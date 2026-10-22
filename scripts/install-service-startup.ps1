# Run only after explicit approval to add a Windows current-user startup item.
$ErrorActionPreference = 'Stop'
$rfeRoot = Split-Path -Parent $PSScriptRoot
$rfeStartup = [Environment]::GetFolderPath('Startup')
$rfeShortcut = Join-Path $rfeStartup 'Figure Relay local service.lnk'
if (Test-Path -LiteralPath $rfeShortcut) { throw 'Startup shortcut exists; no item was overwritten.' }
$rfeShell = New-Object -ComObject WScript.Shell
$rfeLink = $rfeShell.CreateShortcut($rfeShortcut)
$rfeLink.TargetPath = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
$rfeLink.Arguments = '-NoProfile -WindowStyle Hidden -File "' + (Join-Path $PSScriptRoot 'auto-start-sharing.ps1') + '"'
$rfeLink.WorkingDirectory = $rfeRoot
$rfeLink.Description = 'Figure Relay: free local queue; pause/resume at http://127.0.0.1:9041'
$rfeLink.Save()
Write-Output 'Current-user startup shortcut created. Last saved pause preference is preserved.'
