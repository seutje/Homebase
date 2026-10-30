$ErrorActionPreference = 'Stop'
$keyPath = Join-Path $env:USERPROFILE '.tauri/homebase-updater.key'
$passwordPath = "$keyPath.password"
foreach ($path in @($keyPath, $passwordPath)) {
    if (-not (Test-Path -LiteralPath $path)) { throw "Missing signing file: $path" }
}
$previousKey = $env:TAURI_SIGNING_PRIVATE_KEY
$previousPassword = $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD
try {
    $env:TAURI_SIGNING_PRIVATE_KEY = $keyPath
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = Get-Content -LiteralPath $passwordPath -Raw
    & "$PSScriptRoot/native.ps1" tauri build --bundles nsis
    if ($LASTEXITCODE -ne 0) { throw 'Signed release build failed.' }
} finally {
    [Environment]::SetEnvironmentVariable('TAURI_SIGNING_PRIVATE_KEY', $previousKey, 'Process')
    [Environment]::SetEnvironmentVariable('TAURI_SIGNING_PRIVATE_KEY_PASSWORD', $previousPassword, 'Process')
}
