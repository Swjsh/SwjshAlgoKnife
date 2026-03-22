# Plan: Fix Agent Permission Flags Consistency

## Problem Statement

User reported Arbiter asked a question requiring manual "continue" intervention, despite agents supposedly running with `--dangerously-skip-permissions`. User observed inconsistency: "Arbiter doesn't have it but Scout does."

## Analysis

**Current State in `LAUNCH_AGENTS.ps1` (line 103)**:
```cmd
claude --dangerously-skip-permissions --system-prompt "$soulPath" "You are $agentName..."
```

✅ The flag IS present for ALL agents - same command template used in loop.

**Root Cause Options**:
1. **Stale processes**: Old agents were launched before the flag was added
2. **Temp script caching**: Old launcher `.cmd` files in `%TEMP%\halo-agents\`
3. **Path escaping issue**: `$soulPath` contains spaces → command parsing breaks

## Implementation Steps

### Step 1: Fix Path Escaping (CRITICAL)

The `$soulPath` is NOT quoted in the command, causing parsing issues:

**Current (broken)**:
```cmd
claude --dangerously-skip-permissions --system-prompt "$soulPath" "You are..."
```

**Fixed**:
```cmd
claude --dangerously-skip-permissions --system-prompt `"$soulPath`" "You are..."
```

Need to escape the quotes properly in the heredoc so the final .cmd has:
```
claude --dangerously-skip-permissions --system-prompt "C:\path\to\SOUL.md" "prompt..."
```

### Step 2: Add Temp Directory Cleanup

Before creating new launcher scripts, delete old ones to prevent stale configs.

### Step 3: Add Verification Echo

Add a debug line showing the exact command being used.

## Files to Modify

| File | Change |
|------|--------|
| `LAUNCH_AGENTS.ps1` | Fix path quoting, add cleanup, add verification |

## Risk Assessment

- **Low risk**: Changes only affect launcher script generation
- **Rollback**: Revert the .ps1 file changes

## Testing

1. Run `LAUNCH_AGENTS.ps1`
2. Check temp launchers have properly quoted paths
3. Verify no agents ask for permissions
4. Monitor Activity Feed for 5+ minutes

---

**Ready for implementation.**
