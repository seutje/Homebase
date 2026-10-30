use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct AppError {
    pub code: &'static str,
    pub message: String,
}
pub type Result<T> = std::result::Result<T, AppError>;
impl AppError {
    pub fn invalid(message: impl Into<String>) -> Self {
        Self {
            code: "validation",
            message: message.into(),
        }
    }
    pub fn missing() -> Self {
        Self {
            code: "not_found",
            message: "This record no longer exists. Refresh and try again.".into(),
        }
    }
}
impl From<rusqlite::Error> for AppError {
    fn from(error: rusqlite::Error) -> Self {
        Self {
            code: "database",
            message: format!("Could not save or read your data: {error}"),
        }
    }
}
impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        Self {
            code: "file",
            message: format!("Could not access the file: {error}"),
        }
    }
}
