pub mod adoptables;
pub mod cluster;
pub mod curation;
pub mod discover;
pub mod import;
pub mod llm_judge;
pub mod paths;
pub mod projects;
pub mod scan;
pub mod sourcesdb;
pub mod sync;
pub mod usage;

use serde::Serialize;
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
            import_skill,
            set_skill_tool,
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
            adopt_project_skill
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
