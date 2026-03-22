# ECC Skills Quick Reference for Halo Agents

> Use this reference to know which ECC skill to invoke for each task type.

## Skill → Agent Mapping

| ECC Skill | Invoked By | When to Use |
|-----------|------------|-------------|
| `/plan` | Chief, Scout | Before implementing any multi-step task |
| `/harness-audit` | Chief | Audit agent configurations and orchestration |
| `/tdd` | Ops | Write tests first, then implement |
| `/code-review` | Arbiter, Cortana | After writing ANY code |
| `/python-review` | Cortana | Python-specific code review |
| `/typescript-review` | Cortana | TypeScript-specific review |
| `/security-review` | Hunter | Before committing sensitive code |
| `/database-review` | Hunter | SQL, schema changes, queries |
| `/build-fix` | Ops, Arbiter | When builds fail |
| `/architect` | Scout | System design decisions |

## By Task Type

### Planning & Design
```
/plan              → Create implementation plan
/architect         → Design system architecture
/harness-audit     → Audit agent configurations
```

### Development
```
/tdd               → Test-driven development flow
/code-review       → General code quality check
/python-review     → Python-specific review
/typescript-review → TypeScript-specific review
```

### Quality & Security
```
/security-review   → Security vulnerability scan
/database-review   → Database query/schema review
/build-fix         → Resolve build errors
```

## Halo Agent → ECC Skills Matrix

```
┌─────────┬────────────────────────────────────────────────────┐
│  Agent  │                    ECC Skills                      │
├─────────┼────────────────────────────────────────────────────┤
│ Chief   │ /plan, /harness-audit                              │
│ Ops     │ /tdd, /build-fix                                   │
│ Hunter  │ /security-review, /database-review                 │
│ Arbiter │ /code-review, /build-fix                           │
│ Cortana │ /code-review, /python-review, /typescript-review   │
│ Scout   │ /architect, /plan                                  │
└─────────┴────────────────────────────────────────────────────┘
```

## Invocation Examples

### Chief planning a sprint task
```
/plan
Create implementation plan for MGMT-42: Add real-time P&L widget
```

### Ops doing TDD
```
/tdd
Implement position sync endpoint with 80% test coverage
```

### Hunter scanning for vulnerabilities
```
/security-review
Review authentication middleware for OWASP Top 10
```

### Arbiter reviewing code
```
/code-review
Review the changes in src/lib/engine/executor.ts
```

### Cortana reviewing Python
```
/python-review
Review scripts/pivot_pete_engine.py for PEP8 and type hints
```

### Scout designing architecture
```
/architect
Design the multi-broker order routing system
```

## Benchmark Tracking

After each session, record ECC usage:
```bash
npx tsx scripts/ecc-benchmark-tracker.ts <agent> --skills-used=skill1,skill2 [options]
```

Example:
```bash
npx tsx scripts/ecc-benchmark-tracker.ts ops --skills-used=tdd-guide --build-success --test-coverage=85
```

Generate report:
```bash
npx tsx scripts/ecc-benchmark-tracker.ts --report
```

---
*Last updated: 2026-03-22*
