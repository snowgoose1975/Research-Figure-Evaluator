$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
for ($rfeAttempt = 0; $rfeAttempt -lt 6; $rfeAttempt++) {
  try { & (Join-Path $PSScriptRoot 'start-sharing.ps1'); exit 0 }
  catch {
    if ($rfeAttempt -eq 5) { exit 1 }
    Start-Sleep -Seconds 15
  }
}
