use crate::error::{AppError, Result};
use chrono::{Datelike, Days, Months, NaiveDate};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Schedule {
    Relative { value: u32, unit: String },
    Weekly { weekday: u32 },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Timing {
    pub last_completed_on: Option<String>,
    pub elapsed_days: Option<i64>,
    pub next_due: String,
    pub days_until_due: i64,
    pub status: &'static str,
}

pub fn date(text: &str) -> Result<NaiveDate> {
    let parsed = NaiveDate::parse_from_str(text, "%Y-%m-%d")
        .map_err(|_| AppError::invalid("Choose a valid calendar date."))?;
    if parsed.format("%Y-%m-%d").to_string() != text || !(1..=9999).contains(&parsed.year()) {
        return Err(AppError::invalid("Use a date between years 0001 and 9999."));
    }
    Ok(parsed)
}

impl Schedule {
    pub fn validate(&self) -> Result<()> {
        match self {
            Self::Relative { value, unit } => {
                let limit = match unit.as_str() {
                    "days" => 3650,
                    "weeks" => 520,
                    "months" => 120,
                    _ => 0,
                };
                if *value == 0 || *value > limit {
                    return Err(AppError::invalid(
                        "Choose a positive interval within the supported range.",
                    ));
                }
            }
            Self::Weekly { weekday } if !(1..=7).contains(weekday) => {
                return Err(AppError::invalid("Choose a weekday."))
            }
            _ => (),
        }
        Ok(())
    }

    fn add(&self, from: NaiveDate) -> Result<NaiveDate> {
        let target = match self {
            Self::Relative { value, unit } if unit == "months" => {
                from.checked_add_months(Months::new(*value))
            }
            Self::Relative { value, unit } => from.checked_add_days(Days::new(
                u64::from(*value) * if unit == "weeks" { 7 } else { 1 },
            )),
            _ => None,
        };
        target.filter(|d| d.year() <= 9999).ok_or_else(|| {
            AppError::invalid("This interval extends beyond the supported calendar.")
        })
    }

    pub fn timing(
        &self,
        start: NaiveDate,
        last: Option<NaiveDate>,
        today: NaiveDate,
    ) -> Result<Timing> {
        self.validate()?;
        let (due, span) = match self {
            Self::Relative { .. } => {
                let anchor = last.unwrap_or(start);
                let following = self.add(anchor)?;
                (
                    if last.is_some() { following } else { start },
                    (following - anchor).num_days(),
                )
            }
            Self::Weekly { weekday } => {
                let earliest = match last {
                    Some(d) => d
                        .checked_add_days(Days::new(1))
                        .ok_or_else(|| {
                            AppError::invalid("Date is outside the supported calendar.")
                        })?
                        .max(start),
                    None => start,
                };
                let offset = (*weekday as i64 - earliest.weekday().number_from_monday() as i64)
                    .rem_euclid(7);
                let due = earliest
                    .checked_add_days(Days::new(offset as u64))
                    .filter(|d| d.year() <= 9999)
                    .ok_or_else(|| AppError::invalid("Date is outside the supported calendar."))?;
                (due, 7)
            }
        };
        let until = (due - today).num_days();
        let window = ((span + 4) / 5).clamp(1, 7);
        Ok(Timing {
            last_completed_on: last.map(|d| d.to_string()),
            elapsed_days: last.map(|d| (today - d).num_days()),
            next_due: due.to_string(),
            days_until_due: until,
            status: if until <= 0 {
                "attention"
            } else if until <= window {
                "upcoming"
            } else {
                "good"
            },
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn d(s: &str) -> NaiveDate {
        date(s).unwrap()
    }
    fn relative(value: u32, unit: &str) -> Schedule {
        Schedule::Relative {
            value,
            unit: unit.into(),
        }
    }
    #[test]
    fn examples_and_calendar_days() {
        let schedule = relative(7, "days");
        let timing = schedule
            .timing(d("2026-10-01"), Some(d("2026-10-21")), d("2026-10-30"))
            .unwrap();
        assert_eq!(timing.elapsed_days, Some(9));
        assert_eq!(timing.next_due, "2026-10-28");
        assert_eq!(timing.days_until_due, -2);
        assert_eq!(timing.status, "attention");
        assert_eq!(
            schedule
                .timing(d("2026-10-01"), Some(d("2026-10-24")), d("2026-10-30"))
                .unwrap()
                .status,
            "upcoming"
        );
        // Brussels DST changes on March 29 and October 25: date subtraction remains one day.
        for (from, to) in [("2026-03-28", "2026-03-29"), ("2026-10-24", "2026-10-25")] {
            assert_eq!(
                schedule
                    .timing(d(from), Some(d(from)), d(to))
                    .unwrap()
                    .elapsed_days,
                Some(1)
            );
        }
    }
    #[test]
    fn months_clamp_and_weeks_are_days() {
        for (from, value, to) in [
            ("2027-01-31", 1, "2027-02-28"),
            ("2028-01-31", 1, "2028-02-29"),
            ("2026-08-31", 6, "2027-02-28"),
        ] {
            assert_eq!(
                relative(value, "months")
                    .timing(d(from), Some(d(from)), d(from))
                    .unwrap()
                    .next_due,
                to
            );
        }
        assert_eq!(
            relative(2, "weeks")
                .timing(d("2026-10-30"), Some(d("2026-10-30")), d("2026-10-30"))
                .unwrap()
                .next_due,
            "2026-11-13"
        );
    }
    #[test]
    fn weekly_preserves_overdue_and_weekday() {
        let s = Schedule::Weekly { weekday: 7 };
        for (last, due) in [
            ("2026-10-20", "2026-10-25"),
            ("2026-10-25", "2026-11-01"),
            ("2026-10-27", "2026-11-01"),
            ("2026-10-30", "2026-11-01"),
        ] {
            assert_eq!(
                s.timing(d("2026-10-01"), Some(d(last)), d("2026-10-30"))
                    .unwrap()
                    .next_due,
                due
            );
        }
        assert_eq!(
            s.timing(d("2026-11-04"), Some(d("2026-10-30")), d("2026-10-30"))
                .unwrap()
                .next_due,
            "2026-11-08"
        );
    }
    #[test]
    fn never_completed_and_validation() {
        let t = relative(7, "days")
            .timing(d("2026-10-30"), None, d("2026-10-30"))
            .unwrap();
        assert_eq!(t.elapsed_days, None);
        assert_eq!(t.next_due, "2026-10-30");
        assert_eq!(t.status, "attention");
        assert_eq!(
            relative(7, "days")
                .timing(d("2026-11-10"), None, d("2026-10-30"))
                .unwrap()
                .status,
            "good"
        );
        for invalid in ["2026-02-30", "2026-1-01", "0000-01-01"] {
            assert!(date(invalid).is_err());
        }
        assert!(relative(0, "days").validate().is_err());
        assert!(relative(121, "months").validate().is_err());
    }
}
