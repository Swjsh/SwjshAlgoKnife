# ═══════════════════════════════════════════════════════════════════════════════
#  SwjshAK — GCP Control API Bridge
#
#  Send commands to the Control API running on GCP VM without direct HTTP access.
#  Desktop Claude uses this to control the trading system remotely.
#
#  Usage Examples:
#    ./scripts/gcp-command.ps1 -Command "summary"
#    ./scripts/gcp-command.ps1 -Command "pause" -AgentId "boba"
#    ./scripts/gcp-command.ps1 -Command "pause" -AgentId "boba" -Reason "Manual override"
#    ./scripts/gcp-command.ps1 -Command "resume" -AgentId "pivot_pete"
#    ./scripts/gcp-command.ps1 -Command "restart" -AgentId "the_professor"
#    ./scripts/gcp-command.ps1 -Command "killswitch"
#    ./scripts/gcp-command.ps1 -Command "killswitch_reset"
#
#  Valid Commands:
#    - summary          Get daily P&L report and system status
#    - pause            Pause a specific agent (requires -AgentId)
#    - resume           Resume a paused agent (requires -AgentId)
#    - restart          Restart an agent (requires -AgentId)
#    - killswitch       Emergency halt all agents
#    - killswitch_reset Resume all agents after emergency halt
#
# ═══════════════════════════════════════════════════════════════════════════════

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("summary", "pause", "resume", "restart", "killswitch", "killswitch_reset")]
    [string]$Command,

    [string]$AgentId,
    [string]$Reason = "Requested via gcp-command.ps1",
    [string]$GcpProject = "swjsh-algo-knife",
    [string]$GcpInstance = "swjsh-server",
    [string]$GcpZone = "us-central1-a"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# ─────────────────────────────────────────────────────────────────────────────
# Validation
# ─────────────────────────────────────────────────────────────────────────────

# Commands that require AgentId
$AGENT_REQUIRED = @("pause", "resume", "restart")

if ($Command -in $AGENT_REQUIRED -and -not $AgentId) {
    Write-Host "ERROR: -AgentId is required for command '$Command'" -ForegroundColor Red
    Write-Host ""
    Write-Host "Valid agents:" -ForegroundColor Yellow
    Write-Host "  • boba (options)" -ForegroundColor DarkGray
    Write-Host "  • pivot_pete (futures)" -ForegroundColor DarkGray
    Write-Host "  • the_professor (trade review)" -ForegroundColor DarkGray
    Write-Host "  • the_auditor (trade auditing)" -ForegroundColor DarkGray
    Write-Host "  • spx_sniper (volatility trading)" -ForegroundColor DarkGray
    Write-Host ""
    exit 1
}

# ─────────────────────────────────────────────────────────────────────────────
# Build Request Payload
# ─────────────────────────────────────────────────────────────────────────────

$payload = @{
    command = $Command
}

if ($AgentId) {
    $payload["agentId"] = $AgentId
}

if ($Reason) {
    $payload["reason"] = $Reason
}

$jsonPayload = $payload | ConvertTo-Json
$jsonPayload = $jsonPayload -replace "`"", "\`""

# ─────────────────────────────────────────────────────────────────────────────
# Send Command via SSH
# ─────────────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "SwjshAK — Control API Command" -ForegroundColor Cyan
Write-Host "═" * 60 -ForegroundColor Cyan
Write-Host ""
Write-Host "  Command:    $Command" -ForegroundColor White
if ($AgentId) {
    Write-Host "  Agent:      $AgentId" -ForegroundColor White
}
Write-Host "  Reason:     $Reason" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Sending to http://localhost:3000/api/control..." -ForegroundColor Yellow

try {
    $response = gcloud compute ssh $GcpInstance `
        --zone=$GcpZone --project=$GcpProject --quiet `
        --command="curl -s -X POST http://localhost:3000/api/control -H 'Content-Type: application/json' -d '$jsonPayload'" 2>&1

    # Parse and display response
    if ($response.Length -gt 0) {
        Write-Host ""
        Write-Host "Response:" -ForegroundColor Green
        Write-Host "─" * 60 -ForegroundColor DarkGray

        try {
            $parsedResponse = $response | ConvertFrom-Json

            # Pretty-print the JSON response
            $response | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor Cyan

            # Provide human-readable summary
            Write-Host ""
            Write-Host "Summary:" -ForegroundColor White
            if ($parsedResponse.status -eq "ok" -or $parsedResponse.status -eq "success") {
                Write-Host "  ✓ Command successful" -ForegroundColor Green
            } elseif ($parsedResponse.error) {
                Write-Host "  ✗ Error: $($parsedResponse.error)" -ForegroundColor Red
            }

            if ($parsedResponse.data) {
                Write-Host ""
                Write-Host "Data:" -ForegroundColor White
                $parsedResponse.data | ConvertTo-Json | Write-Host -ForegroundColor DarkGray
            }
        } catch {
            # If not JSON, just print raw response
            Write-Host $response -ForegroundColor Cyan
        }
    } else {
        Write-Host ""
        Write-Host "⚠  No response from API. Check that the service is running." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Troubleshooting:" -ForegroundColor White
        Write-Host "  1. Check service status: ./scripts/gcp-status.ps1 --Quick" -ForegroundColor DarkGray
        Write-Host "  2. View logs: gcloud compute ssh $GcpInstance -- 'docker compose logs -f nextjs'" -ForegroundColor DarkGray
        Write-Host "  3. Verify health: gcloud compute ssh $GcpInstance -- 'curl http://localhost:3000/api/health'" -ForegroundColor DarkGray
    }
} catch {
    Write-Host ""
    Write-Host "✗ SSH Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor White
    Write-Host "  1. Verify gcloud is installed: gcloud --version" -ForegroundColor DarkGray
    Write-Host "  2. Check authentication: gcloud auth list" -ForegroundColor DarkGray
    Write-Host "  3. Test SSH: gcloud compute ssh $GcpInstance --zone=$GcpZone -- 'echo OK'" -ForegroundColor DarkGray
    exit 1
}

Write-Host ""
