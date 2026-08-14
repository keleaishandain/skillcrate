use crate::discover::TrendingCache;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;

pub fn home_dir() -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_default();
    PathBuf::from(home)
}

/// D5（暂定）：兼容 skills-manager 的中央库位置与目录格式。
pub fn repo_root() -> PathBuf {
    home_dir().join(".skills-manager")
}

pub fn skills_dir() -> PathBuf {
    repo_root().join("skills")
}

/// E6：SkillCurator 自身状态全部放自己的目录，绝不写入 skills-manager 的库。
pub fn curator_root() -> PathBuf {
    home_dir().join(".skill-curator")
}

pub fn state_path() -> PathBuf {
    curator_root().join("state.json")
}

pub fn archive_dir() -> PathBuf {
    curator_root().join("archive")
}

pub fn tmp_dir() -> PathBuf {
    curator_root().join("tmp")
}

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct SourceRecord {
    pub source_type: String,
    pub source_ref: String,
}

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct IsolationRecord {
    pub isolated_at: String,
    pub tools: Vec<String>,
}

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct PresetRecord {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub skill_dir_names: Vec<String>,
    pub tools: Vec<String>,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct AuditEntry {
    pub id: String,
    pub action: String,
    pub target: String,
    pub success: bool,
    pub detail: String,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct UpdateRecord {
    pub status: String,
    pub checked_at: String,
    pub added: usize,
    pub modified: usize,
    pub removed: usize,
    pub binary_files: usize,
    pub large_files: usize,
    pub error: String,
}

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct FileCache {
    pub size: u64,
    pub mtime: i64,
    /// 技能名 -> 调用日（epoch day），一次调用一条
    pub counts: HashMap<String, Vec<i64>>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Settings {
    pub similarity_threshold: Option<f64>,
    #[serde(default = "default_auto_sync")]
    pub auto_sync_on_save: bool,
    #[serde(default = "default_quarantine_days")]
    pub quarantine_days: i64,
    #[serde(default)]
    pub claude_binary: String,
}

fn default_auto_sync() -> bool {
    true
}

fn default_quarantine_days() -> i64 {
    30
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            similarity_threshold: Some(0.35),
            auto_sync_on_save: true,
            quarantine_days: 30,
            claude_binary: "claude".to_string(),
        }
    }
}

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct State {
    #[serde(default)]
    pub sources: HashMap<String, SourceRecord>,
    #[serde(default)]
    pub isolated: HashMap<String, IsolationRecord>,
    #[serde(default)]
    pub whitelist: HashSet<String>,
    #[serde(default)]
    pub usage_cache: HashMap<String, FileCache>,
    #[serde(default)]
    pub settings: Settings,
    #[serde(default)]
    pub projects: Vec<String>,
    #[serde(default)]
    pub presets: Vec<PresetRecord>,
    #[serde(default)]
    pub current_preset: Option<String>,
    #[serde(default)]
    pub skill_tags: HashMap<String, Vec<String>>,
    #[serde(default)]
    pub audit_log: Vec<AuditEntry>,
    #[serde(default)]
    pub update_records: HashMap<String, UpdateRecord>,
    #[serde(default)]
    pub trending_cache: Option<TrendingCache>,
    /// D8：语义复核结果缓存（组内容哈希 -> 子组划分）
    #[serde(default)]
    pub judge_cache: HashMap<String, Vec<Vec<usize>>>,
}

pub fn append_audit(state: &mut State, action: &str, target: &str, success: bool, detail: &str) {
    let created_at = chrono::Utc::now().to_rfc3339();
    state.audit_log.push(AuditEntry {
        id: format!("audit-{}", chrono::Utc::now().timestamp_millis()),
        action: action.to_string(),
        target: target.to_string(),
        success,
        detail: detail.to_string(),
        created_at,
    });
    const MAX_AUDIT_ENTRIES: usize = 200;
    if state.audit_log.len() > MAX_AUDIT_ENTRIES {
        let excess = state.audit_log.len() - MAX_AUDIT_ENTRIES;
        state.audit_log.drain(0..excess);
    }
}

pub fn load_state() -> State {
    fs::read_to_string(state_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save_state(state: &State) -> Result<(), String> {
    fs::create_dir_all(curator_root()).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    let path = state_path();
    let tmp_path = path.with_file_name("state.json.tmp");
    fs::write(&tmp_path, json).map_err(|e| e.to_string())?;

    if let Err(first) = fs::rename(&tmp_path, &path) {
        let _ = fs::remove_file(&path);
        fs::rename(&tmp_path, &path)
            .map_err(|second| format!("替换状态文件失败：{first}；重试后：{second}"))?;
    }
    Ok(())
}
