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

- [x] Create the app-data database and transactional versioned migration runner; enable foreign keys and refuse newer schemas.
- [x] Add categories, tasks, completions, and settings tables with constraints and useful indexes.
- [x] Seed default categories once, including protected Uncategorized; do not seed tasks or history.
- [x] Implement date-only parsing, elapsed days, relative day/week/month intervals, and month-end clamping in pure Rust functions.
- [x] Implement every-weekday schedules, future tracking starts, never-completed behavior, and persistent overdue occurrences.
- [x] Implement derived status, coming-up windows, and stable default ordering; return an as-of date with list results.
- [x] Add focused Rust tests for the concrete DESIGN.md examples, leap years, month ends, early/late weekly completion, and DST calendar-day behavior.
- [x] Test fresh startup, migration rollback, newer-schema refusal, and persistence after reopening the database.

Exit: recurrence rules and initial storage work without the UI and pass deterministic tests.

## Phase 3 — Tasks, categories, and desktop list

- [x] Add Rust commands and typed IPC wrappers for listing/saving/deleting tasks and categories, with consistent validation errors.
- [x] Implement task forms for relative intervals or a weekday, category, tracking start, and optional initial completion.
- [x] Implement category create/rename/delete with transactional reassignment and protected Uncategorized.
- [x] Render spacious task rows with title, recurrence/category, always-visible last completion, due status, and completion actions.
- [x] Add global relative-date versus full-date display preference persisted in SQLite.
- [x] Add sidebar category filtering, All tasks, summary tiles, status filtering, counts, and Clear filters.
- [x] Add loading, empty, filtered-empty, and recoverable failure states.
- [x] Refresh on local midnight and focus/resume; verify the as-of date advances correctly.
- [x] Verify task/category edits and both date displays survive restart; inspect at minimum size and Windows scaling.

Exit: real tasks can be managed and their age and due status read reliably in the desktop list.

## Phase 4 — Completion and editable history

- [x] Implement transactional record/update/delete completion commands and the per-task/date uniqueness rule.
- [x] Wire one-click Done with pending state and success/error feedback after commit.
- [x] Implement Complete on another date with date validation and duplicate handling.
- [x] Add per-completion Undo feedback lasting about 10 seconds; undo targets the exact inserted entry.
- [x] Build the detail panel with newest-first history, date correction, confirmed deletion, and task editing/deletion.
- [x] Recompute and refresh list/detail after every history mutation; prevent nested completion actions from opening the detail panel.
- [x] Test double-click/retry behavior, backdating older/newer records, deleting the latest/all history, undo after another completion, and failed writes.
- [x] Add a small set of UI integration tests for Done, backdate, Undo, and error feedback.

Exit: completion history is the single source of truth, and mistakes are easy to correct.

## Phase 5 — Suggested chore library

- [x] Curate roughly 20–30 editable starting suggestions across household categories in a bundled JSON file.
- [x] Implement the picker with category browsing, multi-selection, and interval customization before adding.
- [x] Copy templates into independent tasks; match/create categories as needed and warn about previously added templates.
- [x] Add selected templates transactionally; keep the first-launch list empty until the user chooses chores.
- [x] Verify duplicate-template confirmation, renamed categories, customization, and unchanged existing tasks after catalog edits.

Exit: the user can quickly populate a useful list without false completion dates or prescribed care advice.

## Phase 6 — Backup, restore, and usable v1

- [x] Add native save/open dialogs, a consistent SQLite backup snapshot, and visible data-directory access in Settings.
- [x] Implement staged restore validation, compatibility checks, confirmation, and automatic pre-restore backup.
- [x] Suspend writes during replacement, apply the staged snapshot atomically through SQLite's backup API, and refresh; preserve original data on failure.
- [x] Test backup round-trip including preferences/history, cancelled pickers/confirmation, invalid/newer backups, and failed restore recovery. Schema v1 is the first backup format; no older format exists yet.
- [x] Run the relevant frontend checks and Rust suite; fix failures before marking this phase complete.
- [x] Build a local Windows NSIS installer; verify install, launch, restart, reinstall data retention, uninstall data preservation, and operation with external web requests blocked. This is the first release; no older Homebase version exists to upgrade from.
- [x] Exercise the DESIGN.md v1 workflows through Playwright CLI against the native app and smoke-test the installed release, including narrow-window and scaling checks. File-picker path selection is stubbed; native backup/restore remains real.
- [x] Update README with actual commands, backup location/behavior, and any known limitations; reconcile DESIGN.md with delivered behavior.

Exit: v1 can be used daily and its data can be recovered. Stop here for actual use before adding optional scope.

## Phase 7 — V2: snooze and personal urgency (complete)

- [x] Add migrated snooze state and Snooze/Unsnooze controls without changing completion history or actual recurrence.
- [x] Show snoozed tasks in All tasks and a dedicated filter; adjust counts and wake on the selected local date.
- [x] Handle completion clearing snooze and Undo restoring that prior snooze transactionally.
- [x] Add app defaults and per-task overrides for coming-up window and overdue grace, with explicit due-within-grace presentation.
- [x] Test snooze expiry after closed-app periods, undo, backdating, grace boundaries, and combined summary/filter behavior.

Exit: postponement and gentler urgency are understandable without distorting last completion.

## Phase 8 — V2: seasonal tasks (complete)

- [x] Add active-month configuration through a migration and simple task editor controls.
- [x] Implement active-window due behavior, Out of season labels, and active summary counts as described in DESIGN.md.
- [x] Keep last completion visible and inactive tasks available in All tasks.
- [x] Test noncontiguous active months, November–February windows, year rollover, never-completed tasks, and re-entry after missed seasons.

Exit: seasonal chores become relevant at the appropriate time without fabricated history.

## Phase 9 — V2: notes, links, search, and sorting (complete)

- [x] Add plain-text notes and user-managed HTTP(S) links in task details with the necessary migration.
- [x] Open valid links through the system browser only on user action.
- [x] Add title/category search and optional notes search, combined with existing filters and clear empty states.
- [x] Add longest since done, most overdue, category, and alphabetical sorts with stable tie behavior.
- [x] Verify combined search/category/status behavior, never-completed ordering, notes persistence, and rejected invalid URL schemes.

Exit: the extended app remains easy to scan and maintains the always-visible completion information.

## Phase 10 — Tag releases and signed automatic updates (complete)

- [x] Add a tag-triggered Windows workflow that checks version consistency, tests, builds a signed NSIS installer, uploads updater metadata, and publishes the completed release.
- [x] Generate a Homebase-specific encrypted signing key outside Git and configure the public verification key and GitHub endpoint.
- [x] Add automatic startup/periodic checks, manual Settings checks, installation progress, and recoverable offline/error behavior.
- [x] Verify release-tag guards, updater lifecycle/UI behavior, native compilation, and a locally signed installer.
- [x] Document the signing-key location, GitHub secret bootstrap, local builds, and tag publishing; commit the completed phase.

GitHub bootstrap: repository secrets must be configured by the user through Settings or `npm run release:secrets` with authenticated GitHub CLI. The connected GitHub tools do not expose secret management. No tag is pushed or release published as part of local verification.

## Phase 11 — Windows release formatting fix (complete)

- [x] Reproduce the LF/CRLF formatting mismatch reported by GitHub Actions.
- [x] Enforce LF checkouts through Git attributes and explicit Prettier settings.
- [x] Verify a fresh checkout with `core.autocrlf=true` and rerun relevant checks.
- [x] Commit and publish the correction with a new `v0.2.1` tag.

The v0.2.0 workflow failed its formatting step because Windows checkout defaults converted LF files to CRLF. The isolated checkout now passes the same `npm run format:check` command with `core.autocrlf=true`. Version manifests and lockfiles are synchronized at 0.2.1; the original tag is preserved.

## Phase 12 — Completion date beside elapsed time

- [x] Append the completion day and abbreviated localized month to Today, Yesterday, and days-ago labels in the shared list/detail formatter.
- [x] Update the display-setting example and design documentation.
- [x] Verify completion workflows and inspect ordinary/minimum-width layouts; commit the change.

All 12 frontend tests, lint, formatting, and the production build passed. Playwright CLI verified Today/Yesterday/older/never-completed labels, task details, and calendar mode against the native app at 1180px and 900px. Task rows grow with wrapped labels; keep the abbreviated day and month together.
