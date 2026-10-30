CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(name)) BETWEEN 1 AND 80),
    position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
    category_id INTEGER NOT NULL REFERENCES categories(id),
    schedule_kind TEXT NOT NULL,
    interval_value INTEGER,
    interval_unit TEXT,
    weekday INTEGER,
    tracking_start_on TEXT NOT NULL,
    source_template_key TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK((schedule_kind='relative' AND interval_value IS NOT NULL AND interval_unit IS NOT NULL AND weekday IS NULL
        AND ((interval_unit='days' AND interval_value BETWEEN 1 AND 3650) OR (interval_unit='weeks' AND interval_value BETWEEN 1 AND 520) OR (interval_unit='months' AND interval_value BETWEEN 1 AND 120)))
        OR (schedule_kind='weekly' AND weekday IS NOT NULL AND weekday BETWEEN 1 AND 7 AND interval_value IS NULL AND interval_unit IS NULL))
);
CREATE TABLE completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    completed_on TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(task_id, completed_on)
);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX tasks_category ON tasks(category_id);
INSERT INTO categories(id,name,position) VALUES
    (1,'Uncategorized',99),(2,'Laundry',0),(3,'Kitchen',1),(4,'Bathrooms',2),
    (5,'General Cleaning',3),(6,'Home Maintenance',4),(7,'Life Admin',5),
    (8,'Personal Care',6),(9,'Dog Care',7);
INSERT INTO settings VALUES('completionDisplay','"relative"');
