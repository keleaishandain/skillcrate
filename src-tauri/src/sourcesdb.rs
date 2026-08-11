use crate::paths::repo_root;
use std::collections::HashMap;

/// 只读打开 skills-manager 的 SQLite 索引补充来源信息；任何失败静默降级。
/// E2：多套列名尝试适配未知 schema，绝不写入该库。
pub fn load_sources() -> Option<HashMap<String, (String, String)>> {
    let db_path = repo_root().join("skills-manager.db");
    if !db_path.is_file() {
        return None;
    }
    let conn = rusqlite::Connection::open_with_flags(
        &db_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    )
    .ok()?;
    let _ = conn.busy_timeout(std::time::Duration::from_millis(1500));
    for sql in [
        "SELECT dir_name, source_type, source_ref FROM skills",
        "SELECT name, source_type, source_ref FROM skills",
        "SELECT id, source_type, source_ref FROM skills",
    ] {
        let Ok(mut stmt) = conn.prepare(sql) else {
            continue;
        };
        let rows = stmt.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, Option<String>>(1)?.unwrap_or_default(),
                r.get::<_, Option<String>>(2)?.unwrap_or_default(),
            ))
        });
        if let Ok(rows) = rows {
            let map: HashMap<String, (String, String)> =
                rows.flatten().map(|(k, t, rf)| (k, (t, rf))).collect();
            if !map.is_empty() {
                return Some(map);
            }
        }
    }
    None
}
