# Native UI checks with Playwright CLI

Run from the repository root. Use an isolated debug database for phase scripts:

```powershell
npm run dev
# In a second terminal:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/native.ps1 cargo build --manifest-path src-tauri/Cargo.toml --locked
$env:HOMEBASE_DATA_DIR = Join-Path $PWD '.qa/native-data'
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9237 --remote-debugging-address=127.0.0.1'
New-Item -ItemType Directory -Force .qa | Out-Null
Start-Process -FilePath (Join-Path $PWD 'src-tauri/target/debug/homebase.exe') -WindowStyle Hidden
npx --yes @playwright/cli -s=homebase-native attach --cdp http://127.0.0.1:9237
npx --yes @playwright/cli -s=homebase-native run-code --filename scripts/qa/phase3.js
npx --yes @playwright/cli -s=homebase-native run-code --filename scripts/qa/phase4.js
npx --yes @playwright/cli -s=homebase-native run-code --filename scripts/qa/phase5.js
npx --yes @playwright/cli -s=homebase-native run-code --filename scripts/qa/phase6.js
```

Start phase 3 from an empty QA database; phase 4 uses its bedsheets task and
phase 5 adds library copies. Phase 5 can clean up and repeat its own template
additions. Fixtures use October 30, 2026 as the expected current date; update
fixtures deliberately when rerunning on another day. The scripts guard against
running mutations outside a `.qa` data directory.

The debug-only `HOMEBASE_DATA_DIR` override is ignored by release builds. Never
set WebView debugging arguments for ordinary personal use. Remove those two
environment variables from the terminal after QA. No debugging port is configured
by the app itself.

Phase 6 stubs only native picker path selection; its SQLite commands and restore
confirmation are real. Screenshots and test databases are written beneath `.qa/`
and excluded from Git. Production code has no browser preview persistence shim.

## Verified on October 30, 2026

- Formatting, lint, TypeScript/production build, 3 UI integration tests, and 16
  native tests passed. Backup tests were run with normal filesystem permissions;
  the restricted agent sandbox blocks temporary-file renames.
- Phases 3–6 were exercised through npx Playwright CLI against the real debug
  Tauri WebView using an isolated database. The minimum 900 × 600 layout and
  150% device scaling were inspected. The final backup workflow had no console
  errors or warnings and confirmed interception of all four picker calls.
- The NSIS installer was installed into `.qa/installed`. `release-create.js`
  exercised the packaged app with external web requests blocked. After a silent
  reinstall and restart, `release-verify.js` verified retained task/history data
  and deleted its single owned QA task through the UI. The corrected packaged
  app had no console errors or warnings.
- The QA installation was uninstalled. The normal app database remained present
  with an unchanged file hash, and no QA tasks remain in it.

The release scripts intentionally use the normal app data directory because a
release ignores the debug override. Run them only deliberately: the creation
script refuses a pre-existing fixture with its exact QA title, and the cleanup
script removes only that fixture. Picker selection itself is not an automated
Windows-dialog test. The v1 release had no older version to upgrade from.

## V2 verification

Start the development server, then use the isolated v2 harness:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/qa/start-debug.ps1
npx --yes @playwright/cli -s=homebase-v2 attach --cdp http://127.0.0.1:9237
npx --yes @playwright/cli -s=homebase-v2 run-code --filename scripts/qa/phase7.js
npx --yes @playwright/cli -s=homebase-v2 run-code --filename scripts/qa/phase8.js
npx --yes @playwright/cli -s=homebase-v2 run-code --filename scripts/qa/phase9.js
```

Use a fresh `.qa/v2-data` directory for phase 7; phase 8 uses its task and phase 9
uses both earlier fixtures. The start script restarts only the recorded debug
process after checking its executable path. It leaves the ordinary app database
untouched. These fixtures also expect October 30, 2026.

Phases 7–9 passed against the real native app. This covers snooze-aware Undo,
unsnooze, persisted default/task urgency, seasonal months and counts, notes and
multiple links, invalid URL feedback, search/filter combinations, every sort,
reload persistence, and minimum-width layout. The external-browser invocation
is intercepted through its transport in phase 9 to avoid opening test websites;
backend URL validation is covered by native tests. There are no image previews
or browser-only persistence substitutes.

The final v2 suite has 26 passing native tests and 8 passing frontend tests,
including v1-to-v2 migration and backup round-trips with all added fields.

The v0.2.0 installer was also installed in `.qa/v2-installed`, exercised with
external WebView requests blocked, reinstalled, and restarted. The two
`v2-release-*.js` scripts verified all v2 fields and snooze-aware Undo through the
installed release, then deleted only their owned QA task. The packaged console
had zero errors/warnings. The temporary installation was uninstalled, leaving
the database unchanged by the uninstall operation. These release scripts use
the normal app data directory deliberately, just like the v1 release scripts.
