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
    pub id: Option<i64>,
    pub title: String,
    pub category_id: i64,
    pub schedule: Schedule,
    pub tracking_start_on: String,
    pub initial_completed_on: Option<String>,
}

pub fn save(conn: &mut Connection, input: &TaskInput, today: NaiveDate) -> Result<i64> {
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
    pub id: i64,
    pub title: String,
    pub category_id: i64,
    pub category_name: String,
    pub schedule: Schedule,
    pub tracking_start_on: String,
    pub source_template_key: Option<String>,
    #[serde(flatten)]
    pub timing: Timing,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskList {
    pub as_of_date: String,
    pub tasks: Vec<Task>,
}

pub fn list(conn: &Connection, today: NaiveDate) -> Result<TaskList> {
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
        let timing = schedule.timing(
            date(&tracking_start_on)?,
            last.as_deref().map(date).transpose()?,
            today,
        )?;
        tasks.push(Task {
            id,
            title,
            category_id,
            category_name,
            schedule,
            tracking_start_on,
            source_template_key,
            timing,
        });
    }
    tasks.sort_by(|a, b| {
        a.timing
            .next_due
            .cmp(&b.timing.next_due)
            .then_with(|| a.title.to_lowercase().cmp(&b.title.to_lowercase()))
            .then(a.id.cmp(&b.id))
    });
    Ok(TaskList {
        as_of_date: today.to_string(),
        tasks,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn edits_and_preferences_survive_reopen_and_invalid_inputs_do_not_write() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.db");
        let today = date("2026-10-30").unwrap();
        let id;
        {
            let mut c = crate::database::open(&path).unwrap();
            let mut input = TaskInput {
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
