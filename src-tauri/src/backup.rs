use crate::{
    database,
    error::{AppError, Result},
};
use chrono::NaiveDate;
use rusqlite::{
    backup::{Backup, StepResult},
    Connection, OpenFlags,
};
use std::path::{Path, PathBuf};

fn copy(from: &Connection, to: &mut Connection) -> Result<()> {
    let backup = Backup::new(from, to)?;
    match backup.step(-1)? {
        StepResult::Done => Ok(()),
        _ => Err(AppError::invalid(
            "The database is busy. Close any other Homebase windows and try again.",
        )),
    }
}
fn same_file(a: &Path, b: &Path) -> bool {
    match (a.canonicalize(), b.canonicalize()) {
        (Ok(a), Ok(b)) => a.to_string_lossy().to_lowercase() == b.to_string_lossy().to_lowercase(),
        _ => false,
    }
}
pub fn export(conn: &Connection, destination: &Path, live_path: &Path) -> Result<()> {
    if same_file(destination, live_path) {
        return Err(AppError::invalid(
            "Choose a backup file separate from the active database.",
        ));
    }
    let parent = destination
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .ok_or_else(|| AppError::invalid("Choose an absolute backup location."))?;
    if !destination.is_absolute() {
        return Err(AppError::invalid("Choose an absolute backup location."));
    }
    let staging = tempfile::NamedTempFile::new_in(parent)?;
    {
        let mut target = Connection::open(staging.path())?;
        copy(conn, &mut target)?;
    }
    staging
        .persist(destination)
        .map_err(|e| AppError::from(e.error))?;
    Ok(())
}
fn schema(conn: &Connection) -> Result<Vec<(String, String, String)>> {
    Ok(conn.prepare("SELECT type,name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name")?.query_map([],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?)))?.collect::<std::result::Result<_,_>>()?)
}
fn validate(conn: &mut Connection, today: NaiveDate) -> Result<()> {
    let version: i64 = conn.pragma_query_value(None, "user_version", |r| r.get(0))?;
    if !(1..=database::SCHEMA_VERSION).contains(&version) {
        return Err(AppError::invalid(
            "This is not a supported Homebase backup. Newer backups need a newer app version.",
        ));
    }
    let integrity: String = conn.query_row("PRAGMA integrity_check", [], |r| r.get(0))?;
    if integrity != "ok" {
        return Err(AppError::invalid(
            "This backup failed the SQLite integrity check.",
        ));
    }
    database::migrate(conn)?;
    let mut expected = Connection::open_in_memory()?;
    database::migrate(&mut expected)?;
    if schema(conn)? != schema(&expected)? {
        return Err(AppError::invalid(
            "This file does not have a recognized Homebase database structure.",
        ));
    }
    let foreign_key_errors = conn.prepare("PRAGMA foreign_key_check")?.exists([])?;
    if foreign_key_errors {
        return Err(AppError::invalid(
            "This backup has broken task or category references.",
        ));
    }
    let categories = crate::categories::list(conn)?;
    if !categories
        .iter()
        .any(|c| c.id == 1 && c.name == "Uncategorized")
    {
        return Err(AppError::invalid(
            "This backup is missing the permanent Uncategorized category.",
        ));
    }
    let mut names = std::collections::HashSet::new();
    if categories
        .iter()
        .any(|c| !names.insert(c.name.to_lowercase()) || c.name.trim().is_empty())
    {
        return Err(AppError::invalid(
            "This backup contains invalid categories.",
        ));
    }
    for task in crate::tasks::list(conn, today)?.tasks {
        for completion in crate::completions::list(conn, task.id)? {
            if crate::schedule::date(&completion.completed_on)? > today {
                return Err(AppError::invalid(
                    "This backup contains a completion in the future.",
                ));
            }
        }
    }
    let display = crate::settings::display(conn)?;
    if !["relative", "date"].contains(&display.as_str()) {
        return Err(AppError::invalid(
            "This backup contains an invalid display preference.",
        ));
    }
    Ok(())
}
pub fn restore(
    conn: &mut Connection,
    source: &Path,
    directory: &Path,
    today: NaiveDate,
) -> Result<PathBuf> {
    let live_path = directory.join("homebase.db");
    if same_file(source, &live_path) {
        return Err(AppError::invalid(
            "The selected file is already the active database.",
        ));
    }
    // Snapshot read-only input into staging. Validation/migration never touches the original file.
    let source = Connection::open_with_flags(source, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let staging = tempfile::NamedTempFile::new_in(directory)?;
    let mut staged = Connection::open(staging.path())?;
    copy(&source, &mut staged)?;
    validate(&mut staged, today)?;
    let backups = directory.join("backups");
    std::fs::create_dir_all(&backups)?;
    let safety = backups.join(format!(
        "pre-restore-{}.db",
        chrono::Utc::now().format("%Y%m%dT%H%M%S%.9fZ")
    ));
    export(conn, &safety, &live_path)?;
    // SQLite's destination transaction commits only on Done. Any failed/incomplete
    // backup is rolled back by backup_finish; the open connection stays usable.
    copy(&staged, conn)?;
    Ok(safety)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn v1_backups_migrate_in_staging_without_modifying_source() {
        let dir = tempfile::tempdir().unwrap();
        let mut live = setup(dir.path());
        let input_path = dir.path().join("v1.db");
        let source = Connection::open(&input_path).unwrap();
        source
            .execute_batch(include_str!("../migrations/0001_initial.sql"))
            .unwrap();
        source.pragma_update(None, "user_version", 1).unwrap();
        drop(source);
        restore(
            &mut live,
            &input_path,
            dir.path(),
            crate::schedule::date("2026-10-30").unwrap(),
        )
        .unwrap();
        assert_eq!(crate::urgency::defaults(&live).unwrap().grace_days, 0);
        let source = Connection::open(&input_path).unwrap();
        assert_eq!(
            source
                .pragma_query_value(None, "user_version", |r| r.get::<_, i64>(0))
                .unwrap(),
            1
        );
    }
    fn setup(directory: &Path) -> Connection {
        let mut c = database::open(&directory.join("homebase.db")).unwrap();
        let today = crate::schedule::date("2026-10-30").unwrap();
        crate::tasks::save(
            &mut c,
            &crate::tasks::TaskInput {
                coming_up_days: None,
                grace_days: None,
                id: None,
                title: "Sheets".into(),
                category_id: 2,
                schedule: crate::schedule::Schedule::Relative {
                    value: 7,
                    unit: "days".into(),
                },
                tracking_start_on: today.to_string(),
                initial_completed_on: Some("2026-10-21".into()),
            },
            today,
        )
        .unwrap();
        crate::settings::set_display(&c, "date").unwrap();
        c
    }
    #[test]
    fn round_trip_with_history_preferences_and_pre_restore_snapshot() {
        let dir = tempfile::tempdir().unwrap();
        let today = crate::schedule::date("2026-10-30").unwrap();
        let mut c = setup(dir.path());
        let backup = dir.path().join("export.db");
        export(&c, &backup, &dir.path().join("homebase.db")).unwrap();
        crate::tasks::delete(&c, 1).unwrap();
        crate::settings::set_display(&c, "relative").unwrap();
        let safety = restore(&mut c, &backup, dir.path(), today).unwrap();
        assert_eq!(
            crate::tasks::list(&c, today).unwrap().tasks[0]
                .timing
                .elapsed_days,
            Some(9)
        );
        assert_eq!(crate::settings::display(&c).unwrap(), "date");
        let safety = Connection::open(safety).unwrap();
        assert!(crate::tasks::list(&safety, today).unwrap().tasks.is_empty());
        drop(c);
        let c = database::open(&dir.path().join("homebase.db")).unwrap();
        assert_eq!(crate::completions::list(&c, 1).unwrap().len(), 1);
    }
    #[test]
    fn corrupt_newer_unknown_schema_and_invalid_data_leave_live_unchanged() {
        let dir = tempfile::tempdir().unwrap();
        let today = crate::schedule::date("2026-10-30").unwrap();
        let mut c = setup(dir.path());
        let live = dir.path().join("homebase.db");
        assert!(export(&c, &live, &live).is_err());
        assert!(restore(&mut c, &live, dir.path(), today).is_err());
        let corrupt = dir.path().join("corrupt.db");
        std::fs::write(&corrupt, "not sqlite").unwrap();
        assert!(restore(&mut c, &corrupt, dir.path(), today).is_err());
        for mode in ["newer", "empty", "bad-date", "extra-trigger"] {
            let path = dir.path().join(format!("{mode}.db"));
            export(&c, &path, &live).unwrap();
            let input = Connection::open(&path).unwrap();
            match mode {
                "newer"=>input.pragma_update(None,"user_version",999).unwrap(),
                "empty"=>input.execute_batch("DROP TABLE completions;").unwrap(),
                "bad-date"=>input.execute_batch("UPDATE completions SET completed_on='2026-02-30';").unwrap(),
                _=>input.execute_batch("CREATE TRIGGER unexpected AFTER INSERT ON completions BEGIN DELETE FROM tasks; END;").unwrap(),
            };
            drop(input);
            assert!(restore(&mut c, &path, dir.path(), today).is_err(), "{mode}");
            assert_eq!(crate::tasks::list(&c, today).unwrap().tasks.len(), 1);
        }
    }
    #[test]
    fn failed_destination_write_does_not_destroy_existing_database() {
        let dir = tempfile::tempdir().unwrap();
        let today = crate::schedule::date("2026-10-30").unwrap();
        let c = setup(dir.path());
        let live = dir.path().join("homebase.db");
        let backup = dir.path().join("backup.db");
        export(&c, &backup, &live).unwrap();
        crate::categories::save(&c, None, "Garden").unwrap();
        drop(c);
        let mut read_only =
            Connection::open_with_flags(&live, OpenFlags::SQLITE_OPEN_READ_ONLY).unwrap();
        assert!(restore(&mut read_only, &backup, dir.path(), today).is_err());
        assert!(crate::categories::list(&read_only)
            .unwrap()
            .iter()
            .any(|c| c.name == "Garden"));
        assert!(std::fs::read_dir(dir.path().join("backups"))
            .unwrap()
            .next()
            .is_some());
    }
}
