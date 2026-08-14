use crate::paths;
use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
pub struct GitStatus {
    pub repo_path: String,
    pub initialized: bool,
    pub branch: String,
    pub remote: String,
    pub changed_files: usize,
    pub last_commit: String,
    pub last_snapshot: String,
    pub error: String,
}

fn git(args: &[&str]) -> Result<String, String> {
    let root = paths::repo_root();
    let output = Command::new("git")
        .arg("-C")
        .arg(&root)
        .args(args)
        .output()
        .map_err(|error| format!("无法启动 Git：{error}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() { format!("Git 命令失败，退出码：{}", output.status) } else { stderr });
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

pub fn status() -> GitStatus {
    let root = paths::repo_root();
    if !root.join(".git").is_dir() {
        return GitStatus {
            repo_path: root.display().to_string(), initialized: false, branch: String::new(),
            remote: String::new(), changed_files: 0, last_commit: String::new(),
            last_snapshot: String::new(), error: String::new(),
        };
    }
    let branch = git(&["branch", "--show-current"]).unwrap_or_default();
    let remote = git(&["remote", "get-url", "origin"]).unwrap_or_default();
    let changed_files = git(&["status", "--porcelain"]).map(|output| output.lines().count()).unwrap_or(0);
    let last_commit = git(&["log", "-1", "--format=%h %s (%cr)"]).unwrap_or_default();
    let last_snapshot = git(&["tag", "--list", "skill-curator-*", "--sort=-creatordate"])
        .ok().and_then(|output| output.lines().next().map(str::to_string)).unwrap_or_default();
    GitStatus { repo_path: root.display().to_string(), initialized: true, branch, remote, changed_files, last_commit, last_snapshot, error: String::new() }
}

pub fn create_snapshot(message: &str) -> Result<GitStatus, String> {
    let root = paths::repo_root();
    if !root.is_dir() {
        return Err(format!("中央仓库不存在：{}", root.display()));
    }
    if !root.join(".git").is_dir() {
        git(&["init"])?;
    }
    git(&["add", "--", "skills"])?;
    let staged = git(&["diff", "--cached", "--name-only"])?;
    if staged.trim().is_empty() {
        return Err("没有可写入快照的 Skills 变更".to_string());
    }
    let commit_message = if message.trim().is_empty() { "chore: snapshot skills" } else { message.trim() };
    git(&["commit", "-m", commit_message])?;
    let tag = format!("skill-curator-{}", chrono::Utc::now().format("%Y%m%d-%H%M%S"));
    git(&["tag", "-a", &tag, "-m", &format!("SkillCurator snapshot {tag}")])?;
    let mut state = paths::load_state();
    paths::append_audit(&mut state, "git.snapshot", &tag, true, commit_message);
    paths::save_state(&state)?;
    Ok(status())
}
