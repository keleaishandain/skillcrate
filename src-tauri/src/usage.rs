use crate::paths::{home_dir, FileCache, State};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;

pub fn today_epoch_day() -> i64 {
    chrono::Utc::now().timestamp() / 86_400
}

fn parse_day(ts: &str) -> Option<i64> {
    chrono::DateTime::parse_from_rfc3339(ts)
        .ok()
        .map(|dt| dt.timestamp() / 86_400)
}

pub struct UsageData {
    /// 技能名 -> 调用日列表（一次调用一条）
    pub per_skill_days: HashMap<String, Vec<i64>>,
    pub files_scanned: usize,
}

/// E5：V1 仅采集 Claude Code 会话日志（~/.claude/projects/*/*.jsonl）中的 Skill 工具调用。
/// 只提取技能名与时间戳，不读取、不存储对话正文（PRD 第 7 节隐私边界）。
/// 增量缓存按 (路径, 大小, mtime) 命中，写回 state.usage_cache。
pub fn collect_usage(state: &mut State) -> UsageData {
    let projects = home_dir().join(".claude").join("projects");
    let mut files: Vec<PathBuf> = Vec::new();
    if let Ok(rd) = fs::read_dir(&projects) {
        for proj in rd.flatten() {
            let p = proj.path();
            if !p.is_dir() {
                continue;
            }
            if let Ok(rd2) = fs::read_dir(&p) {
                for f in rd2.flatten() {
                    let fp = f.path();
                    if fp.extension().map(|e| e == "jsonl").unwrap_or(false) {
                        files.push(fp);
                    }
                }
            }
        }
    }
    let mut alive: HashSet<String> = HashSet::new();
    let mut agg: HashMap<String, Vec<i64>> = HashMap::new();
    let mut scanned = 0usize;
    for fp in &files {
        let key = fp.to_string_lossy().to_string();
        alive.insert(key.clone());
        let Ok(meta) = fs::metadata(fp) else { continue };
        let size = meta.len();
        if size > 300_000_000 {
            continue; // 单文件 300MB 护栏
        }
        let mtime = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        let cache_hit = state
            .usage_cache
            .get(&key)
            .filter(|c| c.size == size && c.mtime == mtime)
            .map(|c| c.counts.clone());
        let counts = match cache_hit {
            Some(c) => c,
            None => {
                let c = scan_file(fp);
                state.usage_cache.insert(
                    key.clone(),
                    FileCache {
                        size,
                        mtime,
                        counts: c.clone(),
                    },
                );
                c
            }
        };
        scanned += 1;
        for (skill, days) in counts {
            agg.entry(skill).or_default().extend(days);
        }
    }
    state.usage_cache.retain(|k, _| alive.contains(k));
    UsageData {
        per_skill_days: agg,
        files_scanned: scanned,
    }
}

fn scan_file(path: &PathBuf) -> HashMap<String, Vec<i64>> {
    let mut out: HashMap<String, Vec<i64>> = HashMap::new();
    let Ok(f) = fs::File::open(path) else {
        return out;
    };
    let reader = BufReader::new(f);
    for line in reader.lines() {
        let Ok(line) = line else { break };
        if !line.contains("\"Skill\"") {
            continue;
        }
        let Ok(v) = serde_json::from_str::<serde_json::Value>(&line) else {
            continue;
        };
        let Some(day) = v
            .get("timestamp")
            .and_then(|t| t.as_str())
            .and_then(parse_day)
        else {
            continue;
        };
        let Some(content) = v
            .get("message")
            .and_then(|m| m.get("content"))
            .and_then(|c| c.as_array())
        else {
            continue;
        };
        for item in content {
            if item.get("type").and_then(|t| t.as_str()) == Some("tool_use")
                && item.get("name").and_then(|n| n.as_str()) == Some("Skill")
            {
                if let Some(skill) = item
                    .get("input")
                    .and_then(|i| i.get("skill"))
                    .and_then(|s| s.as_str())
                {
                    out.entry(skill.to_string()).or_default().push(day);
                }
            }
        }
    }
    out
}
