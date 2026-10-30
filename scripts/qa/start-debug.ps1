$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$qaRoot = Join-Path $projectRoot '.qa'
New-Item -ItemType Directory -Force $qaRoot | Out-Null
$exePath = Join-Path $projectRoot 'src-tauri/target/debug/homebase.exe'
$pidPath = Join-Path $qaRoot 'v2.pid'
if (Test-Path -LiteralPath $pidPath) {
    $testProcess = Get-Process -Id (Get-Content -LiteralPath $pidPath) -ErrorAction SilentlyContinue
    if ($testProcess -and $testProcess.Path -eq $exePath) { $testProcess | Stop-Process }
}
& (Join-Path $PSScriptRoot '../native.ps1') cargo build --manifest-path (Join-Path $projectRoot 'src-tauri/Cargo.toml') --locked
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$env:HOMEBASE_DATA_DIR = Join-Path $qaRoot 'v2-data'
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9237 --remote-debugging-address=127.0.0.1'
$testProcess = Start-Process -FilePath $exePath -WindowStyle Hidden -PassThru
$testProcess.Id | Set-Content -LiteralPath $pidPath
