use crate::paths::{load_state, save_state};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

const TOPICS: [&str; 3] = [
    "claude-skills",
    "agent-skills",
    "claude-code-skills",
];
const CACHE_SECONDS: i64 = 3600;

#[derive(Serialize, Deserialize, Clone)]
pub struct TrendingRepo {
    pub full_name: String,
    pub description: String,
    pub stars: u64,
    pub url: String,
    pub clone_url: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TrendingCache {
    pub fetched_at: i64,
    pub repos: Vec<TrendingRepo>,
}

#[derive(Serialize)]
pub struct TrendingView {
    pub repos: Vec<TrendingRepo>,
    pub fetched_at: i64,
    pub from_cache: bool,
    /// 部分 topic 拉取失败的非阻断警告（WO-7）
    pub warnings: Vec<String>,
}

#[derive(Deserialize)]
struct GitHubSearchResponse {
    items: Vec<GitHubRepo>,
}

#[derive(Deserialize)]
struct GitHubRepo {
    full_name: String,
    description: Option<String>,
    stargazers_count: u64,
    html_url: String,
    clone_url: String,
}

enum CurlError {
    Missing,
    Failed { message: String, network: bool },
}

fn epoch_seconds() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

fn is_network_exit_code(code: Option<i32>) -> bool {
    matches!(
        code,
        Some(5 | 6 | 7 | 18 | 28 | 35 | 47 | 52 | 55 | 56 | 60)
    )
}

fn run_curl(url: &str, with_proxy: bool) -> Result<String, CurlError> {
    let mut cmd = Command::new("curl");
    cmd.args([
        "-s",
        "--max-time",
        "20",
        "-H",
        "Accept: application/vnd.github+json",
        "-H",
        "User-Agent: skill-curator",
        url,
    ]);
    if with_proxy {
        cmd.env("HTTP_PROXY", "http://127.0.0.1:7897")
            .env("HTTPS_PROXY", "http://127.0.0.1:7897");
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }

    let output = cmd.output().map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            CurlError::Missing
        } else {
            CurlError::Failed {
                message: format!("无法执行 curl：{error}"),
                network: matches!(
                    error.kind(),
                    std::io::ErrorKind::TimedOut
                        | std::io::ErrorKind::ConnectionRefused
                        | std::io::ErrorKind::ConnectionReset
                        | std::io::ErrorKind::ConnectionAborted
                        | std::io::ErrorKind::NotConnected
                ),
            }
        }
    })?;

    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).into_owned());
    }

    let code = output.status.code();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let message = if stderr.is_empty() {
        match code {
            Some(28) => "请求超时（curl 退出码 28）".to_string(),
            Some(code) => format!("curl 退出码 {code}"),
            None => "curl 请求被终止".to_string(),
        }
    } else {
        stderr
    };
    Err(CurlError::Failed {
        message,
        network: is_network_exit_code(code),
    })
}

fn fetch_topic(topic: &str) -> Result<Vec<TrendingRepo>, String> {
    let url = format!(
        "https://api.github.com/search/repositories?q=topic:{topic}&sort=stars&order=desc&per_page=20"
    );
    let body = match run_curl(&url, false) {
        Ok(body) => body,
        Err(CurlError::Missing) => return Err("未找到 curl".to_string()),
        Err(CurlError::Failed {
            message,
            network: true,
        }) => match run_curl(&url, true) {
            Ok(body) => body,
            Err(CurlError::Missing) => return Err("未找到 curl".to_string()),
            Err(CurlError::Failed {
                message: proxy_message,
                ..
            }) => {
                return Err(format!(
                    "GitHub 请求失败（直连：{message}；代理重试：{proxy_message}）"
                ));
            }
        },
        Err(CurlError::Failed { message, .. }) => {
            return Err(format!("GitHub 请求失败：{message}"));
        }
    };

    if body.contains("API rate limit") {
        return Err("GitHub API 限流，请稍后再试".to_string());
    }

    let response: GitHubSearchResponse =
        serde_json::from_str(&body).map_err(|error| format!("解析 GitHub 响应失败：{error}"))?;
    Ok(response
        .items
        .into_iter()
        .map(|repo| TrendingRepo {
            full_name: repo.full_name,
            description: repo.description.unwrap_or_default(),
            stars: repo.stargazers_count,
            url: repo.html_url,
            clone_url: repo.clone_url,
        })
        .collect())
}

fn fetch_trending() -> Result<(Vec<TrendingRepo>, Vec<String>), String> {
    let mut by_name: HashMap<String, TrendingRepo> = HashMap::new();
    let mut warnings = Vec::new();
    let mut any_ok = false;
    for topic in TOPICS {
        match fetch_topic(topic) {
            Ok(list) => {
                any_ok = true;
                for repo in list {
                    let key = repo.full_name.clone();
                    match by_name.get(&key) {
                        Some(existing) if existing.stars >= repo.stars => {}
                        _ => {
                            by_name.insert(key, repo);
                        }
                    }
                }
            }
            Err(e) => warnings.push(format!("topic {topic} 拉取失败：{e}")),
        }
    }
    if !any_ok {
        return Err(warnings.join("；"));
    }

    let mut repos: Vec<TrendingRepo> = by_name.into_values().collect();
    repos.sort_by(|a, b| {
        b.stars
            .cmp(&a.stars)
            .then_with(|| a.full_name.cmp(&b.full_name))
    });
    repos.truncate(40);
    Ok((repos, warnings))
}

pub fn trending(force: bool) -> Result<TrendingView, String> {
    let state = load_state();
    let now = epoch_seconds();
    if !force {
        if let Some(cache) = state.trending_cache.as_ref() {
            if now >= cache.fetched_at && now - cache.fetched_at < CACHE_SECONDS {
                return Ok(TrendingView {
                    repos: cache.repos.clone(),
                    fetched_at: cache.fetched_at,
                    from_cache: true,
                    warnings: Vec::new(),
                });
            }
        }
    }

    let (repos, warnings) = fetch_trending()?;
    let fetched_at = epoch_seconds();
    // 网络请求期间其他命令可能更新 state，写缓存前重新读取以保留这些变更。
    let mut state = load_state();
    state.trending_cache = Some(TrendingCache {
        fetched_at,
        repos: repos.clone(),
    });
    save_state(&state)?;
    Ok(TrendingView {
        repos,
        fetched_at,
        from_cache: false,
        warnings,
    })
}
