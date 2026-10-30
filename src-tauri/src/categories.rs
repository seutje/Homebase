use crate::error::{AppError, Result};
use rusqlite::{params, Connection};
use serde::Serialize;

#[derive(Serialize)]
pub struct Category {
    pub id: i64,
    pub name: String,
}
pub fn list(conn: &Connection) -> Result<Vec<Category>> {
    Ok(conn
        .prepare("SELECT id,name FROM categories ORDER BY position,name COLLATE NOCASE")?
        .query_map([], |r| {
            Ok(Category {
                id: r.get(0)?,
                name: r.get(1)?,
            })
        })?
        .collect::<std::result::Result<_, _>>()?)
}
pub fn save(conn: &Connection, id: Option<i64>, name: &str) -> Result<i64> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 80 {
        return Err(AppError::invalid("Category names need 1–80 characters."));
    }
    if id == Some(1) {
        return Err(AppError::invalid(
            "Uncategorized is the permanent fallback category.",
        ));
    }
    if list(conn)?
        .iter()
        .any(|c| Some(c.id) != id && c.name.to_lowercase() == name.to_lowercase())
    {
        return Err(AppError::invalid(
            "A category with that name already exists.",
        ));
    }
    if let Some(id) = id {
        if conn.execute(
            "UPDATE categories SET name=?1 WHERE id=?2",
            params![name, id],
        )? == 0
        {
            return Err(AppError::missing());
        }
        Ok(id)
    } else {
        conn.execute("INSERT INTO categories(name,position) VALUES(?1,(SELECT COALESCE(MAX(position),0)+1 FROM categories WHERE id<>1))",[name])?;
        Ok(conn.last_insert_rowid())
    }
}
pub fn delete(conn: &mut Connection, id: i64, move_to: i64) -> Result<()> {
    if id == 1 || id == move_to {
        return Err(AppError::invalid(
            "Choose a different category. Uncategorized cannot be deleted.",
        ));
    }
    let tx = conn.transaction()?;
    let exists: bool = tx.query_row(
        "SELECT EXISTS(SELECT 1 FROM categories WHERE id=?1)",
        [move_to],
        |r| r.get(0),
    )?;
    if !exists {
        return Err(AppError::missing());
    }
    tx.execute(
        "UPDATE tasks SET category_id=?1,updated_at=?2 WHERE category_id=?3",
        params![move_to, chrono::Utc::now().to_rfc3339(), id],
    )?;
    if tx.execute("DELETE FROM categories WHERE id=?1", [id])? == 0 {
        return Err(AppError::missing());
    }
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn renaming_and_reassignment_preserve_tasks() {
        let mut c = Connection::open_in_memory().unwrap();
        c.pragma_update(None, "foreign_keys", true).unwrap();
        crate::database::migrate(&mut c).unwrap();
        c.execute("INSERT INTO tasks(title,category_id,schedule_kind,interval_value,interval_unit,tracking_start_on,created_at,updated_at) VALUES('Chore',2,'relative',7,'days','2026-10-30','now','now')",[]).unwrap();
        save(&c, Some(2), "Linen").unwrap();
        assert!(save(&c, None, "linen").is_err());
        assert!(delete(&mut c, 2, 999).is_err());
        assert_eq!(list(&c).unwrap().len(), 9);
        delete(&mut c, 2, 1).unwrap();
        assert_eq!(
            c.query_row("SELECT category_id FROM tasks", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            1
        );
        assert!(delete(&mut c, 1, 3).is_err());
    }
}
