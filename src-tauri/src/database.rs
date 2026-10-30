use crate::error::{AppError, Result};
use rusqlite::Connection;
use std::path::Path;

pub const SCHEMA_VERSION: i64 = 1;
pub fn open(path: &Path) -> Result<Connection> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE;")?;
    conn.busy_timeout(std::time::Duration::from_secs(5))?;
    migrate(&mut conn)?;
    Ok(conn)
}
pub fn migrate(conn: &mut Connection) -> Result<()> {
    let version: i64 = conn.pragma_query_value(None, "user_version", |r| r.get(0))?;
    if version > SCHEMA_VERSION {
        return Err(AppError::invalid(
            "This database was made by a newer Homebase version. Use that version to open it.",
        ));
    }
    if version < 1 {
        apply(conn, include_str!("../migrations/0001_initial.sql"), 1)?;
    }
    Ok(())
}
fn apply(conn: &mut Connection, sql: &str, version: i64) -> Result<()> {
    let tx = conn.transaction()?;
    tx.execute_batch(sql)?;
    tx.pragma_update(None, "user_version", version)?;
    tx.commit()?;
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn fresh_reopen_and_seed_once() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.db");
        {
            let conn = open(&path).unwrap();
            assert_eq!(
                conn.query_row("SELECT COUNT(*) FROM categories", [], |r| r
                    .get::<_, i64>(0))
                    .unwrap(),
                9
            );
            conn.execute("UPDATE categories SET name='My laundry' WHERE id=2", [])
                .unwrap();
        }
        let conn = open(&path).unwrap();
        assert_eq!(
            conn.query_row("SELECT name FROM categories WHERE id=2", [], |r| r
                .get::<_, String>(0))
                .unwrap(),
            "My laundry"
        );
        assert_eq!(
            conn.query_row("SELECT COUNT(*) FROM tasks", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            0
        );
    }
    #[test]
    fn migration_failure_rolls_back_and_newer_is_refused() {
        let mut conn = Connection::open_in_memory().unwrap();
        assert!(apply(&mut conn, "CREATE TABLE example(id); INVALID SQL;", 1).is_err());
        assert_eq!(
            conn.pragma_query_value(None, "user_version", |r| r.get::<_, i64>(0))
                .unwrap(),
            0
        );
        assert!(conn.prepare("SELECT * FROM example").is_err());
        conn.pragma_update(None, "user_version", 999).unwrap();
        assert!(migrate(&mut conn).is_err());
    }
}
