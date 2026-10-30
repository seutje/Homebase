# Homebase

A personal, offline Windows chore tracker. Built with Tauri 2, Rust, React,
TypeScript, and SQLite. See DESIGN.md for behavior and PLAN.md for delivery status.

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
