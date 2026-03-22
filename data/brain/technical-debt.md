# Technical Debt

---
tags: #development #refactoring #planning
status: 📋 Tracking
---

## Overview

This page tracks technical debt - code that works but needs improvement for maintainability, performance, or correctness.

---

## High Priority

### 1. Environment Variable Consolidation

**Issue**: Duplicate and inconsistent env vars across codebase

**Examples**:
- `OANDA_API_KEY` vs `OANDA_TOKEN`
- Multiple places defining same broker keys
- Some agents use hardcoded fallbacks

**Impact**: Confusion, deployment errors, security risk

**Fix**:
- [ ] Audit all env var usage across codebase
- [ ] Consolidate to single `.env` schema
- [ ] Update all imports to use consistent names
- [ ] Create `.env.example` with all required vars

**Effort**: Medium (2-3 hours)

---

### 2. Prisma Migration

**Issue**: Prisma schema exists but not used; still using raw `better-sqlite3`

**Current**:
```typescript
// Using raw SQL
db.prepare('SELECT * FROM trades').all();
```

**Desired**:
```typescript
// Using Prisma (type-safe)
await prisma.trades.findMany();
```

**Impact**: No type safety, manual migration management

**Fix**:
- [ ] Review existing Prisma schema (`prisma/schema.prisma`)
- [ ] Generate migration from current SQLite
- [ ] Update all database access to use Prisma client
- [ ] Remove `better-sqlite3` dependency

**Effort**: High (4-6 hours)

---

### 3. Agent Health Monitoring

**Issue**: Limited visibility into agent health

**Current**:
- Only know if agent is running or crashed
- No memory/CPU metrics
- No health checks

**Desired**:
- Memory usage per agent
- CPU utilization
- Health endpoint for each agent
- Automatic alerts on degradation

**Fix**:
- [ ] Add health metrics to agent status updates
- [ ] Create `/api/agents/:id/health` endpoint
- [ ] Add PM2 metrics integration
- [ ] Create alerting rules

**Effort**: Medium (3-4 hours)

---

## Medium Priority

### 4. API Error Handling Standardization

**Issue**: Inconsistent error responses across API routes

**Current**:
```typescript
// Route 1
return Response.json({ error: 'Not found' }, { status: 404 });

// Route 2
return Response.json({ success: false, message: 'Not found' });

// Route 3
throw new Error('Not found');
```

**Desired**:
```typescript
// All routes
return Response.json({
  success: false,
  error: {
    code: 'NOT_FOUND',
    message: 'Resource not found'
  }
}, { status: 404 });
```

**Fix**:
- [ ] Create standard error response utility
- [ ] Update all API routes to use it
- [ ] Add error logging middleware
- [ ] Document error codes

**Effort**: Medium (2-3 hours)

---

### 5. Test Coverage

**Issue**: Minimal automated tests

**Current**:
- No unit tests
- No integration tests
- Manual testing only

**Desired**:
- Unit tests for strategies
- Integration tests for API routes
- E2E tests for critical flows

**Fix**:
- [ ] Set up Jest or Vitest
- [ ] Write tests for strategy logic
- [ ] Write tests for API endpoints
- [ ] Add CI pipeline

**Effort**: High (8+ hours)

---

### 6. TypeScript Strict Mode

**Issue**: TypeScript not in strict mode; many `any` types

**Current**:
```typescript
// tsconfig.json
"strict": false
```

**Impact**: Type errors missed, runtime bugs

**Fix**:
- [ ] Enable strict mode incrementally
- [ ] Fix type errors
- [ ] Remove `any` usage where possible
- [ ] Add proper types to external data

**Effort**: Medium (4-6 hours)

---

### 7. Logging Standardization

**Issue**: Inconsistent logging format and levels

**Current**:
```typescript
console.log('[Agent] Starting...');
console.error('Error:', error);
console.log(JSON.stringify(data));
```

**Desired**:
```typescript
logger.info({ agent: 'pivot-pete' }, 'Starting agent');
logger.error({ error, context }, 'Agent failed');
```

**Fix**:
- [ ] Add logging library (Pino, Winston)
- [ ] Define log levels and formats
- [ ] Replace console.log throughout
- [ ] Add log rotation

**Effort**: Medium (2-3 hours)

---

## Low Priority

### 8. CSS Cleanup

**Issue**: Some CSS has hardcoded values instead of variables

**Current**:
```css
.panel {
  background: #1a1a2e;  /* Hardcoded */
}
```

**Desired**:
```css
.panel {
  background: hsl(var(--background));
}
```

**Fix**:
- [ ] Audit all CSS modules
- [ ] Replace hardcoded colors with variables
- [ ] Ensure consistent dark mode

**Effort**: Low (1-2 hours)

---

### 9. Remove Unused Files

**Issue**: Old/unused files still in codebase

**Files to Review**:
- `src/app/breakroom/` (deleted but may have remnants)
- `WoodTheme/` images
- Old test files

**Fix**:
- [ ] Identify unused files
- [ ] Verify not referenced
- [ ] Delete and commit

**Effort**: Low (30 min)

---

### 10. Bundle Size Optimization

**Issue**: Next.js bundle may be larger than needed

**Checks**:
- [ ] Run `npm run build` and check bundle analysis
- [ ] Identify large dependencies
- [ ] Consider lazy loading for heavy components

**Effort**: Low (1-2 hours)

---

### 11. Documentation Comments

**Issue**: Many functions lack JSDoc comments

**Current**:
```typescript
function calculatePositionSize(balance, risk, entry, stop) {
  // ...
}
```

**Desired**:
```typescript
/**
 * Calculate position size based on risk parameters
 * @param balance - Account balance in USD
 * @param risk - Risk percentage (1 = 1%)
 * @param entry - Entry price
 * @param stop - Stop loss price
 * @returns Position size in units
 */
function calculatePositionSize(
  balance: number,
  risk: number,
  entry: number,
  stop: number
): number {
  // ...
}
```

**Fix**: Add as code is modified (ongoing)

**Effort**: Ongoing

---

## Tracking

### Sprint Integration

High priority items should be added to [[Current Sprint]] when capacity allows.

### Review Cadence

- Review this list monthly
- Prioritize based on:
  1. Security impact
  2. Bug risk
  3. Developer productivity
  4. User impact

---

## Completed Debt

### 2026-03-15: Pivot Pete Env Vars
- ✅ Consolidated OANDA env vars
- ✅ Fixed startup issues

### 2026-03-10: Architecture Documentation
- ✅ Updated CLAUDE.md
- ✅ Created Obsidian knowledge base

---

## Related Pages

- [[Current Sprint]] - Active development
- [[Roadmap]] - Overall planning
- [[System Architecture]] - Technical overview
- [[Troubleshooting]] - Current issues
