use crate::discover::TrendingCache;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
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
pub struct FileCache {
    pub size: u64,
    pub mtime: i64,
    /// 技能名 -> 调用日（epoch day），一次调用一条
    pub counts: HashMap<String, Vec<i64>>,
}

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct Settings {
    pub similarity_threshold: Option<f64>,
}

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct State {
    #[serde(default)]
    pub sources: HashMap<String, SourceRecord>,
    #[serde(default)]
    pub isolated: HashMap<String, IsolationRecord>,
    #[serde(default)]
    pub usage_cache: HashMap<String, FileCache>,
    #[serde(default)]
    pub settings: Settings,
    #[serde(default)]
    pub projects: Vec<String>,
    #[serde(default)]
    pub trending_cache: Option<TrendingCache>,
    /// D8：语义复核结果缓存（组内容哈希 -> 子组划分）
    #[serde(default)]
    pub judge_cache: HashMap<String, Vec<Vec<usize>>>,
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
