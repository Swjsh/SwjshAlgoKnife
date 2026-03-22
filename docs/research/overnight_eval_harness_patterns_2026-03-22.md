# Overnight Research: Eval Harness & Knowledge System Patterns

**Date**: 2026-03-22
**Researcher**: RESEARCHER Agent (Terminal 3)
**Session ID**: overnight-2026-03-22-162529

---

## Executive Summary

Research into evaluation harness frameworks and agent knowledge persistence patterns yielded actionable findings for improving SwjshAK's quality assurance and agent memory systems.

---

## Finding 1: Evalforge Agent Evaluation Framework

**Source**: https://github.com/speed785/evalforge
**Applicability**: HIGH
**Implementation Difficulty**: 2/5

### Key Patterns Identified

Evalforge provides a systematic approach to agent evaluation:

1. **Three Core Components**:
   - `EvalHarness` - Central coordinator for test execution
   - `TestCase` - Individual evaluation unit with expected output
   - `Registry` - Decorator-based suite and agent registration

2. **Seven Scoring Strategies**:
   - `exact_match()` - Deterministic equality
   - `fuzzy_match(threshold)` - Token similarity via rapidfuzz
   - `contains_match()` - Substring presence
   - `json_match(ignore_keys)` - Deep JSON comparison
   - `llm_judge(threshold)` - LLM rates answers 0.0-1.0
   - `semantic_match(threshold)` - Embedding cosine similarity
   - `custom_scorer()` - User-defined functions

3. **Regression Detection**:
   - Results appended to JSONL history file
   - `RegressionTracker.compare_and_save()` diffs consecutive runs
   - Webhook alerts on newly-failing cases
   - CI exits non-zero on regressions

### TestCase Interface

```python
@registry.suite("smoke")
def suite():
    return [
        TestCase(
            id="capitals",
            input="Capital of France?",
            expected_output="Paris",
            scoring=fuzzy_match(0.8)
        )
    ]

@registry.agent("my-agent")
async def agent(prompt):
    return "Paris"
```

### Application to SwjshAK

- **Strategy Backtests**: Define expected Sharpe/drawdown ranges as TestCases
- **Agent Response Quality**: Evaluate TheProfessor/TheAuditor outputs with LLM judge
- **Signal Accuracy**: Track signal-to-trade conversion rate regression

---

## Finding 2: Memorix Pattern Detection for Knowledge Capture

**Source**: https://github.com/AVIDS2/memorix
**Applicability**: MEDIUM-HIGH
**Implementation Difficulty**: 3/5

### Key Patterns Identified

Automatic detection of knowledge-worthy content:

1. **Pattern Types Detected**:
   - `decision` - Architecture/approach selections
   - `error` - Bug fixes, crashes, resolutions
   - `gotcha` - Pitfalls, caveats, warnings
   - `configuration` - Settings, environment variables
   - `learning` - Insights, discoveries, "TIL" moments
   - `implementation` - Feature completions, refactors
   - `deployment` - Shipping, infrastructure changes

2. **Confidence-Based Filtering**: Each pattern has base confidence (0.5-0.85)

3. **Multi-Language Support**: Keywords in English and Chinese

### Pattern Detection Algorithm

```typescript
const PATTERNS = [
  {
    type: 'decision',
    keywords: [
      /\b(decided|chose|will use|settled on|going with)\b/i,
      /\b(architecture|approach|strategy|pattern|framework)\b/i,
    ],
    minLength: 100,
    baseConfidence: 0.8,
  },
  {
    type: 'gotcha',
    keywords: [
      /\b(gotcha|pitfall|trap|caveat|watch out|careful)\b/i,
      /\b(don'?t|never|avoid|must not)\b/i,
    ],
    minLength: 80,
    baseConfidence: 0.85,
  },
  // ... more patterns
];
```

### Application to SwjshAK

- **Daily Log Auto-Capture**: Detect and extract important learnings from Claude sessions
- **Troubleshooting Memory**: Auto-save gotchas and error resolutions to Obsidian
- **Configuration Audit Trail**: Track all config changes with context

---

## Finding 3: AWS Agent Memory Persistence Architecture

**Source**: https://github.com/aws-samples/sample-agentic-chatbot-accelerator
**Applicability**: MEDIUM
**Implementation Difficulty**: 4/5

### Key Patterns Identified

Enterprise-grade memory chunking strategies:

1. **Chunking Strategies**:
   - `FIXED_SIZE` - Fixed token chunks with overlap
   - `HIERARCHICAL` - Parent-child chunk relationships
   - `SEMANTIC` - Natural breakpoint-based chunking
   - `NONE` - Process as-is

2. **Search Types**:
   - `SEMANTIC` - Vector embedding similarity
   - `HYBRID` - Semantic + keyword search

3. **Memory Configuration**:
   - Max tokens per chunk
   - Overlap percentage
   - Parent/child token limits

### Chunking Interface

```typescript
interface FixedChunkingProps {
  maxTokens: number;
  overlapPercentage: number;
}

interface HierarchicalChunkingProps {
  overlapTokens: number;
  maxParentTokenSize: number;
  maxChildTokenSize: number;
}

enum ChunkingStrategyType {
  FIXED_SIZE = "FIXED_SIZE",
  HIERARCHICAL = "HIERARCHICAL",
  SEMANTIC = "SEMANTIC",
  NONE = "NONE",
}
```

### Application to SwjshAK

- **Long-Term Agent Memory**: Store important decisions with semantic search
- **Trade Journal Context**: Hierarchical chunking for trade history + analysis
- **Pattern Recognition**: Semantic search for similar past trading scenarios

---

## Finding 4: Code Quality Scoring Patterns

**Source**: Multiple GitHub repositories
**Applicability**: MEDIUM
**Implementation Difficulty**: 3/5

### Key Patterns Identified

From `locallama-mcp` and `QICORE-V4`:

1. **Multi-Dimensional Scoring**: 0-100 scale with sub-metrics
2. **Criteria Categories**:
   - Readability (naming, formatting)
   - Complexity (cyclomatic, cognitive)
   - Best Practices (patterns, conventions)
   - Security (vulnerability detection)
   - Maintainability (documentation, modularity)

3. **Benchmark Integration**: Score tracking over time

### Scoring Framework

```typescript
interface CodeQualityScore {
  overall: number;  // 0-100
  breakdown: {
    readability: number;
    complexity: number;
    bestPractices: number;
    security: number;
    maintainability: number;
  };
  suggestions: string[];
  timestamp: number;
}
```

### Application to SwjshAK

- **Strategy Code Review**: Auto-score new strategy implementations
- **PR Quality Gate**: Block merges below threshold
- **Technical Debt Tracking**: Track quality trends over time

---

## Recommendations

### Immediate Actions (Week 1)

1. **Add Eval Suite for Strategies** (Difficulty: 2/5)
   - Create `tests/evals/strategy_suite.py`
   - Define expected Sharpe range TestCases per strategy
   - Add regression tracking via JSONL

2. **Pattern Detection for Daily Log** (Difficulty: 2/5)
   - Implement pattern detector in `scripts/detect-learnings.ts`
   - Auto-extract gotchas, decisions, errors from Claude sessions
   - Append to Obsidian Daily Log

### Short-Term (Month 1)

3. **LLM Judge for Agent Outputs** (Difficulty: 3/5)
   - Evaluate TheProfessor trade reviews with LLM scoring
   - Track review quality regression

4. **Memory Chunking System** (Difficulty: 4/5)
   - Implement hierarchical chunking for journal entries
   - Semantic search for similar past trades

### Medium-Term (Quarter 1)

5. **Code Quality Dashboard** (Difficulty: 3/5)
   - Score all strategies on quality metrics
   - Visual trend tracking
   - Automated improvement suggestions

---

## References

| Topic | Repo | Stars | Last Update |
|-------|------|-------|-------------|
| Eval Harness | speed785/evalforge | - | 2026-03-20 |
| Pattern Detection | AVIDS2/memorix | - | 2026 |
| Agent Memory | aws-samples/sample-agentic-chatbot-accelerator | - | 2026 |
| Code Scoring | zhifengzhang-sz/QICORE-V4 | - | 2026 |
