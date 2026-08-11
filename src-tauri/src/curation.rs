use crate::cluster;
use crate::llm_judge;
use crate::paths::{archive_dir, load_state, save_state, skills_dir, IsolationRecord};
use crate::scan;
use crate::sync;
use crate::usage;
use serde::Serialize;
use std::fs;

const WINDOW_DAYS: i64 = 90;
const SHARE_LIMIT: f64 = 0.15;
const COLD_IMPORT_DAYS: i64 = 30;
const COLD_GROUP_CALLS: u64 = 10;
const ISOLATION_DAYS: i64 = 30;
const DEFAULT_THRESHOLD: f64 = 0.35;

#[derive(Serialize)]
pub struct MemberReport {
    pub dir_name: String,
    pub name: String,
    pub count_90d: u64,
    pub last_used_days: Option<i64>,
    pub share: f64,
    /// keep | normal | suggest | observing
    pub verdict: String,
}

#[derive(Serialize)]
pub struct GroupReport {
    pub keywords: Vec<String>,
    pub total_calls_90d: u64,
    pub observing: bool,
    pub members: Vec<MemberReport>,
}

#[derive(Serialize)]
pub struct CurationReport {
    pub groups: Vec<GroupReport>,
    pub grouped_count: usize,
    pub ungrouped_count: usize,
    pub isolated_count: usize,
    pub files_scanned: usize,
    pub window_days: i64,
    pub threshold: f64,
    pub data_source: String,
    pub generated_at: String,
    /// D8：语义复核状态说明（复核了几组/缓存命中/失败回退）
    pub judge_note: String,
}

fn dir_age_days(dir_name: &str, today: i64) -> Option<i64> {
    let meta = fs::metadata(skills_dir().join(dir_name)).ok()?;
    let created = meta.created().ok()?;
    let day = created
        .duration_since(std::time::UNIX_EPOCH)
        .ok()?
        .as_secs() as i64
        / 86_400;
    Some(today - day)
}

/// D4 定稿口径的完整实现：两段式（先分组后裁决）+ 冷启动保护。
pub fn analyze(threshold_override: Option<f64>) -> Result<CurationReport, String> {
    let mut state = load_state();
    if let Some(t) = threshold_override {
        state.settings.similarity_threshold = Some(t.clamp(0.05, 0.95));
    }
    let threshold = state
        .settings
        .similarity_threshold
        .unwrap_or(DEFAULT_THRESHOLD);
    let skills = scan::scan_skills()?;
    let today = usage::today_epoch_day();
    // 隔离中的技能不参与判定
    let active: Vec<&scan::SkillInfo> = skills
        .iter()
        .filter(|s| !state.isolated.contains_key(&s.dir_name))
        .collect();
    let texts: Vec<String> = active
        .iter()
        .map(|s| format!("{} {}", s.name, s.description))
        .collect();
    let clusters = cluster::cluster(&texts, threshold);
    // D8：LLM 语义复核——把词法候选组拆成真正"抢同一个活"的子组。
    // CLI 失败的组按词法原样保留（宁可保守不丢展示），refined 元素 = (全局下标组, 词法父组序号)。
    let mut refined: Vec<(Vec<usize>, usize)> = Vec::new();
    let mut judged = 0usize;
    let mut cache_hits = 0usize;
    let mut failed = 0usize;
    let mut split_added = 0usize;
    let mut dissolved = 0usize;
    for (gi, g) in clusters.groups.iter().enumerate() {
        let items: Vec<(String, String)> = g
            .iter()
            .map(|&i| (active[i].name.clone(), active[i].description.clone()))
            .collect();
        match llm_judge::judge_group(&mut state, &items) {
            Ok(outcome) => {
                judged += 1;
                if outcome.from_cache {
                    cache_hits += 1;
                }
                let mut kept = 0usize;
                for sub in outcome.subgroups {
                    if sub.len() >= 2 {
                        refined.push((sub.into_iter().map(|k| g[k]).collect(), gi));
                        kept += 1;
                    }
                }
                if kept > 1 {
                    split_added += kept - 1;
                }
                if kept == 0 {
                    dissolved += 1; // 全组被判为各干各的活，解散
                }
            }
            Err(_) => {
                failed += 1;
                refined.push((g.clone(), gi));
            }
        }
    }
    let judge_note = if clusters.groups.is_empty() {
        "无候选组，无需语义复核".to_string()
    } else if judged == 0 {
        "语义复核不可用（claude CLI 调用失败），本报告按词法分组展示".to_string()
    } else {
        format!(
            "语义复核 {judged} 组（缓存命中 {cache_hits}，失败回退 {failed}，拆分新增 {split_added} 组，解散误报 {dissolved} 组）"
        )
    };
    let usage_data = usage::collect_usage(&mut state);
    let cutoff = today - WINDOW_DAYS;
    let stat = |s: &scan::SkillInfo| -> (u64, Option<i64>) {
        let days = usage_data
            .per_skill_days
            .get(&s.name)
            .or_else(|| usage_data.per_skill_days.get(&s.dir_name));
        match days {
            None => (0, None),
            Some(ds) => {
                let count = ds.iter().filter(|&&d| d >= cutoff).count() as u64;
                let last = ds.iter().max().map(|&d| (today - d).max(0));
                (count, last)
            }
        }
    };
    let mut groups = Vec::new();
    let mut grouped_count = 0usize;
    for (g, parent) in refined.iter() {
        grouped_count += g.len();
        let stats: Vec<(u64, Option<i64>)> = g.iter().map(|&i| stat(active[i])).collect();
        let total: u64 = stats.iter().map(|(c, _)| *c).sum();
        let has_cold_member = g.iter().any(|&i| {
            dir_age_days(&active[i].dir_name, today)
                .map(|a| a < COLD_IMPORT_DAYS)
                .unwrap_or(false)
        });
        let observing = has_cold_member || total < COLD_GROUP_CALLS;
        let max_count = stats.iter().map(|(c, _)| *c).max().unwrap_or(0);
        let mut members = Vec::new();
        for (k, &i) in g.iter().enumerate() {
            let (count, last) = stats[k];
            let share = if total > 0 {
                count as f64 / total as f64
            } else {
                0.0
            };
            let verdict = if observing {
                "observing"
            } else if count == max_count && max_count > 0 {
                "keep" // 组内份额最高者永不标记
            } else if share < SHARE_LIMIT && count <= 1 {
                "suggest"
            } else {
                "normal"
            };
            members.push(MemberReport {
                dir_name: active[i].dir_name.clone(),
                name: active[i].name.clone(),
                count_90d: count,
                last_used_days: last,
                share,
                verdict: verdict.to_string(),
            });
        }
        members.sort_by(|a, b| b.count_90d.cmp(&a.count_90d));
        groups.push(GroupReport {
            keywords: clusters.keywords[*parent].clone(),
            total_calls_90d: total,
            observing,
            members,
        });
    }
    save_state(&state)?;
    Ok(CurationReport {
        groups,
        grouped_count,
        ungrouped_count: active.len().saturating_sub(grouped_count),
        isolated_count: state.isolated.len(),
        files_scanned: usage_data.files_scanned,
        window_days: WINDOW_DAYS,
        threshold,
        data_source: "Claude Code 会话日志（Codex 采集在 V1.1 加入）".to_string(),
        generated_at: chrono::Local::now().format("%Y-%m-%d %H:%M").to_string(),
        judge_note,
    })
}

#[derive(Serialize)]
pub struct IsolationEntry {
    pub dir_name: String,
    pub name: String,
    pub isolated_at: String,
    pub days_left: i64,
    pub expired: bool,
    pub tools: Vec<String>,
}

/// 隔离：从所有 agent 目录撤下，记录原同步状态；中央库文件保留（永不删除）。
pub fn isolate(dir_name: &str) -> Result<(), String> {
    let mut state = load_state();
    if state.isolated.contains_key(dir_name) {
        return Ok(());
    }
    let tools = sync::enabled_tools_for(dir_name);
    for t in &tools {
        sync::disable(dir_name, t)?;
    }
    state.isolated.insert(
        dir_name.to_string(),
        IsolationRecord {
            isolated_at: chrono::Local::now().format("%Y-%m-%d").to_string(),
            tools,
        },
    );
    save_state(&state)
}

/// 恢复：原同步状态原样重建（恢复是安全方向，不设确认）。
pub fn restore(dir_name: &str) -> Result<(), String> {
    let mut state = load_state();
    let Some(rec) = state.isolated.remove(dir_name) else {
        return Err("该技能不在隔离区".to_string());
    };
    for t in &rec.tools {
        sync::enable(dir_name, t)?;
    }
    save_state(&state)
}

/// E8：归档 = 移出中央库到 ~/.skill-curator/archive/，产品永不执行真删除。
pub fn archive(dir_name: &str) -> Result<(), String> {
    let mut state = load_state();
    let src = skills_dir().join(dir_name);
    if src.exists() {
        fs::create_dir_all(archive_dir()).map_err(|e| e.to_string())?;
        let mut dst = archive_dir().join(dir_name);
        if dst.exists() {
            dst = archive_dir().join(format!(
                "{dir_name}-{}",
                chrono::Local::now().format("%Y%m%d%H%M%S")
            ));
        }
        fs::rename(&src, &dst).map_err(|e| format!("归档移动失败：{e}"))?;
    }
    state.isolated.remove(dir_name);
    save_state(&state)
}

pub fn isolation_list() -> Result<Vec<IsolationEntry>, String> {
    let state = load_state();
    let names: std::collections::HashMap<String, String> = scan::scan_skills()
        .unwrap_or_default()
        .into_iter()
        .map(|s| (s.dir_name.clone(), s.name))
        .collect();
    let today = chrono::Local::now().date_naive();
    let mut out = Vec::new();
    for (dir, rec) in &state.isolated {
        let elapsed = chrono::NaiveDate::parse_from_str(&rec.isolated_at, "%Y-%m-%d")
            .map(|d| (today - d).num_days())
            .unwrap_or(0);
        out.push(IsolationEntry {
            dir_name: dir.clone(),
            name: names.get(dir).cloned().unwrap_or_else(|| dir.clone()),
            isolated_at: rec.isolated_at.clone(),
            days_left: (ISOLATION_DAYS - elapsed).max(0),
            expired: elapsed >= ISOLATION_DAYS,
            tools: rec.tools.clone(),
        });
    }
    out.sort_by(|a, b| a.days_left.cmp(&b.days_left));
    Ok(out)
}
