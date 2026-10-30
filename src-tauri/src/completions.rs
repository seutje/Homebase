use crate::{
    error::{AppError, Result},
    schedule::date,
};
use chrono::NaiveDate;
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Completion {
    pub id: i64,
    pub task_id: i64,
    pub completed_on: String,
}
#[derive(Serialize)]
pub struct Recorded {
    pub id: i64,
    pub inserted: bool,
}
pub fn list(conn: &Connection, task_id: i64) -> Result<Vec<Completion>> {
    Ok(conn.prepare("SELECT id,task_id,completed_on FROM completions WHERE task_id=?1 ORDER BY completed_on DESC,id DESC")?.query_map([task_id],|r|Ok(Completion{id:r.get(0)?,task_id:r.get(1)?,completed_on:r.get(2)?}))?.collect::<std::result::Result<_,_>>()?)
}
fn valid_date(value: &str, today: NaiveDate) -> Result<()> {
    if date(value)? > today {
        return Err(AppError::invalid(
            "Completion dates cannot be in the future.",
        ));
    }
    Ok(())
}
pub fn record(
    conn: &mut Connection,
    task_id: i64,
    completed_on: &str,
    today: NaiveDate,
) -> Result<Recorded> {
    valid_date(completed_on, today)?;
    let tx = conn.transaction()?;
    if !tx.query_row(
        "SELECT EXISTS(SELECT 1 FROM tasks WHERE id=?1)",
        [task_id],
        |r| r.get::<_, bool>(0),
    )? {
        return Err(AppError::missing());
    }
    let now = chrono::Utc::now().to_rfc3339();
    let inserted=tx.execute("INSERT INTO completions(task_id,completed_on,created_at,updated_at) VALUES(?1,?2,?3,?3) ON CONFLICT(task_id,completed_on) DO NOTHING",params![task_id,completed_on,now])?>0;
    let id = tx.query_row(
        "SELECT id FROM completions WHERE task_id=?1 AND completed_on=?2",
        params![task_id, completed_on],
        |r| r.get(0),
    )?;
    if inserted {
        tx.execute("UPDATE completions SET prior_snoozed_until=(SELECT snoozed_until FROM tasks WHERE id=?1),cleared_snooze_revision=(SELECT snooze_revision+1 FROM tasks WHERE id=?1) WHERE id=?2",params![task_id,id])?;
        tx.execute("UPDATE tasks SET snoozed_until=NULL,snooze_revision=snooze_revision+1,updated_at=?2 WHERE id=?1",params![task_id,now])?;
    }
    crate::tasks::list(&tx, today)?;
    tx.commit()?;
    Ok(Recorded { id, inserted })
}
pub fn update(conn: &mut Connection, id: i64, completed_on: &str, today: NaiveDate) -> Result<()> {
    valid_date(completed_on, today)?;
    let tx = conn.transaction()?;
    let task_id: i64 = tx
        .query_row("SELECT task_id FROM completions WHERE id=?1", [id], |r| {
            r.get(0)
        })
        .optional()?
        .ok_or_else(AppError::missing)?;
    let duplicate: bool = tx.query_row(
        "SELECT EXISTS(SELECT 1 FROM completions WHERE task_id=?1 AND completed_on=?2 AND id<>?3)",
        params![task_id, completed_on, id],
        |r| r.get(0),
    )?;
    if duplicate {
        return Err(AppError::invalid(
            "A completion is already recorded on that date.",
        ));
    }
    tx.execute(
        "UPDATE completions SET completed_on=?1,updated_at=?2 WHERE id=?3",
        params![completed_on, chrono::Utc::now().to_rfc3339(), id],
    )?;
    crate::tasks::list(&tx, today)?;
    tx.commit()?;
    Ok(())
}
pub fn delete(conn: &mut Connection, id: i64, today: NaiveDate) -> Result<()> {
    remove(conn, id, today, false)
}
pub fn undo(conn: &mut Connection, id: i64, today: NaiveDate) -> Result<()> {
    remove(conn, id, today, true)
}
fn remove(conn: &mut Connection, id: i64, today: NaiveDate, undo: bool) -> Result<()> {
    let tx = conn.transaction()?;
    if undo {
        tx.execute("UPDATE tasks SET snoozed_until=(SELECT prior_snoozed_until FROM completions WHERE id=?1),snooze_revision=snooze_revision+1,updated_at=?2 WHERE id=(SELECT task_id FROM completions WHERE id=?1) AND snooze_revision=(SELECT cleared_snooze_revision FROM completions WHERE id=?1)",params![id,chrono::Utc::now().to_rfc3339()])?;
    }
    if tx.execute("DELETE FROM completions WHERE id=?1", [id])? == 0 {
        return Err(AppError::missing());
    }
    crate::tasks::list(&tx, today)?;
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn completion_undo_restores_snooze_but_preserves_later_choices() {
        let (mut c, today) = setup();
        crate::urgency::snooze(&c, 1, Some("2026-11-02".into()), today).unwrap();
        let event = record(&mut c, 1, "2026-10-21", today).unwrap();
        assert_eq!(
            crate::tasks::list(&c, today).unwrap().tasks[0].snoozed_until,
            None
        );
        undo(&mut c, event.id, today).unwrap();
        let task = crate::tasks::list(&c, today).unwrap().tasks.remove(0);
        assert_eq!(task.snoozed_until.as_deref(), Some("2026-11-02"));
        assert!(task.timing.last_completed_on.is_none());
        let event = record(&mut c, 1, "2026-10-21", today).unwrap();
        crate::urgency::snooze(&c, 1, Some("2026-11-05".into()), today).unwrap();
        let duplicate = record(&mut c, 1, "2026-10-21", today).unwrap();
        assert!(!duplicate.inserted);
        undo(&mut c, event.id, today).unwrap();
        assert_eq!(
            crate::tasks::list(&c, today).unwrap().tasks[0]
                .snoozed_until
                .as_deref(),
            Some("2026-11-05")
        );
        assert!(crate::urgency::snooze(&c, 1, Some("2026-10-30".into()), today).is_err());
    }
    fn setup() -> (Connection, NaiveDate) {
        let mut c = Connection::open_in_memory().unwrap();
        c.pragma_update(None, "foreign_keys", true).unwrap();
        crate::database::migrate(&mut c).unwrap();
        c.execute("INSERT INTO tasks(title,category_id,schedule_kind,interval_value,interval_unit,tracking_start_on,created_at,updated_at) VALUES('Sheets',1,'relative',7,'days','2026-10-30','now','now')",[]).unwrap();
        (c, date("2026-10-30").unwrap())
    }
    #[test]
    fn backdating_duplicates_correction_and_exact_undo() {
        let (mut c, today) = setup();
        let newest = record(&mut c, 1, "2026-10-30", today).unwrap();
        assert!(newest.inserted);
        let duplicate = record(&mut c, 1, "2026-10-30", today).unwrap();
        assert!(!duplicate.inserted);
        assert_eq!(duplicate.id, newest.id);
        let older = record(&mut c, 1, "2026-10-27", today).unwrap();
        assert_eq!(
            crate::tasks::list(&c, today).unwrap().tasks[0]
                .timing
                .elapsed_days,
            Some(0)
        );
        assert!(update(&mut c, older.id, "2026-10-30", today).is_err());
        delete(&mut c, newest.id, today).unwrap();
        assert_eq!(
            crate::tasks::list(&c, today).unwrap().tasks[0]
                .timing
                .elapsed_days,
            Some(3)
        );
        update(&mut c, older.id, "2026-10-21", today).unwrap();
        assert_eq!(
            crate::tasks::list(&c, today).unwrap().tasks[0]
                .timing
                .days_until_due,
            -2
        );
        delete(&mut c, older.id, today).unwrap();
        assert_eq!(
            crate::tasks::list(&c, today).unwrap().tasks[0]
                .timing
                .last_completed_on,
            None
        );
        let next = record(&mut c, 1, "2026-10-30", today).unwrap();
        assert_ne!(next.id, newest.id);
        assert!(delete(&mut c, newest.id, today).is_err());
        assert_eq!(list(&c, 1).unwrap().len(), 1);
    }
    #[test]
    fn invalid_dates_missing_tasks_and_failed_writes_preserve_history() {
        let (mut c, today) = setup();
        for value in ["2026-11-01", "2026-02-30"] {
            assert!(record(&mut c, 1, value, today).is_err());
        }
        assert!(record(&mut c, 999, "2026-10-30", today).is_err());
        assert!(list(&c, 1).unwrap().is_empty());
        c.execute_batch("CREATE TRIGGER fail_write BEFORE INSERT ON completions BEGIN SELECT RAISE(ABORT,'simulated disk error'); END;").unwrap();
        assert!(record(&mut c, 1, "2026-10-30", today).is_err());
        assert!(list(&c, 1).unwrap().is_empty());
    }
}
