# Database Schema

---
tags: #database #reference #sqlite
status: 📘 Reference
---

## Overview

SwjshAK uses **SQLite** with the `better-sqlite3` library for fast, file-based storage.

**Location**: Auto-created in project root (typically `swjsh.db`)
**Initialization**: `src/lib/db.ts` - runs on first app start

---

## Tables

### 1. trades

Records all executed trades with entry/exit data and P&L.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY | Auto-increment ID |
| `symbol` | TEXT NOT NULL | Ticker symbol (e.g., 'ES', 'BTC', 'SPY') |
| `side` | TEXT NOT NULL | 'long' or 'short' |
| `entry_price` | REAL NOT NULL | Entry price |
| `exit_price` | REAL | Exit price (null if open) |
| `quantity` | REAL NOT NULL | Position size |
| `entry_time` | TEXT NOT NULL | ISO 8601 timestamp of entry |
| `exit_time` | TEXT | ISO 8601 timestamp of exit |
| `pnl` | REAL | Profit/loss (calculated on exit) |
| `strategy` | TEXT | Strategy name (e.g., 'ORB', 'VWAP Reversion') |
| `notes` | TEXT | Optional trade notes |
| `agent_id` | TEXT | Agent that executed (e.g., 'pivot-pete') |

**Example Query**:
```sql
-- Get all profitable trades today
SELECT * FROM trades
WHERE exit_time > date('now')
  AND pnl > 0
ORDER BY exit_time DESC;
```

---

### 2. signals

Incoming trade signals from TradingView webhooks or manual submissions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY | Auto-increment ID |
| `symbol` | TEXT NOT NULL | Ticker symbol |
| `action` | TEXT NOT NULL | 'buy', 'sell', 'close' |
| `price` | REAL NOT NULL | Signal price |
| `timestamp` | TEXT NOT NULL | ISO 8601 signal time |
| `source` | TEXT | 'tradingview', 'manual', 'strategy' |
| `strategy` | TEXT | Strategy that generated signal |
| `metadata` | TEXT | JSON string with additional data |

**Example Query**:
```sql
-- Get all TradingView buy signals for ES today
SELECT * FROM signals
WHERE source = 'tradingview'
  AND action = 'buy'
  AND symbol = 'ES'
  AND timestamp > date('now')
ORDER BY timestamp DESC;
```

---

### 3. journal_entries

Daily trading journal with notes, mood tracking, and reflection.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY | Auto-increment ID |
| `date` | TEXT NOT NULL | ISO 8601 date (YYYY-MM-DD) |
| `entry` | TEXT | Markdown journal entry |
| `mood` | TEXT | 'confident', 'cautious', 'neutral', etc. |
| `tags` | TEXT | Comma-separated tags (e.g., 'revenge-trading,fomo') |
| `created_at` | TEXT NOT NULL | ISO 8601 timestamp |

**Example Query**:
```sql
-- Get last 7 days of journal entries
SELECT * FROM journal_entries
WHERE date >= date('now', '-7 days')
ORDER BY date DESC;
```

---

### 4. settings

Key-value store for application configuration.

| Column | Type | Description |
|--------|------|-------------|
| `key` | TEXT PRIMARY KEY | Setting name (e.g., 'kill_switch_active') |
| `value` | TEXT NOT NULL | Setting value (JSON string if complex) |
| `updated_at` | DATETIME | Timestamp of last update |

**Common Settings**:
- `kill_switch_active`: `'true'` or `'false'`
- `account_balance`: Current account value (e.g., `'10000.00'`)
- `risk_per_trade`: Risk percentage (e.g., `'1'`)
- `theme`: UI theme (e.g., `'dark'`)

**Example Query**:
```sql
-- Check if kill switch is active
SELECT value FROM settings WHERE key = 'kill_switch_active';
```

---

### 5. intel_signals

Intelligence Bus signals from multiple sources. Provides confidence-weighted trade signals consumed by agents during go/no-go decision-making.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY | Auto-increment ID |
| `timestamp` | DATETIME | When signal was created |
| `source` | TEXT NOT NULL | Signal origin (e.g., 'pivot-pete', 'scanner', 'macro') |
| `symbol` | TEXT NOT NULL | Ticker symbol (e.g., 'ES', 'BTC') |
| `signal_type` | TEXT NOT NULL | Type of signal (e.g., 'SUPPORT', 'BREAKOUT', 'REVERSAL') |
| `confidence` | REAL | Confidence score (0.0 to 1.0, default 0.5) |
| `summary` | TEXT | Human-readable signal summary |
| `payload` | TEXT | JSON string with detailed signal data |
| `expires_at` | DATETIME | When signal becomes stale |

**Indexes**:
- `idx_intel_active`: ON `(symbol, expires_at)` — quickly find active signals for a symbol

**Purpose**: Central intelligence bus for multi-agent coordination. Agents query this table during preflight checks to gather contextual signals before trade entry.

**Example Query**:
```sql
-- Get all active (non-expired) signals for ES right now
SELECT * FROM intel_signals
WHERE symbol = 'ES'
  AND (expires_at IS NULL OR expires_at > datetime('now'))
ORDER BY confidence DESC;
```

**Relationships**:
- Consumed by `intel_preflight_log` (stores which signals were considered in go/no-go)
- Feedback loop from `agent_feedback_log` (scores improved if trades win)

---

### 6. intel_preflight_log

Decision log for every trade considered by agents. Records the go/no-go determination, the intel score, and why.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY | Auto-increment ID |
| `timestamp` | DATETIME | When decision was made |
| `agent_id` | TEXT NOT NULL | Agent making the decision (e.g., 'pivot-pete') |
| `symbol` | TEXT NOT NULL | Ticker symbol |
| `direction` | TEXT NOT NULL | 'LONG' or 'SHORT' |
| `strategy` | TEXT | Strategy name at time of decision |
| `decision` | TEXT NOT NULL | 'GO', 'NO_GO', or 'REDUCED' (reduced size allowed) |
| `intel_score` | REAL | Aggregated confidence from active signals (0.0-1.0) |
| `size_multiplier` | REAL | Recommended position size multiplier based on intel |
| `reason` | TEXT | Text explanation of decision |
| `signals_snapshot` | TEXT | JSON snapshot of signals considered |
| `regime` | TEXT | Market regime at time (e.g., 'TRENDING', 'CHOPPY', 'BREAKOUT') |
| `latency_ms` | INTEGER | How long preflight check took |

**Indexes**:
- `idx_preflight_agent_ts`: ON `(agent_id, timestamp)` — analyze agent's decision history

**Purpose**: Audit trail and feedback mechanism. Every trade attempt is logged here (whether it executed or not). Used to validate that agents are respecting intelligence signals and to improve decision-making over time.

**Example Query**:
```sql
-- How often did Pivot Pete get rejected signals today?
SELECT
  COUNT(*) as total_attempts,
  SUM(CASE WHEN decision = 'GO' THEN 1 ELSE 0 END) as approved,
  SUM(CASE WHEN decision = 'NO_GO' THEN 1 ELSE 0 END) as rejected
FROM intel_preflight_log
WHERE agent_id = 'pivot-pete'
  AND timestamp > datetime('now', '-1 day');
```

**Relationships**:
- **Feeds from**: `intel_signals` (what signals were active)
- **Links to**: `agent_feedback_log` (outcome of approved trades)
- **Used by**: TheProfessor and TheAuditor for trade review

---

### 7. agent_feedback_log

Trade outcome feedback from agents back to the intelligence system. Closes the loop on every executed trade.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY | Auto-increment ID |
| `timestamp` | DATETIME | When feedback was recorded |
| `agent_id` | TEXT NOT NULL | Agent that executed trade |
| `trade_id` | INTEGER | FK to `trades` table (if available) |
| `symbol` | TEXT NOT NULL | Ticker symbol |
| `direction` | TEXT NOT NULL | 'LONG' or 'SHORT' |
| `strategy` | TEXT | Strategy used |
| `outcome` | TEXT NOT NULL | 'WIN', 'LOSS', 'BE', 'TIMEOUT', or 'MANUAL_CLOSE' |
| `pnl` | REAL | Realized profit/loss |
| `duration_minutes` | REAL | How long position was held |
| `intel_score_at_entry` | REAL | What the intelligence score was when trade entered |
| `intel_decision_at_entry` | TEXT | The preflight decision that approved this trade |
| `notes` | TEXT | Trade outcome notes (e.g., 'Hit target', 'Stopped out early') |

**Indexes**:
- `idx_feedback_agent_ts`: ON `(agent_id, timestamp)` — analyze agent performance

**Purpose**: Reinforcement feedback loop. Allows the system to measure which signals and agents are actually profitable. Used by TheAuditor to rate signal sources and adjust future confidence weights.

**Example Query**:
```sql
-- Win rate by agent this month
SELECT
  agent_id,
  COUNT(*) as trades,
  SUM(CASE WHEN outcome = 'WIN' THEN 1 ELSE 0 END) as wins,
  ROUND(100.0 * SUM(CASE WHEN outcome = 'WIN' THEN 1 ELSE 0 END) / COUNT(*), 1) as win_rate,
  ROUND(AVG(pnl), 2) as avg_pnl
FROM agent_feedback_log
WHERE timestamp > datetime('now', '-30 days')
GROUP BY agent_id
ORDER BY win_rate DESC;
```

**Relationships**:
- **Correlates with**: `intel_preflight_log` (via `agent_id`, `symbol`, `timestamp`)
- **Links to**: `trades` table via `trade_id` (same position recorded two ways)
- **Used by**: TheAuditor for post-trade review and signal source scoring

---

## Database Initialization

**File**: `src/lib/db.ts`

Database is initialized via the `initDB()` function which:
1. Creates the 4 core tables (trades, signals, journal_entries, settings)
2. Creates the 3 intelligence tables (intel_signals, intel_preflight_log, agent_feedback_log)
3. Creates necessary indexes for performance
4. Runs all DDL in a transaction for safety
5. Handles schema migrations (e.g., adding new columns)

**Core Tables**:
```sql
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('LONG', 'SHORT')),
  entry_price REAL,
  exit_price REAL,
  size REAL,
  strategy TEXT,
  status TEXT CHECK(status IN ('OPEN', 'CLOSED', 'WIN', 'LOSS', 'BE')),
  pnl REAL,
  notes TEXT,
  entry_date TEXT NOT NULL,
  exit_date TEXT,
  screenshot_url TEXT,
  intel_snapshot TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  symbol TEXT NOT NULL,
  strategy TEXT,
  action TEXT NOT NULL,
  price REAL,
  payload TEXT,
  processed INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS journal_entries (
  date TEXT PRIMARY KEY,
  daily_pnl REAL DEFAULT 0,
  mood TEXT,
  notes TEXT,
  tags TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Intelligence Tables**:
```sql
CREATE TABLE IF NOT EXISTS intel_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  source TEXT NOT NULL,
  symbol TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  confidence REAL DEFAULT 0.5,
  summary TEXT,
  payload TEXT,
  expires_at DATETIME
);

CREATE TABLE IF NOT EXISTS intel_preflight_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  agent_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  strategy TEXT,
  decision TEXT NOT NULL CHECK(decision IN ('GO', 'NO_GO', 'REDUCED')),
  intel_score REAL,
  size_multiplier REAL,
  reason TEXT,
  signals_snapshot TEXT,
  regime TEXT,
  latency_ms INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS agent_feedback_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  agent_id TEXT NOT NULL,
  trade_id INTEGER,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  strategy TEXT,
  outcome TEXT NOT NULL CHECK(outcome IN ('WIN', 'LOSS', 'BE', 'TIMEOUT', 'MANUAL_CLOSE')),
  pnl REAL,
  duration_minutes REAL,
  intel_score_at_entry REAL,
  intel_decision_at_entry TEXT,
  notes TEXT
);
```

**Indexes**:
```sql
CREATE INDEX IF NOT EXISTS idx_intel_active
ON intel_signals(symbol, expires_at);

CREATE INDEX IF NOT EXISTS idx_preflight_agent_ts
ON intel_preflight_log(agent_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_feedback_agent_ts
ON agent_feedback_log(agent_id, timestamp);
```

---

## API Access

### Reading Trades
**Route**: `GET /api/journal?type=trades`

**Example**:
```javascript
const response = await fetch('/api/journal?type=trades&limit=50');
const trades = await response.json();
```

---

### Creating Trade
**Route**: `POST /api/journal?type=trade`

**Body**:
```json
{
  "symbol": "ES",
  "side": "long",
  "entry_price": 5850.25,
  "quantity": 1,
  "entry_time": "2026-03-15T14:30:00Z",
  "strategy": "ORB",
  "agent_id": "pivot-pete"
}
```

---

### Closing Trade
**Route**: `PUT /api/journal?type=trade`

**Body**:
```json
{
  "id": 123,
  "exit_price": 5875.50,
  "exit_time": "2026-03-15T16:00:00Z",
  "pnl": 252.50
}
```

---

### Recording Signal
**Route**: `POST /api/signals`

**Body**:
```json
{
  "symbol": "BTC",
  "action": "buy",
  "price": 65000,
  "source": "manual",
  "strategy": "VWAP Reversion"
}
```

---

## Data Flow

```mermaid
graph LR
    A[TradingView Alert] -->|webhook| B[/api/webhook/tradingview]
    B --> C[(signals table)]

    D[Agent Executes Trade] --> E[/api/journal POST]
    E --> F[(trades table)]

    G[User Writes Journal] --> H[/api/journal POST]
    H --> I[(journal_entries table)]

    J[Kill Switch Triggered] --> K[/api/killswitch POST]
    K --> L[(settings table)]

    F --> M[Dashboard Charts]
    C --> M
    I --> N[Journal Page]
    L --> O[Risk Engine]

    P[Signal Sources] -->|publish| Q[(intel_signals)]
    Q -->|preflight| R[Agent Decision]
    R -->|log| S[(intel_preflight_log)]
    S -->|GO/NO_GO| E
    E -->|outcome| T[(agent_feedback_log)]
    T -->|feedback| Q
    T -->|audit| U[TheAuditor Review]
```

---

## Performance Considerations

### Current Indexes
The system creates indexes on the intelligence tables for performance:
```sql
CREATE INDEX idx_intel_active ON intel_signals(symbol, expires_at);
CREATE INDEX idx_preflight_agent_ts ON intel_preflight_log(agent_id, timestamp);
CREATE INDEX idx_feedback_agent_ts ON agent_feedback_log(agent_id, timestamp);
```

### Recommended Additional Indexes
For large datasets, consider adding:
```sql
CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_entry_date ON trades(entry_date);
CREATE INDEX idx_signals_timestamp ON signals(timestamp);
CREATE INDEX idx_preflight_symbol_ts ON intel_preflight_log(symbol, timestamp);
CREATE INDEX idx_feedback_symbol_ts ON agent_feedback_log(symbol, timestamp);
```

### Archiving Old Data
For long-running systems, consider archiving trades older than 1 year:
```sql
-- Archive to separate table
CREATE TABLE trades_archive AS
SELECT * FROM trades
WHERE entry_time < date('now', '-1 year');

DELETE FROM trades
WHERE entry_time < date('now', '-1 year');
```

---

## Migration to Prisma (Planned)

**Status**: Prisma schema exists (`prisma/schema.prisma`) but not actively used

**Benefits**:
- Type-safe queries
- Automatic migrations
- Better schema management

**Migration Path**:
1. Finalize Prisma schema
2. Generate migration from current SQLite
3. Update all API routes to use Prisma client
4. Remove `better-sqlite3` dependency

See: [[Technical Debt]] for tracking

---

## Backup Strategy

### Manual Backup
```powershell
# Copy database file
cp swjsh.db backups/swjsh_$(date +%Y%m%d).db
```

### Automated Backup (Recommended)
Add to cron or Task Scheduler:
```bash
# Daily backup at 2 AM
0 2 * * * cp /path/to/swjsh.db /backups/swjsh_$(date +\%Y\%m\%d).db
```

---

## Related Pages

- [[System Architecture]] - Overall system design
- [[API Reference]] - Endpoint documentation
- [[Data Flow]] - How data moves through system
- [[Technical Debt]] - Prisma migration plan
