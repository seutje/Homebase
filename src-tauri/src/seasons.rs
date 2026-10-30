use crate::{
    error::{AppError, Result},
    schedule::{date, Timing},
};
use chrono::{Datelike, Months, NaiveDate};

pub fn validate(months: &[u32]) -> Result<()> {
    if months.len() > 12
        || months.iter().any(|m| !(1..=12).contains(m))
        || months
            .iter()
            .collect::<std::collections::HashSet<_>>()
            .len()
            != months.len()
    {
        return Err(AppError::invalid(
            "Choose each active month at most once, from January through December.",
        ));
    }
    Ok(())
}
pub fn parse(value: &str) -> Result<Vec<u32>> {
    let months: Vec<u32> = serde_json::from_str(value)
        .map_err(|_| AppError::invalid("Could not read seasonal months."))?;
    validate(&months)?;
    Ok(months)
}
// A contiguous active window can cross New Year; any gap starts a new window.
pub fn apply(timing: &mut Timing, months: &[u32], today: NaiveDate) -> Result<bool> {
    validate(months)?;
    if months.is_empty() || months.len() == 12 {
        return Ok(false);
    }
    if !months.contains(&today.month()) {
        return Ok(true);
    }
    let mut start = today.with_day(1).unwrap();
    while let Some(previous) = start
        .checked_sub_months(Months::new(1))
        .filter(|d| d.year() >= 1)
    {
        if !months.contains(&previous.month()) {
            break;
        }
        start = previous;
    }
    if date(&timing.next_due)? < start {
        timing.next_due = start.to_string();
        timing.days_until_due = (start - today).num_days();
        timing.status = "attention";
    }
    Ok(false)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn windows_wrap_years_and_restart_after_gaps_without_fake_history() {
        let schedule = crate::schedule::Schedule::Relative {
            value: 7,
            unit: "days".into(),
        };
        let original = date("2024-01-10").unwrap();
        for (today, months, due, inactive) in [
            ("2026-10-30", vec![11, 12, 1, 2], "2024-01-17", true),
            ("2027-01-10", vec![11, 12, 1, 2], "2026-11-01", false),
            ("2027-11-10", vec![11, 12, 1, 2], "2027-11-01", false),
            ("2026-10-30", vec![3, 10], "2026-10-01", false),
        ] {
            let today = date(today).unwrap();
            let mut t = schedule.timing(original, Some(original), today).unwrap();
            assert_eq!(apply(&mut t, &months, today).unwrap(), inactive);
            assert_eq!(t.next_due, due);
            assert_eq!(t.last_completed_on.as_deref(), Some("2024-01-10"));
        }
    }
    #[test]
    fn never_completed_future_starts_all_year_and_validation() {
        let s = crate::schedule::Schedule::Weekly { weekday: 7 };
        let today = date("2026-11-01").unwrap();
        let mut t = s.timing(date("2025-01-01").unwrap(), None, today).unwrap();
        apply(&mut t, &[11, 12, 1, 2], today).unwrap();
        assert_eq!(t.next_due, "2026-11-01");
        assert!(t.last_completed_on.is_none());
        let mut t = s.timing(date("2026-12-01").unwrap(), None, today).unwrap();
        apply(&mut t, &[11, 12, 1, 2], today).unwrap();
        assert_eq!(t.next_due, "2026-12-06");
        let unchanged = t.next_due.clone();
        apply(&mut t, &[], today).unwrap();
        assert_eq!(t.next_due, unchanged);
        assert!(validate(&[1, 1]).is_err());
        assert!(validate(&[0]).is_err());
    }
}
