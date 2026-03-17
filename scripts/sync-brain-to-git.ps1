# Brain Sync to Git
param(
    [string]$ObsidianVault = 'C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain',
    [string]$RepoRoot = (Split-Path -Parent (Split-Path -Parent $PSCommandPath)),
    [string]$BrainDir = (Join-Path (Join-Path $RepoRoot 'data') 'brain'),
    [string]$GitBranch = 'brain-sync',
    [string]$GitRemote = 'origin'
)
$ErrorActionPreference = 'Stop'
$LogFile = Join-Path (Join-Path $RepoRoot 'scripts') 'sync-brain.log'
function Write-Log { param([string]$Message, [string]$Level = 'INFO'); $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'; Write-Host "[$ts] [$Level] $Message"; Add-Content -Path $LogFile -Value "[$ts] [$Level] $Message" -EA SilentlyContinue }
function Sync-BrainFiles {
    param([string]$VaultPath, [string]$TargetDir)
    if (-not (Test-Path $VaultPath)) { throw 'Vault not found' }
    if (-not (Test-Path $TargetDir)) { New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null }
    $maps = @(
        @{s='Master Tracker.md';d='master-tracker.md'},
        @{s='Dashboard.md';d='dashboard.md'},
        @{s='Daily Log.md';d='daily-log.md'},
        @{s='Roadmap.md';d='roadmap.md'},
        @{s='Strategies Overview.md';d='strategies.md'},
        @{s='System Architecture.md';d='system-architecture.md'}
    )
    foreach ($m in $maps) {
        $src = Join-Path $VaultPath $m.s
        $dst = Join-Path $TargetDir $m.d
        if (Test-Path $src) { Copy-Item $src $dst -Force; Write-Log "  [+] $($m.d)" }
        else { Write-Log "  [?] $($m.s)" 'WARN' }
    }
}
try {
    Write-Log '=== Brain Sync ==='
    Push-Location $RepoRoot
    Sync-BrainFiles $ObsidianVault $BrainDir
    $st = git status --porcelain data/brain/
    if ($st) {
        git add data/brain/
        $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
        git commit -m "Brain sync: $ts"
        git push -u $GitRemote $GitBranch
        Write-Log 'Pushed'
    } else { Write-Log 'No changes' }
    Pop-Location
    Write-Log '=== Complete ==='
    exit 0
} catch {
    Pop-Location -EA SilentlyContinue
    Write-Log "ERROR: $_" 'ERROR'
    exit 1
}