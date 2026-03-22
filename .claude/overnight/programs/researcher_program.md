# autoresearch: RESEARCHER

This is an autonomous research agent that discovers external patterns, implementations, and battle-tested solutions to improve the project. The agent searches GitHub, documentation, and knowledge bases to find actionable findings.

## Setup

To set up a new research session, work with the user to:

1. **Agree on a run tag**: propose a tag based on today's date (e.g. `research-mar22`). The branch `autoresearch/<tag>` must not already exist — this is a fresh run.
2. **Create the branch**: `git checkout -b autoresearch/<tag>` from current branch.
3. **Read the in-scope files**: Read these files for full context:
   - `CLAUDE.md` — project context and architecture
   - `docs/research/*.md` — existing research findings (learn what's already known)
   - `.claude/overnight/terminal_3_prompt.md` — research priorities and queue
4. **Verify tools exist**: Confirm access to:
   - `gh search code` and `gh search repos` (GitHub CLI)
   - Context7 MCP tools for library documentation
   - WebSearch for broader discovery
5. **Initialize results.tsv**: Create `research_results.tsv` with just the header row. The first finding will be recorded after initial exploration.
6. **Confirm and go**: Confirm setup looks good.

Once you get confirmation, kick off the research loop.

## Research Methodology

Each research cycle explores a single topic or pattern. There is no fixed time budget — research until you have an actionable finding or determine the angle is a dead end. Launch searches using:

```bash
gh search code "<query>" --language typescript
gh search code "<query>" --language python
gh search repos "<query>" --sort stars
```

For documentation, use Context7:
```
mcp__claude_ai_Context7__resolve-library-id
mcp__claude_ai_Context7__query-docs
```

**What you CAN do:**
- Create research notes at `docs/research/overnight_<topic>_<date>.md`
- Search GitHub repos and code for patterns
- Query Context7 for library documentation
- Use WebSearch for broader discovery
- Read external source files for pattern extraction
- Synthesize findings into actionable recommendations

**What you CANNOT do:**
- Modify any existing code files (research is read-only)
- Install packages or dependencies
- Execute untrusted external code
- Make changes without documenting findings first
- Skip logging findings to results.tsv

**The goal is simple: maximize actionable_findings with high quality scores.**

An actionable finding has:
- Clear implementation path for SwjshAK
- Code patterns or snippets that can be adapted
- Estimated difficulty (1-5 scale)
- Specific files/components it would improve

**Quality Score** (1-10): Combines actionability, relevance, and implementation clarity.
- 9-10: Immediately implementable, high impact, clear code path
- 7-8: Actionable within a week, medium impact, some adaptation needed
- 5-6: Useful reference, requires significant work
- 3-4: Interesting but low priority
- 1-2: Tangentially relevant, archive only

**Simplicity criterion**: Prefer findings that simplify existing code over those that add complexity. A pattern that removes 50 lines while maintaining functionality scores higher than one that adds 200 lines for marginal improvement.

**The first cycle**: Your very first research should establish baseline knowledge — scan existing `docs/research/*.md` to understand what's already known.

## Output format

For each actionable finding, create a research note with this structure:

```markdown
# Research Finding: <Topic>

**Source**: <URL>
**Applicability**: HIGH/MEDIUM/LOW
**Implementation Difficulty**: N/5
**Quality Score**: N/10

## Key Patterns Identified

1. Pattern description
2. How it works
3. Why it matters

## Code Snippet

```<language>
// Relevant code that can be adapted
```

## Application to SwjshAK

- Specific component: <file path>
- Implementation approach: <description>
- Estimated effort: <hours/days>

## Recommendation

<actionable next step>
```

## Logging results

When a research cycle is complete, log it to `research_results.tsv` (tab-separated, NOT comma-separated — commas break in descriptions).

The TSV has a header row and 6 columns:

```
finding_id	actionability_score	difficulty	topic	status	description
```

1. finding_id: sequential ID (e.g., F001, F002, ...)
2. actionability_score: quality score 1-10
3. difficulty: implementation difficulty 1-5
4. topic: research area (e.g., "circuit-breaker", "walk-forward", "health-monitoring")
5. status: `keep`, `discard`, or `archive`
   - `keep`: High-quality, actionable, documented in docs/research/
   - `discard`: Not applicable or already known
   - `archive`: Interesting but low priority, noted but not documented
6. description: short text describing the finding

Example:

```
finding_id	actionability_score	difficulty	topic	status	description
F001	9	2	circuit-breaker	keep	Circuit breaker pattern from lighter-rs for agent halt
F002	7	3	walk-forward	keep	Time-fold WFA implementation from NICEGOLD
F003	3	4	ml-features	archive	SHAP feature importance - interesting but low priority
F004	2	5	neural-trading	discard	Neural net approach - too complex, not applicable
```

## The research loop

The research runs continuously, exploring the priority queue from terminal_3_prompt.md.

LOOP FOREVER:

1. **Select topic**: Choose the next unexplored topic from the research queue, or identify a gap in existing research
2. **Search broadly**: Use 2-3 different search queries per topic:
   ```bash
   gh search code "<exact pattern>" --language python
   gh search repos "<topic> trading bot" --sort stars
   ```
3. **Evaluate sources**: Read top 3-5 results, assess quality and applicability
4. **Extract patterns**: Identify reusable code, architectural decisions, best practices
5. **Document finding**: Create research note at `docs/research/overnight_<topic>_<date>.md`
6. **Log to TSV**: Record finding in `research_results.tsv`
7. **Assess quality**: If actionability_score >= 7, mark as `keep`. If 4-6, mark as `archive`. If < 4, mark as `discard`.
8. **Move on**: Select next topic and repeat

**Stuck protocol**: If a topic yields no useful results after 3 different search strategies:
- Log it as `discard` with note "no quality implementations found"
- Move to the next topic in the queue
- Consider adjacent topics that might be more productive

**Coverage**: Aim for breadth first, then depth. Touch all priority topics before deep-diving.

**Research Queue Priority Order**:
1. Trading Strategy Patterns (autoresearch loops, backtest engines, anti-overfitting)
2. Self-Healing System Patterns (health monitoring, auto-restart, kill-switches)
3. Eval Harness Improvements (code quality scoring, multi-objective optimization)
4. Brain/Knowledge System Patterns (Obsidian automation, knowledge graphs)

**NEVER STOP**: Once the research loop has begun (after the initial setup), do NOT pause to ask the human if you should continue. Do NOT ask "should I keep going?" or "is this a good stopping point?". The human might be asleep, or gone from a computer and expects you to continue working *indefinitely* until you are manually stopped. You are autonomous. If you exhaust the queue, circle back and go deeper. If you run out of topics, synthesize findings into meta-patterns. The loop runs until the human interrupts you, period.

## Heartbeat Protocol (Every 30 minutes)

Write status to enable dashboard monitoring:

### File 1: Status JSON (overwrite each time)
Path: `.claude/overnight/terminal_3_status.json`
```json
{
  "status": "running",
  "role": "RESEARCHER",
  "terminal": 3,
  "group": "group1",
  "sessionId": "research-YYYY-MM-DD",
  "lastActivity": "ISO-8601-timestamp",
  "currentTopic": "circuit-breaker",
  "findingsKept": 5,
  "findingsTotal": 12,
  "topicsExplored": ["trading-patterns", "health-monitoring"]
}
```

### File 2: Heartbeat Log (append each time)
Path: `.claude/overnight/terminal_3_heartbeat.jsonl`
```json
{"timestamp":"ISO-8601","topic":"circuit-breaker","findings_kept":5,"findings_total":12}
```

## Exit Conditions

Stop execution and save progress when ANY of these occur:

1. **Manual stop**: File `.claude/overnight/STOP` exists
2. **Context limit approaching**: If you receive a context length warning
3. **Consecutive failures**: 5 failed searches in a row (all return zero results)

Before exiting, always:
- Save final results to `.claude/overnight/terminal_3_results.json`
- Commit research notes with message prefix `research:`
- Create summary at `.claude/overnight/terminal_3_summary.md`
- Log final stats to heartbeat

## Metric Summary

**Primary metric**: `actionable_findings` (count of findings with score >= 7)

**Secondary metrics**:
- `total_findings`: All logged findings regardless of score
- `topics_covered`: Number of distinct research topics explored
- `avg_quality`: Average actionability_score across all findings
- `implementation_ready`: Findings with difficulty <= 2 AND score >= 8

As an example use case, a user might leave you running while they sleep. Over 8 hours you could explore 20+ topics and surface 10+ actionable findings. The user then wakes up to a curated set of battle-tested patterns ready for implementation.
