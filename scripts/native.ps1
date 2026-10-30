# Initialize the MSVC and Windows SDK environment for native dependencies.
$ErrorActionPreference = 'Stop'
$tool = $args[0]
$toolArgs = @($args | Select-Object -Skip 1)
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path -LiteralPath $vswhere) {
    $installation = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if ($installation) {
        $devShell = Join-Path $installation 'Common7\Tools\Microsoft.VisualStudio.DevShell.dll'
        Import-Module $devShell
        Enter-VsDevShell -VsInstallPath $installation -SkipAutomaticLocation -DevCmdArguments '-arch=x64 -host_arch=x64' | Out-Null
    }
}
if ($tool -eq 'tauri') { & "$PSScriptRoot/../node_modules/.bin/tauri.cmd" @toolArgs }
elseif ($tool -eq 'cargo') { & cargo @toolArgs }
else { throw "Expected cargo or tauri" }
exit $LASTEXITCODE
