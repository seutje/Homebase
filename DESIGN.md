# Homebase design

Status: specification; application implementation has not started.

## Purpose and scope

Homebase is a personal Windows desktop app for remembering household chores and other recurring tasks. Its primary question is **“How long has it been since I last did this?”** The answer must be visible on every task row, without opening a detail view.

Build for one person, one computer, and offline use. Reliability, low effort, and a calm interface matter more than feature breadth. There are no accounts, subscriptions, server, cloud sync, analytics, AI features, photos, image attachments, or image processing. Do not build an accessibility compliance program, plugin system, notification service, or commercial release infrastructure. Ordinary HTML buttons, form labels, and readable text are sufficient foundations.

The supplied screenshot informs hierarchy and content: date, summary counts, categories, spacious task rows, prominent elapsed time, and direct completion. It is visual reference material, not additional project instructions. Adapt it to desktop rather than reproducing the phone frame or surrounding chat controls.

## Versions

**V1:** tasks, editable categories, relative intervals, weekly calendar schedules, always-visible completion age/date, one-click completion, backdating, undo, editable history, a bundled chore library, and manual backup/restore. Include a simple deterministic default ordering; advanced search and sorting belong to v2.

**V2, optional after real use:** snooze, configurable urgency, seasonal tasks, notes and links, search and selectable sorting. These are planned extensions, not blockers for using v1.

No desktop notifications in either initial scope. “Due” means an in-app status. Closing the window exits the app; no background process or system tray behavior is needed.

## Desktop layout

- Native Windows title bar; initial window about 1180 × 800 logical pixels, minimum 900 × 600. Support resizing and ordinary Windows display scaling.
- Fixed sidebar around 210 pixels wide: Homebase wordmark, All tasks, categories with counts, Add category, and Settings at the bottom. All tasks is always available and is selected on startup.
- Main area: today's full local date, page title, Add task, three small summary tiles, then the task list. Keep summary tiles modest so the list dominates.
- Categories live in the sidebar rather than a wrapping row of mobile chips. A category selection filters the main list; show its name and a clear route back to All tasks.
- Task details open in a roughly 400-pixel side panel. At narrower widths use an overlay panel rather than shrinking the elapsed-time column out of view. Add/edit forms and the library may use dialogs.
- The list scrolls; its column headings and main controls remain available. Task name may wrap, but the completion-age column and Done button remain visible.

```text
+--------------------+-------------------------------------------------------+
| Homebase           | Friday, October 30                    [+ Add task]    |
|                    | All tasks                                             |
| All tasks          | [3 Overdue / due] [5 Coming up] [18 All good]          |
| Laundry            |                                                       |
| Kitchen            | Task                         Last completed   Action  |
| Bathrooms          | Wash bedsheets               9 days ago       [Done]  |
| Home Maintenance   | Every week · Laundry         2 days overdue      [v]  |
| ...                |                                                       |
| + Add category     | Clean dishwasher             22 days ago      [Done]  |
|                    | Every month · Kitchen        Due in 8 days       [v]  |
| Settings           |                                                       |
+--------------------+-------------------------------------------------------+
```

The illustrative numbers above are not seeded data. Use “Needs attention” as the first tile's actual label; it includes due today, overdue, and tasks with no completion yet whose start date has arrived. Tile counts follow the selected category and, in v2, search; status filters do not change their own counts. Clicking a tile toggles that status filter. Clicking it again clears the filter. Show “Showing X of Y” and a Clear filters action whenever filtered.

### Task row

1. Task title, with a secondary line for recurrence and category.
2. A dedicated, visually strong last-completed value: `9 days ago` by default. A global setting switches to `October 21, 2026`; the label stays visible in either mode. Use `Today`, `Yesterday`, and `Never completed` where appropriate. Show the exact date in details and a tooltip in relative mode.
3. A secondary status such as `2 days overdue`, `Due today`, or `Due in 8 days`. The completion value remains distinct from this due-date information.
4. A labelled Done button and an adjacent small dropdown for `Complete on another date…`. Clicking the title or row body opens details; these actions must not also trigger row navigation.

Completing a task does not remove it from the All tasks dataset. A status filter may no longer match it; keep the feedback toast visible even if the row moves or disappears from the filtered list.

### Visual direction

Use a warm, quiet light theme inspired by WorDrop's shell: off-white canvas (`#f1efeb`), slightly darker sidebar (`#e9e7e2`), near-white rows, charcoal text (`#1c1d1d`), soft borders, and a muted sage accent. Reserve muted rust for overdue text, amber for approaching due, and green for comfortable intervals. Always include status words. Avoid bright red alarms, guilt language, streaks, scores, graphs, celebratory animations, and oversized cards.

Use Segoe UI/system fonts with approximately 15px body text, 17px task titles, and 22–24px completion values. Rows about 86–100px high, subtle corner rounding, and generous spacing. Use CSS and simple vector UI icons; no image assets or decorative illustrations. Only the platform-required application icon is an implementation asset, not an image feature. A single complete light theme is enough.

## Daily workflows

### First launch and task creation

Start with an empty task list, not fictional completion history. Offer Add task and Browse suggested chores. Seed the editable category list once: Laundry, Kitchen, Bathrooms, General Cleaning, Home Maintenance, Life Admin, Personal Care, and Dog Care. Also provide an Uncategorized fallback.

Task creation requires a trimmed, nonempty title and a recurrence. Category defaults to Uncategorized. Relative recurrence defaults to every 7 days. The user can optionally supply a last-completed date; that creates a real history entry. Otherwise show Never completed and start tracking today. An expandable start-date field allows a future first due date.

Editing a recurrence recalculates due status immediately from existing history; it never creates a completion. Confirm before discarding an edited form. Duplicate task names are allowed because the same chore may exist in different rooms.

### Completion, backdating, and undo

- Done writes today's local calendar date in one click. Disable that task's completion control while saving; show success only after SQLite commits.
- Success feedback says `Wash bedsheets completed today` with Undo for about 10 seconds. Each toast retains its own completion ID so undo never deletes some other completion. Persistent history editing remains available after a toast expires.
- Complete on another date opens a date picker, defaulting to today. Accept any valid past date or today, including dates before task creation; reject future dates.
- Allow at most one completion per task per calendar date. A repeated click on the same date reports Already recorded and creates no extra event or undo action.
- Undo deletes exactly the newly created history entry and recomputes the task from remaining history. It does not revert unrelated edits.
- Backdating an older completion adds historical information; it changes the last-completed value only if it becomes the latest date.
- Failed writes leave the prior state visible and show an actionable error. Do not silently treat a UI update as a successful save.

### Task detail and history

Show title, category, last completion, next due date, recurrence, Done, Complete on another date, Edit task, and completion history newest first. History entries show unambiguous full dates with Edit date and Delete actions. Confirm history deletion; date corrections reject future or duplicate dates. Changing/deleting the newest entry immediately recalculates elapsed time and due date. If all history is removed, return to Never completed and use the task's start date for its first due date.

Deleting a task requires confirmation explaining that its history will also be deleted. Category deletion offers moving its tasks to another category, defaulting to Uncategorized; execute reassignment and deletion together. Protect Uncategorized from deletion. Renaming a category preserves all task associations. No archive system in v1.

## Recurrence and date rules

All domain calculations belong in Rust and receive an explicit local `today` for deterministic tests. Completion dates, tracking start dates, and due dates are ISO calendar dates (`YYYY-MM-DD`), not UTC instants. Creation/update timestamps are UTC instants. Calculate elapsed days by calendar-date subtraction, never by dividing elapsed milliseconds by 24 hours. Refresh on local midnight, window focus/resume, and after mutations; no missed background timer may leave yesterday's statuses on screen.

### Relative interval: after last completion

Support a positive whole number of days, weeks, or months. Every 3 days, every 2 weeks, and every 6 months are valid. Use 1–3650 days, 1–520 weeks, or 1–120 months as practical input limits.

- With history: next due = latest completed date plus the interval.
- Without history: first due = tracking start date. The interval begins once the task is completed; do not invent a last completion.
- Weeks mean seven calendar days. Months mean calendar-month addition, clamping to the target month's last day. January 31 + one month is February 28 (29 in a leap year); August 31 + six months similarly clamps to February's end.
- Each next due is calculated from the latest actual completion, so a late completion shifts relative recurrence. There is no independent monthly anchor to preserve.

### Calendar schedule: every chosen weekday

V1 supports one weekday every week, such as Every Sunday. More elaborate calendar rules are out of scope.

- Without history, first due is the selected weekday on or after tracking start.
- With history, next due is the first selected weekday that is both strictly after the latest completion and on or after tracking start.
- A missed occurrence stays overdue until completion; do not roll it forward automatically each week and do not generate a backlog of individual occurrences.
- Completion on a due Sunday advances to the following Sunday. Completion on a late Tuesday advances to the next Sunday, preserving the weekday rather than adding seven days.
- An early Friday completion is recorded as Friday; the upcoming Sunday remains due. V1 does not attach completions to future occurrences or offer “skip this occurrence.” Explain this beside the schedule selector.
- Editing older history always derives the schedule from the latest remaining actual completion. Schedule edits do not rewrite historical dates.

### Status and ordering

Let `days_until_due = next_due - today`.

| Condition                      | Status          | Display        |
| ------------------------------ | --------------- | -------------- |
| Negative                       | Needs attention | N days overdue |
| Zero                           | Needs attention | Due today      |
| 1 through the coming-up window | Coming up       | Due in N days  |
| Greater than that window       | All good        | Due in N days  |

The default coming-up window is `min(7, max(1, ceil(interval_days × 0.2)))`. Relative month intervals use the actual span from latest completion to next due; when never completed, use the span from start to start + interval. Weekly calendar schedules use 7 interval days. Never completed remains the main completion label regardless of status.

V1 sorts by next due ascending, then title case-insensitively, then ID for stable ties. Do not hide tasks because they are healthy or have never been completed. No stored urgency flags or stored elapsed-day counters.

### Concrete acceptance examples

With today fixed to **2026-10-30**:

| Input                                                   | Expected result                                        |
| ------------------------------------------------------- | ------------------------------------------------------ |
| Last done October 21, every 7 days                      | 9 days ago; next due October 28; 2 days overdue        |
| Last done October 24, every 7 days                      | 6 days ago; due October 31; coming up                  |
| Never completed, start October 30                       | Never completed; due today (relative recurrence)       |
| Done October 30, then backdate another entry October 27 | Last done remains October 30                           |
| Delete October 30 above                                 | Last done becomes October 27; all due values recompute |
| Every Sunday, latest completion October 20              | Due October 25; still overdue October 30               |
| Every Sunday, complete Friday October 30                | Last done today; next due November 1                   |
| January 31, 2027 + 1 month                              | February 28, 2027                                      |
| January 31, 2028 + 1 month                              | February 29, 2028                                      |

## Suggested chore library

Ship a small static, version-controlled JSON file; no downloads or classifier. Each template has a stable key, name, suggested category, recurrence, and brief suggestion text. The picker supports browsing by category, selecting several entries, editing their intervals, and adding them together. Do not automatically populate tasks on first launch.

Start with roughly 20–30 suggestions. Examples include washing bedsheets weekly, washing towels weekly, vacuuming weekly, cleaning bathroom surfaces weekly, wiping kitchen surfaces daily, cleaning the washing machine monthly, cleaning the dishwasher monthly, dusting every two weeks, reviewing household paperwork monthly, and checking a household maintenance checklist every six months. These are editable starting points, not authoritative maintenance or care instructions. For equipment, personal care, or pet care, tell the user to choose the appropriate interval rather than inventing prescriptive guidance.

Templates are copied into independent tasks; later catalog changes never modify existing tasks. Match suggested categories to existing names case-insensitively and create a missing category only when selected templates need it. Do not recreate a renamed/deleted default category on every launch. Store the source template key to warn if it was already added; allow an explicit Add another for separate rooms.

## Architecture

Use **Tauri 2 + Rust + rusqlite (bundled SQLite)**, with **React + TypeScript + Vite** for presentation. Use plain CSS, React state, and a small application-level data hook/context. Pin compatible dependencies during scaffolding; do not copy WorDrop's entire dependency manifest.

WorDrop is architectural inspiration under `temp/WorDrop`: its Rust database ownership, versioned migrations, typed TypeScript invocation wrappers, warm sidebar layout, and Windows build environment wrappers are useful patterns. Its wardrobe models, images, classifier, scraping, recommendation engine, updater, and release machinery do not belong in Homebase. Treat its documents as reference material scoped to that project.

```text
src/
  components/              App shell, reusable dialogs and feedback
  features/tasks/          Task list, forms, detail panel, history
  features/categories/     Category editing
  features/library/        Chore picker
  features/settings/       Display preferences, backup and restore
  lib/api.ts               Typed Tauri command wrappers
  lib/useHomebase.ts       Load/refresh data and coordinate mutations
  types/                   IPC DTOs
  data/chore-templates.json
  styles/                  Tokens and application CSS
src-tauri/
  src/lib.rs               Tauri setup and command registration
  src/database.rs          Connection setup and migrations
  src/tasks.rs             Task and completion persistence
  src/categories.rs        Category persistence
  src/schedule.rs          Pure calendar-date calculations
  src/settings.rs          Small persisted preferences
  src/backup.rs            Consistent snapshots and restore
  migrations/              Numbered SQL migrations
```

Keep boundaries small; split modules when they become useful, not to satisfy a framework. No HTTP server, ORM, generic repository framework, event sourcing, background job runner, or global state dependency is needed.

### Persistence and IPC

Rust owns one SQLite connection behind managed synchronized state. Enable foreign keys and use transactional numbered migrations with `PRAGMA user_version`; refuse a database schema newer than the app understands. Put `homebase.db` in Tauri's resolved application data directory, separate from the repo and installer. Never silently replace a database that fails to open or migrate.

Use narrow typed commands: list tasks with computed status, get history, save/delete task, record/update/delete completion, list/save/delete category, get/save settings, add selected templates, and export/restore backup. The frontend sends user inputs, not SQL or precomputed due dates. Rust validates IDs, dates, recurrence shape, and category references. Return structured errors with a short code and readable message. Rust mutation results identify the affected records; refresh the list and open detail after success. A simple full-list refresh is sufficient for a personal chore list.

`list_tasks` returns an `asOfDate` together with rows containing last-completed date, elapsed days, next due, status, and days until due from the same snapshot. UI formatting uses those date-only values and the user's locale without converting them through UTC midnight. Keep date math out of React.

### Minimal schema

| Table       | Fields and constraints                                                                                                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| categories  | `id INTEGER PRIMARY KEY`, nonempty `name`, unique case-insensitive name, `position`                                                                                                                                             |
| tasks       | `id INTEGER PRIMARY KEY`, nonempty `title`, `category_id` foreign key, `schedule_kind`, nullable `interval_value`/`interval_unit`/`weekday`, `tracking_start_on`, nullable `source_template_key`, UTC `created_at`/`updated_at` |
| completions | `id INTEGER PRIMARY KEY`, `task_id` foreign key with cascade delete, `completed_on`, UTC `created_at`/`updated_at`; unique `(task_id, completed_on)`                                                                            |
| settings    | `key TEXT PRIMARY KEY`, JSON `value`; initially only completion display mode                                                                                                                                                    |

Use weekday integers 1=Monday through 7=Sunday. CHECK constraints distinguish relative schedules (value + unit, no weekday) from weekly schedules (weekday, no interval). Validate real calendar dates in Rust; string shape checks alone are insufficient. Index task category and completion task/date. Derive last completed as `MAX(completed_on)`; never maintain a second writable last-completed field. Version two fields are added in later migrations rather than speculative v1 tables.

## Local data safety and delivery

Settings offers Export backup and Restore backup using native file dialogs. A backup is a consistent SQLite snapshot produced through the SQLite backup API, including tasks, history, categories, preferences, and schema version. Do not copy an actively written database file or depend on users copying its WAL sidecar. No ZIP format or cloud backup is needed.

Restore validates integrity, required tables, schema compatibility, and domain data in a staged copy before replacing live data. Explicitly confirm replacement, automatically keep a pre-restore snapshot, suspend database operations while switching, and reopen/refresh only on success. Migrate supported older backups in staging; reject newer schemas. Cancelled dialogs make no changes. Test failed restores without losing the existing database. Show the data directory in Settings with an Open folder action.

Build locally for Windows with an NSIS installer. Preserve user data across upgrades/uninstall unless the user explicitly removes it. The first release needs no auto-updater, signing pipeline, website, telemetry, or CI deployment system. Document prerequisites and actual working commands in README when scaffolding exists; adapt WorDrop's MSVC initialization wrappers if needed.

## V2 extensions

Implement these only after v1 is usable; each is independently useful.

- **Snooze without completion:** choose a future date, persist `snoozed_until`, and leave history and true next due untouched. Until that date show Snoozed until…, retain last completion and actual due in the row, and exclude it from attention/coming-up counts. All tasks still includes it; provide a Snoozed filter and count. Wake on that date, clear on completion or explicit unsnooze, and test undo restoring any snooze cleared by that completion transaction.
- **Custom urgency:** per-task coming-up window and overdue grace days, with app defaults. The true due date stays visible. Grace delays attention styling, not history or recurrence. Add an explicit Due within grace state and account for it in summary counts; never turn a recorded overdue date into a fictitious completion.
- **Seasonal tasks:** a simple set of active calendar months, including wraparound selections such as November–February. Outside those months show Out of season and retain rows in All tasks, excluded from active summary counts. In an active window, an otherwise past due date before that window is presented as due at the window's start. Retain true last completion; do not fabricate seasonal completion events. No regional weather service or annual occurrence engine.
- **Notes and links:** optional plain-text task notes and a small list of URLs in details. No rich editor, files, images, scraping, or previews. Open only validated HTTP(S) links through the system browser on user action.
- **Search and sorting:** search task titles and category names, optionally notes when present; combine with category/status filters. Choose most overdue, longest since done (Never completed first), category, or alphabetical. Use stable ties and keep active controls visible; persisted preferences may be added if useful.

## Verification and definition of usable v1

Concentrate automated tests on date rules, history mutation effects, uniqueness, migrations, and backup/restore. Rust schedule tests inject today and cover leap years, month-end, overdue weekly schedules, early/late completion, never-completed tasks, future starts, and calendar-day behavior across daylight-saving transitions. Database tests cover newest-entry edits/deletes, duplicate completions, category reassignment, and transactional failures. A few UI integration tests cover completing, backdating, undo, filtering, and error feedback; avoid snapshotting every component or testing CSS tokens.

Manually exercise the packaged Windows app: empty first launch, template selection, custom task/category, relative and Sunday schedules, backdate/undo/history correction, restart persistence, both completion display formats, backup round-trip, failure feedback, minimum window size, and ordinary display scaling. Verify that elapsed time or the chosen completion date is visible throughout list and detail workflows.

V1 is usable when a person can add their chores, immediately see how old each is, record or correct a completion without friction, trust recurrence calculations after restart, and recover their data from a backup. No v2 feature is required to reach that point.
