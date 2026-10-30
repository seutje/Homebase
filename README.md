# Homebase

A personal, offline Windows chore tracker. Built with Tauri 2, Rust, React,
TypeScript, and SQLite. See DESIGN.md for behavior and PLAN.md for delivery status.

## Using Homebase

Add a task yourself or browse the 26 suggested chores. Choose an interval after
the last completion, or a weekly weekday. The task list always shows when each
chore was last done; switch between elapsed days and dates in Settings.

Click Done to record today. The adjacent arrow records another date. Undo is
available for ten seconds, and clicking a task opens its editable completion
history. Categories and status tiles filter the list; All tasks is always available.

Settings includes Export backup, Restore backup, and Open data folder. Homebase
keeps `homebase.db` in its resolved Windows app-data directory (normally
`%APPDATA%\local.homebase.desktop`). Backups include all history and preferences.
Restore validates a staged copy and retains your previous data in the `backups`
subfolder before applying it. Backup schema v1 is the first supported format;
newer-schema files are rejected. Keep occasional exported copies somewhere safe.

The app runs offline, with no account, background service, or notifications.
Closing the window exits. Optional snooze, seasonal rules, notes, and search are
listed separately in PLAN.md and are not part of v1.

## Development

Requires Node.js 24+, npm, Rust's MSVC toolchain, Visual Studio C++ Build Tools
with the Windows SDK, and Edge WebView2.

```powershell
npm ci
npm run tauri dev
```

Homebase uses **127.0.0.1:1437**, leaving port 1420 available for other apps.
`npm run dev` runs just the frontend; native persistence needs the Tauri window.
The `scripts/native.ps1` wrapper initializes the installed MSVC/SDK environment.

```powershell
npm run format:check
npm run lint
npm run build
npm test
npm run test:native
npm run tauri build
```

The local installer is generated in `src-tauri/target/release/bundle/nsis`.
Development/build output and local data are excluded from Git.

## UI verification

UI checks use `npx --yes @playwright/cli`, including a loopback CDP connection to
the real Tauri WebView. See `scripts/qa/README.md`. Database tests cover recurrence,
history mutations, migrations, and backup failure recovery. UI integration tests
cover Done, backdating, exact Undo, duplicate handling, and failed-write feedback.

Native picker path selection is stubbed in the backup UI workflow because the
picker is outside the WebView; the real SQLite export and restore commands run.
No automatic updater or signing pipeline is configured.
