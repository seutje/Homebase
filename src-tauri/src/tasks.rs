use crate::{
    error::Result,
    schedule::{date, Schedule, Timing},
};
use chrono::NaiveDate;
use rusqlite::Connection;
use serde::Serialize;

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
