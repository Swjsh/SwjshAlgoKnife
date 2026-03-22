# LLM Control API

---
tags: #api #automation #llm
status: ✅ Active
endpoint: /api/control
---

## Overview

The **LLM Control API** allows any AI assistant (Claude, GPT, local LLMs) to control the SwjshAK trading system via HTTP requests.

**Use Cases**:
- Get daily P&L summary
- Pause/resume specific agents
- Trigger emergency kill switch
- Query system status
- Automate reporting

---

## Endpoint

```
POST http://localhost:3000/api/control
```

**Authentication**: None (local-only by default)

---

## Commands

### 1. System Status

Get complete system overview including all agents, positions, and P&L.

**Request**:
```bash
curl -X POST http://localhost:3000/api/control \
  -H "Content-Type: application/json" \
  -d '{"command": "status"}'
```

**Response**:
```json
{
  "success": true,
  "data": {
    "system_status": "operational",
    "kill_switch_active": false,
    "agents": [
      {
        "id": "pivot-pete",
        "name": "Pivot Pete",
        "status": "active",
        "market": "Futures",
        "daily_pnl": 250.00,
        "open_trades": 1,
        "current_position": {
          "symbol": "ES",
          "side": "long",
          "entry": 5850.25
        }
      }
    ],
    "total_daily_pnl": 450.00,
    "account_balance": 10450.00
  }
}
```

---

### 2. Daily Summary

Get concise daily performance report (ideal for morning briefings).

**Request**:
```bash
curl -X POST http://localhost:3000/api/control \
  -H "Content-Type: application/json" \
  -d '{"command": "summary"}'
```

**Response**:
```json
{
  "success": true,
  "data": {
    "date": "2026-03-15",
    "total_pnl": 450.00,
    "total_trades": 7,
    "winning_trades": 5,
    "losing_trades": 2,
    "win_rate": 0.71,
    "best_trade": {
      "symbol": "ES",
      "pnl": 175.00,
      "agent": "pivot-pete"
    },
    "worst_trade": {
      "symbol": "BTC",
      "pnl": -85.00,
      "agent": "bitcoin-bob"
    },
    "agent_breakdown": [
      {"agent": "pivot-pete", "pnl": 250.00, "trades": 3},
      {"agent": "bitcoin-bob", "pnl": 200.00, "trades": 4}
    ]
  }
}
```

---

### 3. Pause Agent

Temporarily stop an agent from taking new trades (existing positions remain open).

**Request**:
```bash
curl -X POST http://localhost:3000/api/control \
  -H "Content-Type: application/json" \
  -d '{"command": "pause", "agentId": "pivot-pete"}'
```

**Response**:
```json
{
  "success": true,
  "message": "Agent 'pivot-pete' paused successfully",
  "data": {
    "agent_id": "pivot-pete",
    "previous_status": "active",
    "new_status": "paused"
  }
}
```

---

### 4. Resume Agent

Resume a paused agent.

**Request**:
```bash
curl -X POST http://localhost:3000/api/control \
  -H "Content-Type: application/json" \
  -d '{"command": "resume", "agentId": "pivot-pete"}'
```

**Response**:
```json
{
  "success": true,
  "message": "Agent 'pivot-pete' resumed successfully",
  "data": {
    "agent_id": "pivot-pete",
    "new_status": "active"
  }
}
```

---

### 5. Kill Switch (Emergency Halt)

**⚠️ CRITICAL**: Immediately halt ALL trading activity across all agents.

**Request**:
```bash
curl -X POST http://localhost:3000/api/control \
  -H "Content-Type: application/json" \
  -d '{"command": "killswitch"}'
```

**Response**:
```json
{
  "success": true,
  "message": "KILL SWITCH ACTIVATED - All trading halted",
  "data": {
    "activated_at": "2026-03-15T14:45:00Z",
    "agents_paused": ["pivot-pete", "boba-trades", "bitcoin-bob", "spx-sniper"],
    "open_positions": 3
  }
}
```

**Effect**:
- All agents stop opening new positions
- Existing positions remain open (manual intervention required to close)
- Kill switch status stored in database (`settings` table)
- Dashboard displays warning banner

---

### 6. Reset Kill Switch

Re-enable trading after emergency halt.

**Request**:
```bash
curl -X POST http://localhost:3000/api/control \
  -H "Content-Type: application/json" \
  -d '{"command": "killswitch_reset"}'
```

**Response**:
```json
{
  "success": true,
  "message": "Kill switch deactivated - Trading resumed",
  "data": {
    "deactivated_at": "2026-03-15T15:00:00Z",
    "agents_resumed": ["pivot-pete", "boba-trades", "bitcoin-bob", "spx-sniper"]
  }
}
```

---

### 7. Agent Details

Get detailed information about a specific agent.

**Request**:
```bash
curl -X POST http://localhost:3000/api/control \
  -H "Content-Type: application/json" \
  -d '{"command": "agent", "agentId": "pivot-pete"}'
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "pivot-pete",
    "name": "Pivot Pete",
    "status": "active",
    "market": "Futures",
    "strategy": "ORB",
    "daily_pnl": 250.00,
    "total_pnl": 1250.00,
    "win_rate": 0.65,
    "open_trades": 1,
    "closed_trades": 3,
    "current_position": {
      "symbol": "ES",
      "side": "long",
      "entry_price": 5850.25,
      "size": 1,
      "unrealized_pnl": 125.00
    },
    "recent_trades": [
      {
        "symbol": "ES",
        "side": "long",
        "entry": 5840.00,
        "exit": 5855.00,
        "pnl": 75.00,
        "time": "2026-03-15T13:00:00Z"
      }
    ]
  }
}
```

---

## LLM Integration Examples

### Claude (via MCP)

```typescript
// In Claude MCP server
async function getDailySummary() {
  const response = await fetch('http://localhost:3000/api/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: 'summary' })
  });

  const data = await response.json();

  return `
📊 SwjshAK Daily Summary - ${data.data.date}

Total P&L: $${data.data.total_pnl.toFixed(2)}
Win Rate: ${(data.data.win_rate * 100).toFixed(1)}%
Trades: ${data.data.total_trades} (${data.data.winning_trades}W / ${data.data.losing_trades}L)

Best Trade: ${data.data.best_trade.symbol} +$${data.data.best_trade.pnl}
Worst Trade: ${data.data.worst_trade.symbol} -$${Math.abs(data.data.worst_trade.pnl)}

Agent Performance:
${data.data.agent_breakdown.map(a =>
  `  - ${a.agent}: $${a.pnl.toFixed(2)} (${a.trades} trades)`
).join('\n')}
  `;
}
```

---

### ChatGPT (via Actions)

```yaml
# openapi.yaml for GPT Action
openapi: 3.0.0
info:
  title: SwjshAK Control API
  version: 1.0.0
servers:
  - url: http://localhost:3000/api
paths:
  /control:
    post:
      summary: Execute trading system command
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                command:
                  type: string
                  enum: [status, summary, pause, resume, killswitch, killswitch_reset, agent]
                agentId:
                  type: string
      responses:
        '200':
          description: Command executed successfully
```

---

### Scheduled Reports (Cron + LLM)

```bash
# cron job: Daily 5 PM summary via LLM
0 17 * * * curl -X POST http://localhost:3000/api/control \
  -H "Content-Type: application/json" \
  -d '{"command": "summary"}' | \
  python send_to_claude.py
```

```python
# send_to_claude.py
import sys
import json
from anthropic import Anthropic

data = json.load(sys.stdin)
client = Anthropic()

message = client.messages.create(
    model="claude-sonnet-4",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": f"Analyze this trading data and provide insights: {json.dumps(data)}"
    }]
)

print(message.content)
```

---

## Error Handling

**Invalid Command**:
```json
{
  "success": false,
  "error": "Unknown command: 'invalid'",
  "available_commands": ["status", "summary", "pause", "resume", "killswitch", "killswitch_reset", "agent"]
}
```

**Missing Agent ID**:
```json
{
  "success": false,
  "error": "agentId required for 'pause' command"
}
```

**Agent Not Found**:
```json
{
  "success": false,
  "error": "Agent 'unknown-agent' not found",
  "available_agents": ["pivot-pete", "boba-trades", "bitcoin-bob", "spx-sniper"]
}
```

---

## Security Considerations

### Current State
- **No authentication** - assumes local-only access
- **HTTP only** - not exposed to internet

### Production Recommendations
1. **Add API key authentication**:
```typescript
const API_KEY = process.env.CONTROL_API_KEY;

if (req.headers['x-api-key'] !== API_KEY) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

2. **Use HTTPS** if exposing to network:
```typescript
// In next.config.ts
module.exports = {
  async headers() {
    return [
      {
        source: '/api/control',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' }
        ]
      }
    ];
  }
};
```

3. **Rate limiting**:
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
```

---

## Related Pages

- [[API Reference]] - All API endpoints
- [[Agent System]] - How agents work
- [[Risk Management]] - Kill switch logic
- [[Monitoring]] - System health tracking
- [[Deployment]] - Production setup
