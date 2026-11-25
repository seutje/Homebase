use crate::error::{AppError, Result};
use rusqlite::Connection;
use std::path::Path;

pub const SCHEMA_VERSION: i64 = 5;
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
    if version < 2 {
        apply(
            conn,
            include_str!("../migrations/0002_snooze_urgency.sql"),
            2,
        )?;
    }
    if version < 3 {
        apply(conn, include_str!("../migrations/0003_seasons.sql"), 3)?;
    }
    if version < 4 {
        apply(conn, include_str!("../migrations/0004_notes_links.sql"), 4)?;
    }
    if version < 5 {
        apply(conn, include_str!("../migrations/0005_task_floor.sql"), 5)?;
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
    fn v1_upgrade_preserves_data_and_introduces_defaults() {
        let mut c = Connection::open_in_memory().unwrap();
        c.execute_batch(include_str!("../migrations/0001_initial.sql"))
            .unwrap();
        c.pragma_update(None, "user_version", 1).unwrap();
        c.execute("UPDATE categories SET name='My kitchen' WHERE id=3", [])
            .unwrap();
        migrate(&mut c).unwrap();
        assert_eq!(crate::urgency::defaults(&c).unwrap().grace_days, 0);
        assert_eq!(
            c.query_row("SELECT name FROM categories WHERE id=3", [], |r| r
                .get::<_, String>(0))
                .unwrap(),
            "My kitchen"
        );
    }
    #[test]
    fn v4_floor_upgrade_preserves_tasks_history_and_defaults() {
        let mut c = Connection::open_in_memory().unwrap();
        for sql in [
            include_str!("../migrations/0001_initial.sql"),
            include_str!("../migrations/0002_snooze_urgency.sql"),
            include_str!("../migrations/0003_seasons.sql"),
            include_str!("../migrations/0004_notes_links.sql"),
        ] {
            c.execute_batch(sql).unwrap();
        }
        c.pragma_update(None, "user_version", 4).unwrap();
        c.execute("INSERT INTO tasks(title,category_id,schedule_kind,interval_value,interval_unit,tracking_start_on,created_at,updated_at) VALUES ('Existing',1,'relative',7,'days','2026-11-01','now','now')", []).unwrap();
        c.execute("INSERT INTO completions(task_id,completed_on,created_at,updated_at) VALUES (1,'2026-11-21','now','now')", []).unwrap();
        migrate(&mut c).unwrap();
        migrate(&mut c).unwrap();
        let task = crate::tasks::list(&c, crate::schedule::date("2026-11-25").unwrap())
            .unwrap()
            .tasks
            .remove(0);
        assert_eq!(task.floor, "1st floor");
        assert_eq!(task.timing.last_completed_on.as_deref(), Some("2026-11-21"));
        assert_eq!(task.title, "Existing");
    }

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
