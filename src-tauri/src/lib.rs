pub mod adoptables;
pub mod cluster;
pub mod curation;
pub mod discover;
pub mod gitops;
pub mod import;
pub mod llm_judge;
pub mod paths;
pub mod presets;
pub mod projects;
pub mod scan;
pub mod sourcesdb;
pub mod sync;
pub mod system;
pub mod tags;
pub mod updates;
pub mod usage;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize)]
struct RepoStatus {
    repo_path: String,
    exists: bool,
    skill_count: usize,
    db_found: bool,
}

/// 库技能 + 来源富化 + 同步/隔离状态（GUI 与 MCP 共用）。
pub fn enriched_skills() -> Result<Vec<scan::SkillInfo>, String> {
    let mut skills = scan::scan_skills()?;
    let state = paths::load_state();
    let db_sources = sourcesdb::load_sources().unwrap_or_default();
    for s in skills.iter_mut() {
        // 本产品自己的导入记录优先，其次读 skills-manager 的索引（E2/E6）
        if let Some(rec) = state.sources.get(&s.dir_name) {
            if !rec.source_type.is_empty() {
                s.source_type = Some(rec.source_type.clone());
            }
            if !rec.source_ref.is_empty() {
                s.source_ref = Some(rec.source_ref.clone());
            }
        } else if let Some((t, r)) = db_sources
            .get(&s.dir_name)
            .or_else(|| db_sources.get(&s.name))
        {
            if !t.is_empty() {
                s.source_type = Some(t.clone());
            }
            if !r.is_empty() {
                s.source_ref = Some(r.clone());
            }
        }
        s.enabled_tools = sync::enabled_tools_for(&s.dir_name);
        s.isolated = state.isolated.contains_key(&s.dir_name);
        s.is_whitelisted = state.whitelist.contains(&s.dir_name);
        s.tags = state.skill_tags.get(&s.dir_name).cloned().unwrap_or_default();
    }
    Ok(skills)
}

#[tauri::command]
fn scan_local_skills() -> Result<Vec<adoptables::LocalSkill>, String> {
    adoptables::scan_local_skills()
}

#[tauri::command]
fn adopt_local_skill(dir_name: String, tool: String) -> Result<(), String> {
    adoptables::adopt_local_skill(&dir_name, &tool)
}

#[tauri::command]
fn list_skills() -> Result<Vec<scan::SkillInfo>, String> {
    enriched_skills()
}

#[tauri::command]
fn group_badges() -> Result<HashMap<String, usize>, String> {
    let state = paths::load_state();
    let threshold = state.settings.similarity_threshold.unwrap_or(0.35);
    let skills = enriched_skills()?;
    let active: Vec<&scan::SkillInfo> = skills.iter().filter(|s| !s.isolated).collect();
    let texts: Vec<String> = active
        .iter()
        .map(|s| format!("{} {}", s.name, s.description))
        .collect();
    let clusters = cluster::cluster(&texts, threshold);
    let mut badges = HashMap::new();
    for group in clusters.groups {
        let count = group.len();
        for index in group {
            badges.insert(active[index].dir_name.clone(), count);
        }
    }
    Ok(badges)
}

#[tauri::command]
fn repo_status() -> RepoStatus {
    let root = paths::repo_root();
    let skill_count = scan::scan_skills().map(|v| v.len()).unwrap_or(0);
    RepoStatus {
        repo_path: root.display().to_string(),
        exists: root.join("skills").is_dir(),
        skill_count,
        db_found: root.join("skills-manager.db").is_file(),
    }
}

#[tauri::command]
async fn import_skill(
    source: String,
    reference: String,
) -> Result<import::ImportOutcome, String> {
    tauri::async_runtime::spawn_blocking(move || match source.as_str() {
        "git" => import::import_git(&reference),
        "local" => import::import_local(&reference),
        "skillssh" => import::import_skillssh(&reference),
        _ => Err(format!("未知来源类型：{source}")),
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn set_skill_tool(dir_name: String, tool: String, enabled: bool) -> Result<Vec<String>, String> {
    let state = paths::load_state();
    if state.isolated.contains_key(&dir_name) {
        return Err("该技能在隔离区中，请先恢复再操作同步".to_string());
    }
    if enabled {
        sync::enable(&dir_name, &tool)?;
    } else {
        sync::disable(&dir_name, &tool)?;
    }
    Ok(sync::enabled_tools_for(&dir_name))
}

#[tauri::command]
fn list_presets() -> Vec<paths::PresetRecord> {
    presets::list()
}

#[tauri::command]
fn save_preset(preset: paths::PresetRecord) -> Result<paths::PresetRecord, String> {
    presets::upsert(preset)
}

#[tauri::command]
fn delete_preset(id: String) -> Result<(), String> {
    presets::delete(&id)
}

#[tauri::command]
fn preview_preset(id: String, tools: Vec<String>) -> Result<presets::PresetPlan, String> {
    presets::preview(&id, tools)
}

#[tauri::command]
fn apply_preset(id: String, tools: Vec<String>) -> Result<presets::BatchResult, String> {
    presets::apply(&id, tools)
}

#[tauri::command]
fn remove_preset(id: String, tools: Vec<String>) -> Result<presets::BatchResult, String> {
    presets::remove(&id, tools)
}

#[tauri::command]
fn workspace_status() -> Vec<sync::ToolWorkspaceStatus> {
    sync::workspace_status()
}

#[tauri::command]
fn set_skill_tags(dir_name: String, tags: Vec<String>) -> Result<Vec<String>, String> {
    update_skill_tags(&dir_name, tags)
}

pub fn update_skill_tags(dir_name: &str, tags: Vec<String>) -> Result<Vec<String>, String> {
    if !paths::skills_dir().join(dir_name).is_dir() {
        return Err(format!("中央技能库中不存在：{dir_name}"));
    }
    let mut normalized: Vec<String> = tags
        .into_iter()
        .map(|tag| tag.trim().to_string())
        .filter(|tag| !tag.is_empty())
        .collect();
    normalized.sort_by_key(|tag| tag.to_lowercase());
    normalized.dedup_by(|left, right| left.eq_ignore_ascii_case(right));
    if normalized.len() > 12 {
        return Err("单个 Skill 最多添加 12 个标签".to_string());
    }
    if let Some(tag) = normalized.iter().find(|tag| tag.chars().count() > 24) {
        return Err(format!("标签不能超过 24 个字符：{tag}"));
    }
    let mut state = paths::load_state();
    state.skill_tags.insert(dir_name.to_string(), normalized.clone());
    paths::append_audit(&mut state, "skill.tags", dir_name, true, &format!("{} 个标签", normalized.len()));
    paths::save_state(&state)?;
    Ok(normalized)
}

#[tauri::command]
fn git_status() -> gitops::GitStatus {
    gitops::status()
}

#[tauri::command]
fn git_create_snapshot(message: String) -> Result<gitops::GitStatus, String> {
    gitops::create_snapshot(&message)
}

#[tauri::command]
fn recent_activity() -> Vec<paths::AuditEntry> {
    let mut entries = paths::load_state().audit_log;
    entries.reverse();
    entries.truncate(40);
    entries
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SettingsView {
    repo_path: String,
    archive_path: String,
    similarity_threshold: f64,
    auto_sync_on_save: bool,
    quarantine_days: i64,
    claude_binary: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SettingsUpdate {
    similarity_threshold: f64,
    auto_sync_on_save: bool,
    quarantine_days: i64,
    claude_binary: String,
}

#[tauri::command]
fn toggle_whitelist(dir_name: String) -> Result<bool, String> {
    let mut state = paths::load_state();
    if !state.whitelist.insert(dir_name.clone()) {
        state.whitelist.remove(&dir_name);
    }
    let enabled = state.whitelist.contains(&dir_name);
    paths::save_state(&state)?;
    Ok(enabled)
}

#[tauri::command]
fn save_skill_content(dir_name: String, content: String) -> Result<(), String> {
    scan::save_skill_content(&dir_name, &content)?;
    let state = paths::load_state();
    if state.settings.auto_sync_on_save {
        for tool in sync::enabled_tools_for(&dir_name) {
            sync::refresh(&dir_name, &tool)
                .map_err(|error| format!("SKILL.md 已保存，但刷新 {tool} 同步副本失败：{error}"))?;
        }
    }
    Ok(())
}

#[tauri::command]
fn sync_skill(dir_name: String) -> Result<Vec<String>, String> {
    let tools = sync::enabled_tools_for(&dir_name);
    for tool in &tools {
        sync::refresh(&dir_name, tool)
            .map_err(|error| format!("刷新 {tool} 同步副本失败：{error}"))?;
    }
    Ok(tools)
}

#[tauri::command]
fn create_skill(
    dir_name: String,
    name: String,
    description: String,
    content: String,
) -> Result<(), String> {
    scan::create_skill(&dir_name, &name, &description, &content)
}

#[tauri::command]
fn get_settings() -> SettingsView {
    let settings = paths::load_state().settings;
    SettingsView {
        repo_path: paths::skills_dir().display().to_string(),
        archive_path: paths::archive_dir().display().to_string(),
        similarity_threshold: settings.similarity_threshold.unwrap_or(0.35),
        auto_sync_on_save: settings.auto_sync_on_save,
        quarantine_days: settings.quarantine_days,
        claude_binary: settings.claude_binary,
    }
}

#[tauri::command]
fn save_settings(settings: SettingsUpdate) -> Result<SettingsView, String> {
    if !(0.05..=0.95).contains(&settings.similarity_threshold) {
        return Err("相似度阈值必须在 0.05 到 0.95 之间".to_string());
    }
    if !(1..=365).contains(&settings.quarantine_days) {
        return Err("隔离保护期必须在 1 到 365 天之间".to_string());
    }
    if settings.claude_binary.trim().is_empty() {
        return Err("Claude CLI 命令或路径不能为空".to_string());
    }
    let mut state = paths::load_state();
    state.settings.similarity_threshold = Some(settings.similarity_threshold);
    state.settings.auto_sync_on_save = settings.auto_sync_on_save;
    state.settings.quarantine_days = settings.quarantine_days;
    state.settings.claude_binary = settings.claude_binary.trim().to_string();
    paths::save_state(&state)?;
    Ok(get_settings())
}

#[tauri::command]
async fn environment_health() -> Result<system::EnvironmentHealth, String> {
    tauri::async_runtime::spawn_blocking(system::environment_health)
        .await
        .map_err(|error| format!("环境探测任务失败：{error}"))
}

#[tauri::command]
async fn analyze(threshold: Option<f64>) -> Result<curation::CurationReport, String> {
    tauri::async_runtime::spawn_blocking(move || curation::analyze(threshold))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn trending(force: Option<bool>) -> Result<discover::TrendingView, String> {
    tauri::async_runtime::spawn_blocking(move || discover::trending(force.unwrap_or(false)))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn isolate_skill(dir_name: String) -> Result<(), String> {
    curation::isolate(&dir_name)
}

#[tauri::command]
fn restore_skill(dir_name: String) -> Result<(), String> {
    curation::restore(&dir_name)
}

#[tauri::command]
fn archive_skill(dir_name: String) -> Result<(), String> {
    curation::archive(&dir_name)
}

#[tauri::command]
fn isolation_list() -> Result<Vec<curation::IsolationEntry>, String> {
    curation::isolation_list()
}

#[tauri::command]
fn list_projects() -> Result<Vec<projects::ProjectInfo>, String> {
    projects::list_projects()
}

#[tauri::command]
fn add_project(path: String) -> Result<(), String> {
    projects::add_project(&path)
}

#[tauri::command]
fn remove_project(path: String) -> Result<(), String> {
    projects::remove_project(&path)
}

#[tauri::command]
fn project_add_skill(project: String, dir_name: String, tool: String) -> Result<(), String> {
    projects::project_add_skill(&project, &dir_name, &tool)
}

#[tauri::command]
fn project_remove_skill(project: String, dir_name: String, tool: String) -> Result<(), String> {
    projects::project_remove_skill(&project, &dir_name, &tool)
}

#[tauri::command]
fn adopt_project_skill(project: String, dir_name: String, tool: String) -> Result<(), String> {
    projects::adopt_project_skill(&project, &dir_name, &tool)
}

#[tauri::command]
fn project_promote_skill(project: String, dir_name: String, tool: String) -> Result<(), String> {
    projects::project_promote_skill(&project, &dir_name, &tool)
}

#[tauri::command]
fn project_pull_skill(project: String, dir_name: String, tool: String) -> Result<(), String> {
    projects::project_pull_skill(&project, &dir_name, &tool)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_skills,
            scan_local_skills,
            adopt_local_skill,
            group_badges,
            repo_status,
            list_presets,
            save_preset,
            delete_preset,
            preview_preset,
            apply_preset,
            remove_preset,
            workspace_status,
            set_skill_tags,
            git_status,
            git_create_snapshot,
            recent_activity,
            import_skill,
            set_skill_tool,
            toggle_whitelist,
            save_skill_content,
            sync_skill,
            create_skill,
            get_settings,
            save_settings,
            environment_health,
            analyze,
            trending,
            isolate_skill,
            restore_skill,
            archive_skill,
            isolation_list,
            list_projects,
            add_project,
            remove_project,
            project_add_skill,
            project_remove_skill,
            adopt_project_skill,
            project_promote_skill,
            project_pull_skill
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
