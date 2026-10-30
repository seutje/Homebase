use crate::error::{AppError, Result};
use rusqlite::Connection;
pub fn display(conn: &Connection) -> Result<String> {
    let value: String = conn.query_row(
        "SELECT value FROM settings WHERE key='completionDisplay'",
        [],
        |r| r.get(0),
    )?;
    serde_json::from_str(&value)
        .map_err(|_| AppError::invalid("Could not read the display preference."))
}
pub fn set_display(conn: &Connection, value: &str) -> Result<()> {
    if !["relative", "date"].contains(&value) {
        return Err(AppError::invalid("Choose relative time or calendar dates."));
    }
    conn.execute("INSERT INTO settings(key,value) VALUES('completionDisplay',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[serde_json::to_string(value).unwrap()])?;
    Ok(())
}
