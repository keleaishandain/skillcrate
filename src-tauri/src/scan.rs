use crate::paths::skills_dir;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::{Component, Path, PathBuf};

#[derive(Serialize, Default, Clone)]
pub struct SkillInfo {
    pub dir_name: String,
    pub name: String,
    pub description: String,
    pub source_type: Option<String>,
    pub source_ref: Option<String>,
    pub enabled_tools: Vec<String>,
    pub isolated: bool,
    pub content_md: String,
    pub is_whitelisted: bool,
    pub tags: Vec<String>,
}

fn unquote(s: &str) -> String {
    let t = s.trim();
    if t.len() >= 2
        && ((t.starts_with('"') && t.ends_with('"')) || (t.starts_with('\'') && t.ends_with('\'')))
    {
        t[1..t.len() - 1].to_string()
    } else {
        t.to_string()
    }
}

fn valid_dir_name(dir_name: &str) -> Result<&str, String> {
    let trimmed = dir_name.trim();
    let path = Path::new(trimmed);
    if trimmed.is_empty()
        || path.components().count() != 1
        || !matches!(path.components().next(), Some(Component::Normal(_)))
    {
        return Err("技能目录名必须是单一目录名".to_string());
    }
    Ok(trimmed)
}

fn skill_markdown_path(dir_name: &str) -> Result<PathBuf, String> {
    let dir_name = valid_dir_name(dir_name)?;
    let root = skills_dir();
    let directory = root.join(dir_name);
    if !directory.is_dir() {
        return Err(format!("中央库中不存在技能：{dir_name}"));
    }
    ["SKILL.md", "skill.md"]
        .iter()
        .map(|name| directory.join(name))
        .find(|path| path.is_file())
        .ok_or_else(|| format!("技能 {dir_name} 缺少 SKILL.md"))
}

pub fn save_skill_content(dir_name: &str, content: &str) -> Result<(), String> {
    if content.trim().is_empty() {
        return Err("SKILL.md 内容不能为空".to_string());
    }
    let path = skill_markdown_path(dir_name)?;
    fs::write(&path, content).map_err(|error| format!("写入 {} 失败：{error}", path.display()))
}

pub fn create_skill(
    dir_name: &str,
    name: &str,
    description: &str,
    content: &str,
) -> Result<(), String> {
    let dir_name = valid_dir_name(dir_name)?;
    if name.trim().is_empty() {
        return Err("技能名称不能为空".to_string());
    }
    let destination = skills_dir().join(dir_name);
    if destination.exists() {
        return Err(format!("中央库中已存在技能：{dir_name}"));
    }
    fs::create_dir_all(&destination)
        .map_err(|error| format!("创建技能目录 {} 失败：{error}", destination.display()))?;
    let body = if content.trim_start().starts_with("---") {
        content.to_string()
    } else {
        format!(
            "---\nname: {}\ndescription: {}\n---\n\n{}\n",
            name.trim(),
            description.trim(),
            content.trim()
        )
    };
    let path = destination.join("SKILL.md");
    if let Err(error) = fs::write(&path, body) {
        let _ = fs::remove_dir(&destination);
        return Err(format!("写入 {} 失败：{error}", path.display()));
    }
    Ok(())
}

/// 轻量 YAML frontmatter 解析：顶层 `key: value`，支持折叠/字面块与缩进续行。
pub fn parse_frontmatter(text: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let mut lines = text.lines();
    match lines.next() {
        Some(l) if l.trim() == "---" => {}
        _ => return map,
    }
    let mut current_key: Option<String> = None;
    let mut current_val = String::new();
    for line in lines {
        if line.trim() == "---" {
            break;
        }
        let indent = line.len() - line.trim_start().len();
        if indent == 0 && line.contains(':') {
            if let Some(k) = current_key.take() {
                map.insert(k, unquote(&current_val));
            }
            current_val = String::new();
            let mut parts = line.splitn(2, ':');
            let key = parts.next().unwrap_or("").trim().to_string();
            let raw = parts.next().unwrap_or("").trim();
            let cleaned = if matches!(raw, ">" | ">-" | "|" | "|-") { "" } else { raw };
            current_key = Some(key);
            current_val.push_str(cleaned);
        } else if indent > 0 && current_key.is_some() && !line.trim().is_empty() {
            if !current_val.is_empty() {
                current_val.push(' ');
            }
            current_val.push_str(line.trim());
        }
    }
    if let Some(k) = current_key.take() {
        map.insert(k, unquote(&current_val));
    }
    map
}

pub fn scan_skills() -> Result<Vec<SkillInfo>, String> {
    let root = skills_dir();
    let entries = fs::read_dir(&root)
        .map_err(|e| format!("无法读取技能目录 {}：{}", root.display(), e))?;
    let mut out = Vec::new();
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
        let md = ["SKILL.md", "skill.md", "README.md"]
            .iter()
            .map(|f| path.join(f))
            .find(|p| p.is_file());
        if let Some(md_path) = md {
            if let Ok(text) = fs::read_to_string(&md_path) {
                content_md = text.clone();
                let fm = parse_frontmatter(&text);
                if let Some(n) = fm.get("name") {
                    if !n.is_empty() {
                        name = n.clone();
                    }
                }
                if let Some(d) = fm.get("description") {
                    description = d.clone();
                }
            }
        }
        out.push(SkillInfo {
            dir_name,
            name,
            description,
            content_md,
            ..Default::default()
        });
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}
