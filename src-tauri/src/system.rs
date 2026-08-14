use crate::paths;
use serde::Serialize;
use std::path::Path;
use std::process::Command;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolHealthInfo {
    installed: bool,
    version: String,
    path: String,
    status: String,
    last_checked: String,
    message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpHealthInfo {
    running: bool,
    port: u16,
    active_connections: u32,
    uptime_seconds: u64,
    protocol: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentHealth {
    claude_cli: ToolHealthInfo,
    codex: ToolHealthInfo,
    open_code: ToolHealthInfo,
    mcp_server: McpHealthInfo,
}

fn locate(command: &str) -> Option<String> {
    if Path::new(command).is_file() {
        return Some(command.to_string());
    }
    #[cfg(windows)]
    let output = Command::new("where.exe").arg(command).output().ok()?;
    #[cfg(not(windows))]
    let output = Command::new("which").arg(command).output().ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(str::to_string)
}

fn version(command: &str) -> Option<String> {
    #[cfg(windows)]
    let output = Command::new("cmd.exe")
        .args(["/C", command, "--version"])
        .output()
        .ok()?;
    #[cfg(not(windows))]
    let output = Command::new(command).arg("--version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let text = if output.stdout.is_empty() {
        String::from_utf8_lossy(&output.stderr)
    } else {
        String::from_utf8_lossy(&output.stdout)
    };
    text.lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(str::to_string)
}

fn tool(command: &str, skills_path: &Path, now: &str) -> ToolHealthInfo {
    match locate(command) {
        Some(path) => ToolHealthInfo {
            installed: true,
            version: version(command).unwrap_or_else(|| "版本未知".to_string()),
            path,
            status: "ready".to_string(),
            last_checked: now.to_string(),
            message: format!("技能目录：{}", skills_path.display()),
        },
        None => ToolHealthInfo {
            installed: false,
            version: "未检测到".to_string(),
            path: command.to_string(),
            status: "missing".to_string(),
            last_checked: now.to_string(),
            message: format!("PATH 中未找到 {command}"),
        },
    }
}

pub fn environment_health() -> EnvironmentHealth {
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let state = paths::load_state();
    let claude = if state.settings.claude_binary.trim().is_empty() {
        "claude"
    } else {
        state.settings.claude_binary.trim()
    };
    EnvironmentHealth {
        claude_cli: tool(claude, &paths::home_dir().join(".claude/skills"), &now),
        codex: tool("codex", &paths::home_dir().join(".codex/skills"), &now),
        open_code: tool(
            "opencode",
            &paths::home_dir().join(".config/opencode/skills"),
            &now,
        ),
        mcp_server: McpHealthInfo {
            running: false,
            port: 0,
            active_connections: 0,
            uptime_seconds: 0,
            protocol: "stdio JSON-RPC 2.0（客户端按需启动）".to_string(),
        },
    }
}
