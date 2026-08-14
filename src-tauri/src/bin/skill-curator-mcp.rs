//! skill-curator-mcp — SkillCurator 的 MCP stdio 服务器（V2：AI 问答管理）。
//! 新行分隔 JSON-RPC 2.0，复用 GUI 同一套 Rust 核心；stdout 只走协议，诊断走 stderr。

use serde_json::{json, Value};
use skill_curator_lib::{curation, discover, gitops, import, paths, presets, projects, scan, sync};
use std::io::{self, BufRead, Write};

fn main() {
    eprintln!("[skill-curator-mcp] started");
    let stdin = io::stdin();
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let Ok(req) = serde_json::from_str::<Value>(line) else {
            eprintln!("[skill-curator-mcp] bad json line");
            continue;
        };
        let id = req.get("id").cloned();
        let method = req.get("method").and_then(|m| m.as_str()).unwrap_or("");
        let params = req.get("params").cloned().unwrap_or(Value::Null);
        match method {
            "initialize" => respond(
                &id,
                json!({
                    "protocolVersion": "2024-11-05",
                    "capabilities": { "tools": {} },
                    "serverInfo": { "name": "skill-curator", "version": "0.1.0" }
                }),
            ),
            "ping" => respond(&id, json!({})),
            "tools/list" => respond(&id, tools_list()),
            "tools/call" => {
                let name = params
                    .get("name")
                    .and_then(|n| n.as_str())
                    .unwrap_or("")
                    .to_string();
                let args = params.get("arguments").cloned().unwrap_or(json!({}));
                let (text, is_error) = match call_tool(&name, &args) {
                    Ok(v) => (
                        serde_json::to_string_pretty(&v).unwrap_or_else(|_| v.to_string()),
                        false,
                    ),
                    Err(e) => (e, true),
                };
                respond(
                    &id,
                    json!({
                        "content": [{ "type": "text", "text": text }],
                        "isError": is_error
                    }),
                );
            }
            m if m.starts_with("notifications/") => {}
            _ => {
                if id.is_some() {
                    respond_error(&id, -32601, &format!("method not found: {method}"));
                }
            }
        }
    }
}

fn respond(id: &Option<Value>, result: Value) {
    let Some(id) = id else { return };
    let msg = json!({ "jsonrpc": "2.0", "id": id, "result": result });
    println!("{msg}");
    let _ = io::stdout().flush();
}

fn respond_error(id: &Option<Value>, code: i64, message: &str) {
    let Some(id) = id else { return };
    let msg = json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } });
    println!("{msg}");
    let _ = io::stdout().flush();
}

fn req_str(args: &Value, key: &str) -> Result<String, String> {
    args.get(key)
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| format!("缺少参数 {key}"))
}

fn tools_list() -> Value {
    let tools = json!([
        {
            "name": "library_status",
            "description": "技能库总览：库路径、技能数、隔离数、各工具已同步数量",
            "inputSchema": { "type": "object", "properties": {} }
        },
        {
            "name": "list_skills",
            "description": "列出库中技能（名称/描述/来源/各工具启用状态/是否隔离），可选关键词过滤",
            "inputSchema": { "type": "object", "properties": {
                "query": { "type": "string", "description": "按名称/描述过滤的关键词" }
            } }
        },
        {
            "name": "curation_report",
            "description": "生成策展报告：两段式冗余分析（先按描述相似度分职责组，再按 90 天被动调用数据裁决），返回各组成员的份额与保留/正常/建议隔离/观察中裁决",
            "inputSchema": { "type": "object", "properties": {
                "threshold": { "type": "number", "description": "分组相似度阈值（默认 0.35）" }
            } }
        },
        {
            "name": "isolate_skill",
            "description": "把技能移入隔离区：从所有工具撤下同步，文件保留，30 天内可恢复，永不删除",
            "inputSchema": { "type": "object", "properties": {
                "dir_name": { "type": "string", "description": "技能目录名" }
            }, "required": ["dir_name"] }
        },
        {
            "name": "restore_skill",
            "description": "从隔离区恢复技能，原同步状态原样重建",
            "inputSchema": { "type": "object", "properties": {
                "dir_name": { "type": "string" }
            }, "required": ["dir_name"] }
        },
        {
            "name": "isolation_list",
            "description": "查看隔离区：各技能剩余天数、原同步工具、是否到期可归档",
            "inputSchema": { "type": "object", "properties": {} }
        },
        {
            "name": "archive_skill",
            "description": "归档技能：从中央库移动到 ~/.skill-curator/archive/（文件保留，非删除）。请先与用户确认",
            "inputSchema": { "type": "object", "properties": {
                "dir_name": { "type": "string" }
            }, "required": ["dir_name"] }
        },
        {
            "name": "import_skill",
            "description": "导入技能：source=git（整仓 URL）/ local（本地目录）/ skillssh（owner/repo[@skill]，按 GitHub 直译）",
            "inputSchema": { "type": "object", "properties": {
                "source": { "type": "string", "enum": ["git", "local", "skillssh"] },
                "reference": { "type": "string" }
            }, "required": ["source", "reference"] }
        },
        {
            "name": "set_skill_tool",
            "description": "启用/停用技能到某个工具（claude_code / codex / opencode），复制式同步",
            "inputSchema": { "type": "object", "properties": {
                "dir_name": { "type": "string" },
                "tool": { "type": "string", "enum": ["claude_code", "codex", "opencode"] },
                "enabled": { "type": "boolean" }
            }, "required": ["dir_name", "tool", "enabled"] }
        },
        {
            "name": "list_projects",
            "description": "列出已注册的项目工作区：各项目内 .claude/skills 与 .codex/skills 的技能、是否已在中央库、单项目扫描错误",
            "inputSchema": { "type": "object", "properties": {} }
        },
        {
            "name": "add_project",
            "description": "注册一个项目工作区（传项目文件夹绝对路径，目录必须存在；仅登记，不动磁盘）",
            "inputSchema": { "type": "object", "properties": {
                "path": { "type": "string", "description": "项目文件夹绝对路径" }
            }, "required": ["path"] }
        },
        {
            "name": "project_add_skill",
            "description": "把中央库技能复制进项目的工具技能目录（项目级隔离）",
            "inputSchema": { "type": "object", "properties": {
                "project": { "type": "string" },
                "dir_name": { "type": "string" },
                "tool": { "type": "string", "enum": ["claude_code", "codex"] }
            }, "required": ["project", "dir_name", "tool"] }
        },
        {
            "name": "adopt_project_skill",
            "description": "把仅存在于项目内的技能收编进中央库（库中已存在同名会报错）。会写入中央库，请先与用户确认",
            "inputSchema": { "type": "object", "properties": {
                "project": { "type": "string" },
                "dir_name": { "type": "string" },
                "tool": { "type": "string", "enum": ["claude_code", "codex"] }
            }, "required": ["project", "dir_name", "tool"] }
        },
        {
            "name": "trending",
            "description": "GitHub 热门 skill 仓库榜（按 stars，三 topic 合并，1 小时缓存；force=true 强制刷新）。配合 import_skill(source=git) 可一键导入",
            "inputSchema": { "type": "object", "properties": {
                "force": { "type": "boolean", "description": "强制绕过缓存刷新" }
            } }
        },
        {
            "name": "list_presets",
            "description": "列出所有 Preset 及其有序 Skills 成员和默认目标 Agent",
            "inputSchema": { "type": "object", "properties": {} }
        },
        {
            "name": "save_preset",
            "description": "创建或更新 Preset 配置；只写配置，不改变 Agent 目录",
            "inputSchema": { "type": "object", "properties": {
                "preset": { "type": "object", "properties": {
                    "id": { "type": "string" }, "name": { "type": "string" },
                    "description": { "type": "string" }, "icon": { "type": "string" },
                    "skill_dir_names": { "type": "array", "items": { "type": "string" } },
                    "tools": { "type": "array", "items": { "type": "string" } },
                    "updated_at": { "type": "string" }
                }, "required": ["id", "name", "skill_dir_names", "tools"] }
            }, "required": ["preset"] }
        },
        {
            "name": "preview_preset",
            "description": "预览 Preset 对指定 Agent 的写入计划，不改变文件",
            "inputSchema": { "type": "object", "properties": {
                "id": { "type": "string" },
                "tools": { "type": "array", "items": { "type": "string" } }
            }, "required": ["id", "tools"] }
        },
        {
            "name": "apply_preset",
            "description": "一次性把 Preset 成员分发到明确指定的 Agent，返回成功、跳过、未变化和失败计数",
            "inputSchema": { "type": "object", "properties": {
                "id": { "type": "string" },
                "tools": { "type": "array", "items": { "type": "string" } }
            }, "required": ["id", "tools"] }
        },
        {
            "name": "set_skill_tags",
            "description": "替换一个中央 Skill 的自定义标签",
            "inputSchema": { "type": "object", "properties": {
                "dir_name": { "type": "string" },
                "tags": { "type": "array", "items": { "type": "string" } }
            }, "required": ["dir_name", "tags"] }
        },
        {
            "name": "git_status",
            "description": "读取中央 Skills 仓库的 Git 分支、远程、变更和最近快照状态",
            "inputSchema": { "type": "object", "properties": {} }
        }
    ]);
    json!({ "tools": tools })
}

fn call_tool(name: &str, args: &Value) -> Result<Value, String> {
    match name {
        "library_status" => {
            let skills = skill_curator_lib::enriched_skills()?;
            let isolated = skills.iter().filter(|s| s.isolated).count();
            let mut per_tool = serde_json::Map::new();
            for tool in sync::all_tools() {
                let n = skills
                    .iter()
                    .filter(|s| s.enabled_tools.iter().any(|t| t == tool))
                    .count();
                per_tool.insert(tool.to_string(), json!(n));
            }
            Ok(json!({
                "repo_path": paths::repo_root().display().to_string(),
                "skill_count": skills.len(),
                "isolated_count": isolated,
                "enabled_per_tool": per_tool,
                "state_file": paths::state_path().display().to_string()
            }))
        }
        "list_skills" => {
            let skills = skill_curator_lib::enriched_skills()?;
            let query = args
                .get("query")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_lowercase();
            let filtered: Vec<scan::SkillInfo> = skills
                .into_iter()
                .filter(|s| {
                    query.is_empty()
                        || s.name.to_lowercase().contains(&query)
                        || s.description.to_lowercase().contains(&query)
                })
                .collect();
            serde_json::to_value(&filtered).map_err(|e| e.to_string())
        }
        "curation_report" => {
            let t = args.get("threshold").and_then(|v| v.as_f64());
            serde_json::to_value(curation::analyze(t)?).map_err(|e| e.to_string())
        }
        "isolate_skill" => {
            let d = req_str(args, "dir_name")?;
            curation::isolate(&d)?;
            Ok(json!({ "ok": true, "message": format!("{d} 已隔离：从所有工具撤下，30 天内可恢复") }))
        }
        "restore_skill" => {
            let d = req_str(args, "dir_name")?;
            curation::restore(&d)?;
            Ok(json!({ "ok": true, "message": format!("{d} 已恢复，原同步状态已重建") }))
        }
        "isolation_list" => {
            serde_json::to_value(curation::isolation_list()?).map_err(|e| e.to_string())
        }
        "archive_skill" => {
            let d = req_str(args, "dir_name")?;
            curation::archive(&d)?;
            Ok(json!({ "ok": true, "message": format!("{d} 已归档到 {}（文件保留）", paths::archive_dir().display()) }))
        }
        "import_skill" => {
            let source = req_str(args, "source")?;
            let reference = req_str(args, "reference")?;
            let outcome = match source.as_str() {
                "git" => import::import_git(&reference)?,
                "local" => import::import_local(&reference)?,
                "skillssh" => import::import_skillssh(&reference)?,
                _ => return Err(format!("未知来源类型：{source}")),
            };
            serde_json::to_value(&outcome).map_err(|e| e.to_string())
        }
        "set_skill_tool" => {
            let d = req_str(args, "dir_name")?;
            let tool = req_str(args, "tool")?;
            let enabled = args
                .get("enabled")
                .and_then(|v| v.as_bool())
                .ok_or("缺少参数 enabled")?;
            let state = paths::load_state();
            if state.isolated.contains_key(&d) {
                return Err("该技能在隔离区中，请先 restore_skill 再操作同步".to_string());
            }
            if enabled {
                sync::enable(&d, &tool)?;
            } else {
                sync::disable(&d, &tool)?;
            }
            Ok(json!({ "ok": true, "enabled_tools": sync::enabled_tools_for(&d) }))
        }
        "list_projects" => {
            serde_json::to_value(projects::list_projects()?).map_err(|e| e.to_string())
        }
        "add_project" => {
            let path = req_str(args, "path")?;
            projects::add_project(&path)?;
            Ok(json!({ "ok": true, "message": format!("已注册项目工作区：{path}") }))
        }
        "project_add_skill" => {
            let project = req_str(args, "project")?;
            let d = req_str(args, "dir_name")?;
            let tool = req_str(args, "tool")?;
            projects::project_add_skill(&project, &d, &tool)?;
            Ok(json!({ "ok": true, "message": format!("{d} 已加入项目（{tool}）") }))
        }
        "adopt_project_skill" => {
            let project = req_str(args, "project")?;
            let d = req_str(args, "dir_name")?;
            let tool = req_str(args, "tool")?;
            projects::adopt_project_skill(&project, &d, &tool)?;
            Ok(json!({ "ok": true, "message": format!("{d} 已收编进中央库") }))
        }
        "trending" => {
            let force = args.get("force").and_then(|v| v.as_bool()).unwrap_or(false);
            serde_json::to_value(discover::trending(force)?).map_err(|e| e.to_string())
        }
        "list_presets" => serde_json::to_value(presets::list()).map_err(|e| e.to_string()),
        "save_preset" => {
            let value = args.get("preset").cloned().ok_or("缺少参数 preset")?;
            let preset: paths::PresetRecord = serde_json::from_value(value).map_err(|error| format!("Preset 参数无效：{error}"))?;
            serde_json::to_value(presets::upsert(preset)?).map_err(|e| e.to_string())
        }
        "preview_preset" | "apply_preset" => {
            let id = req_str(args, "id")?;
            let tools = args.get("tools").and_then(|value| value.as_array()).ok_or("缺少参数 tools")?
                .iter().map(|value| value.as_str().map(str::to_string).ok_or("tools 必须是字符串数组"))
                .collect::<Result<Vec<_>, _>>()?;
            if name == "preview_preset" {
                serde_json::to_value(presets::preview(&id, tools)?).map_err(|e| e.to_string())
            } else {
                serde_json::to_value(presets::apply(&id, tools)?).map_err(|e| e.to_string())
            }
        }
        "set_skill_tags" => {
            let dir_name = req_str(args, "dir_name")?;
            let tags = args.get("tags").and_then(|value| value.as_array()).ok_or("缺少参数 tags")?
                .iter().map(|value| value.as_str().map(str::trim).map(str::to_string).ok_or("tags 必须是字符串数组"))
                .collect::<Result<Vec<_>, _>>()?;
            let tags = skill_curator_lib::update_skill_tags(&dir_name, tags)?;
            Ok(json!({ "ok": true, "tags": tags }))
        }
        "git_status" => serde_json::to_value(gitops::status()).map_err(|e| e.to_string()),
        _ => Err(format!("unknown tool: {name}")),
    }
}
