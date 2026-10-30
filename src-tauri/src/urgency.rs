use crate::{
    error::{AppError, Result},
    schedule::{date, Timing},
};
use chrono::NaiveDate;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Defaults {
    pub coming_up_days: Option<u32>,
    pub grace_days: u32,
}
pub fn validate(coming: Option<u32>, grace: Option<u32>) -> Result<()> {
    if coming.is_some_and(|d| d > 365) || grace.is_some_and(|d| d > 365) {
        return Err(AppError::invalid(
            "Urgency windows must be between 0 and 365 days.",
        ));
    }
    Ok(())
}
pub fn defaults(conn: &Connection) -> Result<Defaults> {
    let json: String = conn.query_row(
        "SELECT value FROM settings WHERE key='urgencyDefaults'",
        [],
        |r| r.get(0),
    )?;
    let value: Defaults = serde_json::from_str(&json)
        .map_err(|_| AppError::invalid("Could not read urgency defaults."))?;
    validate(value.coming_up_days, Some(value.grace_days))?;
    Ok(value)
}
pub fn save_defaults(conn: &Connection, value: Defaults) -> Result<()> {
    validate(value.coming_up_days, Some(value.grace_days))?;
    conn.execute(
        "UPDATE settings SET value=?1 WHERE key='urgencyDefaults'",
        [serde_json::to_string(&value).unwrap()],
    )?;
    Ok(())
}
pub fn apply(
    timing: &mut Timing,
    coming: Option<u32>,
    grace: Option<u32>,
    defaults: &Defaults,
    snooze: Option<&str>,
    today: NaiveDate,
) -> Result<()> {
    validate(coming, grace)?;
    if let Some(window) = coming.or(defaults.coming_up_days) {
        if timing.days_until_due > 0 {
            timing.status = if timing.days_until_due <= i64::from(window) {
                "upcoming"
            } else {
                "good"
            };
        }
    }
    let grace = grace.unwrap_or(defaults.grace_days);
    if grace > 0 && timing.days_until_due <= 0 && -timing.days_until_due <= i64::from(grace) {
        timing.status = "grace";
    }
    if let Some(until) = snooze {
        if date(until)? > today {
            timing.status = "snoozed";
        }
    }
    Ok(())
}
pub fn snooze(conn: &Connection, id: i64, until: Option<String>, today: NaiveDate) -> Result<()> {
    if let Some(until) = &until {
        if date(until)? <= today {
            return Err(AppError::invalid("Snooze until a future date."));
        }
    }
    if conn.execute("UPDATE tasks SET snoozed_until=?1,snooze_revision=snooze_revision+1,updated_at=?2 WHERE id=?3",params![until,chrono::Utc::now().to_rfc3339(),id])?==0 {return Err(AppError::missing());}
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn grace_windows_overrides_and_snooze_expiry_are_derived_from_today() {
        let s = crate::schedule::Schedule::Relative {
            value: 7,
            unit: "days".into(),
        };
        let start = date("2026-10-01").unwrap();
        let last = Some(date("2026-10-21").unwrap());
        let defaults = Defaults {
            coming_up_days: Some(5),
            grace_days: 3,
        };
        for (today, expected) in [
            ("2026-10-30", "snoozed"),
            ("2026-10-31", "grace"),
            ("2026-11-01", "attention"),
        ] {
            let today = date(today).unwrap();
            let mut t = s.timing(start, last, today).unwrap();
            apply(&mut t, None, None, &defaults, Some("2026-10-31"), today).unwrap();
            assert_eq!(t.status, expected);
            assert_eq!(t.next_due, "2026-10-28");
        }
        let today = date("2026-10-24").unwrap();
        let mut t = s.timing(start, last, today).unwrap();
        apply(&mut t, None, None, &defaults, None, today).unwrap();
        assert_eq!(t.status, "upcoming");
        apply(&mut t, Some(0), Some(0), &defaults, None, today).unwrap();
        assert_eq!(t.status, "good");
        assert!(validate(Some(366), None).is_err());
    }
}
