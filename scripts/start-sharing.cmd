@echo off
cd /d "%~dp0.."
powershell.exe -NoProfile -File "%~dp0start-sharing.ps1"
if errorlevel 1 (
  echo Sharing did not start. See docs/LOCAL_HOSTING.md and runs/service-control logs.
  pause
  exit /b 1
)
start "" "http://127.0.0.1:9041"
