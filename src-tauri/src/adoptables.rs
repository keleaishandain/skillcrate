use crate::paths::{load_state, save_state, skills_dir, SourceRecord};
use crate::scan;
use crate::sync;
use serde::Serialize;
use std::fs;
use std::path::{Component, Path, PathBuf};

#[derive(Serialize)]
pub struct LocalSkill {
    pub dir_name: String,
    pub name: String,
    pub description: String,
    pub tool: String,
    pub path: String,
    pub in_library: bool,
}

fn valid_dir_name(dir_name: &str) -> Result<(), String> {
    let trimmed = dir_name.trim();
    let path = Path::new(trimmed);
    if trimmed.is_empty()
        || path.components().count() != 1
        || !matches!(path.components().next(), Some(Component::Normal(_)))
    {
        return Err("技能目录名必须是单一目录名".to_string());
    }
    Ok(())
}

fn scan_tool(tool: &str, root: &Path) -> Result<Vec<LocalSkill>, String> {
    let entries = fs::read_dir(root).map_err(|e| format!("读取 {} 失败：{e}", root.display()))?;
    let mut skills = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let dir_name = entry.file_name().to_string_lossy().to_string();
        if dir_name.starts_with('.') {
            continue;
        }
        // 自动发现只认含 SKILL.md 的目录，避免 scripts/ 等杂项目录混入收编列表（监督者补丁）
        let md_path = [path.join("SKILL.md"), path.join("skill.md")]
            .into_iter()
            .find(|p| p.is_file());
        let Some(md_path) = md_path else {
            continue;
        };
        let mut name = dir_name.clone();
        let mut description = String::new();
        if let Ok(text) = fs::read_to_string(md_path) {
            let frontmatter = scan::parse_frontmatter(&text);
            if let Some(value) = frontmatter.get("name").filter(|v| !v.is_empty()) {
                name = value.clone();
            }
            if let Some(value) = frontmatter.get("description") {
                description = value.clone();
            }
        }
        skills.push(LocalSkill {
            dir_name: dir_name.clone(),
            name,
            description,
            tool: tool.to_string(),
            path: path.to_string_lossy().to_string(),
            in_library: skills_dir().join(dir_name).is_dir(),
        });
    }
    Ok(skills)
}

pub fn scan_local_skills() -> Result<Vec<LocalSkill>, String> {
    let mut skills = Vec::new();
    for tool in sync::all_tools() {
        let Some(root) = sync::tool_skills_dir(tool) else {
            continue;
        };
        if !root.is_dir() {
            continue;
        }
        if let Ok(mut found) = scan_tool(tool, &root) {
            skills.append(&mut found);
        }
    }
    skills.sort_by(|a, b| {
        a.in_library
            .cmp(&b.in_library)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(skills)
}

fn checked_source(tool: &str, dir_name: &str) -> Result<(PathBuf, PathBuf), String> {
    valid_dir_name(dir_name)?;
    let root = sync::tool_skills_dir(tool).ok_or_else(|| format!("未知工具 {tool}"))?;
    let canonical_root = fs::canonicalize(&root)
        .map_err(|e| format!("工具技能目录不存在：{}：{e}", root.display()))?;
    if !canonical_root.is_dir() {
        return Err(format!("工具技能路径不是目录：{}", canonical_root.display()));
    }
    let source = root.join(dir_name.trim());
    let canonical_source = fs::canonicalize(&source)
        .map_err(|e| format!("本机技能目录不存在：{}：{e}", source.display()))?;
    if canonical_source == canonical_root || !canonical_source.starts_with(&canonical_root) {
        return Err("拒绝访问工具技能目录之外的路径".to_string());
    }
    if !canonical_source.is_dir() {
        return Err(format!("本机技能路径不是目录：{}", canonical_source.display()));
    }
    Ok((canonical_root, canonical_source))
}

pub fn adopt_local_skill(dir_name: &str, tool: &str) -> Result<(), String> {
    let (_, source) = checked_source(tool, dir_name)?;
    let destination = skills_dir().join(dir_name.trim());
    if destination.exists() {
        return Err("库中已存在".to_string());
    }
    fs::create_dir_all(skills_dir()).map_err(|e| format!("创建中央库目录失败：{e}"))?;
    sync::copy_dir_all(&source, &destination).map_err(|e| format!("收编本机技能失败：{e}"))?;
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
