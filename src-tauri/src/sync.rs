use crate::paths::{home_dir, skills_dir};
use serde::Serialize;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
pub struct WorkspaceSkill {
    pub dir_name: String,
    pub managed: bool,
}

#[derive(Serialize)]
pub struct ToolWorkspaceStatus {
    pub tool: String,
    pub label: String,
    pub path: String,
    pub exists: bool,
    pub total_skills: usize,
    pub managed_skills: usize,
    pub unmanaged_skills: usize,
    pub skills: Vec<WorkspaceSkill>,
}

/// E9：V1 支持的工具及其技能目录。
pub fn all_tools() -> Vec<&'static str> {
    vec!["claude_code", "codex", "opencode"]
}

pub fn tool_skills_dir(tool: &str) -> Option<PathBuf> {
    match tool {
        "claude_code" => Some(home_dir().join(".claude").join("skills")),
        "codex" => Some(home_dir().join(".codex").join("skills")),
        "opencode" => Some(
            home_dir()
                .join(".config")
                .join("opencode")
                .join("skills"),
        ),
        _ => None,
    }
}

pub fn enabled_tools_for(dir_name: &str) -> Vec<String> {
    all_tools()
        .into_iter()
        .filter(|t| {
            tool_skills_dir(t)
                .map(|d| d.join(dir_name).exists())
                .unwrap_or(false)
        })
        .map(|t| t.to_string())
        .collect()
}

pub fn copy_dir_all(src: &Path, dst: &Path) -> io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let to = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &to)?;
        } else {
            fs::copy(entry.path(), &to)?;
        }
    }
    Ok(())
}

fn clear_readonly(path: &Path) {
    if let Ok(meta) = fs::symlink_metadata(path) {
        let mut perms = meta.permissions();
        if perms.readonly() {
            perms.set_readonly(false);
            let _ = fs::set_permissions(path, perms);
        }
        if meta.is_dir() {
            if let Ok(rd) = fs::read_dir(path) {
                for e in rd.flatten() {
                    clear_readonly(&e.path());
                }
            }
        }
    }
}

/// 删除目录：symlink 只摘链接不动目标；普通目录清只读位后删（git clone 的对象文件是只读的）。
pub fn force_remove_dir_all(path: &Path) -> Result<(), String> {
    let Ok(meta) = fs::symlink_metadata(path) else {
        return Ok(());
    };
    if meta.file_type().is_symlink() {
        return fs::remove_dir(path)
            .or_else(|_| fs::remove_file(path))
            .map_err(|e| e.to_string());
    }
    if let Err(first) = fs::remove_dir_all(path) {
        clear_readonly(path);
        fs::remove_dir_all(path).map_err(|e| format!("{first}；重试后：{e}"))?;
    }
    Ok(())
}

/// E8：启用 = 从中央库复制进工具技能目录（Windows symlink 需特权，V1 用复制）。
pub fn enable(dir_name: &str, tool: &str) -> Result<(), String> {
    let src = skills_dir().join(dir_name);
    if !src.is_dir() {
        return Err(format!("中央库中不存在技能 {dir_name}"));
    }
    let tool_dir = tool_skills_dir(tool).ok_or_else(|| format!("未知工具 {tool}"))?;
    fs::create_dir_all(&tool_dir).map_err(|e| e.to_string())?;
    let dst = tool_dir.join(dir_name);
    if dst.exists() {
        return Ok(());
    }
    copy_dir_all(&src, &dst).map_err(|e| format!("复制到 {} 失败：{e}", dst.display()))
}

pub fn workspace_status() -> Vec<ToolWorkspaceStatus> {
    all_tools()
        .into_iter()
        .filter_map(|tool| {
            let path = tool_skills_dir(tool)?;
            let mut skills = Vec::new();
            if let Ok(entries) = fs::read_dir(&path) {
                for entry in entries.flatten() {
                    let entry_path = entry.path();
                    if !entry_path.is_dir() {
                        continue;
                    }
                    let dir_name = entry.file_name().to_string_lossy().to_string();
                    let has_manifest = entry_path.join("SKILL.md").is_file() || entry_path.join("skill.md").is_file();
                    if has_manifest {
                        skills.push(WorkspaceSkill {
                            managed: skills_dir().join(&dir_name).is_dir(),
                            dir_name,
                        });
                    }
                }
            }
            skills.sort_by(|a, b| a.dir_name.to_lowercase().cmp(&b.dir_name.to_lowercase()));
            let managed_skills = skills.iter().filter(|skill| skill.managed).count();
            Some(ToolWorkspaceStatus {
                tool: tool.to_string(),
                label: match tool {
                    "claude_code" => "Claude Code",
                    "codex" => "Codex",
                    "opencode" => "OpenCode",
                    _ => tool,
                }
                .to_string(),
                path: path.display().to_string(),
                exists: path.is_dir(),
                total_skills: skills.len(),
                managed_skills,
                unmanaged_skills: skills.len().saturating_sub(managed_skills),
                skills,
            })
        })
        .collect()
}

pub fn refresh(dir_name: &str, tool: &str) -> Result<(), String> {
    let tool_dir = tool_skills_dir(tool).ok_or_else(|| format!("未知工具 {tool}"))?;
    let destination = tool_dir.join(dir_name);
    force_remove_dir_all(&destination)?;
    enable(dir_name, tool)
}

pub fn disable(dir_name: &str, tool: &str) -> Result<(), String> {
    let tool_dir = tool_skills_dir(tool).ok_or_else(|| format!("未知工具 {tool}"))?;
    force_remove_dir_all(&tool_dir.join(dir_name))
}
