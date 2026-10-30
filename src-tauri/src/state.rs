use crate::error::{AppError, Result};
use rusqlite::Connection;
use std::{path::PathBuf, sync::Mutex};

pub struct Store {
    pub connection: Mutex<Connection>,
    pub directory: PathBuf,
}
impl Store {
    pub fn with<T>(&self, action: impl FnOnce(&mut Connection) -> Result<T>) -> Result<T> {
        let mut conn = self
            .connection
            .lock()
            .map_err(|_| AppError::invalid("Homebase is busy. Please restart the app."))?;
        action(&mut conn)
    }
}
