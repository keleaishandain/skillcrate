use crate::paths::{load_state, save_state, skills_dir, SourceRecord};
use crate::scan;
use crate::sync;
use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Component, Path, PathBuf};

#[derive(Serialize)]
pub struct ProjectInfo {
    pub path: String,
    pub exists: bool,
    pub skills: Vec<ProjectSkill>,
    /// 单项目扫描失败时的降级信息（WO-7）：不连累其他项目
    pub error: Option<String>,
}

#[derive(Serialize)]
pub struct ProjectSkill {
    pub dir_name: String,
    pub name: String,
    pub description: String,
    pub tool: String,
    pub in_library: bool,
    pub content_md: String,
    pub has_diff: bool,
    pub sync_status: String,
}

fn project_tool_skills_dir(project: &Path, tool: &str) -> Result<PathBuf, String> {
    match tool {
        "claude_code" => Ok(project.join(".claude").join("skills")),
        "codex" => Ok(project.join(".codex").join("skills")),
        _ => Err(format!("未知工具 {tool}")),
    }
}

fn canonical_project(path: &str) -> Result<PathBuf, String> {
    let raw = path.trim();
    if raw.is_empty() {
        return Err("项目路径不能为空".to_string());
    }
    let project = fs::canonicalize(raw).map_err(|e| format!("项目目录不存在：{raw}：{e}"))?;
    if !project.is_dir() {
        return Err(format!("项目路径不是目录：{}", project.display()));
    }
    Ok(project)
}

fn registry_path(path: &str) -> PathBuf {
    let p = PathBuf::from(path.trim());
    if p.is_absolute() {
        p
    } else {
        std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join(p)
    }
}

fn normalized_path_string(path: &Path) -> String {
    let value = path.to_string_lossy().to_string();
    #[cfg(windows)]
    {
        if let Some(rest) = value.strip_prefix(r"\\?\UNC\") {
            return format!(r"\\{rest}");
        }
        if let Some(rest) = value.strip_prefix(r"\\?\") {
            return rest.to_string();
        }
    }
    value
}

fn registry_key(path: &str) -> String {
    let path = fs::canonicalize(path).unwrap_or_else(|_| registry_path(path));
    let key = normalized_path_string(&path);
    #[cfg(windows)]
    {
        return key.to_lowercase();
    }
    #[cfg(not(windows))]
    key
}

fn valid_dir_name(dir_name: &str) -> Result<(), String> {
    let path = Path::new(dir_name.trim());
    if dir_name.trim().is_empty()
        || path.components().count() != 1
        || !matches!(path.components().next(), Some(Component::Normal(_)))
    {
        return Err("技能目录名必须是单一目录名".to_string());
    }
    Ok(())
}

fn checked_tool_root(project: &Path, tool: &str, create: bool) -> Result<PathBuf, String> {
    let root = project_tool_skills_dir(project, tool)?;
    if create {
        fs::create_dir_all(&root).map_err(|e| format!("创建项目技能目录失败：{}：{e}", root.display()))?;
    }
    let canonical_root = fs::canonicalize(&root)
        .map_err(|e| format!("项目工具技能目录不存在：{}：{e}", root.display()))?;
    if !canonical_root.is_dir() {
        return Err(format!("项目工具技能路径不是目录：{}", canonical_root.display()));
    }
    if !canonical_root.starts_with(project) {
        return Err("项目工具技能目录不在项目目录内".to_string());
    }
    Ok(canonical_root)
}

fn checked_project_skill(
    project: &str,
    dir_name: &str,
    tool: &str,
) -> Result<(PathBuf, PathBuf), String> {
    valid_dir_name(dir_name)?;
    let project = canonical_project(project)?;
    let root = checked_tool_root(&project, tool, false)?;
    let target = root.join(dir_name.trim());
    let canonical_target = fs::canonicalize(&target)
        .map_err(|e| format!("项目技能目录不存在：{}：{e}", target.display()))?;
    if canonical_target == root || !canonical_target.starts_with(&root) {
        return Err("拒绝访问项目工具技能目录之外的路径".to_string());
    }
    // canonical 路径只用于校验；实际操作保留原始路径，避免删除符号链接指向的目录。
    Ok((root, target))
}

fn scan_project_tool(project: &Path, tool: &str) -> Result<Vec<ProjectSkill>, String> {
    let root = project_tool_skills_dir(project, tool)?;
    let entries = match fs::read_dir(&root) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(format!("读取项目技能目录失败：{}：{error}", root.display())),
    };
    let mut skills = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let dir_name = entry.file_name().to_string_lossy().to_string();
        if dir_name.starts_with('.') {
            continue;
        }
        let mut name = dir_name.clone();
        let mut description = String::new();
        let mut content_md = String::new();
        let md_path = path.join("SKILL.md");
        if let Ok(text) = fs::read_to_string(&md_path) {
            content_md = text.clone();
            let frontmatter = scan::parse_frontmatter(&text);
            if let Some(value) = frontmatter.get("name").filter(|v| !v.is_empty()) {
                name = value.clone();
            }
            if let Some(value) = frontmatter.get("description") {
                description = value.clone();
            }
        }
        let library_path = skills_dir().join(&dir_name).join("SKILL.md");
        let in_library = library_path.is_file();
        let has_diff = in_library
            && fs::read_to_string(&library_path)
                .map(|library_content| library_content != content_md)
                .unwrap_or(false);
        let sync_status = if !in_library {
            "project_only"
        } else if !has_diff {
            "in_sync"
        } else {
            let project_modified = fs::metadata(&md_path).and_then(|meta| meta.modified()).ok();
            let center_modified = fs::metadata(&library_path).and_then(|meta| meta.modified()).ok();
            match (project_modified, center_modified) {
                (Some(project_time), Some(center_time)) => {
                    let tolerance = std::time::Duration::from_secs(1);
                    if project_time.duration_since(center_time).map(|delta| delta > tolerance).unwrap_or(false) {
                        "project_newer"
                    } else if center_time.duration_since(project_time).map(|delta| delta > tolerance).unwrap_or(false) {
                        "center_newer"
                    } else {
                        "diverged"
                    }
                }
                _ => "diverged",
            }
        }
        .to_string();
        skills.push(ProjectSkill {
            dir_name: dir_name.clone(),
            name,
            description,
            tool: tool.to_string(),
            in_library,
            content_md,
            has_diff,
            sync_status,
        });
    }
    skills.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(skills)
}

pub fn list_projects() -> Result<Vec<ProjectInfo>, String> {
    let state = load_state();
    let mut projects = Vec::new();
    for path in state.projects {
        let project = PathBuf::from(&path);
        let exists = project.is_dir();
        let (skills, error) = if exists {
            let mut collected = Vec::new();
            let mut problems = Vec::new();
            for tool in ["claude_code", "codex"] {
                match scan_project_tool(&project, tool) {
                    Ok(mut s) => collected.append(&mut s),
                    Err(e) => problems.push(e),
                }
            }
            let error = if problems.is_empty() {
                None
            } else {
                Some(problems.join("；"))
            };
            (collected, error)
        } else {
            (Vec::new(), None)
        };
        projects.push(ProjectInfo {
            path,
            exists,
            skills,
            error,
        });
    }
    Ok(projects)
}

pub fn add_project(path: &str) -> Result<(), String> {
    let project = canonical_project(path)?;
    let project_path = normalized_path_string(&project);
    let project_key = registry_key(&project_path);
    let mut state = load_state();
    let mut seen = HashSet::new();
    state.projects.retain(|item| seen.insert(registry_key(item)));
    if !state
        .projects
        .iter()
        .any(|item| registry_key(item) == project_key)
    {
        state.projects.push(project_path);
    }
    save_state(&state)
}

pub fn remove_project(path: &str) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("项目路径不能为空".to_string());
    }
    let key = registry_key(path);
    let mut state = load_state();
    state.projects.retain(|item| registry_key(item) != key);
    save_state(&state)
}

pub fn project_add_skill(project: &str, dir_name: &str, tool: &str) -> Result<(), String> {
    valid_dir_name(dir_name)?;
    let project = canonical_project(project)?;
    let source = skills_dir().join(dir_name.trim());
    if !source.is_dir() {
        return Err(format!("中央库中不存在技能：{dir_name}"));
    }
    let root = checked_tool_root(&project, tool, true)?;
    let destination = root.join(dir_name.trim());
    if destination.exists() {
        return Ok(());
    }
    sync::copy_dir_all(&source, &destination)
        .map_err(|e| format!("复制技能到项目失败：{}：{e}", destination.display()))
}

pub fn project_remove_skill(project: &str, dir_name: &str, tool: &str) -> Result<(), String> {
    let (_, target) = checked_project_skill(project, dir_name, tool)?;
    sync::force_remove_dir_all(&target)
}

pub fn adopt_project_skill(project: &str, dir_name: &str, tool: &str) -> Result<(), String> {
    let (_, source) = checked_project_skill(project, dir_name, tool)?;
    let destination = skills_dir().join(dir_name.trim());
    if destination.exists() {
        return Err("库中已存在".to_string());
    }
    fs::create_dir_all(skills_dir()).map_err(|e| format!("创建中央库目录失败：{e}"))?;
    sync::copy_dir_all(&source, &destination)
        .map_err(|e| format!("收编项目技能失败：{e}"))?;
    let mut state = load_state();
    state.sources.insert(
        dir_name.trim().to_string(),
        SourceRecord {
            source_type: "local".to_string(),
            source_ref: source.to_string_lossy().to_string(),
        },
    );
    save_state(&state)
}

pub fn project_promote_skill(project: &str, dir_name: &str, tool: &str) -> Result<(), String> {
    let (_, source) = checked_project_skill(project, dir_name, tool)?;
    let source_file = source.join("SKILL.md");
    if !source_file.is_file() {
        return Err(format!("项目技能缺少 SKILL.md：{}", source.display()));
    }
    let destination = skills_dir().join(dir_name).join("SKILL.md");
    if !destination.is_file() {
        return Err(format!("中央库中不存在技能：{dir_name}"));
    }
    let content = fs::read_to_string(&source_file)
        .map_err(|error| format!("读取项目技能失败：{}：{error}", source_file.display()))?;
    fs::write(&destination, content)
        .map_err(|error| format!("写入中央技能失败：{}：{error}", destination.display()))
}

pub fn project_pull_skill(project: &str, dir_name: &str, tool: &str) -> Result<(), String> {
    let (_, destination) = checked_project_skill(project, dir_name, tool)?;
    let source = skills_dir().join(dir_name).join("SKILL.md");
    if !source.is_file() {
        return Err(format!("中央库中不存在技能：{dir_name}"));
    }
    let destination_file = destination.join("SKILL.md");
    if !destination_file.is_file() {
        return Err(format!("项目技能缺少 SKILL.md：{}", destination.display()));
    }
    let content = fs::read_to_string(&source)
        .map_err(|error| format!("读取中央技能失败：{}：{error}", source.display()))?;
    fs::write(&destination_file, content).map_err(|error| {
        format!(
            "写入项目技能失败：{}：{error}",
            destination_file.display()
        )
    })
}
