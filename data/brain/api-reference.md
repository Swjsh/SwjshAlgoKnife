# API Reference

---
tags: #api #reference #endpoints
status: 📘 Reference
---

## Overview

SwjshAK exposes REST API endpoints via Next.js API routes for:
- Webhook ingestion (TradingView signals)
- Agent management
- Trade journaling
- System control

**Base URL**: `http://localhost:3000/api`

---

## Authentication

### Webhook Authentication
TradingView webhooks require a secret header:

```
X-Webhook-Secret: your_webhook_secret
```

Configured via `WEBHOOK_SECRET` environment variable.

### API Authentication
Internal APIs currently have no authentication (local-only access).

**Production Note**: Add authentication before exposing to network.

---

## Webhook Endpoints

### POST /api/webhook/tradingview

Receive trading signals from TradingView alerts.

**Headers**:
```
Content-Type: application/json
X-Webhook-Secret: your_webhook_secret
```

**Request Body**:
```json
{
  "symbol": "ES",
  "action": "buy",
  "price": 5850.25,
  "strategy": "ORB",
  "timeframe": "5m",
  "message": "ORB breakout above range"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "signal_id": 123,
  "timestamp": "2026-03-15T14:30:00Z"
}
```

**Response (Error)**:
```json
{
  "success": false,
  "error": "Invalid webhook secret"
}
```

**Status Codes**:
- `200`: Signal received
- `401`: Invalid or missing secret
- `400`: Invalid request body

---

## Signal Endpoints

### POST /api/signals

Submit a manual signal.

**Request Body**:
```json
{
  "symbol": "BTC",
  "action": "buy",
  "price": 68500,
  "source": "manual",
  "strategy": "VWAP Reversion",
  "notes": "Deviation from VWAP"
}
```

**Response**:
```json
{
  "success": true,
  "signal_id": 124
}
```

---

### GET /api/signals

Retrieve recent signals.

**Query Parameters**:
- `limit` (optional): Number of signals to return (default: 50)
- `symbol` (optional): Filter by symbol
- `source` (optional): Filter by source (tradingview, manual, strategy)

**Example**:
```
GET /api/signals?limit=10&symbol=ES
```

**Response**:
```json
{
  "signals": [
    {
      "id": 124,
      "symbol": "ES",
      "action": "buy",
      "price": 5850.25,
      "timestamp": "2026-03-15T14:30:00Z",
      "source": "tradingview",
      "strategy": "ORB"
    }
  ]
}
```

---

## Agent Endpoints

### GET /api/agents

Get status of all agents.

**Response**:
```json
{
  "agents": [
    {
      "id": "pivot-pete",
      "name": "Pivot Pete",
      "status": "active",
      "market": "Futures",
      "daily_pnl": 250.00,
      "total_pnl": 1250.00,
      "current_position": {
        "symbol": "ES",
        "side": "long",
        "entry_price": 5850.25,
        "size": 1
      }
    },
    {
      "id": "boba-trades",
      "name": "Boba Trades",
      "status": "idle",
      "market": "Options",
      "daily_pnl": 0,
      "current_position": null
    }
  ]
}
```

---

### GET /api/agents/:id

Get detailed status of specific agent.

**Example**:
```
GET /api/agents/pivot-pete
```

**Response**:
```json
{
  "id": "pivot-pete",
  "name": "Pivot Pete",
  "status": "active",
  "market": "Futures",
  "strategy": "ORB",
  "daily_pnl": 250.00,
  "total_pnl": 1250.00,
  "win_rate": 0.65,
  "current_position": {...},
  "recent_trades": [...],
  "reviews": [...],
  "audits": [...]
}
```

---

### POST /api/agents/:id/chat

Send a chat message to agent (for AgentTerminal UI).

**Request Body**:
```json
{
  "message": "What's your current position?"
}
```

**Response**:
```json
{
  "response": "Currently long 1 ES at 5850.25, unrealized P&L +$125",
  "timestamp": "2026-03-15T14:35:00Z"
}
```

---

## Journal Endpoints

### GET /api/journal

Get trades and journal entries.

**Query Parameters**:
- `type`: `trades` | `entries` | `all`
- `limit` (optional): Number of records
- `start_date` (optional): ISO 8601 date
- `end_date` (optional): ISO 8601 date

**Example**:
```
GET /api/journal?type=trades&limit=20
```

**Response**:
```json
{
  "trades": [
    {
      "id": 1,
      "symbol": "ES",
      "side": "long",
      "entry_price": 5840.00,
      "exit_price": 5855.00,
      "quantity": 1,
      "pnl": 750.00,
      "entry_time": "2026-03-15T10:00:00Z",
      "exit_time": "2026-03-15T12:00:00Z",
      "strategy": "ORB",
      "agent_id": "pivot-pete"
    }
  ]
}
```

---

### POST /api/journal

Create a trade or journal entry.

**Create Trade**:
```json
{
  "type": "trade",
  "symbol": "ES",
  "side": "long",
  "entry_price": 5850.00,
  "quantity": 1,
  "entry_time": "2026-03-15T14:00:00Z",
  "strategy": "ORB",
  "agent_id": "pivot-pete"
}
```

**Create Journal Entry**:
```json
{
  "type": "entry",
  "date": "2026-03-15",
  "entry": "Good trading day. Followed the plan.",
  "mood": "confident",
  "tags": "disciplined,profit"
}
```

---

### PUT /api/journal/:id

Update a trade (e.g., close it).

**Request Body**:
```json
{
  "exit_price": 5875.00,
  "exit_time": "2026-03-15T16:00:00Z",
  "pnl": 1250.00,
  "notes": "Closed at resistance"
}
```

---

## Control Endpoints

### GET /api/control

Get system status.

**Response**:
```json
{
  "system_status": "operational",
  "kill_switch_active": false,
  "agents_count": 5,
  "active_agents": 2,
  "total_daily_pnl": 450.00
}
```

---

### POST /api/control

Execute a control command. See [[LLM Control API]] for full details.

**Available Commands**:

| Command | Description | Parameters |
|---------|-------------|------------|
| `status` | Full system status | None |
| `summary` | Daily P&L summary | None |
| `pause` | Pause an agent | `agentId` |
| `resume` | Resume an agent | `agentId` |
| `killswitch` | Emergency halt | None |
| `killswitch_reset` | Resume trading | None |
| `agent` | Get agent details | `agentId` |

**Example**:
```bash
curl -X POST http://localhost:3000/api/control \
  -H "Content-Type: application/json" \
  -d '{"command": "summary"}'
```

---

## Kill Switch Endpoint

### POST /api/killswitch

Activate or deactivate kill switch.

**Activate**:
```json
{
  "action": "activate",
  "reason": "Manual safety stop"
}
```

**Deactivate**:
```json
{
  "action": "deactivate"
}
```

**Response**:
```json
{
  "success": true,
  "kill_switch_active": true,
  "activated_at": "2026-03-15T14:45:00Z"
}
```

---

## Health Endpoint

### GET /api/health

System health check.

**Response**:
```json
{
  "status": "healthy",
  "database": "connected",
  "agents_db": "readable",
  "uptime": 3600,
  "version": "1.0.0"
}
```

---

## Error Response Format

All endpoints return errors in consistent format:

```json
{
  "success": false,
  "error": "Error message here",
  "code": "ERROR_CODE",
  "details": {}
}
```

**Common Error Codes**:
- `AUTH_FAILED`: Invalid authentication
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Invalid request data
- `KILL_SWITCH_ACTIVE`: Trading is halted
- `INTERNAL_ERROR`: Server error

---

## Rate Limiting

Currently no rate limiting implemented.

**Recommended for Production**:
```typescript
// 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
```

---

## WebSocket (Future)

Real-time updates planned via WebSocket:

```javascript
// Future implementation
const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('message', (data) => {
  const event = JSON.parse(data);
  // event types: 'signal', 'trade', 'agent_status', 'pnl_update'
});
```

---

## Testing APIs

### Using curl
```bash
# Get all agents
curl http://localhost:3000/api/agents

# Submit signal
curl -X POST http://localhost:3000/api/signals \
  -H "Content-Type: application/json" \
  -d '{"symbol": "ES", "action": "buy", "price": 5850}'

# Control command
curl -X POST http://localhost:3000/api/control \
  -H "Content-Type: application/json" \
  -d '{"command": "status"}'
```

### Using JavaScript
```javascript
// Fetch agent status
const response = await fetch('/api/agents');
const { agents } = await response.json();

// Submit control command
const result = await fetch('/api/control', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command: 'summary' })
});
```

---

## Account & Broker Endpoints

### GET /api/accounts

Get account information with optional filtering.

**Query Parameters**:
- `id` (optional): Get specific account by ID
- `summary` (optional): If set to `true`, returns summary of all accounts
- `transactions` (optional): If set to `true`, returns transactions for account; if set to `all`, returns all transactions

**Example (Get Summary)**:
```
GET /api/accounts?summary=true
```

**Response (Summary)**:
```json
{
  "master_account": {
    "id": "master-001",
    "accountId": "master-001",
    "name": "Master Account",
    "accountType": "MASTER",
    "initialBalance": 50000,
    "currentBalance": 48500,
    "allocatedCapital": 10000,
    "realizedPnl": 500,
    "unrealizedPnl": 1500,
    "totalEquity": 50000
  },
  "agent_count": 3,
  "total_equity": 50000,
  "total_allocated": 10000,
  "total_available": 40000,
  "total_realized_pnl": 500,
  "total_unrealized_pnl": 1500,
  "utilization_rate": 20.0,
  "accounts": [...]
}
```

---

### POST /api/accounts

Create account or perform account transactions.

**Create Account**:
```json
{
  "action": "create",
  "accountId": "agent-001",
  "name": "Pivot Pete Account",
  "accountType": "AGENT",
  "initialBalance": 10000
}
```

**Deposit Funds**:
```json
{
  "action": "deposit",
  "accountId": "agent-001",
  "amount": 5000,
  "description": "Initial funding"
}
```

**Withdraw Funds**:
```json
{
  "action": "withdraw",
  "accountId": "agent-001",
  "amount": 1000
}
```

**Transfer Between Accounts**:
```json
{
  "action": "transfer",
  "accountId": "master-001",
  "toAccountId": "agent-001",
  "amount": 2000
}
```

**Response**:
```json
{
  "success": true,
  "account": {
    "id": "agent-001",
    "accountId": "agent-001",
    "name": "Pivot Pete Account",
    "currentBalance": 5000
  }
}
```

---

### GET /api/brokers

Get list of connected brokers.

**Response**:
```json
{
  "brokers": [
    {
      "id": "broker-001",
      "broker": "ALPACA",
      "environment": "PAPER",
      "label": "Alpaca Paper",
      "isPrimary": true,
      "isActive": true,
      "connectionStatus": "CONNECTED",
      "accountId": "PA123456",
      "accountType": "PAPER",
      "buyingPower": 50000,
      "lastVerifiedAt": "2026-03-15T14:30:00Z",
      "createdAt": "2026-03-01T10:00:00Z"
    }
  ]
}
```

---

### POST /api/brokers

Add a new broker connection.

**Request Body**:
```json
{
  "broker": "ALPACA",
  "environment": "PAPER",
  "label": "Alpaca Paper",
  "apiKey": "PKxxxxx",
  "apiSecret": "xxxxxxxxxxxxxxxx"
}
```

**Status Codes**:
- `201`: Broker created successfully
- `400`: Validation failed
- `409`: Broker with this label already exists

---

### GET /api/brokers/:id

Get specific broker configuration.

---

### POST /api/brokers/:id/verify

Verify broker connection status and credentials.

---

### GET /api/brokers/:id/health

Get broker connection health status.

---

## Bot Management Endpoints

### GET /api/bots

List all trading bots for authenticated user.

**Query Parameters**:
- `status` (optional): Filter by status (`RUNNING`, `STOPPED`, `PAUSED`)

**Response**:
```json
{
  "bots": [
    {
      "id": "bot-001",
      "name": "Futures Scalper",
      "strategy": "ORB",
      "strategyConfig": { "timeframe": "5m", "threshold": 0.5 },
      "status": "RUNNING",
      "maxPositionSize": 1000,
      "maxDailyLoss": 500,
      "maxOpenPositions": 1,
      "totalTrades": 24,
      "winningTrades": 16,
      "losingTrades": 8,
      "totalPnl": 1250.50,
      "winRate": 67,
      "createdAt": "2026-03-10T08:00:00Z"
    }
  ]
}
```

---

### POST /api/bots

Create a new bot.

**Request Body**:
```json
{
  "name": "Futures Scalper",
  "strategy": "ORB",
  "strategyConfig": { "timeframe": "5m" },
  "maxPositionSize": 1000,
  "maxDailyLoss": 500,
  "maxOpenPositions": 1,
  "brokerConfigId": "broker-001"
}
```

**Status Codes**:
- `201`: Bot created
- `400`: Validation failed
- `400`: No broker connected (code: `NO_BROKER`)

---

### PUT /api/bots

Update an existing bot.

**Request Body**:
```json
{
  "id": "bot-001",
  "name": "Updated Name",
  "status": "RUNNING",
  "maxPositionSize": 2000
}
```

---

### DELETE /api/bots

Delete a bot.

**Request Parameters**:
- Query: `?id=bot-001` OR
- Body: `{ "id": "bot-001" }`

---

### GET /api/bots/:id

Get specific bot details.

---

## Connection & Integration Endpoints

### GET /api/connections

Get status of all external integrations and API connections.

**Response**:
```json
{
  "connections": [
    {
      "id": "alpaca",
      "name": "Alpaca",
      "category": "Trading",
      "description": "Paper trading for US equities, ETFs, and crypto",
      "icon": "🦙",
      "status": "NOT_CONFIGURED",
      "statusLabel": "Not configured",
      "usedFor": ["SPX agent", "Historical bar data"],
      "agents": ["Pivot Pete", "SPX Sniper"],
      "credentials": [
        {
          "label": "API Key ID",
          "envVar": "APCA_API_KEY_ID",
          "masked": "••••••••",
          "configured": false
        }
      ],
      "docsUrl": "https://alpaca.markets/docs/"
    }
  ],
  "byCategory": {
    "Trading": [...],
    "Market Data": [...],
    "Intelligence": [...]
  },
  "summary": {
    "total": 20,
    "connected": 8,
    "partial": 2,
    "missing": 10
  },
  "generatedAt": "2026-03-15T14:30:00Z"
}
```

---

## User & Auth Endpoints

### GET /api/me

Get current authenticated user information.

**Response**:
```json
{
  "user": {
    "id": "user-001",
    "email": "trader@example.com",
    "displayName": "John Trader",
    "avatarUrl": "https://...",
    "onboardingStep": "COMPLETED",
    "createdAt": "2026-02-01T10:00:00Z"
  }
}
```

**Status Codes**:
- `200`: User found
- `401`: Not authenticated

---

### PATCH /api/me

Update current user profile.

**Request Body**:
```json
{
  "displayName": "New Name",
  "avatarUrl": "https://..."
}
```

---

### POST /api/auth/session

Create session cookie from Firebase ID token.

**Request Body**:
```json
{
  "idToken": "firebase_id_token_here"
}
```

**Response**:
```json
{
  "success": true
}
```

---

### DELETE /api/auth/session

Clear session cookie (sign out).

**Response**:
```json
{
  "success": true
}
```

---

## Market Data & Pricing Endpoints

### GET /api/prices

Get current market prices for crypto and equities.

**Response**:
```json
{
  "BTC": 68500,
  "ETH": 4200,
  "SOL": 185.50,
  "SPY": 450.25,
  "NVDA": 875.00,
  "QQQ": 380.00,
  "_source": "alpaca"
}
```

**Notes**:
- Prices cached for 30 seconds
- Falls back to free sources (CoinGecko, Yahoo Finance) if Alpaca unavailable
- `_source` indicates which data provider was used

---

## Intelligence & Signals Endpoints

### GET /api/intel

Get active intel signals.

**Query Parameters**:
- `symbol` (optional): Filter by symbol (e.g., `BTCUSD`)
- `source` (optional): Filter by source (e.g., `ORDER_FLOW`)
- `limit` (optional): Max results (default: 100, max: 500)

**Example**:
```
GET /api/intel?symbol=BTCUSD&limit=50
```

**Response**:
```json
{
  "status": "ok",
  "count": 3,
  "signals": [
    {
      "id": 1,
      "source": "ORDER_FLOW",
      "symbol": "BTCUSD",
      "direction": "BULLISH",
      "confidence": 0.85,
      "summary": "Large buy orders detected",
      "publishedAt": "2026-03-15T14:30:00Z",
      "expiresAt": "2026-03-15T16:30:00Z"
    }
  ]
}
```

---

### POST /api/intel

Publish a new intel signal to the bus.

**Request Body**:
```json
{
  "source": "ORDER_FLOW",
  "symbol": "BTCUSD",
  "direction": "BULLISH",
  "confidence": 0.85,
  "summary": "Large buy orders detected",
  "expiresAt": "2026-03-15T16:30:00Z"
}
```

**Response (Success)**:
```json
{
  "status": "published",
  "id": 42
}
```

**Response (Deduplicated)**:
```json
{
  "status": "deduplicated",
  "message": "Identical signal was recently published"
}
```

---

### GET /api/intel/calendar

Get economic calendar events.

---

### GET /api/intel/score

Get aggregated intel score for a symbol.

---

### GET /api/intel/history

Get historical intel signals.

---

### GET /api/intel/free-feeds

Get list of free intel data feeds.

---

### GET /api/intel/preflight

Preflight check for intel configuration.

---

### GET /api/intel/stream

Stream real-time intel updates (SSE).

---

### POST /api/intel/feedback

Submit feedback on intel signal accuracy.

---

## Onboarding Endpoints

### POST /api/onboarding/complete

Mark user onboarding as completed.

**Response**:
```json
{
  "success": true,
  "onboardingStep": "COMPLETED"
}
```

---

### POST /api/onboarding/legal

Accept legal/terms agreement.

---

## Admin Endpoints

### GET /api/admin/costs

Get detailed cost breakdown and infrastructure audit.

**Response**:
```json
{
  "generatedAt": "2026-03-15T14:30:00Z",
  "nextRefresh": "2026-03-15T16:30:00Z",
  "totalMonthly": 226.32,
  "totalAnnual": 2714,
  "breakdown": {
    "subscriptions": 200,
    "infrastructure": 16.32,
    "apis": 10,
    "domains": 1
  },
  "items": [
    {
      "id": "claude-max",
      "name": "Claude Max Subscription",
      "category": "subscription",
      "status": "active",
      "monthlyCost": 200,
      "annualCost": 2400,
      "isVariable": false,
      "notes": "Covers all Claude usage"
    }
  ],
  "freeServices": [...],
  "futureRisks": [...],
  "optimizations": [...]
}
```

---

## Agent Communication Endpoints

### GET /api/agents/stream

Stream real-time agent status updates (SSE).

---

### POST /api/agents/chat

Send chat message to an agent (interactive terminal).

---

### GET /api/agent-status

Get quick agent status snapshot.

**Response**:
```json
{
  "last_updated": "2026-03-15T14:30:00Z",
  "status": "ACTIVE",
  "active_pairs": 5,
  "total_zones_found": 2,
  "performance": {
    "win_rate": 68,
    "total_pnl": 1245.50,
    "trades": 12
  },
  "pending_orders": [...],
  "closed_trades": [...]
}
```

---

## System Endpoints

### GET /api/brain

Get system knowledge base and documentation index.

---

## Related Pages

- [[LLM Control API]] - Detailed control commands
- [[Database Schema]] - Data structures
- [[Agent System]] - Agent status format
- [[Trade Execution]] - Execution flow
- [[TradingView Integration]] - Webhook setup
