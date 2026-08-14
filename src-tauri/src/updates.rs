use crate::import::{clone_git_to_temp, discover_skill_dirs, is_skill_dir};
use crate::paths::{self, SourceRecord, UpdateRecord};
use crate::sync::{force_remove_dir_all, refresh};
use crate::{scan, sourcesdb};
use serde::Serialize;
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::hash::{DefaultHasher, Hasher};
use std::io::Read;
use std::path::{Path, PathBuf};

const LARGE_FILE_BYTES: u64 = 2 * 1024 * 1024;

#[derive(Clone)]
struct FileStamp {
    size: u64,
    hash: u64,
    binary: bool,
}

#[derive(Serialize, Clone)]
pub struct UpdateCheck {
    pub dir_name: String,
    pub source_type: String,
    pub source_ref: String,
    pub status: String,
    pub checked_at: String,
    pub added: usize,
    pub modified: usize,
    pub removed: usize,
    pub binary_files: usize,
    pub large_files: usize,
    pub error: String,
}

#[derive(Serialize)]
pub struct UpdateOutcome {
    pub dir_name: String,
    pub changed: bool,
    pub added: usize,
    pub modified: usize,
    pub removed: usize,
    pub backup_path: String,
    pub refreshed_tools: Vec<String>,
    pub sync_failures: Vec<String>,
}

fn source_for(dir_name: &str) -> Option<SourceRecord> {
    let state = paths::load_state();
    if let Some(source) = state.sources.get(dir_name) {
        return Some(source.clone());
    }
    let db = sourcesdb::load_sources().unwrap_or_default();
    db.get(dir_name).map(|(source_type, source_ref)| SourceRecord {
        source_type: source_type.clone(),
        source_ref: source_ref.clone(),
    })
}

fn collect_files(root: &Path) -> Result<BTreeMap<String, FileStamp>, String> {
    fn walk(base: &Path, current: &Path, output: &mut BTreeMap<String, FileStamp>) -> Result<(), String> {
        let entries = fs::read_dir(current)
            .map_err(|error| format!("读取目录失败：{}：{error}", current.display()))?;
        for entry in entries {
            let entry = entry.map_err(|error| error.to_string())?;
            let file_type = entry.file_type().map_err(|error| error.to_string())?;
            let name = entry.file_name().to_string_lossy().to_string();
            if name == ".git" || name == "node_modules" || name == "target" {
                continue;
            }
            if file_type.is_symlink() {
                continue;
            }
            let path = entry.path();
            if file_type.is_dir() {
                walk(base, &path, output)?;
                continue;
            }
            if !file_type.is_file() {
                continue;
            }
            let metadata = entry.metadata().map_err(|error| error.to_string())?;
            let mut file = fs::File::open(&path)
                .map_err(|error| format!("读取文件失败：{}：{error}", path.display()))?;
            let mut hasher = DefaultHasher::new();
            let mut binary = false;
            let mut buffer = [0_u8; 64 * 1024];
            loop {
                let read = file.read(&mut buffer).map_err(|error| error.to_string())?;
                if read == 0 {
                    break;
                }
                if buffer[..read].contains(&0) {
                    binary = true;
                }
                hasher.write(&buffer[..read]);
            }
            let relative = path
                .strip_prefix(base)
                .map_err(|error| error.to_string())?
                .to_string_lossy()
                .replace('\\', "/");
            output.insert(relative, FileStamp { size: metadata.len(), hash: hasher.finish(), binary });
        }
        Ok(())
    }

    let mut files = BTreeMap::new();
    walk(root, root, &mut files)?;
    Ok(files)
}

fn resolve_skill_root(root: &Path, dir_name: &str) -> Result<PathBuf, String> {
    if !root.is_dir() {
        return Err(format!("来源目录不存在：{}", root.display()));
    }
    if is_skill_dir(root) {
        return Ok(root.to_path_buf());
    }
    discover_skill_dirs(root)
        .into_iter()
        .find(|path| path.file_name().map(|name| name.to_string_lossy() == dir_name).unwrap_or(false))
        .ok_or_else(|| format!("来源中找不到技能目录：{dir_name}"))
}

fn compare(dir_name: &str, source: &SourceRecord, source_skill: &Path) -> Result<UpdateCheck, String> {
    let central = paths::skills_dir().join(dir_name);
    if !central.is_dir() {
        return Err(format!("中央技能库中不存在：{dir_name}"));
    }
    let current = collect_files(&central)?;
    let incoming = collect_files(source_skill)?;
    let added = incoming.keys().filter(|path| !current.contains_key(*path)).count();
    let removed = current.keys().filter(|path| !incoming.contains_key(*path)).count();
    let modified = incoming
        .iter()
        .filter(|(path, stamp)| current.get(*path).map(|old| old.size != stamp.size || old.hash != stamp.hash).unwrap_or(false))
        .count();
    let binary_files = incoming.values().filter(|stamp| stamp.binary).count();
    let large_files = incoming.values().filter(|stamp| stamp.size > LARGE_FILE_BYTES).count();
    Ok(UpdateCheck {
        dir_name: dir_name.to_string(),
        source_type: source.source_type.clone(),
        source_ref: source.source_ref.clone(),
        status: if added + modified + removed == 0 { "up_to_date" } else { "update_available" }.to_string(),
        checked_at: chrono::Utc::now().to_rfc3339(),
        added,
        modified,
        removed,
        binary_files,
        large_files,
        error: String::new(),
    })
}

fn to_record(check: &UpdateCheck) -> UpdateRecord {
    UpdateRecord {
        status: check.status.clone(),
        checked_at: check.checked_at.clone(),
        added: check.added,
        modified: check.modified,
        removed: check.removed,
        binary_files: check.binary_files,
        large_files: check.large_files,
        error: check.error.clone(),
    }
}

fn error_check(dir_name: &str, source: Option<&SourceRecord>, status: &str, error: String) -> UpdateCheck {
    UpdateCheck {
        dir_name: dir_name.to_string(),
        source_type: source.map(|item| item.source_type.clone()).unwrap_or_default(),
        source_ref: source.map(|item| item.source_ref.clone()).unwrap_or_default(),
        status: status.to_string(),
        checked_at: chrono::Utc::now().to_rfc3339(),
        added: 0,
        modified: 0,
        removed: 0,
        binary_files: 0,
        large_files: 0,
        error,
    }
}

fn prepare_root(source: &SourceRecord) -> Result<(PathBuf, Option<PathBuf>), String> {
    match source.source_type.as_str() {
        "git" | "skillssh" => {
            let temp = clone_git_to_temp(&source.source_ref, "update-check")?;
            Ok((temp.clone(), Some(temp)))
        }
        "local" | "import" => {
            let root = PathBuf::from(source.source_ref.trim());
            if !root.is_dir() {
                return Err(format!("来源目录不存在：{}", root.display()));
            }
            Ok((root, None))
        }
        other => Err(format!("暂不支持更新来源类型：{other}")),
    }
}

pub fn status_list() -> Result<Vec<UpdateCheck>, String> {
    let skills = scan::scan_skills()?;
    let state = paths::load_state();
    Ok(skills
        .into_iter()
        .map(|skill| {
            let source = source_for(&skill.dir_name);
            let record = state.update_records.get(&skill.dir_name);
            UpdateCheck {
                dir_name: skill.dir_name,
                source_type: source.as_ref().map(|item| item.source_type.clone()).unwrap_or_default(),
                source_ref: source.as_ref().map(|item| item.source_ref.clone()).unwrap_or_default(),
                status: record.map(|item| item.status.clone()).unwrap_or_else(|| "unknown".to_string()),
                checked_at: record.map(|item| item.checked_at.clone()).unwrap_or_default(),
                added: record.map(|item| item.added).unwrap_or(0),
                modified: record.map(|item| item.modified).unwrap_or(0),
                removed: record.map(|item| item.removed).unwrap_or(0),
                binary_files: record.map(|item| item.binary_files).unwrap_or(0),
                large_files: record.map(|item| item.large_files).unwrap_or(0),
                error: record.map(|item| item.error.clone()).unwrap_or_default(),
            }
        })
        .collect())
}

pub fn check_many(requested: Vec<String>) -> Result<Vec<UpdateCheck>, String> {
    let available: Vec<String> = scan::scan_skills()?.into_iter().map(|skill| skill.dir_name).collect();
    let targets = if requested.is_empty() { available } else { requested };
    let mut grouped: HashMap<(String, String), Vec<String>> = HashMap::new();
    let mut results = Vec::new();
    for dir_name in targets {
        match source_for(&dir_name) {
            Some(source) => grouped.entry((source.source_type, source.source_ref)).or_default().push(dir_name),
            None => results.push(error_check(&dir_name, None, "unknown", "未记录可检查的来源".to_string())),
        }
    }

    for ((source_type, source_ref), dir_names) in grouped {
        let source = SourceRecord { source_type, source_ref };
        match prepare_root(&source) {
            Ok((root, temporary)) => {
                for dir_name in dir_names {
                    let check = match resolve_skill_root(&root, &dir_name).and_then(|skill_root| compare(&dir_name, &source, &skill_root)) {
                        Ok(check) => check,
                        Err(error) => {
                            let status = if source.source_type == "local" || source.source_type == "import" { "source_missing" } else { "check_failed" };
                            error_check(&dir_name, Some(&source), status, error)
                        }
                    };
                    results.push(check);
                }
                if let Some(path) = temporary {
                    let _ = force_remove_dir_all(&path);
                }
            }
            Err(error) => {
                let status = if source.source_type == "local" || source.source_type == "import" { "source_missing" } else { "check_failed" };
                for dir_name in dir_names {
                    results.push(error_check(&dir_name, Some(&source), status, error.clone()));
                }
            }
        }
    }

    results.sort_by(|left, right| left.dir_name.cmp(&right.dir_name));
    let mut state = paths::load_state();
    for result in &results {
        state.update_records.insert(result.dir_name.clone(), to_record(result));
    }
    paths::save_state(&state)?;
    Ok(results)
}

fn copy_filtered(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination).map_err(|error| error.to_string())?;
    for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name == ".git" || name == "node_modules" || name == "target" {
            continue;
        }
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if file_type.is_symlink() {
            continue;
        }
        let target = destination.join(entry.file_name());
        if file_type.is_dir() {
            copy_filtered(&entry.path(), &target)?;
        } else if file_type.is_file() {
            fs::copy(entry.path(), &target).map_err(|error| format!("复制 {} 失败：{error}", target.display()))?;
        }
    }
    Ok(())
}

pub fn apply(dir_name: &str) -> Result<UpdateOutcome, String> {
    let source = source_for(dir_name).ok_or_else(|| format!("{dir_name} 未记录可更新来源"))?;
    let (root, temporary) = prepare_root(&source)?;
    let result = (|| {
        let source_skill = resolve_skill_root(&root, dir_name)?;
        let check = compare(dir_name, &source, &source_skill)?;
        if check.status == "up_to_date" {
            return Ok(UpdateOutcome {
                dir_name: dir_name.to_string(), changed: false, added: 0, modified: 0, removed: 0,
                backup_path: String::new(), refreshed_tools: Vec::new(), sync_failures: Vec::new(),
            });
        }

        let destination = paths::skills_dir().join(dir_name);
        let backup_root = paths::curator_root().join("update-backups");
        fs::create_dir_all(&backup_root).map_err(|error| error.to_string())?;
        let stamp = chrono::Utc::now().format("%Y%m%d-%H%M%S%.3f");
        let backup = backup_root.join(format!("{dir_name}-{stamp}"));
        fs::rename(&destination, &backup)
            .map_err(|error| format!("创建更新前备份失败：{} -> {}：{error}", destination.display(), backup.display()))?;
        if let Err(copy_error) = copy_filtered(&source_skill, &destination) {
            let _ = force_remove_dir_all(&destination);
            fs::rename(&backup, &destination)
                .map_err(|restore_error| format!("更新复制失败：{copy_error}；恢复原版本也失败：{restore_error}"))?;
            return Err(format!("更新复制失败，已恢复原版本：{copy_error}"));
        }

        let mut refreshed_tools = Vec::new();
        let mut sync_failures = Vec::new();
        for tool in crate::sync::enabled_tools_for(dir_name) {
            match refresh(dir_name, &tool) {
                Ok(()) => refreshed_tools.push(tool),
                Err(error) => sync_failures.push(format!("{tool}：{error}")),
            }
        }
        let mut state = paths::load_state();
        state.update_records.insert(dir_name.to_string(), UpdateRecord {
            status: "up_to_date".to_string(), checked_at: chrono::Utc::now().to_rfc3339(),
            added: 0, modified: 0, removed: 0, binary_files: check.binary_files,
            large_files: check.large_files, error: String::new(),
        });
        paths::append_audit(
            &mut state,
            "skill.update",
            dir_name,
            sync_failures.is_empty(),
            &format!("新增 {}，修改 {}，删除 {}；备份 {}", check.added, check.modified, check.removed, backup.display()),
        );
        paths::save_state(&state)?;
        Ok(UpdateOutcome {
            dir_name: dir_name.to_string(), changed: true, added: check.added, modified: check.modified,
            removed: check.removed, backup_path: backup.display().to_string(), refreshed_tools, sync_failures,
        })
    })();
    if let Some(path) = temporary {
        let _ = force_remove_dir_all(&path);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_status_preserves_failure_reason() {
        let check = error_check("demo", None, "unknown", "未记录来源".to_string());
        assert_eq!(check.status, "unknown");
        assert_eq!(check.error, "未记录来源");
    }
}
