use crate::paths::skills_dir;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;

#[derive(Serialize, Default, Clone)]
pub struct SkillInfo {
    pub dir_name: String,
    pub name: String,
    pub description: String,
    pub source_type: Option<String>,
    pub source_ref: Option<String>,
    pub enabled_tools: Vec<String>,
    pub isolated: bool,
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
        let md = ["SKILL.md", "skill.md", "README.md"]
            .iter()
            .map(|f| path.join(f))
            .find(|p| p.is_file());
        if let Some(md_path) = md {
            if let Ok(text) = fs::read_to_string(&md_path) {
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
            ..Default::default()
        });
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}
