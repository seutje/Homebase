use crate::error::{AppError, Result};
use rusqlite::{Connection, OptionalExtension};

pub fn validate(text: &str) -> Result<()> {
    if text.chars().count() > 20_000 {
        return Err(AppError::invalid(
            "Notes can contain up to 20,000 characters.",
        ));
    }
    Ok(())
}
pub fn normalize_links(links: &[String]) -> Result<Vec<String>> {
    if links.len() > 20 {
        return Err(AppError::invalid("A task can have up to 20 links."));
    }
    let mut result = Vec::new();
    for value in links {
        let value = value.trim();
        let parsed = url::Url::parse(value)
            .map_err(|_| AppError::invalid("Use a complete http:// or https:// link."))?;
        if value.len() > 2048
            || !["http", "https"].contains(&parsed.scheme())
            || parsed.host_str().is_none()
            || !(value.to_lowercase().starts_with("http://")
                || value.to_lowercase().starts_with("https://"))
        {
            return Err(AppError::invalid(
                "Links must be complete HTTP(S) URLs of at most 2,048 characters.",
            ));
        }
        let normalized = parsed.to_string();
        if !result.contains(&normalized) {
            result.push(normalized);
        }
    }
    Ok(result)
}
pub fn parse_links(value: &str) -> Result<Vec<String>> {
    let values: Vec<String> = serde_json::from_str(value)
        .map_err(|_| AppError::invalid("Could not read the task's links."))?;
    normalize_links(&values)
}
pub fn link_for(conn: &Connection, id: i64, index: usize) -> Result<String> {
    let json: String = conn
        .query_row("SELECT links FROM tasks WHERE id=?1", [id], |r| r.get(0))
        .optional()?
        .ok_or_else(AppError::missing)?;
    parse_links(&json)?
        .get(index)
        .cloned()
        .ok_or_else(AppError::missing)
}
pub fn open(conn: &Connection, id: i64, index: usize) -> Result<()> {
    let url = link_for(conn, id, index)?;
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer.exe")
            .arg(url)
            .spawn()?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = url;
        Err(AppError::invalid("Opening links is supported on Windows."))
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_complete_http_links_are_accepted_and_duplicates_normalize() {
        for bad in [
            "javascript:alert(1)",
            "file:///C:/Windows",
            "data:text/html,test",
            "mailto:person@example.com",
            "https://",
            "https:example.com",
            "C:\\file.txt",
        ] {
            assert!(normalize_links(&[bad.into()]).is_err(), "{bad}");
        }
        assert_eq!(
            normalize_links(&[
                " https://example.com ".into(),
                "https://example.com/".into()
            ])
            .unwrap(),
            vec!["https://example.com/"]
        );
        assert!(validate(&"x".repeat(20_001)).is_err());
        assert!(normalize_links(&vec!["https://example.com".into(); 21]).is_err());
    }
}
