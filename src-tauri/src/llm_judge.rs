use crate::paths::State;
use serde_json::Value;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::io::Write as _;
use std::process::{Command, Stdio};

/// D8（学习者 2026-08-11 拍板）：用本机 Claude CLI（`claude -p` 无头模式）对
/// 词法候选组做语义复核，把"看起来像"拆成"真的抢同一个活"。
/// 隐私边界：只发送技能名与描述（截断 200 字符），不发送任何其他数据。
/// 判定结果按内容哈希缓存进 state.json，内容不变不重复花钱。
/// 已知限制（E12）：外部进程无超时护栏；CLI 不可用时整组按词法保留并在报告注明。

pub struct JudgeOutcome {
    /// 按传入下标划分的真实职责子组（含单元素组）
    pub subgroups: Vec<Vec<usize>>,
    pub from_cache: bool,
}

fn truncate_chars(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        s.chars().take(max).collect::<String>() + "…"
    }
}

fn group_hash(items: &[(String, String)]) -> String {
    let mut h = DefaultHasher::new();
    for (name, desc) in items {
        name.hash(&mut h);
        desc.hash(&mut h);
    }
    format!("{:016x}", h.finish())
}

fn run_claude(prompt: &str) -> Result<String, String> {
    #[cfg(windows)]
    let mut cmd = {
        // claude 在 Windows 上通常是 .cmd 垫片，需经 cmd /C 解析
        let mut c = Command::new("cmd");
        c.args(["/C", "claude", "-p"]);
        c
    };
    #[cfg(not(windows))]
    let mut cmd = {
        let mut c = Command::new("claude");
        c.arg("-p");
        c
    };
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = cmd.spawn().map_err(|e| format!("无法启动 claude CLI：{e}"))?;
    child
        .stdin
        .take()
        .ok_or("无法写入 claude CLI stdin")?
        .write_all(prompt.as_bytes())
        .map_err(|e| format!("写入 claude CLI 失败：{e}"))?;
    let out = child
        .wait_with_output()
        .map_err(|e| format!("等待 claude CLI 失败：{e}"))?;
    if !out.status.success() {
        return Err(format!(
            "claude CLI 退出异常：{}",
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

fn parse_groups(raw: &str, n: usize) -> Result<Vec<Vec<usize>>, String> {
    let start = raw.find('{').ok_or("响应中没有 JSON")?;
    let end = raw.rfind('}').ok_or("响应中没有 JSON")?;
    if end < start {
        return Err("响应 JSON 形状异常".to_string());
    }
    let v: Value = serde_json::from_str(&raw[start..=end]).map_err(|e| format!("JSON 解析失败：{e}"))?;
    let groups = v
        .get("groups")
        .and_then(|g| g.as_array())
        .ok_or("缺少 groups 字段")?;
    let mut result: Vec<Vec<usize>> = Vec::new();
    let mut seen = vec![false; n];
    for g in groups {
        let arr = g.as_array().ok_or("groups 子项不是数组")?;
        let mut sub = Vec::new();
        for idx in arr {
            let i = idx.as_u64().ok_or("编号不是整数")? as usize;
            if i >= n || seen[i] {
                return Err("编号越界或重复".to_string());
            }
            seen[i] = true;
            sub.push(i);
        }
        if !sub.is_empty() {
            result.push(sub);
        }
    }
    if seen.iter().any(|s| !s) {
        return Err("编号未覆盖全部技能".to_string());
    }
    Ok(result)
}

/// 复核一个候选组。items = (name, description)。
pub fn judge_group(state: &mut State, items: &[(String, String)]) -> Result<JudgeOutcome, String> {
    let key = group_hash(items);
    if let Some(cached) = state.judge_cache.get(&key) {
        return Ok(JudgeOutcome {
            subgroups: cached.clone(),
            from_cache: true,
        });
    }
    let mut listing = String::new();
    for (i, (name, desc)) in items.iter().enumerate() {
        listing.push_str(&format!("{i}. {name}：{}\n", truncate_chars(desc, 200)));
    }
    let prompt = format!(
        "你是技能库策展助手。下面是一组候选\"职责重叠\"的 AI 技能（编号、名称、描述）。\
请判断它们是否真的在抢同一个活——即用户想完成同一类任务时会在它们之间二选一。\
把候选组拆成真正职责重叠的子组；职责不同的技能单独成组。\n\
只输出一行 JSON，格式如 {{\"groups\": [[0,1],[2]]}}；编号必须覆盖全部技能且不重复；不要输出任何其他文字。\n\n技能列表：\n{listing}"
    );
    let raw = run_claude(&prompt)?;
    let subgroups = parse_groups(&raw, items.len())?;
    state.judge_cache.insert(key, subgroups.clone());
    Ok(JudgeOutcome {
        subgroups,
        from_cache: false,
    })
}
