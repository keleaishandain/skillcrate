use crate::paths;
use crate::scan;
use serde::Serialize;
use std::collections::BTreeMap;

#[derive(Serialize)]
pub struct TagSummary {
    pub name: String,
    pub skill_count: usize,
}

#[derive(Serialize)]
pub struct TagBatchResult {
    pub changed: usize,
    pub unchanged: usize,
    pub failed: usize,
    pub failures: Vec<String>,
}

pub fn normalize_tag(tag: &str) -> Result<String, String> {
    let tag = tag.trim();
    if tag.is_empty() {
        return Err("标签不能为空".to_string());
    }
    if tag.chars().count() > 24 {
        return Err(format!("标签不能超过 24 个字符：{tag}"));
    }
    Ok(tag.to_string())
}

pub fn list() -> Vec<TagSummary> {
    let state = paths::load_state();
    let mut counts: BTreeMap<String, usize> = BTreeMap::new();
    for tags in state.skill_tags.values() {
        for tag in tags {
            *counts.entry(tag.clone()).or_default() += 1;
        }
    }
    counts.into_iter().map(|(name, skill_count)| TagSummary { name, skill_count }).collect()
}

pub fn add_to_skills(dir_names: Vec<String>, tag: &str) -> Result<TagBatchResult, String> {
    let tag = normalize_tag(tag)?;
    let available: std::collections::HashSet<String> = scan::scan_skills()?.into_iter().map(|skill| skill.dir_name).collect();
    let mut state = paths::load_state();
    let mut result = TagBatchResult { changed: 0, unchanged: 0, failed: 0, failures: Vec::new() };
    for dir_name in dir_names {
        if !available.contains(&dir_name) {
            result.failed += 1;
            result.failures.push(format!("中央技能库中不存在：{dir_name}"));
            continue;
        }
        let tags = state.skill_tags.entry(dir_name).or_default();
        if tags.iter().any(|current| current.eq_ignore_ascii_case(&tag)) {
            result.unchanged += 1;
        } else if tags.len() >= 12 {
            result.failed += 1;
            result.failures.push("单个 Skill 最多添加 12 个标签".to_string());
        } else {
            tags.push(tag.clone());
            tags.sort_by_key(|item| item.to_lowercase());
            result.changed += 1;
        }
    }
    paths::append_audit(&mut state, "tag.batch_add", &tag, result.failed == 0, &format!("变更 {}，未变化 {}，失败 {}", result.changed, result.unchanged, result.failed));
    paths::save_state(&state)?;
    Ok(result)
}

pub fn rename(old_name: &str, new_name: &str) -> Result<TagBatchResult, String> {
    let old_name = normalize_tag(old_name)?;
    let new_name = normalize_tag(new_name)?;
    let mut state = paths::load_state();
    let mut result = TagBatchResult { changed: 0, unchanged: 0, failed: 0, failures: Vec::new() };
    for tags in state.skill_tags.values_mut() {
        let Some(index) = tags.iter().position(|tag| tag.eq_ignore_ascii_case(&old_name)) else { continue };
        tags[index] = new_name.clone();
        tags.sort_by_key(|tag| tag.to_lowercase());
        tags.dedup_by(|left, right| left.eq_ignore_ascii_case(right));
        result.changed += 1;
    }
    if result.changed == 0 {
        return Err(format!("找不到标签：{old_name}"));
    }
    paths::append_audit(&mut state, "tag.rename", &old_name, true, &format!("重命名为 {new_name}，影响 {} 个 Skills", result.changed));
    paths::save_state(&state)?;
    Ok(result)
}

pub fn delete(name: &str) -> Result<TagBatchResult, String> {
    let name = normalize_tag(name)?;
    let mut state = paths::load_state();
    let mut result = TagBatchResult { changed: 0, unchanged: 0, failed: 0, failures: Vec::new() };
    for tags in state.skill_tags.values_mut() {
        let before = tags.len();
        tags.retain(|tag| !tag.eq_ignore_ascii_case(&name));
        if tags.len() != before {
            result.changed += 1;
        }
    }
    if result.changed == 0 {
        return Err(format!("找不到标签：{name}"));
    }
    paths::append_audit(&mut state, "tag.delete", &name, true, &format!("从 {} 个 Skills 移除", result.changed));
    paths::save_state(&state)?;
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_blank_and_long_tags() {
        assert!(normalize_tag(" ").is_err());
        assert!(normalize_tag(&"x".repeat(25)).is_err());
    }
}
