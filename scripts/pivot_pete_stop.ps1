$ErrorActionPreference = 'Stop'

$repo = 'C:\Users\jackw\Desktop\SwjshAlgoKnife'
$pidFile = Join-Path $repo 'data\pivot_pete.pid'

if (!(Test-Path $pidFile)) {
  Write-Output 'No PID file found. Pivot Pete not running.'
  exit 0
}

$pidValue = Get-Content $pidFile -ErrorAction SilentlyContinue
if ($pidValue) {
  $proc = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
  if ($proc) {
    Stop-Process -Id $pidValue -Force
    Write-Output "Stopped Pivot Pete (PID $pidValue)"
  } else {
    Write-Output "PID $pidValue not running"
  }
}

Remove-Item $pidFile -ErrorAction SilentlyContinue
