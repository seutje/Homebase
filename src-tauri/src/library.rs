use crate::{
    error::{AppError, Result},
    schedule::Schedule,
};
use chrono::NaiveDate;
use rusqlite::{params, Connection};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct Template {
    pub key: String,
    pub name: String,
    pub category: String,
    pub value: u32,
    pub unit: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Selection {
    pub key: String,
    pub value: u32,
    pub unit: String,
    pub allow_duplicate: bool,
}
pub fn catalog() -> Result<Vec<Template>> {
    let templates: Vec<Template> =
        serde_json::from_str(include_str!("../../src/data/chore-templates.json"))
            .map_err(|_| AppError::invalid("Could not read the bundled chore library."))?;
    for template in &templates {
        Schedule::Relative {
            value: template.value,
            unit: template.unit.clone(),
        }
        .validate()?;
    }
    Ok(templates)
}
pub fn add(conn: &mut Connection, selected: Vec<Selection>, today: NaiveDate) -> Result<Vec<i64>> {
    if selected.is_empty() || selected.len() > 100 {
        return Err(AppError::invalid("Select between 1 and 100 chores."));
    }
    let templates = catalog()?;
    let tx = conn.transaction()?;
    let mut added = Vec::new();
    for selection in selected {
        let template = templates
            .iter()
            .find(|t| t.key == selection.key)
            .ok_or_else(|| AppError::invalid("This chore template does not exist."))?;
        let duplicate: bool = tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM tasks WHERE source_template_key=?1)",
            [&selection.key],
            |r| r.get(0),
        )?;
        if duplicate && !selection.allow_duplicate {
            return Err(AppError::invalid(format!(
                "{} is already in your tasks. Choose Add another to make a separate copy.",
                template.name
            )));
        }
        Schedule::Relative {
            value: selection.value,
            unit: selection.unit.clone(),
        }
        .timing(today, None, today)?;
        let category_id = match crate::categories::list(&tx)?
            .into_iter()
            .find(|c| c.name.to_lowercase() == template.category.to_lowercase())
        {
            Some(category) => category.id,
            None => crate::categories::save(&tx, None, &template.category)?,
        };
        let now = chrono::Utc::now().to_rfc3339();
        tx.execute("INSERT INTO tasks(title,category_id,schedule_kind,interval_value,interval_unit,tracking_start_on,source_template_key,created_at,updated_at) VALUES(?1,?2,'relative',?3,?4,?5,?6,?7,?7)",params![template.name,category_id,selection.value,selection.unit,today.to_string(),template.key,now])?;
        added.push(tx.last_insert_rowid());
    }
    tx.commit()?;
    Ok(added)
}
#[cfg(test)]
mod tests {
    use super::*;
    fn pick(key: &str, value: u32, allow_duplicate: bool) -> Selection {
        Selection {
            key: key.into(),
            value,
            unit: "days".into(),
            allow_duplicate,
        }
    }
    #[test]
    fn catalog_is_valid_and_tasks_are_customizable_independent_copies() {
        let templates = catalog().unwrap();
        assert!((20..=30).contains(&templates.len()));
        let keys = templates
            .iter()
            .map(|t| t.key.clone())
            .collect::<std::collections::HashSet<_>>();
        assert_eq!(keys.len(), templates.len());
        for t in &templates {
            Schedule::Relative {
                value: t.value,
                unit: t.unit.clone(),
            }
            .validate()
            .unwrap();
        }
        let mut c = Connection::open_in_memory().unwrap();
        crate::database::migrate(&mut c).unwrap();
        let today = crate::schedule::date("2026-10-30").unwrap();
        crate::categories::save(&c, Some(2), "Linen").unwrap();
        add(
            &mut c,
            vec![
                pick("wash-bedsheets", 9, false),
                pick("wash-towels", 8, false),
            ],
            today,
        )
        .unwrap();
        let tasks = crate::tasks::list(&c, today).unwrap().tasks;
        assert_eq!(tasks.len(), 2);
        assert!(tasks.iter().all(|t| t.timing.last_completed_on.is_none()));
        assert_eq!(
            crate::categories::list(&c)
                .unwrap()
                .iter()
                .filter(|cat| cat.name == "Laundry")
                .count(),
            1
        );
        assert!(add(&mut c, vec![pick("wash-bedsheets", 1, false)], today).is_err());
        add(&mut c, vec![pick("wash-bedsheets", 3, true)], today).unwrap();
        assert_eq!(
            c.query_row("SELECT interval_value FROM tasks WHERE id=1", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            9
        );
    }
    #[test]
    fn invalid_selection_rolls_back_all_additions() {
        let mut c = Connection::open_in_memory().unwrap();
        crate::database::migrate(&mut c).unwrap();
        let today = crate::schedule::date("2026-10-30").unwrap();
        assert!(add(
            &mut c,
            vec![
                pick("wash-bedsheets", 7, false),
                pick("does-not-exist", 1, false)
            ],
            today
        )
        .is_err());
        assert!(crate::tasks::list(&c, today).unwrap().tasks.is_empty());
    }
}
