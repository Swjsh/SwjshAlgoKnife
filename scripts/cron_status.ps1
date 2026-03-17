$ErrorActionPreference = 'Stop'

$journey = 'C:\Users\jackw\Desktop\Journey'
$report = Join-Path $journey 'CRON_STATUS.md'

New-Item -ItemType Directory -Path $journey -Force | Out-Null

$ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

$jobs = & openclaw cron list --json 2>$null | ConvertFrom-Json
$jobLines = @()
foreach ($j in $jobs.jobs) {
  $jobLines += "- $($j.name) | enabled=$($j.enabled) | next=$($j.state.nextRunAtMs)"
}

$body = @()
$body += "# Cron/Heartbeat Health"
$body += "Updated: $ts"
$body += ""
$body += "## Cron Jobs"
$body += $jobLines
$body += ""

$body | Set-Content -Path $report -Encoding UTF8
