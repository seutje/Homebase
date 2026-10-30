# Homebase implementation plan

This is a sequential implementation checklist for DESIGN.md. Check an item only after its result exists and its relevant verification passes. Keep incomplete items unchecked; record blockers or reduced scope beside them. The checked planning items below represent this documentation task, not implemented app features.

## Phase 0 — Specification (complete)

- [x] Review the supplied layout and the relevant WorDrop architecture and styling.
- [x] Write DESIGN.md with v1/v2 boundaries, desktop flows, recurrence semantics, schema, and acceptance examples.
- [x] Write this phased implementation checklist.
- [x] Write project-specific AGENTS.md instructions.

## Phase 1 — Runnable Windows foundation

- [x] Scaffold Tauri 2, React, TypeScript, and Vite at the repository root; use a new Homebase identity and compatible locked dependencies.
- [x] Add plain CSS tokens and the native-title-bar desktop shell, sidebar, and empty task list.
- [x] Configure the window dimensions, minimum size, and platform-required app icon without introducing image features.
- [x] Add frontend formatting, lint, typecheck, test, build, and native test commands; adapt MSVC setup wrappers only if needed.
- [x] Write README with verified prerequisites, development commands, and local build instructions.
- [x] Verify the shell launches through Tauri on Windows; confirm frontend production build and Rust compile checks pass.

Exit: a real desktop window runs locally with no copied wardrobe features or runtime network dependency.

## Phase 2 — SQLite and recurrence engine

- [ ] Create the app-data database and transactional versioned migration runner; enable foreign keys and refuse newer schemas.
- [ ] Add categories, tasks, completions, and settings tables with constraints and useful indexes.
- [ ] Seed default categories once, including protected Uncategorized; do not seed tasks or history.
- [ ] Implement date-only parsing, elapsed days, relative day/week/month intervals, and month-end clamping in pure Rust functions.
- [ ] Implement every-weekday schedules, future tracking starts, never-completed behavior, and persistent overdue occurrences.
- [ ] Implement derived status, coming-up windows, and stable default ordering; return an as-of date with list results.
- [ ] Add focused Rust tests for the concrete DESIGN.md examples, leap years, month ends, early/late weekly completion, and DST calendar-day behavior.
- [ ] Test fresh startup, migration rollback, newer-schema refusal, and persistence after reopening the database.

Exit: recurrence rules and initial storage work without the UI and pass deterministic tests.

## Phase 3 — Tasks, categories, and desktop list

- [ ] Add Rust commands and typed IPC wrappers for listing/saving/deleting tasks and categories, with consistent validation errors.
- [ ] Implement task forms for relative intervals or a weekday, category, tracking start, and optional initial completion.
- [ ] Implement category create/rename/delete with transactional reassignment and protected Uncategorized.
- [ ] Render spacious task rows with title, recurrence/category, always-visible last completion, due status, and completion actions.
- [ ] Add global relative-date versus full-date display preference persisted in SQLite.
- [ ] Add sidebar category filtering, All tasks, summary tiles, status filtering, counts, and Clear filters.
- [ ] Add loading, empty, filtered-empty, and recoverable failure states.
- [ ] Refresh on local midnight and focus/resume; verify the as-of date advances correctly.
- [ ] Verify task/category edits and both date displays survive restart; inspect at minimum size and Windows scaling.

Exit: real tasks can be managed and their age and due status read reliably in the desktop list.

## Phase 4 — Completion and editable history

- [ ] Implement transactional record/update/delete completion commands and the per-task/date uniqueness rule.
- [ ] Wire one-click Done with pending state and success/error feedback after commit.
- [ ] Implement Complete on another date with date validation and duplicate handling.
- [ ] Add per-completion Undo feedback lasting about 10 seconds; undo targets the exact inserted entry.
- [ ] Build the detail panel with newest-first history, date correction, confirmed deletion, and task editing/deletion.
- [ ] Recompute and refresh list/detail after every history mutation; prevent nested completion actions from opening the detail panel.
- [ ] Test double-click/retry behavior, backdating older/newer records, deleting the latest/all history, undo after another completion, and failed writes.
- [ ] Add a small set of UI integration tests for Done, backdate, Undo, and error feedback.

Exit: completion history is the single source of truth, and mistakes are easy to correct.

## Phase 5 — Suggested chore library

- [ ] Curate roughly 20–30 editable starting suggestions across household categories in a bundled JSON file.
- [ ] Implement the picker with category browsing, multi-selection, and interval customization before adding.
- [ ] Copy templates into independent tasks; match/create categories as needed and warn about previously added templates.
- [ ] Add selected templates transactionally; keep the first-launch list empty until the user chooses chores.
- [ ] Verify duplicate-template confirmation, renamed categories, customization, and unchanged existing tasks after catalog edits.

Exit: the user can quickly populate a useful list without false completion dates or prescribed care advice.

## Phase 6 — Backup, restore, and usable v1

- [ ] Add native save/open dialogs, a consistent SQLite backup snapshot, and visible data-directory access in Settings.
- [ ] Implement staged restore validation, compatibility checks, confirmation, and automatic pre-restore backup.
- [ ] Suspend writes during replacement and reopen cleanly; preserve the original data on validation/replacement failure.
- [ ] Test backup round-trip including preferences/history, cancelled dialogs, invalid/newer backups, older-schema migration, and failed restore recovery.
- [ ] Run the relevant frontend checks and Rust suite; fix failures before marking this phase complete.
- [ ] Build a local Windows NSIS installer; verify install, launch, restart, upgrade data retention, and offline operation.
- [ ] Run the DESIGN.md manual v1 workflow checklist on the packaged app, including narrow window and display scaling.
- [ ] Update README with actual commands, backup location/behavior, and any known limitations; reconcile DESIGN.md with delivered behavior.

Exit: v1 can be used daily and its data can be recovered. Stop here for actual use before adding optional scope.

## Phase 7 — V2: snooze and personal urgency (optional)

- [ ] Add migrated snooze state and Snooze/Unsnooze controls without changing completion history or actual recurrence.
- [ ] Show snoozed tasks in All tasks and a dedicated filter; adjust counts and wake on the selected local date.
- [ ] Handle completion clearing snooze and Undo restoring that prior snooze transactionally.
- [ ] Add app defaults and per-task overrides for coming-up window and overdue grace, with explicit due-within-grace presentation.
- [ ] Test snooze expiry after closed-app periods, undo, backdating, grace boundaries, and combined summary/filter behavior.

Exit: postponement and gentler urgency are understandable without distorting last completion.

## Phase 8 — V2: seasonal tasks (optional)

- [ ] Add active-month configuration through a migration and simple task editor controls.
- [ ] Implement active-window due behavior, Out of season labels, and active summary counts as described in DESIGN.md.
- [ ] Keep last completion visible and inactive tasks available in All tasks.
- [ ] Test noncontiguous active months, November–February windows, year rollover, never-completed tasks, and re-entry after missed seasons.

Exit: seasonal chores become relevant at the appropriate time without fabricated history.

## Phase 9 — V2: notes, links, search, and sorting (optional)

- [ ] Add plain-text notes and user-managed HTTP(S) links in task details with the necessary migration.
- [ ] Open valid links through the system browser only on user action.
- [ ] Add title/category search and optional notes search, combined with existing filters and clear empty states.
- [ ] Add longest since done, most overdue, category, and alphabetical sorts with stable tie behavior.
- [ ] Verify combined search/category/status behavior, never-completed ordering, notes persistence, and rejected invalid URL schemes.

Exit: the extended app remains easy to scan and maintains the always-visible completion information.
