use crate::paths::{load_state, save_state, skills_dir, tmp_dir, SourceRecord};
use crate::sync::{copy_dir_all, force_remove_dir_all};
use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Serialize)]
pub struct ImportOutcome {
    pub imported: Vec<String>,
    pub skipped: Vec<String>,
    pub message: String,
}

fn is_skill_dir(p: &Path) -> bool {
    p.join("SKILL.md").is_file() || p.join("skill.md").is_file()
}

/// 发现技能目录：根目录本身 / 一级子目录 / 二级子目录（如 repo/skills/xxx）。
fn discover_skill_dirs(root: &Path) -> Vec<PathBuf> {
    if is_skill_dir(root) {
        return vec![root.to_path_buf()];
    }
    let mut found = Vec::new();
    let mut deeper: Vec<PathBuf> = Vec::new();
    if let Ok(rd) = fs::read_dir(root) {
        for e in rd.flatten() {
            let p = e.path();
            if !p.is_dir() {
                continue;
            }
            let name = e.file_name().to_string_lossy().to_string();
            if name.starts_with('.') || name == "node_modules" || name == "target" {
                continue;
            }
            if is_skill_dir(&p) {
                found.push(p);
            } else {
                deeper.push(p);
            }
        }
    }
    for dir in deeper {
        if let Ok(rd) = fs::read_dir(&dir) {
            for e in rd.flatten() {
                let p = e.path();
                if p.is_dir()
                    && !e.file_name().to_string_lossy().starts_with('.')
                    && is_skill_dir(&p)
                {
                    found.push(p);
                }
            }
        }
    }
    found
}

/// shared_ref = Some(url)：git/skillssh，全体共用来源；None：local，逐目录记原路径。
/// 来源记录写入 SkillCurator 自己的 state.json（E6），供包分组（D1 派生）使用。
fn copy_into_library(
    dirs: &[(PathBuf, String)],
    filter: Option<&str>,
    source_type: &str,
    shared_ref: Option<&str>,
) -> Result<ImportOutcome, String> {
    let lib = skills_dir();
    fs::create_dir_all(&lib).map_err(|e| e.to_string())?;
    let mut state = load_state();
    let mut imported = Vec::new();
    let mut skipped = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    for (path, name) in dirs {
        if name.is_empty() {
            continue;
        }
        if let Some(f) = filter {
            if f != name {
                continue;
            }
        }
        if !seen.insert(name.clone()) {
            skipped.push(format!("{name}（来源内重名）"));
            continue;
        }
        let dst = lib.join(name);
        if dst.exists() {
            skipped.push(format!("{name}（库中已存在）"));
            continue;
        }
        copy_dir_all(path, &dst).map_err(|e| format!("复制 {name} 失败：{e}"))?;
        let source_ref = shared_ref
            .map(str::to_string)
            .unwrap_or_else(|| path.display().to_string());
        state.sources.insert(
            name.clone(),
            SourceRecord {
                source_type: source_type.to_string(),
                source_ref,
            },
        );
        imported.push(name.clone());
    }
    save_state(&state)?;
    let message = if imported.is_empty() && skipped.is_empty() {
        "未在该来源中发现技能（目录需包含 SKILL.md）".to_string()
    } else {
        format!("导入 {} 个，跳过 {} 个", imported.len(), skipped.len())
    };
    Ok(ImportOutcome {
        imported,
        skipped,
        message,
    })
}

fn with_names(dirs: Vec<PathBuf>) -> Vec<(PathBuf, String)> {
    dirs.into_iter()
        .map(|p| {
            let name = p
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            (p, name)
        })
        .collect()
}

pub fn import_local(path: &str) -> Result<ImportOutcome, String> {
    let p = PathBuf::from(path.trim());
    if !p.is_dir() {
        return Err(format!("目录不存在：{}", p.display()));
    }
    let dirs = discover_skill_dirs(&p);
    if dirs.is_empty() {
        return Err("该目录及其两级子目录中未发现 SKILL.md".into());
    }
    copy_into_library(&with_names(dirs), None, "local", None)
}

fn run_git(args: &[&str], with_proxy: bool) -> Result<(), String> {
    let mut cmd = Command::new("git");
    cmd.args(args);
    if with_proxy {
        cmd.env("HTTP_PROXY", "http://127.0.0.1:7897")
            .env("HTTPS_PROXY", "http://127.0.0.1:7897");
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let out = cmd.output().map_err(|e| format!("无法执行 git：{e}"))?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

fn repo_name_from_url(url: &str) -> String {
    url.trim_end_matches('/')
        .rsplit('/')
        .next()
        .unwrap_or("skill")
        .trim_end_matches(".git")
        .to_string()
}

/// E9：直连失败且像网络错误时，经 127.0.0.1:7897 代理自动重试一次。
pub fn import_git_as(
    url: &str,
    skill_filter: Option<&str>,
    source_type: &str,
) -> Result<ImportOutcome, String> {
    let url = url.trim();
    if url.is_empty() {
        return Err("请填写 Git 仓库地址".into());
    }
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let tmp = tmp_dir().join(format!("clone-{stamp}"));
    fs::create_dir_all(tmp_dir()).map_err(|e| e.to_string())?;
    let tmp_s = tmp.to_string_lossy().to_string();
    if let Err(e) = run_git(&["clone", "--depth", "1", url, &tmp_s], false) {
        let lower = e.to_lowercase();
        let network = ["unable to access", "timed out", "could not resolve", "connection", "ssl", "rpc failed", "early eof"]
            .iter()
            .any(|h| lower.contains(h));
        if network {
            let _ = force_remove_dir_all(&tmp);
            run_git(&["clone", "--depth", "1", url, &tmp_s], true)
                .map_err(|e2| format!("git clone 失败（直连：{e}；代理重试：{e2}）"))?;
        } else {
            let _ = force_remove_dir_all(&tmp);
            return Err(format!("git clone 失败：{e}"));
        }
    }
    let result = if is_skill_dir(&tmp) {
        // 仓库根目录本身就是一个技能：用仓库名作为技能目录名
        let name = repo_name_from_url(url);
        copy_into_library(&[(tmp.clone(), name)], skill_filter, source_type, Some(url))
    } else {
        let dirs = discover_skill_dirs(&tmp);
        if dirs.is_empty() {
            Err("仓库中未发现 SKILL.md（检查了根目录与两级子目录）".to_string())
        } else {
            copy_into_library(&with_names(dirs), skill_filter, source_type, Some(url))
        }
    };
    let _ = force_remove_dir_all(&tmp);
    result
}

pub fn import_git(url: &str) -> Result<ImportOutcome, String> {
    import_git_as(url, None, "git")
}

/// E7：skills.sh 引用按 GitHub 直译：owner/repo[@skill] → clone github.com/owner/repo。
pub fn import_skillssh(reference: &str) -> Result<ImportOutcome, String> {
    let reference = reference.trim();
    let (repo_part, skill) = match reference.split_once('@') {
        Some((r, s)) => (r.trim(), Some(s.trim())),
        None => (reference, None),
    };
    let segs: Vec<&str> = repo_part.split('/').filter(|s| !s.is_empty()).collect();
    if segs.len() != 2 {
        return Err("格式应为 owner/repo 或 owner/repo@skill".into());
    }
    let url = format!("https://github.com/{}/{}.git", segs[0], segs[1]);
    let outcome = import_git_as(&url, skill.filter(|s| !s.is_empty()), "skillssh")?;
    if outcome.imported.is_empty() && skill.is_some() && outcome.skipped.is_empty() {
        return Err(format!(
            "仓库里没有名为 {} 的技能目录",
            skill.unwrap_or_default()
        ));
    }
    Ok(outcome)
}
