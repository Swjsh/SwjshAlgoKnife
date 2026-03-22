# Overnight Research: Self-Healing & Monitoring Patterns

**Date**: 2026-03-22
**Researcher**: RESEARCHER Agent (Terminal 3)
**Session ID**: overnight-2026-03-22-162529

---

## Executive Summary

Research into self-healing system patterns, agent heartbeat monitoring, and production trading bot infrastructure yielded several battle-tested implementations directly applicable to SwjshAK's agent runner and activity monitoring systems.

---

## Finding 1: Dual-Signal Heartbeat Monitoring (Crewly)

**Source**: https://github.com/stevehuang0115/crewly
**Applicability**: VERY HIGH
**Implementation Difficulty**: 3/5

### Key Patterns Identified

Enterprise-grade agent heartbeat monitoring with non-intrusive design:

1. **Dual Idle Detection**: Checks BOTH PTY activity AND API activity timestamps
2. **Process Liveness Check**: Server-side child process inspection (no input injection)
3. **Progressive Restart**: After N consecutive dead checks, triggers restart with session preservation
4. **Suspend on Idle**: Suspends monitoring for idle-but-alive agents

### State Machine

```
HEALTHY → (silent) → WARNING → (more silence) → CRITICAL → TERMINATED
    ↑                                                ↓
    └────────────────── RESTART ←────────────────────┘
```

### Configuration

```typescript
// Constants
const MAX_DEAD_CHECKS_BEFORE_RESTART = 3;
const IDLE_CHECKS_BEFORE_SUSPEND = 5;

interface AgentMonitorState {
  sessionName: string;
  memberId: string;
  role: string;
  consecutiveDeadChecks: number;
  restartTimestamps: number[];
  restartCount: number;
  lastApiCallTime: number;
  consecutiveIdleChecks: number;
  heartbeatSuspended: boolean;
}
```

### Design Principle

**NEVER write to an agent's PTY input** — All checks are performed server-side via process inspection and API activity timestamps.

### Application to SwjshAK

- **Agent Runner Enhancement**: Add dual-signal detection (stdout activity + API heartbeat)
- **Activity Bridge**: Implement progressive restart with cooldown tracking
- **Stuck Agent Detection**: Use silence duration for auto-nudge decisions

---

## Finding 2: Action-Based Heartbeat (Runcore)

**Source**: https://github.com/XDM-ZSBW/runcore
**Applicability**: HIGH
**Implementation Difficulty**: 2/5

### Key Patterns Identified

Elegant "every action IS the ping" approach:

1. **No Polling**: Agent output IS the heartbeat signal
2. **Append-Only Log**: JSONL heartbeat trail for auditing
3. **Silence Detection**: Agent produces no output for too long → terminate
4. **Drift Detection**: Agent actions diverge from assigned task → warn/terminate

### Heartbeat Pulse Types

```typescript
type PulseType =
  | "spawn"           // Agent started
  | "action"          // Agent performed an action
  | "output"          // Agent produced output
  | "checkpoint"      // Agent reached milestone
  | "complete"        // Task finished
  | "terminate"       // Agent stopped
  | "silence-warning" // No activity warning

interface HeartbeatPulse {
  timestamp: string;
  taskId: string;
  instanceId: string;
  type: PulseType;
  detail?: string;
  actionSummary?: string;  // For drift detection
}
```

### Configuration

```typescript
const DEFAULT_CONFIG: HeartbeatConfig = {
  silenceWarningMs: 120_000,     // 2 minutes
  silenceTerminateMs: 300_000,   // 5 minutes
  checkIntervalMs: 15_000,       // 15 seconds
  taskDescription: "",
  taskKeywords: [],
  maxDriftWarnings: 3,
};
```

### Application to SwjshAK

- **Activity Bridge Improvement**: Use stdout parsing as heartbeat signal
- **Drift Detection**: Compare agent actions against assigned ticket keywords
- **Stuck Detection**: 2-minute warning, 5-minute auto-nudge

---

## Finding 3: Production Trading Health Checks (Trading-Copilot)

**Source**: https://github.com/LobaHQ/trading-copilot
**Applicability**: HIGH
**Implementation Difficulty**: 2/5

### Key Patterns Identified

Comprehensive health check system for trading services:

1. **Service Registration**: Declarative service health check registration
2. **Cache-Based Optimization**: Health results cached to reduce load
3. **Periodic Checks**: Configurable interval, timeout, retries per service
4. **Metrics Integration**: Prometheus-compatible metrics export

### Health Check Interface

```typescript
interface ServiceHealth {
  name: string;
  endpoint: string;
  interval: number;   // Check interval (ms)
  timeout: number;    // Check timeout (ms)
  retries: number;    // Retry count before failing
  check: () => Promise<HealthCheck>;
}

interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message?: string;
  responseTime?: number;
  lastCheck?: string;
  metadata?: any;
}
```

### Application to SwjshAK

- **API Health Endpoint**: Enhance `/api/health` with per-service checks
- **Agent Runner Health**: Register each Python agent as a health check service
- **Broker Connection Check**: Monitor Alpaca/broker connectivity

---

## Finding 4: Multi-Channel Alerting System (Trading-Copilot)

**Source**: https://github.com/LobaHQ/trading-copilot
**Applicability**: HIGH
**Implementation Difficulty**: 3/5

### Key Patterns Identified

Production alerting system with:

1. **Multi-Channel Support**: Email, SMS, Webhook, Slack, PagerDuty
2. **Alert Types**: Transaction failures, order rejections, risk breaches, system errors
3. **Severity Levels**: Info, Warning, Error, Critical
4. **Cooldown Tracking**: Prevent alert fatigue with rule-based cooldowns
5. **Acknowledgment Flow**: Track acknowledged alerts

### Alert Rule Interface

```typescript
interface AlertRule {
  id: string;
  name: string;
  condition: (event: any) => boolean;
  type: AlertType;
  severity: AlertSeverity;
  channels: AlertChannel[];
  cooldown: number;  // Milliseconds
  enabled: boolean;
}

type AlertType =
  | 'transaction_failed'
  | 'order_rejected'
  | 'position_liquidated'
  | 'risk_limit_breach'
  | 'system_error'
  | 'connectivity_issue'
  | 'market_anomaly';

type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
type AlertChannel = 'email' | 'sms' | 'webhook' | 'slack' | 'pagerduty' | 'console';
```

### Application to SwjshAK

- **Kill-Switch Alerts**: Critical alert when kill switch activated
- **Agent Crash Alerts**: Warning on agent restart, critical on repeated crashes
- **Trade Failure Alerts**: Notify on order rejections or position issues

---

## Finding 5: Backtest Analysis Framework (Maverick-MCP)

**Source**: https://github.com/wshobson/maverick-mcp
**Applicability**: MEDIUM-HIGH
**Implementation Difficulty**: 2/5

### Key Patterns Identified

VectorBT-based backtest analysis with:

1. **Type Conversion**: Safe numpy-to-native conversion for JSON serialization
2. **Input Validation**: Handle empty data/signals gracefully
3. **Fallback Modes**: Buy-and-hold results when no signals generated
4. **Comprehensive Metrics**: Sharpe, max drawdown, win rate, profit factor

### Metrics Interface

```python
metrics = {
    "total_return": float(portfolio.total_return()),
    "annual_return": float(portfolio.annualized_return()),
    "sharpe_ratio": float(portfolio.sharpe_ratio()),
    "max_drawdown": float(portfolio.max_drawdown()),
    "win_rate": float(portfolio.trades.win_rate()),
    "total_trades": int(portfolio.trades.count()),
    "profit_factor": float(portfolio.trades.profit_factor()),
}
```

### Application to SwjshAK

- **Strategy Backtest Reports**: Standardize metrics output format
- **Signal Validation**: Handle empty signal arrays gracefully
- **Fallback Results**: Return buy-and-hold baseline when no trades generated

---

## Recommendations

### Immediate Actions (Week 1)

1. **Implement Action-Based Heartbeat** (Difficulty: 2/5)
   - Modify Activity Bridge to use stdout parsing as heartbeat
   - Add silence detection (2min warning, 5min nudge)
   - Log heartbeats to JSONL for debugging

2. **Add Progressive Restart Logic** (Difficulty: 2/5)
   - Track consecutive failure count per agent
   - Implement cooldown between restarts
   - Preserve session context across restarts

### Short-Term (Month 1)

3. **Multi-Service Health Checks** (Difficulty: 2/5)
   - Register each agent as a health check service
   - Add broker connectivity check
   - Export Prometheus metrics

4. **Basic Alerting System** (Difficulty: 3/5)
   - Slack/Discord webhook alerts for critical events
   - Alert cooldown to prevent spam
   - Kill-switch activation alert

### Medium-Term (Quarter 1)

5. **Full Dual-Signal Monitoring** (Difficulty: 3/5)
   - Combine PTY activity + API heartbeat
   - Implement idle suspension
   - Add drift detection for off-task agents

---

## Code Snippets for Implementation

### Quick Heartbeat Implementation

```typescript
// Activity Bridge heartbeat tracking
interface HeartbeatState {
  agentId: string;
  lastActivityAt: number;
  silenceMs: number;
  warningIssued: boolean;
}

const SILENCE_WARNING_MS = 120_000;
const SILENCE_TERMINATE_MS = 300_000;

function checkHeartbeats(agents: Map<string, HeartbeatState>) {
  const now = Date.now();
  for (const [id, state] of agents) {
    state.silenceMs = now - state.lastActivityAt;

    if (state.silenceMs >= SILENCE_TERMINATE_MS) {
      terminateAndRestart(id, "silence-timeout");
    } else if (state.silenceMs >= SILENCE_WARNING_MS && !state.warningIssued) {
      logWarning(id, `Silent for ${state.silenceMs}ms`);
      state.warningIssued = true;
    }
  }
}
```

### Progressive Restart

```typescript
const MAX_RESTARTS = 3;
const RESTART_COOLDOWN_MS = 60_000;

interface RestartState {
  count: number;
  timestamps: number[];
}

function shouldRestart(state: RestartState): boolean {
  const now = Date.now();
  // Filter to recent restarts within cooldown window
  state.timestamps = state.timestamps.filter(t => now - t < RESTART_COOLDOWN_MS);

  if (state.timestamps.length >= MAX_RESTARTS) {
    logCritical("Max restarts exceeded, entering circuit-breaker mode");
    return false;
  }

  state.timestamps.push(now);
  state.count++;
  return true;
}
```

---

## References

| Topic | Repo | Key File | Stars |
|-------|------|----------|-------|
| Dual-Signal Heartbeat | stevehuang0115/crewly | agent-heartbeat-monitor.service.ts | - |
| Action-Based Heartbeat | XDM-ZSBW/runcore | heartbeat.ts | - |
| Trading Health Checks | LobaHQ/trading-copilot | health-checks.ts | - |
| Trading Alerts | LobaHQ/trading-copilot | alerting-system.ts | - |
| Backtest Analysis | wshobson/maverick-mcp | analysis.py | - |
