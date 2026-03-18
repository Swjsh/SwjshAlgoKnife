# SwjshAK Master Game Plan: 4 Data Layer Integrations

**Goal**: Transform SwjshAK from a reactive system (waits for TradingView signals) into a proactive intelligence platform that ingests order flow, sentiment, on-chain convergence, and whale activity in real time.

**Execution Model**: Each phase is self-contained and can be completed in a single Claude session or manually. Phases build on each other but are independently testable. Every phase ends with a concrete verification step.

> **Review Notes (2026-03-14)**: Plan reviewed against actual codebase. Key fixes applied:
> - Absorption detection criteria corrected (was backwards)
> - Dual Signal type conflict resolved (maps to `types.ts` Signal, not StrategyLoop)
> - Intelligence Bus is a module-level singleton (executor is instantiated per-request)
> - `consumed` flag replaced with expiry-only lifecycle
> - DB index added for query performance
> - FinBERT demoted to opt-in; keyword scorer is default
> - Intel gating wired through RiskEngine.canOpenTrade() instead of hacking executor
> - Health check endpoint added for service monitoring
> - ScannerEngine integration added for intel-enhanced scan results

---

## Architecture Overview: The Intelligence Bus

All 4 new systems feed into a single shared layer called the **Intelligence Bus** — a lightweight event emitter + SQLite table that normalizes signals from any source into a common format your existing executor already understands.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    NEW DATA LAYERS (Proactive)                      │
│                                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Order Flow   │ │  Sentiment   │ │ ConfluX  │ │ Whale Flow   │  │
│  │ CVD+Z-Score  │ │  LSTM+NLP    │ │ On-Chain │ │ Tracker      │  │
│  └──────┬───────┘ └──────┬───────┘ └────┬─────┘ └──────┬───────┘  │
│         │                │               │              │          │
│         ▼                ▼               ▼              ▼          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              INTELLIGENCE BUS (New Shared Layer)            │   │
│  │  EventEmitter + SQLite `intel_signals` table               │   │
│  │  Normalizes all sources → IntelSignal format               │   │
│  └────────────────────────┬────────────────────────────────────┘   │
│                           │                                        │
└───────────────────────────┼────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 EXISTING SWJSHAK ENGINE (Unchanged)                 │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Signal       │  │ Risk Engine  │  │ TradeExecutor            │  │
│  │ Validator    │  │ + Regime     │  │ (Alpaca/OANDA/Paper)     │  │
│  │ (new gate)   │  │ Detector     │  │                          │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────────┘  │
│         │                 │                      │                  │
│  ┌──────┴─────────────────┴──────────────────────┴───────────────┐  │
│  │  SQLite (trades, signals, journal) + Firebase + Discord       │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Foundation — The Intelligence Bus

**Why first**: Every subsequent phase publishes into this bus. Build it once, everything connects cleanly.

### 0.1 — New SQLite Table: `intel_signals`

Add to `src/lib/db.ts` inside `initDB()`:

```sql
CREATE TABLE IF NOT EXISTS intel_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    source TEXT NOT NULL,          -- 'ORDER_FLOW' | 'SENTIMENT' | 'ONCHAIN_CONFLUENCE' | 'WHALE_FLOW'
    symbol TEXT NOT NULL,
    signal_type TEXT NOT NULL,     -- 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'ALERT'
    confidence REAL DEFAULT 0.5,   -- 0.0 to 1.0
    payload TEXT,                  -- JSON blob with source-specific data
    expires_at DATETIME            -- TTL — intel goes stale, no consumed flag (reusable until expired)
);

-- Index for fast lookups during trade execution
CREATE INDEX IF NOT EXISTS idx_intel_active ON intel_signals(symbol, expires_at);
```

> **Design decision**: No `consumed` flag. Intel signals are reusable by multiple trades until they expire. This avoids the bug where a second trade on the same symbol loses intel context because the first trade marked it consumed.

### 0.2 — IntelSignal Type

Create `src/lib/intel/types.ts`:

```typescript
export type IntelSource = 'ORDER_FLOW' | 'SENTIMENT' | 'ONCHAIN_CONFLUENCE' | 'WHALE_FLOW';
export type IntelDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'ALERT';

export interface IntelSignal {
    source: IntelSource;
    symbol: string;
    direction: IntelDirection;
    confidence: number;        // 0.0 – 1.0
    summary: string;           // Human-readable for Discord/UI
    payload: Record<string, any>;
    expiresAt?: string;        // ISO timestamp — intel goes stale
}
```

### 0.3 — Intelligence Bus

Create `src/lib/intel/bus.ts`:

**CRITICAL**: Must be a module-level singleton (same pattern as `db` in `src/lib/db.ts`). The TradeExecutor is instantiated fresh on every webhook POST — the bus must persist across requests.

An EventEmitter that:
1. Receives `IntelSignal` from any source via `bus.publish(signal)`
2. Persists to `intel_signals` table
3. Emits `'intel'` event for real-time listeners (dashboard, executor)
4. Auto-expires stale signals (configurable TTL per source, default 15 min for order flow, 30 min for sentiment, 60 min for on-chain/whale)
5. Exposes `bus.query(symbol, source?)` to fetch active (non-expired) intel for a symbol
6. Exposes `bus.score(symbol, signalDirection)` to compute weighted Intel Score for executor gating

### 0.4 — Signal Validator (RiskEngine Integration)

**Important context**: Your codebase has two `Signal` interfaces. The intel system maps to `src/lib/engine/types.ts` Signal (action: BUY/SELL/EXIT) since that's what TradeExecutor.processSignal() consumes. The StrategyLoop Signal (type: ENTRY/EXIT/ZONE_FOUND) is internal to the local runner and is NOT affected.

**Also important**: `RiskEngine.canOpenTrade()` already has a clean gating pattern (kill switch → daily loss → concurrent trades → correlation check) but the TradeExecutor currently does NOT call it. Wire it in as part of this step.

Modify `src/lib/engine/risk/RiskEngine.ts`:
- Add new check #5: **Intel Score Gate**
- Query `bus.score(symbol, direction)` which returns a weighted score from active intel
- Scoring logic:
  - **Confirm** (score > 0.6, intel aligns): `{ allowed: true, intelMultiplier: 1.0 }`
  - **Neutral** (score 0.3–0.6, mixed intel): `{ allowed: true, intelMultiplier: 0.5 }`
  - **Veto** (score < 0.3, intel opposes): `{ allowed: false, reason: 'Intel opposes: ...' }`
  - **No data** (no active intel): `{ allowed: true, intelMultiplier: 0.75 }` — slight reduction when flying blind

Modify `src/lib/engine/executor.ts` → `processSignal()`:
- Call `RiskEngine.canOpenTrade()` before submitting to broker
- Apply `intelMultiplier` to position size calculation
- Log the intel decision for every trade

### 0.5 — Discord Notifications for Intel

Add to `src/lib/notifications/discord.ts`:

```typescript
export async function notifyIntelSignal(intel: {
    source: string;
    symbol: string;
    direction: string;
    confidence: number;
    summary: string;
}): Promise<void>
```

Route to appropriate channel using existing `channelForSymbol()`.

### 0.6 — API Routes

Create `src/app/api/intel/route.ts`:
- `GET` — Returns active (non-expired) intel signals, filterable by `?symbol=` and `?source=`
- Used by dashboard UI to render intel overlays

Create `src/app/api/health/route.ts`:
- `GET` — Returns status of all background services (order flow, sentiment, on-chain, whale)
- Each service writes a heartbeat timestamp to the `settings` table (key: `health:{service_name}`)
- Health endpoint checks if heartbeat is within expected interval, returns per-service status
- Used by dashboard to show green/red service indicators

### 0.7 — ScannerEngine Integration

Modify `src/lib/scanner/engine.ts` → `scan()`:
- After computing scan results, query Intelligence Bus for active intel on each scanned symbol
- Multiply scan confidence by intel alignment factor:
  - Breakout + bullish intel = HIGH confidence boost
  - Breakout + bearish intel = downgrade to LOW
  - No intel = keep original confidence
- This makes the scanner page significantly more useful without changing any scan strategy code

### 0.8 — Dashboard Widget

Add an "Intel Feed" panel to `src/app/dashboard/page.tsx` that polls `/api/intel` and shows a live scrolling feed of intel signals with source icons, direction arrows, and confidence bars. Include service health indicators from `/api/health`.

### Verification
- Run `npx tsx scripts/init-db.ts` and confirm `intel_signals` table exists
- POST a test IntelSignal to the bus programmatically, confirm it appears in SQLite and the `/api/intel` endpoint
- Send a TradingView webhook signal and confirm the executor logs whether intel confirmed/reduced/vetoed the trade

---

## Phase 1: Order Flow Engine (CVD + Z-Score)

**What it does**: Subscribes to exchange WebSocket trade streams, computes Cumulative Volume Delta (CVD) and Z-Score anomaly detection in real time, and publishes absorption/exhaustion signals to the Intelligence Bus.

### 1.1 — New Dependencies

```bash
npm install --save-dev @types/ws
# ws is already in devDeps — move to production deps:
npm install ws
```

No new Python deps needed. This is pure TypeScript.

### 1.2 — Order Flow Types

Create `src/lib/intel/orderflow/types.ts`:

```typescript
export interface TradeEvent {
    symbol: string;
    price: number;
    quantity: number;
    side: 'BUY' | 'SELL';      // Taker side (aggressor)
    timestamp: number;
    exchange: string;
}

export interface CVDSnapshot {
    symbol: string;
    cvd: number;               // Running cumulative delta
    cvdZScore: number;         // Z-score of CVD vs rolling mean
    buyVolume: number;         // Total buy volume in window
    sellVolume: number;        // Total sell volume in window
    delta: number;             // buyVolume - sellVolume in current window
    absorptionDetected: boolean;
    exhaustionDetected: boolean;
    timestamp: number;
}

export interface OrderFlowConfig {
    rollingWindowMs: number;    // e.g., 300000 (5 min)
    zScoreThreshold: number;    // e.g., 2.0 (2 standard deviations)
    minTradeSize: number;       // Filter noise — minimum trade size to count
    absorptionRatio: number;    // e.g., 3.0 — buy vol / sell vol ratio for absorption
}
```

### 1.3 — CVD Calculator

Create `src/lib/intel/orderflow/cvd.ts`:

A class that:
1. Maintains a rolling window of `TradeEvent[]` per symbol
2. Computes running CVD (sum of signed volume: +buy, -sell)
3. Keeps a rolling history of CVD values to compute mean/stddev
4. Calculates Z-Score: `(currentCVD - rollingMean) / rollingStdDev`
5. Detects **absorption**: High sell-side aggression on tape (many market sell orders hitting bid), but CVD stays flat or positive AND price holds/rises. This means a hidden passive buyer is absorbing all the selling. Detection: count of sell-aggressor trades is high, but net delta is near zero or positive, and price change over window is >= 0. Bullish signal.
6. Detects **exhaustion**: Extreme one-sided CVD (Z-Score > 2.0 or < -2.0) — the move has overextended. When CVD Z-Score hits extreme AND price momentum stalls (ATR decreasing), signal potential reversal.
7. Returns `CVDSnapshot` on each computation cycle

### 1.4 — Exchange WebSocket Feeds

Create `src/lib/intel/orderflow/feeds.ts`:

Extend the existing `MarketData` pattern from `src/lib/engine/local_runner/MarketData.ts`. Connect to:

- **Binance** (`wss://stream.binance.us:9443/ws/btcusdt@aggTrade`) — Crypto
  - Parse aggTrade messages: `{ p: price, q: quantity, m: isBuyerMaker }`
  - `m === true` means taker was SELL, `m === false` means taker was BUY
- **Alpaca** (existing integration) — Equities
  - Use Alpaca's streaming trade API for SPY/ES data

Include the same fallback pattern as existing `MarketData.ts` — if Binance fails (geo-block), log a warning and continue with whatever feeds are available.

### 1.5 — Order Flow Service

Create `src/lib/intel/orderflow/service.ts`:

The main orchestrator:
1. Initializes exchange feeds
2. Pipes trade events into CVD Calculator
3. On each computation cycle (every 10 seconds), checks for signals:
   - Absorption detected → publish `BULLISH` IntelSignal (confidence: 0.7–0.9 based on ratio strength)
   - Exhaustion detected → publish directional IntelSignal (confidence: 0.6–0.8)
   - Extreme Z-Score → publish `ALERT` IntelSignal
4. Publishes to Intelligence Bus
5. Configurable via `OrderFlowConfig` (loaded from `settings` table or .env)

### 1.6 — Runner Script

Create `scripts/run_orderflow.ts`:

Standalone script that starts the Order Flow Service. Can be launched via:
```bash
npx tsx scripts/run_orderflow.ts
```

Add to PM2 ecosystem config for persistent background execution.

### 1.7 — Dashboard Panel

Add "Order Flow" tab to the dashboard or scanner page:
- Real-time CVD chart using `lightweight-charts` (already installed)
- Buy/sell volume bars
- Z-Score gauge
- Absorption/exhaustion alert history

### Verification
- Start the order flow runner, confirm WebSocket connects to Binance
- Watch console for CVD snapshots logging every 10 seconds
- Trigger a high-volume period (or mock one) and confirm absorption/exhaustion signals appear in `intel_signals` table
- Confirm Discord notification fires for the intel signal
- Send a TradingView BUY signal for BTCUSD while order flow shows absorption → confirm executor logs "Intel CONFIRMED" with full position size

---

## Phase 2: Sentiment + LSTM Prediction Engine

**What it does**: Ingests news headlines, social media sentiment, and Fear & Greed index data. Runs NLP scoring and optional LSTM short-term prediction. Publishes sentiment signals to the Intelligence Bus.

### 2.1 — Python Environment Setup

Create `scripts/sentiment/requirements.txt` (lightweight default):
```
requests>=2.31
beautifulsoup4>=4.12
numpy>=1.24
pandas>=2.0
```

Create `scripts/sentiment/requirements_full.txt` (opt-in for FinBERT + LSTM):
```
transformers>=4.35
torch>=2.1
scikit-learn>=1.3
```

> **Design decision**: FinBERT + PyTorch is a 2GB+ download. The default scorer uses a keyword-based approach (fast, no GPU, works everywhere). FinBERT is opt-in for users who want higher accuracy and have the disk space. The service auto-detects: if `transformers` is importable, use FinBERT; otherwise fall back to keyword scoring.

### 2.2 — Sentiment Data Sources

Create `scripts/sentiment/sources.py`:

Data collectors for:
1. **Fear & Greed Index** — `https://api.alternative.me/fng/` (free, no auth, JSON)
   - Returns 0–100 score + classification (Extreme Fear → Extreme Greed)
   - Poll every 15 minutes
2. **CryptoPanic API** — `https://cryptopanic.com/api/v1/posts/` (free tier available)
   - Returns latest crypto news headlines with community votes
   - Poll every 5 minutes
3. **Finnhub News** — Uses your existing `NEXT_PUBLIC_FINNHUB_KEY`
   - `GET /api/v1/news?category=general&token=YOUR_KEY`
   - Returns financial news headlines
   - Poll every 10 minutes

Each source returns a normalized list:
```python
@dataclass
class HeadlineItem:
    text: str
    source: str
    symbol: str | None    # None if general market
    timestamp: str
    url: str | None
```

### 2.3 — NLP Sentiment Scorer

Create `scripts/sentiment/scorer.py`:

Uses HuggingFace `transformers` with the `ProsusAI/finbert` model (financial sentiment, ~250MB download on first run):
- Input: List of `HeadlineItem`
- Output: Per-headline sentiment score (-1.0 to +1.0) and aggregate symbol-level scores
- Caches model in `~/.cache/huggingface/` (standard behavior)

For lighter-weight deployment: include fallback to `TextBlob` or keyword-based scoring if PyTorch is unavailable.

### 2.4 — Sentiment Service (Python Process)

Create `scripts/sentiment/service.py`:

Main loop:
1. Every 5 minutes: poll all data sources
2. Score new headlines with FinBERT
3. Aggregate per-symbol sentiment (weighted by recency + source reliability)
4. Compute overall market sentiment from Fear & Greed + headline aggregate
5. Output signals as `AGENT_STATUS_UPDATE:{json}` to stdout (same pattern as existing Python agents like `bitcoin_bob_engine.py`)
6. The TypeScript agent runner reads stdout and publishes to Intelligence Bus

Signal logic:
- Symbol sentiment > +0.6 → `BULLISH` (confidence = sentiment * 0.8)
- Symbol sentiment < -0.6 → `BEARISH` (confidence = abs(sentiment) * 0.8)
- Fear & Greed < 20 (Extreme Fear) → `BULLISH` contrarian signal (confidence: 0.6)
- Fear & Greed > 80 (Extreme Greed) → `BEARISH` contrarian signal (confidence: 0.6)

### 2.5 — Phase 2B: LSTM Price Prediction (Optional Advanced)

Create `scripts/sentiment/lstm_model.py`:

Only implement after Phase 2A is stable. Uses:
- Input features: sentiment score, Fear & Greed, 1h/4h candle data, volume
- LSTM architecture: 2-layer, 64 hidden units, trained on last 90 days
- Output: Predicted 1h price direction (up/down) with confidence
- Training: Run `python scripts/sentiment/train_lstm.py` offline
- Inference: Called by sentiment service every 15 minutes

The LSTM output becomes another IntelSignal source with higher weight if backtested accuracy > 55%.

### 2.6 — TypeScript Bridge

Create `src/lib/intel/sentiment/bridge.ts`:

Spawns `python scripts/sentiment/service.py` as a child process (same pattern as `scripts/agent_runner.ts`). Parses `AGENT_STATUS_UPDATE:{json}` messages from stdout and publishes to Intelligence Bus.

### 2.7 — Dashboard Panel

Add "Sentiment" card to dashboard:
- Fear & Greed gauge (0–100 with color gradient)
- Rolling headline feed with per-headline sentiment badges (green/red/gray)
- Per-symbol sentiment sparkline
- LSTM prediction indicator (Phase 2B — "AI thinks BTC up in next 1h: 67%")

### 2.8 — Runner Script

Create `scripts/run_sentiment.ts`:
```bash
npx tsx scripts/run_sentiment.ts
```

Alternatively, add to agent_runner.ts to manage alongside existing Python agents.

### Verification
- Run `python scripts/sentiment/service.py` standalone, confirm it prints `AGENT_STATUS_UPDATE:{...}` with valid sentiment data
- Confirm Fear & Greed Index API returns data
- Confirm FinBERT scores a test headline correctly (e.g., "Bitcoin crashes 20%" → negative)
- Start the TypeScript bridge, confirm IntelSignals appear in `intel_signals` table
- On dashboard, confirm Sentiment panel renders Fear & Greed gauge and headline feed
- Send a TradingView BUY for BTC while sentiment is strongly bearish → confirm executor reduces position size

---

## Phase 3: ConfluX — On-Chain Confluence Detector

**What it does**: Monitors a curated list of known profitable crypto wallets. When multiple wallets start accumulating the same token simultaneously, fires a convergence signal.

### 3.1 — Python Environment

Add to `scripts/onchain/requirements.txt`:
```
requests>=2.31
web3>=6.0
```

### 3.2 — Wallet Watchlist

Create `data/wallet_watchlist.json`:

```json
{
    "wallets": [
        {
            "address": "0x...",
            "label": "Smart Money Wallet A",
            "chain": "ethereum",
            "track_since": "2026-01-01"
        }
    ],
    "config": {
        "convergence_window_minutes": 60,
        "min_wallets_for_signal": 3,
        "min_usd_value": 50000,
        "chains": ["ethereum", "solana"]
    }
}
```

This file is user-editable. Users add wallet addresses they want to track.

### 3.3 — Blockchain Data Fetchers

Create `scripts/onchain/fetchers.py`:

Abstraction layer for blockchain APIs:
- **Ethereum**: Etherscan API (`https://api.etherscan.io/api`) — free tier: 5 calls/sec
  - `GET ?module=account&action=tokentx&address={wallet}`
  - Returns ERC-20 token transfers for a wallet
- **Solana**: Solscan API or Helius RPC
  - Token transfer history for a wallet

Each fetcher returns normalized transfer events:
```python
@dataclass
class WalletTransfer:
    wallet: str
    chain: str
    token_symbol: str
    token_address: str
    direction: str       # 'IN' or 'OUT'
    amount: float
    usd_value: float
    timestamp: str
    tx_hash: str
```

### 3.4 — Confluence Detector

Create `scripts/onchain/confluence.py`:

Core algorithm:
1. Every 5 minutes: Fetch recent transfers for all watched wallets
2. Group transfers by `token_symbol` within the `convergence_window`
3. Count unique wallets buying each token
4. If `unique_buyers >= min_wallets_for_signal` AND total_usd > threshold:
   - Fire convergence signal: `BULLISH` with confidence scaled by wallet count and USD volume
5. Also detect "exit convergence" — multiple wallets selling same token → `BEARISH`

### 3.5 — On-Chain Service

Create `scripts/onchain/service.py`:

Main polling loop. Outputs `AGENT_STATUS_UPDATE:{json}` to stdout for the TypeScript bridge, same pattern as sentiment.

Signal format:
```json
{
    "source": "ONCHAIN_CONFLUENCE",
    "symbol": "ETH",
    "direction": "BULLISH",
    "confidence": 0.85,
    "summary": "4 tracked wallets accumulated $2.1M ETH in last 45 minutes",
    "payload": {
        "wallets_involved": 4,
        "total_usd": 2100000,
        "token": "ETH",
        "window_minutes": 45
    }
}
```

### 3.6 — TypeScript Bridge

Create `src/lib/intel/onchain/bridge.ts`:

Same pattern as sentiment bridge. Spawns Python process, parses stdout, publishes to Intelligence Bus.

### 3.7 — Environment Variables

Add to `.env.local`:
```
ETHERSCAN_API_KEY=your_key_here
HELIUS_API_KEY=your_key_here   # Optional, for Solana
```

### 3.8 — Dashboard Panel

Add "On-Chain Intel" panel:
- List of recently detected convergence events
- Wallet activity heatmap (which wallets are active right now)
- Token accumulation timeline

### 3.9 — Runner

```bash
npx tsx scripts/run_onchain.ts
```

### Verification
- Add 3+ known wallet addresses to `data/wallet_watchlist.json`
- Run `python scripts/onchain/service.py` standalone, confirm it fetches wallet data from Etherscan
- Manually trigger convergence by testing with wallets known to have recent activity
- Confirm IntelSignal appears in `intel_signals` table with `source = 'ONCHAIN_CONFLUENCE'`
- Confirm Discord notification fires with wallet count and USD volume

---

## Phase 4: Whale Flow Tracker

**What it does**: Monitors large crypto transfers (exchange deposits/withdrawals) and uses them as regime signals for the Risk Engine.

### 4.1 — Data Sources

Two approaches (implement whichever is accessible):

**Option A — Whale Alert API** (`https://api.whale-alert.io/v1/transactions`):
- Paid API ($9/mo for real-time), free tier has 10 min delay
- Returns large transfers with exchange labels (Binance, Coinbase, etc.)
- Best signal: "500 BTC transferred to Coinbase" → bearish (likely selling)

**Option B — Direct Mempool Monitoring**:
- Use Etherscan/Blockchain.com API to poll large BTC/ETH transfers
- Filter by transfer size > configurable threshold (e.g., $1M+)
- Classify by destination: exchange wallet = bearish, cold wallet = bullish

### 4.2 — Whale Flow Types

Create `src/lib/intel/whale/types.ts`:

```typescript
export interface WhaleTransfer {
    txHash: string;
    chain: string;
    symbol: string;
    amount: number;
    usdValue: number;
    fromLabel: string;          // 'unknown' | 'Binance' | 'Coinbase' | etc.
    toLabel: string;
    direction: 'TO_EXCHANGE' | 'FROM_EXCHANGE' | 'BETWEEN_WALLETS' | 'UNKNOWN';
    timestamp: string;
}

export interface WhaleFlowConfig {
    minUsdThreshold: number;      // e.g., 1000000 ($1M)
    alertCooldownMs: number;      // Don't spam — cooldown between alerts
    exchangeInflowWeight: number; // How much exchange inflows affect regime
    pollIntervalMs: number;       // How often to check (e.g., 60000 = 1 min)
}
```

### 4.3 — Whale Flow Service

Create `scripts/whale/service.ts` (TypeScript — this one doesn't need Python):

1. Polls whale alert API or blockchain explorers every 60 seconds
2. Classifies each transfer:
   - **TO_EXCHANGE** → Bearish (selling pressure incoming)
   - **FROM_EXCHANGE** → Bullish (accumulation, moving to cold storage)
   - **BETWEEN_WALLETS** → Neutral (internal transfer)
3. Aggregates over rolling 1-hour window:
   - Net exchange flow = sum(inflows) - sum(outflows)
   - If net inflow > threshold → publish `BEARISH` IntelSignal
   - If net outflow > threshold → publish `BULLISH` IntelSignal
4. Publishes to Intelligence Bus

### 4.4 — Regime Detector Integration

This is where whale data gets unique power. Modify `src/lib/engine/risk/RegimeDetector.ts`:

Add a new method: `RegimeDetector.ingestWhaleFlow(netExchangeFlow: number)`

The regime classifier gains a new input dimension:
- Current logic: ATR + trend strength → TRENDING / RANGING / VOLATILE / DEAD
- New logic: If whale net exchange inflow is extreme (>$50M in 1h) → bias toward VOLATILE
- If whale net outflow is extreme → bias toward TRENDING (accumulation phase)

This affects all strategies via `shouldTradeInRegime()` — when whales are dumping on exchanges, impulse strategies get throttled automatically.

### 4.5 — KillSwitch Enhancement

Add whale-triggered kill switch logic. If exchange inflows spike beyond a configurable "panic threshold" (e.g., >$200M in 30 minutes), auto-trigger `KillSwitch.globalHalt('Whale panic: $X inflows in 30m')`.

This is a safety net — massive exchange inflows often precede flash crashes.

### 4.6 — Dashboard Panel

Add "Whale Radar" panel:
- Real-time feed of large transfers (amount, from, to, exchange labels)
- Net exchange flow gauge (bullish ← neutral → bearish)
- Whale flow vs price overlay chart

### 4.7 — Discord Channel

Add `DISCORD_WHALE_WEBHOOK` env var. Create a dedicated `#whale-alerts` Discord channel for high-value transfer notifications. Only fires for transfers above the configured threshold.

### 4.8 — Runner

```bash
npx tsx scripts/run_whale_tracker.ts
```

### Verification
- Start whale tracker, confirm it polls API and logs transfers
- Manually verify classification: known exchange wallets → TO_EXCHANGE, cold wallets → FROM_EXCHANGE
- Confirm IntelSignals appear in `intel_signals` with `source = 'WHALE_FLOW'`
- Simulate heavy exchange inflows → confirm RegimeDetector shifts to VOLATILE
- Simulate extreme inflows → confirm KillSwitch triggers globalHalt
- Confirm Discord whale alerts fire in the whale channel

---

## Phase 5: Integration Testing & Tuning

After all 4 phases are individually working, this phase ties everything together.

### 5.1 — Full Stack Test

Start all services simultaneously:
```bash
# Terminal 1: Dashboard
npm run dev

# Terminal 2: Order Flow
npx tsx scripts/run_orderflow.ts

# Terminal 3: Sentiment
npx tsx scripts/run_sentiment.ts

# Terminal 4: On-Chain
npx tsx scripts/run_onchain.ts

# Terminal 5: Whale Tracker
npx tsx scripts/run_whale_tracker.ts
```

Or add all to PM2 ecosystem config:
```javascript
// ecosystem.config.js
module.exports = {
    apps: [
        { name: 'swjshak-dashboard', script: 'npm', args: 'run dev' },
        { name: 'orderflow', script: 'npx', args: 'tsx scripts/run_orderflow.ts' },
        { name: 'sentiment', script: 'npx', args: 'tsx scripts/run_sentiment.ts' },
        { name: 'onchain', script: 'npx', args: 'tsx scripts/run_onchain.ts' },
        { name: 'whale-tracker', script: 'npx', args: 'tsx scripts/run_whale_tracker.ts' },
    ]
};
```

### 5.2 — Intel Score Calibration

The Signal Validator (Phase 0.4) weights intel from each source. Default weights:

| Source | Weight | Rationale |
|--------|--------|-----------|
| ORDER_FLOW | 0.35 | Most immediate, directly measures buying/selling pressure |
| SENTIMENT | 0.15 | Noisy but useful as confirmation |
| ONCHAIN_CONFLUENCE | 0.30 | High signal quality, but latent (not real-time) |
| WHALE_FLOW | 0.20 | Good regime signal, less useful for individual trades |

These weights are stored in the `settings` table and adjustable via the Settings page.

### 5.3 — Backtesting with Intel

Extend the existing backtest framework (`scripts/pivot-pete-backtest.ts` pattern) to replay historical intel alongside price data. Compare:
- Baseline: TradingView signals only (current behavior)
- Enhanced: TradingView + Intel Score gating

Measure: Win rate change, average PnL per trade, max drawdown reduction.

### 5.4 — PowerShell Launcher Update

Update `START_SWJSH.ps1` to launch all services:
```powershell
# START_SWJSH.ps1
Write-Host "Starting SwjshAK Full Stack..." -ForegroundColor Cyan
Start-Process npm -ArgumentList "run dev" -NoNewWindow
Start-Process npx -ArgumentList "tsx scripts/run_orderflow.ts" -NoNewWindow
Start-Process npx -ArgumentList "tsx scripts/run_sentiment.ts" -NoNewWindow
Start-Process npx -ArgumentList "tsx scripts/run_onchain.ts" -NoNewWindow
Start-Process npx -ArgumentList "tsx scripts/run_whale_tracker.ts" -NoNewWindow
Write-Host "All systems online." -ForegroundColor Green
```

---

## New File Inventory

After all phases, these new files will exist:

```
src/lib/intel/
    types.ts                          # IntelSignal, IntelSource types
    bus.ts                            # Intelligence Bus (EventEmitter + DB)

src/lib/intel/orderflow/
    types.ts                          # TradeEvent, CVDSnapshot, OrderFlowConfig
    cvd.ts                            # CVD Calculator with Z-Score
    feeds.ts                          # Exchange WebSocket feed manager
    service.ts                        # Order Flow Service orchestrator

src/lib/intel/sentiment/
    bridge.ts                         # Python↔TypeScript bridge

src/lib/intel/onchain/
    bridge.ts                         # Python↔TypeScript bridge

src/lib/intel/whale/
    types.ts                          # WhaleTransfer, WhaleFlowConfig
    service.ts                        # Whale Flow Service

src/app/api/intel/
    route.ts                          # GET /api/intel endpoint

scripts/
    run_orderflow.ts                  # Order Flow runner
    run_sentiment.ts                  # Sentiment bridge runner
    run_onchain.ts                    # On-Chain bridge runner
    run_whale_tracker.ts              # Whale Flow runner

scripts/sentiment/
    requirements.txt
    sources.py                        # Data source collectors
    scorer.py                         # FinBERT NLP scorer
    service.py                        # Main sentiment service loop
    lstm_model.py                     # (Phase 2B) LSTM predictor
    train_lstm.py                     # (Phase 2B) LSTM training script

scripts/onchain/
    requirements.txt
    fetchers.py                       # Blockchain API abstraction
    confluence.py                     # Convergence detection algorithm
    service.py                        # Main on-chain service loop

data/
    wallet_watchlist.json             # Curated wallet addresses
```

## Modified Files

```
src/lib/db.ts                         # Add intel_signals table
src/lib/engine/executor.ts            # Add Intel Score gating
src/lib/engine/risk/RegimeDetector.ts # Add whale flow input
src/lib/engine/risk/KillSwitch.ts     # Add whale panic threshold
src/lib/notifications/discord.ts      # Add notifyIntelSignal, notifyWhaleAlert
src/app/dashboard/page.tsx            # Add Intel, Sentiment, Whale panels
ecosystem.config.js                   # Add new service entries
.env.local                            # Add ETHERSCAN_API_KEY, WHALE_ALERT_API_KEY, etc.
```

## New Environment Variables

```bash
# Phase 3: On-Chain
ETHERSCAN_API_KEY=             # Free tier: https://etherscan.io/apis
HELIUS_API_KEY=                # Optional Solana: https://helius.dev

# Phase 4: Whale Flow
WHALE_ALERT_API_KEY=           # Optional: https://whale-alert.io
WHALE_MIN_USD_THRESHOLD=1000000
WHALE_PANIC_THRESHOLD=200000000

# Phase 2: Sentiment
CRYPTOPANIC_API_KEY=           # Optional: https://cryptopanic.com/developers/api/

# Discord
DISCORD_WHALE_WEBHOOK=         # New channel for whale alerts
DISCORD_INTEL_WEBHOOK=         # Optional: dedicated intel channel

# Intel Score Weights (defaults in code, overridable)
INTEL_WEIGHT_ORDERFLOW=0.35
INTEL_WEIGHT_SENTIMENT=0.15
INTEL_WEIGHT_ONCHAIN=0.30
INTEL_WEIGHT_WHALE=0.20
```

---

## Execution Order & Dependencies

```
Phase 0 (Foundation) ──────► REQUIRED FIRST
    │
    ├──► Phase 1 (Order Flow) ──── No Python needed, pure TS
    │
    ├──► Phase 2 (Sentiment) ───── Needs Python + FinBERT download
    │
    ├──► Phase 3 (ConfluX) ─────── Needs Etherscan API key
    │
    └──► Phase 4 (Whale Flow) ──── Needs Whale Alert API or Etherscan
              │
              └──► Phase 4.4 modifies RegimeDetector (depends on Phase 0)

Phase 5 (Integration) ────► AFTER all 4 are individually working
```

Phases 1–4 are independent of each other and can be built in any order after Phase 0. Start with whichever interests you most or has the simplest API key setup.

---

## Estimated Effort Per Phase

| Phase | Sessions | Complexity | Notes |
|-------|----------|------------|-------|
| Phase 0 | 1 | Low | DB table, types, bus, API route — all boilerplate |
| Phase 1 | 1–2 | Medium | WebSocket management is the tricky part |
| Phase 2A | 1–2 | Medium | FinBERT download + Python service setup |
| Phase 2B | 2–3 | High | LSTM training requires data collection + tuning |
| Phase 3 | 1–2 | Medium | API rate limits require careful throttling |
| Phase 4 | 1 | Low–Medium | Simpler than others, mostly API polling |
| Phase 5 | 1–2 | Medium | Calibration and testing take iteration |

**Total: ~8–12 sessions to fully implement all phases.**

---

*Generated for SwjshAK — Last updated: 2026-03-14*
