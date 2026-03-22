# Plan: Fix HALO Agent Launcher

## Problem Statement
The HALO agent launcher opens Windows Terminal tabs but Claude never actually starts. The terminals hang at "Starting Claude..." and the activity feed shows agents as offline.

## Root Cause Analysis
The launcher scripts are overcomplicating things. We're using here-strings, variable assignments, try/catch blocks - all unnecessary complexity that's causing issues.

## Simple Solution
Just run `claude -p "prompt"` directly. That's it.

## Implementation

### Step 1: Simplify LAUNCH_AGENTS.ps1
Replace the complex launcher script generation with a simple one-liner:
```powershell
claude -p "You are SCOUT..."
```

No variables, no here-strings, no try/catch. Just the command.

### Step 2: Fix the prompt escaping
The prompt contains single quotes (e.g., `'To Do'`). In PowerShell:
- Double quotes can contain single quotes without escaping
- Just wrap the whole prompt in double quotes and escape any internal double quotes

### Step 3: Remove the temp file approach entirely
Instead of writing launcher scripts to temp files, just pass the command directly to Windows Terminal.

## Files to Change
1. `LAUNCH_AGENTS.ps1` - Simplify the launcher script generation

## Risks
- LOW: Simple approach, minimal code

## Estimated Complexity: LOW
- 5 minutes to implement
- 2 minutes to test

---

**WAITING FOR CONFIRMATION**: Proceed with this simple fix?
