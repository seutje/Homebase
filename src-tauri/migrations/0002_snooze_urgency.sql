ALTER TABLE tasks ADD COLUMN snoozed_until TEXT;
ALTER TABLE tasks ADD COLUMN snooze_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN coming_up_days INTEGER CHECK(coming_up_days BETWEEN 0 AND 365);
ALTER TABLE tasks ADD COLUMN grace_days INTEGER CHECK(grace_days BETWEEN 0 AND 365);
ALTER TABLE completions ADD COLUMN prior_snoozed_until TEXT;
ALTER TABLE completions ADD COLUMN cleared_snooze_revision INTEGER;
INSERT INTO settings VALUES('urgencyDefaults','{"comingUpDays":null,"graceDays":0}');
