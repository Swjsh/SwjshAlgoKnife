$ErrorActionPreference = 'Stop'

$repo = 'C:\Users\jackw\Desktop\SwjshAlgoKnife'
$pidFile = Join-Path $repo 'data\pivot_pete.pid'

if (!(Test-Path $pidFile)) {
  Write-Output 'No PID file found. Pivot Pete not running.'
  exit 0
}

$pid = Get-Content $pidFile -ErrorAction SilentlyContinue
if ($pid) {
  $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
  if ($proc) {
    Stop-Process -Id $pid -Force
    Write-Output "Stopped Pivot Pete (PID $pid)"
  } else {
    Write-Output "PID $pid not running"
  }
}

Remove-Item $pidFile -ErrorAction SilentlyContinue
