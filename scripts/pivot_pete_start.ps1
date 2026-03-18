$ErrorActionPreference = 'Stop'

$repo = 'C:\Users\jackw\Desktop\SwjshAlgoKnife'
$logs = Join-Path $repo 'logs'
$data = Join-Path $repo 'data'
$pidFile = Join-Path $data 'pivot_pete.pid'

New-Item -ItemType Directory -Path $logs -Force | Out-Null
New-Item -ItemType Directory -Path $data -Force | Out-Null

if (Test-Path $pidFile) {
  $pidValue = Get-Content $pidFile -ErrorAction SilentlyContinue
  if ($pidValue) {
    $proc = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
    if ($proc) {
      Write-Output "Pivot Pete already running (PID $pidValue)"
      exit 0
    }
  }
}

$stdout = Join-Path $logs 'pivot_pete_engine.log'
$stderr = Join-Path $logs 'pivot_pete_engine.err'

$env:PYTHONIOENCODING = 'utf-8'
$proc = Start-Process -FilePath 'python' -ArgumentList 'scripts\pivot_pete_engine.py ES' -WorkingDirectory $repo -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
$proc.Id | Out-File -FilePath $pidFile -Encoding ascii

Write-Output "Started Pivot Pete (PID $($proc.Id))"
