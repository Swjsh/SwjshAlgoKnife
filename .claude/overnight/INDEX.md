# AutoResearch Overnight Session
# Reference: https://github.com/karpathy/autoresearch

Generated: 2026-03-22T17:05:08.767Z
Run Tag: overnight-2026-03-22

## AutoResearch Protocol Summary

1. **Git commit BEFORE every experiment**
2. **Measure single metric AFTER every experiment**
3. **Keep if improved, Discard (git reset) if same/worse**
4. **Log to results.tsv**
5. **NEVER STOP until manual STOP signal**

---

## Group 1: Internal Improvement (Terminals 1-4)

| Terminal | Role | Focus | Program File |
|----------|------|-------|--------------|
| 1 | IMPROVER | improvement-cycles | improver_program.md |
| 2 | BACKTESTER | strategy-validation | backtester_program.md |
| 3 | RESEARCHER | external-patterns | researcher_program.md |
| 4 | BRAIN_UPDATER | knowledge-currency | brain_updater_program.md |

## Group 2: Security & Ops (Terminals 5-8)

| Terminal | Role | Focus | Program File |
|----------|------|-------|--------------|
| 5 | SECURITY_AUDITOR | security-hardening | security_auditor_program.md |
| 6 | INTEGRATION_TESTER | integration-testing | integration_tester_program.md |
| 7 | INTEL_AGGREGATOR | oracle-intelligence | intel_aggregator_program.md |
| 8 | DEVOPS_OPTIMIZER | infrastructure-optimization | devops_optimizer_program.md |

---

## Launch Commands

### Group 1 (Terminals 1-4):
```powershell
# Launch all Group 1 agents
Start-Process -FilePath "claude" -ArgumentList "-p", (Get-Content ".claude/overnight/terminal_1_prompt.md" -Raw)
Start-Process -FilePath "claude" -ArgumentList "-p", (Get-Content ".claude/overnight/terminal_2_prompt.md" -Raw)
Start-Process -FilePath "claude" -ArgumentList "-p", (Get-Content ".claude/overnight/terminal_3_prompt.md" -Raw)
Start-Process -FilePath "claude" -ArgumentList "-p", (Get-Content ".claude/overnight/terminal_4_prompt.md" -Raw)
```

### Group 2 (Terminals 5-8):
```powershell
# Launch all Group 2 agents
Start-Process -FilePath "claude" -ArgumentList "-p", (Get-Content ".claude/overnight/terminal_5_prompt.md" -Raw)
Start-Process -FilePath "claude" -ArgumentList "-p", (Get-Content ".claude/overnight/terminal_6_prompt.md" -Raw)
Start-Process -FilePath "claude" -ArgumentList "-p", (Get-Content ".claude/overnight/terminal_7_prompt.md" -Raw)
Start-Process -FilePath "claude" -ArgumentList "-p", (Get-Content ".claude/overnight/terminal_8_prompt.md" -Raw)
```

---

## Stop Signal

To stop all terminals gracefully:
```powershell
echo "stop" > .claude/overnight/STOP
```

To resume after stop:
```powershell
Remove-Item .claude/overnight/STOP
```

---

## Results

Each agent logs to its own results.tsv in the current branch.
View combined results:
```bash
cat results.tsv
```

## Session State

Check status of all terminals:
```powershell
Get-Content .claude/overnight/terminal_*_status.json | ConvertFrom-Json
```
