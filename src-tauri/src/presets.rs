use crate::paths::{self, PresetRecord};
use crate::{scan, sync};
use serde::Serialize;
use std::collections::HashSet;

#[derive(Serialize)]
pub struct PresetPlan {
    pub preset_id: String,
    pub preset_name: String,
    pub target_tools: Vec<String>,
    pub total_operations: usize,
    pub already_applied: usize,
    pub pending: usize,
    pub missing_skills: Vec<String>,
}

#[derive(Serialize)]
pub struct BatchFailure {
    pub item: String,
    pub reason: String,
}

#[derive(Serialize)]
pub struct BatchResult {
    pub succeeded: usize,
    pub skipped: usize,
    pub unchanged: usize,
    pub failed: usize,
    pub failures: Vec<BatchFailure>,
}

fn validate_preset(preset: &PresetRecord) -> Result<(), String> {
    if preset.id.trim().is_empty() {
        return Err("Preset ID 不能为空".to_string());
    }
    if preset.name.trim().is_empty() {
        return Err("Preset 名称不能为空".to_string());
    }
    if preset.name.chars().count() > 40 {
        return Err("Preset 名称不能超过 40 个字符".to_string());
    }
    let known_tools: HashSet<&str> = sync::all_tools().into_iter().collect();
    if let Some(tool) = preset.tools.iter().find(|tool| !known_tools.contains(tool.as_str())) {
        return Err(format!("Preset 包含未知 Agent：{tool}"));
    }
    Ok(())
}

pub fn list() -> Vec<PresetRecord> {
    paths::load_state().presets
}

pub fn upsert(mut preset: PresetRecord) -> Result<PresetRecord, String> {
    preset.name = preset.name.trim().to_string();
    preset.description = preset.description.trim().to_string();
    preset.icon = preset.icon.trim().to_string();
    preset.skill_dir_names.retain(|name| !name.trim().is_empty());
    preset.skill_dir_names.dedup();
    preset.tools.retain(|tool| !tool.trim().is_empty());
    preset.tools.dedup();
    preset.updated_at = chrono::Utc::now().to_rfc3339();
    validate_preset(&preset)?;

    let available: HashSet<String> = scan::scan_skills()?
        .into_iter()
        .map(|skill| skill.dir_name)
        .collect();
    if let Some(missing) = preset.skill_dir_names.iter().find(|name| !available.contains(*name)) {
        return Err(format!("中央技能库中不存在：{missing}"));
    }

    let mut state = paths::load_state();
    if state
        .presets
        .iter()
        .any(|item| item.id != preset.id && item.name.eq_ignore_ascii_case(&preset.name))
    {
        return Err(format!("Preset 名称已存在：{}", preset.name));
    }
    if let Some(existing) = state.presets.iter_mut().find(|item| item.id == preset.id) {
        *existing = preset.clone();
    } else {
        state.presets.push(preset.clone());
    }
    paths::append_audit(&mut state, "preset.save", &preset.name, true, "Preset 配置已保存");
    paths::save_state(&state)?;
    Ok(preset)
}

pub fn delete(id: &str) -> Result<(), String> {
    let mut state = paths::load_state();
    let Some(index) = state.presets.iter().position(|item| item.id == id) else {
        return Err(format!("找不到 Preset：{id}"));
    };
    let removed = state.presets.remove(index);
    if state.current_preset.as_deref() == Some(id) {
        state.current_preset = None;
    }
    paths::append_audit(&mut state, "preset.delete", &removed.name, true, "仅删除 Preset 配置，未删除 Skill");
    paths::save_state(&state)
}

fn get_preset(id: &str) -> Result<PresetRecord, String> {
    paths::load_state()
        .presets
        .into_iter()
        .find(|item| item.id == id)
        .ok_or_else(|| format!("找不到 Preset：{id}"))
}

fn target_tools(preset: &PresetRecord, requested: Vec<String>) -> Result<Vec<String>, String> {
    let tools = if requested.is_empty() { preset.tools.clone() } else { requested };
    if tools.is_empty() {
        return Err("请至少选择一个目标 Agent".to_string());
    }
    let known: HashSet<&str> = sync::all_tools().into_iter().collect();
    if let Some(tool) = tools.iter().find(|tool| !known.contains(tool.as_str())) {
        return Err(format!("未知 Agent：{tool}"));
    }
    Ok(tools)
}

pub fn preview(id: &str, requested_tools: Vec<String>) -> Result<PresetPlan, String> {
    let preset = get_preset(id)?;
    let tools = target_tools(&preset, requested_tools)?;
    let available: HashSet<String> = scan::scan_skills()?
        .into_iter()
        .map(|skill| skill.dir_name)
        .collect();
    let missing_skills: Vec<String> = preset
        .skill_dir_names
        .iter()
        .filter(|name| !available.contains(*name))
        .cloned()
        .collect();
    let total_operations = preset.skill_dir_names.len() * tools.len();
    let already_applied = preset
        .skill_dir_names
        .iter()
        .map(|name| {
            let enabled: HashSet<String> = sync::enabled_tools_for(name).into_iter().collect();
            tools.iter().filter(|tool| enabled.contains(*tool)).count()
        })
        .sum();
    Ok(PresetPlan {
        preset_id: preset.id,
        preset_name: preset.name,
        target_tools: tools,
        total_operations,
        already_applied,
        pending: total_operations.saturating_sub(already_applied),
        missing_skills,
    })
}

pub fn apply(id: &str, requested_tools: Vec<String>) -> Result<BatchResult, String> {
    let preset = get_preset(id)?;
    let tools = target_tools(&preset, requested_tools)?;
    let state = paths::load_state();
    let mut result = BatchResult { succeeded: 0, skipped: 0, unchanged: 0, failed: 0, failures: Vec::new() };
    for name in &preset.skill_dir_names {
        if state.isolated.contains_key(name) {
            result.skipped += tools.len();
            continue;
        }
        for tool in &tools {
            if sync::enabled_tools_for(name).iter().any(|enabled| enabled == tool) {
                result.unchanged += 1;
                continue;
            }
            match sync::enable(name, tool) {
                Ok(()) => result.succeeded += 1,
                Err(reason) => {
                    result.failed += 1;
                    result.failures.push(BatchFailure { item: format!("{name} -> {tool}"), reason });
                }
            }
        }
    }
    let mut state = paths::load_state();
    state.current_preset = Some(id.to_string());
    paths::append_audit(
        &mut state,
        "preset.apply",
        &preset.name,
        result.failed == 0,
        &format!("成功 {}，跳过 {}，未变化 {}，失败 {}", result.succeeded, result.skipped, result.unchanged, result.failed),
    );
    paths::save_state(&state)?;
    Ok(result)
}

pub fn remove(id: &str, requested_tools: Vec<String>) -> Result<BatchResult, String> {
    let preset = get_preset(id)?;
    let tools = target_tools(&preset, requested_tools)?;
    let mut result = BatchResult { succeeded: 0, skipped: 0, unchanged: 0, failed: 0, failures: Vec::new() };
    for name in &preset.skill_dir_names {
        for tool in &tools {
            if !sync::enabled_tools_for(name).iter().any(|enabled| enabled == tool) {
                result.unchanged += 1;
                continue;
            }
            match sync::disable(name, tool) {
                Ok(()) => result.succeeded += 1,
                Err(reason) => {
                    result.failed += 1;
                    result.failures.push(BatchFailure { item: format!("{name} -> {tool}"), reason });
                }
            }
        }
    }
    let mut state = paths::load_state();
    if state.current_preset.as_deref() == Some(id) {
        state.current_preset = None;
    }
    paths::append_audit(
        &mut state,
        "preset.remove",
        &preset.name,
        result.failed == 0,
        &format!("移除 {}，未变化 {}，失败 {}", result.succeeded, result.unchanged, result.failed),
    );
    paths::save_state(&state)?;
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> PresetRecord {
        PresetRecord {
            id: "preset-test".to_string(),
            name: "测试 Preset".to_string(),
            description: String::new(),
            icon: "layers".to_string(),
            skill_dir_names: Vec::new(),
            tools: vec!["codex".to_string()],
            updated_at: String::new(),
        }
    }

    #[test]
    fn rejects_unknown_tool() {
        let mut preset = sample();
        preset.tools = vec!["unknown-agent".to_string()];
        assert!(validate_preset(&preset).is_err());
    }

    #[test]
    fn requires_target_tool_when_applying() {
        let mut preset = sample();
        preset.tools.clear();
        assert!(target_tools(&preset, Vec::new()).is_err());
    }
}
