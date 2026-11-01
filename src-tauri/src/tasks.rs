use crate::error::AppError;
use crate::{
    error::Result,
    schedule::{date, Schedule, Timing},
};
use chrono::NaiveDate;
use rusqlite::params;
use rusqlite::Connection;
use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskInput {
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub links: Vec<String>,
    #[serde(default)]
    pub active_months: Vec<u32>,
    pub id: Option<i64>,
    pub title: String,
    pub category_id: i64,
    pub schedule: Schedule,
    pub tracking_start_on: String,
    pub initial_completed_on: Option<String>,
    #[serde(default)]
    pub coming_up_days: Option<u32>,
    #[serde(default)]
    pub grace_days: Option<u32>,
}

pub fn save(conn: &mut Connection, input: &TaskInput, today: NaiveDate) -> Result<i64> {
    crate::notes::validate(&input.notes)?;
    let links = crate::notes::normalize_links(&input.links)?;
    crate::seasons::validate(&input.active_months)?;
    crate::urgency::validate(input.coming_up_days, input.grace_days)?;
    let title = input.title.trim();
    if title.is_empty() || title.chars().count() > 200 {
        return Err(AppError::invalid("Task titles need 1–200 characters."));
    }
    let start = date(&input.tracking_start_on)?;
    input.schedule.timing(start, None, today)?;
    if input.id.is_some() && input.initial_completed_on.is_some() {
        return Err(AppError::invalid(
            "Correct completion dates through the task history.",
        ));
    }
    if let Some(last) = input.initial_completed_on.as_deref() {
        let last = date(last)?;
        if last > today {
            return Err(AppError::invalid(
                "Completion dates cannot be in the future.",
            ));
        }
        input.schedule.timing(start, Some(last), today)?;
    }
    let tx = conn.transaction()?;
    let exists: bool = tx.query_row(
        "SELECT EXISTS(SELECT 1 FROM categories WHERE id=?1)",
        [input.category_id],
        |r| r.get(0),
    )?;
    if !exists {
        return Err(AppError::invalid("Choose an existing category."));
    }
    let (kind, value, unit, weekday) = match &input.schedule {
        Schedule::Relative { value, unit } => ("relative", Some(*value), Some(unit.as_str()), None),
        Schedule::Weekly { weekday } => ("weekly", None, None, Some(*weekday)),
    };
    let now = chrono::Utc::now().to_rfc3339();
    let id = if let Some(id) = input.id {
        // Validate the new rule against the latest existing completion before writing it.
        let last: Option<String> = tx.query_row(
            "SELECT MAX(completed_on) FROM completions WHERE task_id=?1",
            [id],
            |r| r.get(0),
        )?;
        input
            .schedule
            .timing(start, last.as_deref().map(date).transpose()?, today)?;
        if tx.execute("UPDATE tasks SET title=?1,category_id=?2,schedule_kind=?3,interval_value=?4,interval_unit=?5,weekday=?6,tracking_start_on=?7,updated_at=?8 WHERE id=?9",params![title,input.category_id,kind,value,unit,weekday,input.tracking_start_on,now,id])?==0 {return Err(AppError::missing());}
        id
    } else {
        tx.execute("INSERT INTO tasks(title,category_id,schedule_kind,interval_value,interval_unit,weekday,tracking_start_on,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?8)",params![title,input.category_id,kind,value,unit,weekday,input.tracking_start_on,now])?;
        let id = tx.last_insert_rowid();
        if let Some(last) = &input.initial_completed_on {
            tx.execute("INSERT INTO completions(task_id,completed_on,created_at,updated_at) VALUES(?1,?2,?3,?3)",params![id,last,now])?;
        }
        id
    };
    tx.execute(
        "UPDATE tasks SET coming_up_days=?1,grace_days=?2 WHERE id=?3",
        params![input.coming_up_days, input.grace_days, id],
    )?;
    tx.execute(
        "UPDATE tasks SET active_months=?1 WHERE id=?2",
        params![serde_json::to_string(&input.active_months).unwrap(), id],
    )?;
    tx.execute(
        "UPDATE tasks SET notes=?1,links=?2 WHERE id=?3",
        params![input.notes, serde_json::to_string(&links).unwrap(), id],
    )?;
    tx.commit()?;
    Ok(id)
}

pub fn delete(conn: &Connection, id: i64) -> Result<()> {
    if conn.execute("DELETE FROM tasks WHERE id=?1", [id])? == 0 {
        return Err(AppError::missing());
    }
    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub notes: String,
    pub links: Vec<String>,
    pub active_months: Vec<u32>,
    pub is_snoozed: bool,
    pub is_out_of_season: bool,
    pub recurrence_due: String,
    pub id: i64,
    pub title: String,
    pub category_id: i64,
    pub category_name: String,
    pub schedule: Schedule,
    pub tracking_start_on: String,
    pub source_template_key: Option<String>,
    pub snoozed_until: Option<String>,
    pub coming_up_days: Option<u32>,
    pub grace_days: Option<u32>,
    #[serde(flatten)]
    pub timing: Timing,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskList {
    pub urgency_defaults: crate::urgency::Defaults,
    pub as_of_date: String,
    pub tasks: Vec<Task>,
}

pub fn list(conn: &Connection, today: NaiveDate) -> Result<TaskList> {
    let urgency_defaults = crate::urgency::defaults(conn)?;
    let mut stmt=conn.prepare("SELECT t.id,t.title,t.category_id,c.name,t.schedule_kind,t.interval_value,t.interval_unit,t.weekday,t.tracking_start_on,t.source_template_key,MAX(h.completed_on) FROM tasks t JOIN categories c ON c.id=t.category_id LEFT JOIN completions h ON h.task_id=t.id GROUP BY t.id")?;
    let rows = stmt.query_map([], |r| {
        let kind: String = r.get(4)?;
        let schedule = if kind == "relative" {
            Schedule::Relative {
                value: r.get(5)?,
                unit: r.get(6)?,
            }
        } else {
            Schedule::Weekly { weekday: r.get(7)? }
        };
        Ok((
            r.get::<_, i64>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, i64>(2)?,
            r.get::<_, String>(3)?,
            schedule,
            r.get::<_, String>(8)?,
            r.get::<_, Option<String>>(9)?,
            r.get::<_, Option<String>>(10)?,
        ))
    })?;
    let mut tasks = Vec::new();
    for row in rows {
        let (
            id,
            title,
            category_id,
            category_name,
            schedule,
            tracking_start_on,
            source_template_key,
            last,
        ) = row?;
        let mut timing = schedule.timing(
            date(&tracking_start_on)?,
            last.as_deref().map(date).transpose()?,
            today,
        )?;
        let (snoozed_until, coming_up_days, grace_days): (
            Option<String>,
            Option<u32>,
            Option<u32>,
        ) = conn.query_row(
            "SELECT snoozed_until,coming_up_days,grace_days FROM tasks WHERE id=?1",
            [id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )?;
        let active_months: String =
            conn.query_row("SELECT active_months FROM tasks WHERE id=?1", [id], |r| {
                r.get(0)
            })?;
        let active_months = crate::seasons::parse(&active_months)?;
        let recurrence_due = timing.next_due.clone();
        let is_out_of_season = crate::seasons::apply(&mut timing, &active_months, today)?;
        crate::urgency::apply(
            &mut timing,
            coming_up_days,
            grace_days,
            &urgency_defaults,
            snoozed_until.as_deref(),
            today,
        )?;
        let is_snoozed = timing.status == "snoozed";
        if is_out_of_season {
            timing.status = "outOfSeason";
        }
        // History is authoritative: without it there is no urgency yet.
        if last.is_none() {
            timing.status = "untracked";
        }
        let (notes, links): (String, String) =
            conn.query_row("SELECT notes,links FROM tasks WHERE id=?1", [id], |r| {
                Ok((r.get(0)?, r.get(1)?))
            })?;
        crate::notes::validate(&notes)?;
        let links = crate::notes::parse_links(&links)?;
        tasks.push(Task {
            notes,
            links,
            active_months,
            is_snoozed,
            is_out_of_season,
            recurrence_due,
            id,
            title,
            category_id,
            category_name,
            schedule,
            tracking_start_on,
            source_template_key,
            snoozed_until,
            coming_up_days,
            grace_days,
            timing,
        });
    }
    tasks.sort_by(|a, b| {
        a.timing
            .last_completed_on
            .is_none()
            .cmp(&b.timing.last_completed_on.is_none())
            .then_with(|| {
                if a.timing.last_completed_on.is_none() {
                    std::cmp::Ordering::Equal
                } else {
                    a.timing.next_due.cmp(&b.timing.next_due)
                }
            })
            .then_with(|| a.title.to_lowercase().cmp(&b.title.to_lowercase()))
            .then(a.id.cmp(&b.id))
    });
    Ok(TaskList {
        urgency_defaults,
        as_of_date: today.to_string(),
        tasks,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn untracked_state_survives_restart_and_follows_history() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("untracked.db");
        let today = date("2026-10-30").unwrap();
        {
            let c = crate::database::open(&path).unwrap();
            for (kind, weekday) in [("relative", "NULL"), ("weekly", "7")] {
                let interval = if kind == "relative" {
                    "7,'days'"
                } else {
                    "NULL,NULL"
                };
                c.execute(&format!("INSERT INTO tasks(title,category_id,schedule_kind,interval_value,interval_unit,weekday,tracking_start_on,created_at,updated_at) VALUES ('New chore',1,'{kind}',{interval},{weekday},'2020-01-01','now','now')"), []).unwrap();
            }
        }
        let mut c = crate::database::open(&path).unwrap();
        for task in list(&c, today).unwrap().tasks {
            assert_eq!(task.timing.status, "untracked");
            assert_eq!(task.timing.elapsed_days, None);
            let recorded =
                crate::completions::record(&mut c, task.id, "2026-10-21", today).unwrap();
            assert_eq!(
                list(&c, today)
                    .unwrap()
                    .tasks
                    .iter()
                    .find(|t| t.id == task.id)
                    .unwrap()
                    .timing
                    .status,
                "attention"
            );
            crate::completions::undo(&mut c, recorded.id, today).unwrap();
            assert_eq!(
                list(&c, today)
                    .unwrap()
                    .tasks
                    .iter()
                    .find(|t| t.id == task.id)
                    .unwrap()
                    .timing
                    .status,
                "untracked"
            );
            let recorded =
                crate::completions::record(&mut c, task.id, "2026-10-30", today).unwrap();
            crate::completions::delete(&mut c, recorded.id, today).unwrap();
            assert_eq!(
                list(&c, today)
                    .unwrap()
                    .tasks
                    .iter()
                    .find(|t| t.id == task.id)
                    .unwrap()
                    .timing
                    .status,
                "untracked"
            );
        }
    }
    #[test]
    fn notes_links_persist_and_invalid_link_edits_do_not_overwrite_them() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("notes.db");
        let today = date("2026-10-30").unwrap();
        {
            let mut c = crate::database::open(&path).unwrap();
            let mut input = TaskInput {
                notes: "Use cleaning cycle\nModel ABC".into(),
                links: vec!["https://example.com/manual".into()],
                active_months: vec![],
                coming_up_days: None,
                grace_days: None,
                id: None,
                title: "Washer".into(),
                category_id: 1,
                schedule: Schedule::Relative {
                    value: 1,
                    unit: "months".into(),
                },
                tracking_start_on: today.to_string(),
                initial_completed_on: None,
            };
            let id = save(&mut c, &input, today).unwrap();
            input.id = Some(id);
            input.notes = "Do not save".into();
            input.links = vec!["file:///C:/secret".into()];
            assert!(save(&mut c, &input, today).is_err());
            assert!(crate::notes::link_for(&c, id, 1).is_err());
        }
        let c = crate::database::open(&path).unwrap();
        let task = list(&c, today).unwrap().tasks.remove(0);
        assert_eq!(task.notes, "Use cleaning cycle\nModel ABC");
        assert_eq!(task.links, vec!["https://example.com/manual"]);
    }
    #[test]
    fn seasonal_settings_persist_and_snooze_remains_independent() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("seasonal.db");
        let today = date("2026-10-30").unwrap();
        {
            let mut c = crate::database::open(&path).unwrap();
            let input = TaskInput {
                notes: String::new(),
                links: vec![],
                active_months: vec![11, 12, 1, 2],
                coming_up_days: None,
                grace_days: None,
                id: None,
                title: "Winter chore".into(),
                category_id: 1,
                schedule: Schedule::Relative {
                    value: 7,
                    unit: "days".into(),
                },
                tracking_start_on: "2025-01-01".into(),
                initial_completed_on: None,
            };
            let id = save(&mut c, &input, today).unwrap();
            crate::urgency::snooze(&c, id, Some("2026-11-05".into()), today).unwrap();
        }
        let c = crate::database::open(&path).unwrap();
        let task = list(&c, today).unwrap().tasks.remove(0);
        assert!(task.is_out_of_season);
        assert!(task.is_snoozed);
        assert_eq!(task.timing.status, "untracked");
        assert!(task.timing.last_completed_on.is_none());
        let task = list(&c, date("2026-11-06").unwrap())
            .unwrap()
            .tasks
            .remove(0);
        assert!(!task.is_out_of_season);
        assert!(!task.is_snoozed);
        assert_eq!(task.timing.next_due, "2026-11-01");
        assert_eq!(task.recurrence_due, "2025-01-01");
    }
    #[test]
    fn edits_and_preferences_survive_reopen_and_invalid_inputs_do_not_write() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.db");
        let today = date("2026-10-30").unwrap();
        let id;
        {
            let mut c = crate::database::open(&path).unwrap();
            let mut input = TaskInput {
                notes: String::new(),
                links: vec![],
                active_months: vec![],
                coming_up_days: None,
                grace_days: None,
                id: None,
                title: " Bedsheets ".into(),
                category_id: 2,
                schedule: Schedule::Relative {
                    value: 7,
                    unit: "days".into(),
                },
                tracking_start_on: today.to_string(),
                initial_completed_on: Some("2026-10-21".into()),
            };
            id = save(&mut c, &input, today).unwrap();
            input.id = Some(id);
            input.initial_completed_on = None;
            input.title = "Fresh sheets".into();
            input.schedule = Schedule::Weekly { weekday: 7 };
            save(&mut c, &input, today).unwrap();
            input.id = None;
            input.category_id = 999;
            assert!(save(&mut c, &input, today).is_err());
            crate::settings::set_display(&c, "date").unwrap();
            assert!(crate::settings::set_display(&c, "invalid").is_err());
        }
        let c = crate::database::open(&path).unwrap();
        let rows = list(&c, today).unwrap();
        assert_eq!(rows.tasks.len(), 1);
        assert_eq!(rows.tasks[0].title, "Fresh sheets");
        assert_eq!(rows.tasks[0].timing.next_due, "2026-11-01");
        assert_eq!(crate::settings::display(&c).unwrap(), "date");
        delete(&c, id).unwrap();
        assert!(delete(&c, id).is_err());
        assert_eq!(
            c.query_row("SELECT COUNT(*) FROM completions", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            0
        );
    }
    #[test]
    fn list_derives_history_and_stable_order() {
        let mut conn = Connection::open_in_memory().unwrap();
        crate::database::migrate(&mut conn).unwrap();
        for title in ["Zulu", "Alpha", "Alpha"] {
            conn.execute("INSERT INTO tasks(title,category_id,schedule_kind,interval_value,interval_unit,tracking_start_on,created_at,updated_at) VALUES (?1,1,'relative',7,'days','2026-10-30','now','now')",[title]).unwrap();
        }
        let today = date("2026-10-30").unwrap();
        let data = list(&conn, today).unwrap();
        assert_eq!(data.as_of_date, "2026-10-30");
        assert_eq!(
            data.tasks.iter().map(|t| t.id).collect::<Vec<_>>(),
            vec![2, 3, 1]
        );
        conn.execute("INSERT INTO completions(task_id,completed_on,created_at,updated_at) VALUES (1,'2026-10-21','now','now')",[]).unwrap();
        let data = list(&conn, today).unwrap();
        assert_eq!(data.tasks[0].id, 1);
        assert_eq!(data.tasks[0].timing.elapsed_days, Some(9));
    }
}
