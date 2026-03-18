# Testing Guide

## Overview

SwjshAK now has comprehensive test coverage using **Vitest** and **React Testing Library**. The test suite covers database operations, trading strategies, and frontend components.

## Test Statistics

- **Total Test Files**: 3
- **Total Tests**: 47 (all passing)
- **Coverage Areas**:
  - Database Operations: 16 tests
  - Trading Strategies (ORB): 13 tests
  - UI Components (GlassPanel): 18 tests

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm test -- --watch

# Run tests with UI dashboard
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

### 1. Database Tests (`src/lib/db.test.ts`)

Tests all CRUD operations across the 4 core tables:

**Trades Table**
- ✓ Insert new trades
- ✓ Retrieve trades by status (OPEN, CLOSED, WIN, LOSS, BE)
- ✓ Update trades with exit data and PnL calculations
- ✓ Enforce direction constraints (LONG/SHORT)

**Signals Table**
- ✓ Insert trading signals from strategies
- ✓ Retrieve unprocessed signals
- ✓ Mark signals as processed

**Journal Entries Table**
- ✓ Insert daily journal entries with PnL, mood, notes
- ✓ Retrieve entries by date
- ✓ Update journal entries
- ✓ Enforce date primary key constraint

**Settings Table**
- ✓ Store/retrieve key-value configuration
- ✓ Update settings (account balance, risk per trade, etc.)

**Transaction Handling**
- ✓ Rollback on errors
- ✓ Commit successful multi-table transactions

### 2. Strategy Tests (`src/lib/engine/strategies/orb.test.ts`)

Comprehensive tests for the ORB (Opening Range Breakout) strategy:

**Initialization**
- ✓ Correct strategy properties
- ✓ Proper category assignment (FUTURES)

**Opening Range Detection**
- ✓ Track high/low during first 15 minutes
- ✓ Set range after duration completes

**Breakout Detection - Upside**
- ✓ Generate BUY signal when price breaks above opening high
- ✓ Prevent multiple signals in same session

**Breakout Detection - Downside**
- ✓ Generate SELL signal when price breaks below opening low
- ✓ Prevent multiple signals in same session

**Session Management**
- ✓ Reset range for new trading day

**Configuration**
- ✓ Respect isActive flag
- ✓ Use custom start time parameters
- ✓ Use custom duration parameters

### 3. Component Tests (`src/components/UI/GlassPanel.test.tsx`)

Tests for the glassmorphic panel UI component:

**Rendering**
- ✓ Render children content
- ✓ Render title (string or ReactNode)
- ✓ Render action elements
- ✓ Conditional header rendering

**CSS Classes**
- ✓ Apply custom className
- ✓ Combine default and custom classes

**Content Structure**
- ✓ Wrap children in content div
- ✓ Handle multiple children
- ✓ Support complex nested content

**Header Layout**
- ✓ Position title and action in header

**Real-World Use Cases**
- ✓ Trading signal panel
- ✓ Chart panel with timeframe selector
- ✓ Strategy configuration panel
- ✓ Journal entry panel

## Test Configuration

### Vitest Config (`vitest.config.ts`)

```typescript
{
  environment: 'jsdom',  // DOM simulation for React components
  globals: true,          // No need to import describe, it, expect
  setupFiles: ['./src/test/setup.ts']
}
```

### Setup File (`src/test/setup.ts`)

- Imports `@testing-library/jest-dom` for enhanced matchers
- Auto-cleanup after each test
- Sets `NODE_ENV=test`

## Writing New Tests

### Database Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

describe('My Database Test', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:'); // In-memory DB for tests
    // Initialize schema...
  });

  it('should do something', () => {
    const stmt = db.prepare('INSERT INTO...');
    const result = stmt.run(...);
    expect(result.changes).toBe(1);
  });
});
```

### Strategy Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MyStrategy } from './myStrategy';
import { Candle, StrategyConfig } from '../types';

describe('My Strategy', () => {
  let strategy: MyStrategy;

  beforeEach(() => {
    const config: StrategyConfig = {
      id: 'my_strat',
      name: 'My Strategy',
      isActive: true,
      params: {},
      category: 'CRYPTO'
    };
    strategy = new MyStrategy(config);
  });

  it('should generate signal', () => {
    const candle: Candle = {
      timestamp: '2026-01-01T10:00:00',
      open: 5000,
      high: 5010,
      low: 4990,
      close: 5005,
      volume: 1000
    };

    const signal = strategy.onCandle(candle);
    expect(signal?.action).toBe('BUY');
  });
});
```

### Component Tests

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('should render content', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always close database connections in `afterEach`
3. **Descriptive Names**: Use clear, behavior-focused test names
4. **Arrange-Act-Assert**: Structure tests clearly:
   ```typescript
   it('should calculate PnL correctly', () => {
     // Arrange
     const entry = 5000, exit = 5025;

     // Act
     const pnl = (exit - entry) * 50;

     // Assert
     expect(pnl).toBe(1250);
   });
   ```
5. **Edge Cases**: Test boundaries, nulls, empty states
6. **Timestamps**: Use local time format (`2026-01-01T09:30:00`) not UTC

## Next Steps

### Expand Coverage

1. **More Strategies**: Add tests for all 7 strategies
   - NeverStoppedOut
   - Support/Resistance
   - VWAP Reversion
   - Bollinger Band Breakout
   - Three Ducks
   - Grid Trading

2. **More Components**: Test critical UI components
   - ActiveSignals
   - TradingChart
   - StrategyPanel
   - AgentTerminal

3. **API Routes**: Test webhook and API endpoints
   ```typescript
   // Example API route test
   import { POST } from '@/app/api/signals/route';

   it('should create signal', async () => {
     const request = new Request('http://localhost/api/signals', {
       method: 'POST',
       body: JSON.stringify({ symbol: 'ES', action: 'BUY' })
     });

     const response = await POST(request);
     expect(response.status).toBe(201);
   });
   ```

4. **Integration Tests**: Test multi-component workflows
   - Signal generation → Trade execution → Journal update
   - Strategy evaluation → Risk calculation → Position sizing

5. **E2E Tests**: Consider adding Playwright for full user flows
   ```bash
   npm install -D @playwright/test
   ```

## Troubleshooting

### Database Lock Errors
**Error**: `EBUSY: resource busy or locked`

**Solution**: Ensure `afterEach` closes database connections:
```typescript
afterEach(() => {
  if (db) db.close();
});
```

### Timestamp Issues
**Error**: Strategy tests failing due to timezone

**Solution**: Use local time format without 'Z' suffix:
```typescript
timestamp: '2026-01-01T09:30:00' // ✓ Local time
timestamp: '2026-01-01T09:30:00Z' // ✗ UTC time
```

### React Component Not Found
**Error**: `screen.getByText(...) not found`

**Solution**: Check component actually renders the text, use `screen.debug()`:
```typescript
render(<MyComponent />);
screen.debug(); // Prints current DOM
```

## CI/CD Integration

Add to GitHub Actions (`.github/workflows/test.yml`):

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm test -- --run
      - run: npm run test:coverage
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)
