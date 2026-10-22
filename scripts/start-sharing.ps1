$ErrorActionPreference = 'Stop'
$rfeRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $rfeRoot
$rfeControl = Join-Path $rfeRoot 'runs/service-control'
New-Item -ItemType Directory -Path $rfeControl -Force | Out-Null
$rfeSsh = (Get-Command ssh).Source
$rfeNode = (Get-Command node).Source
try { $rfeStatus = Invoke-RestMethod 'http://127.0.0.1:3000/api/status' -TimeoutSec 5 }
catch {
  Start-Process -FilePath $rfeNode -ArgumentList @('scripts/next.mjs','start','--hostname','127.0.0.1') -WorkingDirectory $rfeRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $rfeControl 'app.out.log') -RedirectStandardError (Join-Path $rfeControl 'app.err.log') | Out-Null
  $rfeStatus = $null
  for ($rfeAttempt = 0; $rfeAttempt -lt 15; $rfeAttempt++) {
    try { $rfeStatus = Invoke-RestMethod 'http://127.0.0.1:3000/api/status' -TimeoutSec 2; break } catch { Start-Sleep -Milliseconds 1000 }
  }
}
if (-not $rfeStatus -or -not $rfeStatus.configured -or $rfeStatus.model -ne 'qwen3-vl:4b-instruct-16k' -or $rfeStatus.base_url_host -notin @('127.0.0.1:11434','localhost:11434')) { throw 'Start the configured local Ollama model service before sharing. No paid provider is allowed.' }
try { $null = Invoke-RestMethod 'http://127.0.0.1:9041/status' -TimeoutSec 2 }
catch {
  Start-Process -FilePath $rfeNode -ArgumentList @('node_modules/tsx/dist/cli.mjs','adapters/local-service/server.ts') -WorkingDirectory $rfeRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $rfeControl 'worker.out.log') -RedirectStandardError (Join-Path $rfeControl 'worker.err.log') | Out-Null
  $rfeWorkerReady = $false
  for ($rfeAttempt = 0; $rfeAttempt -lt 15; $rfeAttempt++) {
    try { $null = Invoke-RestMethod 'http://127.0.0.1:9041/status' -TimeoutSec 2; $rfeWorkerReady = $true; break } catch { Start-Sleep -Milliseconds 1000 }
  }
  if (-not $rfeWorkerReady) { throw 'Worker did not start; inspect runs/service-control/worker.err.log.' }
}
$rfeMetaPath = Join-Path $rfeControl 'tunnel.json'
$rfeReuse = $false
if (Test-Path -LiteralPath $rfeMetaPath) {
  $rfeMeta = Get-Content -LiteralPath $rfeMetaPath -Raw | ConvertFrom-Json
  $rfePrevious = Get-CimInstance Win32_Process -Filter "ProcessId=$($rfeMeta.pid)" -ErrorAction SilentlyContinue
  $rfeReuse = $rfePrevious -and $rfePrevious.ExecutablePath -eq $rfeSsh -and $rfePrevious.CommandLine -like '*127.0.0.1:9040*nokey@localhost.run*'
}
if (-not $rfeReuse) {
  $rfeStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $rfeLog = Join-Path $rfeControl "tunnel-$rfeStamp.err.log"
  $rfeOutput = Join-Path $rfeControl "tunnel-$rfeStamp.out.log"
  $rfeTunnel = Start-Process -FilePath $rfeSsh -ArgumentList @('-o','BatchMode=yes','-o','ConnectTimeout=15','-o','StrictHostKeyChecking=accept-new','-o','UserKnownHostsFile=runs/service-control/localhost-run-known-hosts','-o','IdentitiesOnly=yes','-o','PubkeyAuthentication=no','-o','PasswordAuthentication=no','-o','KbdInteractiveAuthentication=no','-o','ServerAliveInterval=30','-o','ServerAliveCountMax=3','-o','ExitOnForwardFailure=yes','-R','80:127.0.0.1:9040','nokey@localhost.run','--','--output','json') -WorkingDirectory $rfeRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $rfeOutput -RedirectStandardError $rfeLog
  $rfeMeta = @{ pid=$rfeTunnel.Id; url=$null; output=$rfeOutput }
  $rfeMeta | ConvertTo-Json | Set-Content -LiteralPath $rfeMetaPath -Encoding utf8
}
if (-not $rfeMeta.url) {
  $rfeOutput = $rfeMeta.output
  $rfeUrl = $null
  for ($rfeAttempt = 0; $rfeAttempt -lt 35; $rfeAttempt++) {
    if (Test-Path -LiteralPath $rfeOutput) {
      $rfeLogText = Get-Content -LiteralPath $rfeOutput -Raw
      if ($rfeLogText) {
        $rfeMatch = [regex]::Match($rfeLogText, 'https://[a-z0-9-]+\.(?:lhr\.life|localhost\.run)')
        if ($rfeMatch.Success) { $rfeUrl = $rfeMatch.Value; break }
      }
    }
    Start-Sleep -Milliseconds 1000
  }
  if (-not $rfeUrl) { throw 'Free temporary tunnel is not ready; inspect the tunnel log. No stable URL is claimed.' }
  $rfeMeta.url = $rfeUrl
  $rfeMeta | ConvertTo-Json | Set-Content -LiteralPath $rfeMetaPath -Encoding utf8
  $rfeUrl | Set-Content -LiteralPath (Join-Path $rfeControl 'public-url.txt') -Encoding utf8
}
$rfeCurrentUrlPath=Join-Path $rfeControl 'public-url.txt'
$rfeDisplayUrl=if (Test-Path -LiteralPath $rfeCurrentUrlPath) { (Get-Content -LiteralPath $rfeCurrentUrlPath -Raw).Trim() } else { $rfeMeta.url }
Write-Output "Visitor URL: $rfeDisplayUrl"
$rfeDiscoveryPath=Join-Path $rfeControl 'discovery.json'
$rfeDiscoveryRunning=$false
if (Test-Path -LiteralPath $rfeDiscoveryPath) {
  $rfeDiscoveryMeta=Get-Content -LiteralPath $rfeDiscoveryPath -Raw | ConvertFrom-Json
  $rfeDiscoveryProcess=Get-CimInstance Win32_Process -Filter "ProcessId=$($rfeDiscoveryMeta.pid)" -ErrorAction SilentlyContinue
  $rfeDiscoveryRunning=$rfeDiscoveryProcess -and $rfeDiscoveryProcess.CommandLine -like '*scripts/share-discovery.mjs*'
}
if (-not $rfeDiscoveryRunning) {
  $rfeDiscovery=Start-Process -FilePath $rfeNode -ArgumentList @('scripts/share-discovery.mjs') -WorkingDirectory $rfeRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $rfeControl 'discovery.out.log') -RedirectStandardError (Join-Path $rfeControl 'discovery.err.log')
  @{pid=$rfeDiscovery.Id} | ConvertTo-Json | Set-Content -LiteralPath $rfeDiscoveryPath -Encoding utf8
}
Write-Output 'Pause/resume controls: http://127.0.0.1:9041'
Write-Output 'Temporary URL changes if the tunnel restarts. Existing pause preference is preserved.'
