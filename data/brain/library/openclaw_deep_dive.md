# OpenClaw Deep Dive: Complete Implementation Guide

> **Last Updated**: 2026-03-20
> **Purpose**: Comprehensive documentation for implementing OpenClaw with SwjshAK autonomous trading agents
> **Sources**: Official docs, GitHub source code, community examples, verified working configurations

---

## Table of Contents

1. [What is OpenClaw?](#what-is-openclaw)
2. [Architecture Overview](#architecture-overview)
3. [Installation & Setup](#installation--setup)
4. [Configuration Deep Dive](#configuration-deep-dive)
5. [Agent System & Workspaces](#agent-system--workspaces)
6. [Multi-Agent Routing](#multi-agent-routing)
7. [Webhooks & HTTP Triggers](#webhooks--http-triggers)
8. [Cron Jobs](#cron-jobs)
9. [Discord Integration](#discord-integration)
10. [n8n Integration Pattern](#n8n-integration-pattern)
11. [SwjshAK Implementation Plan](#swjshak-implementation-plan)
12. [Complete Configuration Examples](#complete-configuration-examples)
13. [Troubleshooting](#troubleshooting)

---

## What is OpenClaw?

OpenClaw (formerly Clawdbot, Moltbot, and Molty) is a **free and open-source autonomous AI agent platform** developed by Peter Steinberger. It acts as an orchestration layer between LLMs (Claude, GPT, etc.) and your computer, enabling persistent, multi-channel AI assistants.

### Key Facts
- **GitHub**: github.com/openclaw/openclaw (247k+ stars as of March 2026)
- **Creator**: Peter Steinberger (joined OpenAI in Feb 2026, project moved to open-source foundation)
- **Version**: 2026.3.14 (current)
- **License**: Open source
- **Primary SDK**: TypeScript/Node.js (with Python interop)

### How It Works

```
User Message (WhatsApp/Discord/Telegram/Webhook)
        |
        v
   +---------+
   | Gateway |  <-- Routes messages, manages sessions
   +---------+
        |
        v
   +---------+
   |  Agent  |  <-- Reads SOUL.md, has workspace, runs tools
   +---------+
        |
        v
   +---------+
   |   LLM   |  <-- Claude, GPT, Ollama, etc.
   +---------+
        |
        v
   Response (with tool execution)
```

### Core Capabilities

1. **Multi-Channel Support**: WhatsApp, Telegram, Discord, Slack, Signal, iMessage, Mattermost, MS Teams
2. **Persistent Identity**: SOUL.md defines agent personality across sessions
3. **Memory System**: Daily logs + long-term memory files
4. **Tool Execution**: Shell commands, browsers, APIs, file operations
5. **Multi-Agent Routing**: Different agents for different contexts
6. **Automation**: Cron jobs, webhooks, heartbeats
7. **Session Management**: Isolated or shared contexts

---

## Architecture Overview

### Directory Structure

```
~/.openclaw/
├── openclaw.json           # Main configuration (JSON5)
├── credentials/            # API keys (chmod 600)
│   ├── anthropic
│   ├── openai
│   └── openrouter
├── agents/                 # Per-agent state
│   └── <agentId>/
│       ├── agent/
│       │   └── auth-profiles.json
│       └── sessions/       # Chat history
├── cron/
│   ├── jobs.json           # Scheduled tasks
│   └── runs/               # Execution history (.jsonl)
├── workspace/              # Default agent workspace
│   ├── SOUL.md             # Agent identity
│   ├── AGENTS.md           # Operating instructions
│   ├── USER.md             # User preferences
│   ├── IDENTITY.md         # Name, emoji, vibe
│   ├── TOOLS.md            # Tool conventions
│   ├── HEARTBEAT.md        # Periodic checklist
│   ├── MEMORY.md           # Long-term memory
│   ├── memory/             # Daily logs
│   │   └── YYYY-MM-DD.md
│   └── skills/             # Custom skills
└── logs/                   # Gateway logs
```

### Component Flow

```
                    ┌─────────────────────────────────────────────┐
                    │              OpenClaw Gateway               │
                    │  (Port 18789 - localhost by default)        │
                    └─────────────────────────────────────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        │                               │                               │
        v                               v                               v
   ┌─────────┐                    ┌─────────┐                    ┌─────────┐
   │ Discord │                    │ Webhook │                    │  Cron   │
   │ Channel │                    │ Handler │                    │ Scheduler│
   └─────────┘                    └─────────┘                    └─────────┘
        │                               │                               │
        └───────────────────────────────┼───────────────────────────────┘
                                        │
                                        v
                              ┌───────────────────┐
                              │    Bindings       │
                              │ (Route to Agent)  │
                              └───────────────────┘
                                        │
                                        v
                              ┌───────────────────┐
                              │     Agent         │
                              │  (Workspace)      │
                              │  - SOUL.md        │
                              │  - Tools          │
                              │  - Memory         │
                              └───────────────────┘
                                        │
                                        v
                              ┌───────────────────┐
                              │   LLM Provider    │
                              │ (Anthropic/OpenAI)│
                              └───────────────────┘
```

---

## Installation & Setup

### Prerequisites

- Node.js 18+
- npm or pnpm
- API key for at least one LLM provider

### Installation

```bash
# Install OpenClaw globally
npm install -g openclaw

# OR using pnpm
pnpm add -g openclaw

# Verify installation
openclaw --version
```

### Initial Setup

```bash
# Interactive setup wizard
openclaw onboard

# OR non-interactive with Anthropic
openclaw onboard --anthropic-api-key "$ANTHROPIC_API_KEY"

# Set gateway mode (REQUIRED before first run)
openclaw config set gateway.mode local

# Start the gateway
openclaw gateway
```

### Environment Variables

```bash
# Required
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# Optional
export DISCORD_BOT_TOKEN="..."
export OPENCLAW_HOME="~/.openclaw"           # Override home directory
export OPENCLAW_STATE_DIR="..."              # Override state directory
export OPENCLAW_CONFIG_PATH="..."            # Override config file path
```

---

## Configuration Deep Dive

### Configuration File Location

- **Default**: `~/.openclaw/openclaw.json`
- **Format**: JSON5 (supports comments, trailing commas)
- **Hot Reload**: Gateway watches and auto-applies changes

### Validation

OpenClaw uses **Zod schema validation**. The config must match exactly:
- Unknown keys are rejected
- Invalid types cause startup failure
- Run `openclaw doctor --fix` to repair common issues

### Root-Level Schema

```json5
{
  // Optional: JSON Schema reference for editor support
  "$schema": "https://openclaw.ai/schema/2026.3.json",

  // Metadata
  "meta": {
    "version": "2026.3.14",
    "lastTouched": "2026-03-20T12:00:00Z"
  },

  // Environment variables
  "env": {
    "ANTHROPIC_API_KEY": "sk-ant-...",
    "vars": {},
    "shellEnv": { "enabled": true, "timeoutMs": 5000 }
  },

  // Gateway settings
  "gateway": {
    "mode": "local",                    // REQUIRED: "local" | "remote" | "hybrid"
    "port": 18789,
    "bind": "127.0.0.1",
    "auth": {
      "token": "your-gateway-token"     // Required for remote mode
    },
    "reload": {
      "mode": "hybrid",                 // "hybrid" | "hot" | "restart" | "off"
      "debounceMs": 500
    }
  },

  // Agent configuration
  "agents": {
    "defaults": { /* ... */ },
    "list": [ /* ... */ ]
  },

  // Model/provider configuration
  "models": {
    "providers": { /* ... */ }
  },

  // Channel configuration
  "channels": {
    "discord": { /* ... */ },
    "whatsapp": { /* ... */ },
    "telegram": { /* ... */ }
  },

  // Routing rules
  "bindings": [ /* ... */ ],

  // Automation
  "hooks": { /* ... */ },
  "cron": { /* ... */ },

  // Tools & permissions
  "tools": { /* ... */ },

  // Session behavior
  "session": { /* ... */ }
}
```

### Agent Defaults Section

```json5
{
  "agents": {
    "defaults": {
      "workspace": "~/.openclaw/workspace",
      "model": {
        "primary": "anthropic/claude-sonnet-4-6",
        "fallbacks": [
          "anthropic/claude-haiku-3-5",
          "openai/gpt-4o"
        ]
      },
      "models": {
        "anthropic/claude-opus-4-6": {
          "params": {
            "thinking": "adaptive",
            "cacheRetention": "short",
            "context1m": false
          }
        }
      },
      "bootstrapMaxChars": 20000,       // Per-file limit
      "bootstrapTotalMaxChars": 150000, // Aggregate limit
      "imageMaxDimensionPx": 2048,
      "sandbox": {
        "mode": "non-main",             // "off" | "non-main" | "all"
        "scope": "session"              // "session" | "agent" | "shared"
      },
      "heartbeat": {
        "every": "30m",
        "target": "last",               // "last" | channel name | "none"
        "directPolicy": "allow"
      },
      "subagents": {
        "maxSpawnDepth": 2,
        "maxChildrenPerAgent": 5,
        "model": "anthropic/claude-sonnet-4-6"
      }
    },
    "list": [
      {
        "id": "main",
        "default": true,
        "workspace": "~/.openclaw/workspace"
      }
    ]
  }
}
```

### Anthropic Provider Configuration

```json5
{
  "env": {
    "ANTHROPIC_API_KEY": "sk-ant-api03-..."
  },
  "models": {
    "providers": {
      "anthropic": {
        "apiKey": {
          "source": "env",
          "id": "ANTHROPIC_API_KEY"
        }
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-opus-4-6",
        "fallbacks": [
          "anthropic/claude-sonnet-4-6",
          "anthropic/claude-haiku-3-5"
        ]
      },
      "models": {
        "anthropic/claude-opus-4-6": {
          "params": {
            "thinking": "adaptive",      // Extended thinking for Claude 4.x
            "cacheRetention": "short",   // 5-minute prompt cache
            "fastMode": true,            // Maps to service_tier: "auto"
            "context1m": false           // 1M context (beta-gated)
          }
        }
      }
    }
  }
}
```

### Available Claude Models (2026)

| Model ID | Notes |
|----------|-------|
| `anthropic/claude-opus-4-6` | Most capable, expensive |
| `anthropic/claude-opus-4-5-20250514` | Previous generation |
| `anthropic/claude-sonnet-4-6` | Balanced performance/cost |
| `anthropic/claude-sonnet-4-5` | Previous generation |
| `anthropic/claude-haiku-3-5-20241022` | Fast, cheap |

---

## Agent System & Workspaces

### What is a Workspace?

The workspace is the agent's "home" - a directory of markdown files injected into the system prompt on each turn. This gives the agent persistent identity, behavioral rules, and memory.

### Standard Workspace Files

| File | Purpose | When Loaded |
|------|---------|-------------|
| **SOUL.md** | Agent identity, values, personality | Every session |
| **AGENTS.md** | Operating instructions, rules | Every session |
| **USER.md** | User identity, preferences | Every session |
| **IDENTITY.md** | Name, emoji, vibe | Bootstrap |
| **TOOLS.md** | Local tool conventions | Reference only |
| **HEARTBEAT.md** | Periodic checklist | Heartbeat runs |
| **BOOT.md** | Startup checklist | Gateway restart |
| **MEMORY.md** | Curated long-term memory | Main sessions |
| **memory/YYYY-MM-DD.md** | Daily logs | Today + yesterday |

### SOUL.md Template

```markdown
# Soul

## Core Truths

1. **Genuine helpfulness**: Skip "Great question!" and "I'd be happy to help!" - just help. Actions speak louder than filler.

2. **Authentic opinions**: Have preferences. Disagree when warranted. An assistant with no personality is just a search engine.

3. **Resourcefulness**: Exhaust available information before asking for clarification. Try before you ask.

4. **Competence-based trust**: Earn credibility through capability and careful judgment.

## Boundaries

1. **Absolute privacy**: Never share personal information without explicit permission.

2. **External action approval**: Always confirm before sending messages, posting publicly, or taking irreversible actions.

3. **Quality threshold**: Better to say "I don't know" than provide incorrect information.

4. **Role clarity**: In group contexts, understand when you're addressed vs. background noise.

## Vibe

Conversational authenticity - neither corporate formality nor excessive friendliness. Have opinions. Be direct. Skip the filler.
```

### Trading Agent SOUL.md Example

```markdown
# Soul: Chief Trading Orchestrator

## Identity

I am Chief, the autonomous trading system orchestrator for SwjshAK. I coordinate 6 specialized trading agents across Forex, Crypto, Options, and Futures markets.

## Core Truths

1. **Capital preservation first**: No trade is worth risking the account. Position sizing and risk management override signal strength.

2. **Data-driven decisions**: Every trade must have documented rationale. "Gut feelings" get logged but never acted upon.

3. **Transparent operation**: Log everything. The human should be able to audit any decision at any time.

4. **Fail-safe mentality**: When uncertain, close positions. When systems fail, halt trading.

## Operational Rules

1. **Pre-market**: Review overnight positions, check for earnings/news, confirm agent health
2. **Market hours**: Monitor agents, enforce risk limits, coordinate signals
3. **Post-market**: Generate EOD report, update performance memory, prepare for next session
4. **Never**: Override risk limits, hide losses, trade without stops

## Communication Style

- Brief, factual updates during market hours
- Detailed analysis in EOD reports
- Immediate alerts for risk events
- No hedging language when reporting losses

## Risk Parameters

- Max daily drawdown: 3%
- Max position size: 2% of account per trade
- Max correlated exposure: 5%
- Kill switch trigger: 5% daily loss OR any agent crash
```

### Memory Persistence

Memory operates at four levels:

1. **Session Context**: Current conversation (ephemeral)
2. **Daily Logs**: `memory/YYYY-MM-DD.md` - what happened today
3. **Long-term Memory**: `MEMORY.md` - curated important facts
4. **Workspace Files**: Static configuration

**Best Practice**: At end of each day, the agent writes notes to daily log. Over time, important patterns get promoted to MEMORY.md.

---

## Multi-Agent Routing

### Defining Multiple Agents

```json5
{
  "agents": {
    "list": [
      {
        "id": "chief",
        "default": true,
        "name": "Chief Orchestrator",
        "workspace": "~/.openclaw/workspace-chief",
        "model": { "primary": "anthropic/claude-opus-4-6" }
      },
      {
        "id": "spx-sniper",
        "name": "SPX Sniper",
        "workspace": "~/.openclaw/workspace-spx-sniper",
        "model": { "primary": "anthropic/claude-sonnet-4-6" }
      },
      {
        "id": "bitcoin-bob",
        "name": "Bitcoin Bob",
        "workspace": "~/.openclaw/workspace-bitcoin-bob",
        "model": { "primary": "anthropic/claude-sonnet-4-6" }
      }
    ]
  }
}
```

### Bindings for Routing

Bindings determine which agent receives inbound messages:

```json5
{
  "bindings": [
    // Most specific: peer-level routing
    {
      "agentId": "spx-sniper",
      "match": {
        "channel": "discord",
        "guildId": "123456789012345678",
        "peer": { "kind": "channel", "id": "111111111111111111" }
      }
    },
    // Role-based routing
    {
      "agentId": "bitcoin-bob",
      "match": {
        "channel": "discord",
        "guildId": "123456789012345678",
        "roles": ["222222222222222222"]
      }
    },
    // Webhook routing
    {
      "agentId": "chief",
      "match": {
        "channel": "hooks"
      }
    },
    // Default fallback
    {
      "agentId": "chief",
      "match": {
        "channel": "discord"
      }
    }
  ]
}
```

### Matching Priority (First Wins)

1. Peer ID (exact DM/group/channel)
2. Parent peer (thread inheritance)
3. Guild + roles (Discord)
4. Guild or team ID
5. Account ID match
6. Channel-level match
7. Default agent fallback

### Inter-Agent Communication

Disabled by default. Enable explicitly:

```json5
{
  "tools": {
    "agentToAgent": {
      "enabled": true,
      "allow": ["chief", "spx-sniper", "bitcoin-bob"]
    }
  }
}
```

### Sub-Agents

Sub-agents are background workers spawned from a running conversation:

```json5
{
  "agents": {
    "defaults": {
      "subagents": {
        "maxSpawnDepth": 2,           // Orchestrator can spawn workers
        "maxChildrenPerAgent": 5,      // Max concurrent children
        "model": "anthropic/claude-sonnet-4-6"  // Cheaper model for workers
      }
    }
  }
}
```

---

## Webhooks & HTTP Triggers

### Configuration

```json5
{
  "hooks": {
    "enabled": true,
    "token": "your-webhook-secret",           // REQUIRED
    "path": "/hooks",                          // Default
    "allowedAgentIds": ["chief", "hooks"],    // Restrict agent routing
    "defaultSessionKey": "hook:ingress",
    "allowRequestSessionKey": false,
    "allowedSessionKeyPrefixes": ["hook:"],
    "presets": [],                             // Built-in mappings
    "mappings": [],                            // Custom mappings
    "transformsDir": "~/.openclaw/transforms"
  }
}
```

### Authentication

Every request must include the token:

```bash
# Recommended: Header auth
curl -X POST http://localhost:18789/hooks/agent \
  -H "Authorization: Bearer your-webhook-secret" \
  -H "Content-Type: application/json" \
  -d '{"message": "Run daily analysis"}'

# Alternative header
curl -X POST http://localhost:18789/hooks/agent \
  -H "x-openclaw-token: your-webhook-secret" \
  -H "Content-Type: application/json" \
  -d '{"message": "Run daily analysis"}'
```

**Note**: Query-string tokens (`?token=...`) return 400.

### Endpoints

#### POST /hooks/wake

Enqueue system event for main session:

```json
{
  "text": "System line to process",
  "mode": "now"                      // "now" | "next-heartbeat"
}
```

#### POST /hooks/agent

Run isolated agent turn:

```json
{
  "message": "Run this task",                    // REQUIRED
  "name": "TradingView",                         // Optional: human-readable label
  "agentId": "spx-sniper",                       // Optional: target agent
  "sessionKey": "hook:tradingview:alert",        // Optional: session key
  "wakeMode": "now",                             // "now" | "next-heartbeat"
  "deliver": true,                               // Send response to channel
  "channel": "discord",                          // Target channel
  "to": "channel:111111111111111111",            // Recipient
  "model": "anthropic/claude-opus-4-6",          // Model override
  "thinking": "low",                             // Thinking level
  "timeoutSeconds": 120                          // Max duration
}
```

### Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Invalid payload or query-string token |
| 401 | Authentication failure |
| 413 | Oversized payload |
| 429 | Rate-limited (check `Retry-After` header) |

### Example: n8n Triggering OpenClaw Agent

```bash
# From n8n HTTP Request node
curl -X POST http://localhost:18789/hooks/agent \
  -H "Authorization: Bearer ${OPENCLAW_HOOK_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "TradingView alert: SPY breakout confirmed at $587.50. Analyze and execute if conditions met.",
    "agentId": "spx-sniper",
    "sessionKey": "hook:tradingview:spx",
    "deliver": true,
    "channel": "discord",
    "to": "channel:1234567890123456789"
  }'
```

---

## Cron Jobs

### Configuration Location

Cron jobs are stored separately from `openclaw.json`:

```
~/.openclaw/cron/jobs.json    # Job definitions
~/.openclaw/cron/runs/        # Execution history (.jsonl)
```

**Important**: The Gateway manages `jobs.json`. Edit only when Gateway is stopped, or use CLI commands.

### Enable Cron in Config

```json5
{
  "cron": {
    "enabled": true,
    "store": "~/.openclaw/cron/jobs.json",
    "maxConcurrentRuns": 1,
    "sessionRetention": "24h",
    "runLog": {
      "maxBytes": 2000000,
      "keepLines": 2000
    }
  }
}
```

### Job Schema

```json
{
  "jobId": "unique-identifier",
  "name": "job-name",
  "description": "optional description",
  "enabled": true,
  "agentId": "optional-agent-binding",
  "schedule": {
    "kind": "cron",                    // "at" | "every" | "cron"
    "expr": "0 7 * * *",               // Cron expression
    "tz": "America/New_York",          // Optional timezone
    "staggerMs": 0                     // Optional stagger (up to 5 min)
  },
  "sessionTarget": "isolated",         // "main" | "isolated" | "session:custom-id"
  "wakeMode": "now",                   // "now" | "next-heartbeat"
  "payload": {
    "kind": "agentTurn",               // "systemEvent" | "agentTurn"
    "message": "Run morning analysis",
    "model": "anthropic/claude-sonnet-4-6",
    "thinking": "low",
    "timeoutSeconds": 300,
    "lightContext": true
  },
  "delivery": {
    "mode": "announce",                // "announce" | "webhook" | "none"
    "channel": "discord",
    "to": "channel:1234567890123456789",
    "bestEffort": false
  },
  "deleteAfterRun": false
}
```

### Schedule Types

#### One-shot (at)

```json
{
  "schedule": {
    "kind": "at",
    "at": "2026-03-20T16:00:00Z"
  }
}
```

#### Fixed Interval (every)

```json
{
  "schedule": {
    "kind": "every",
    "everyMs": 300000                  // 5 minutes
  }
}
```

#### Cron Expression (cron)

```json
{
  "schedule": {
    "kind": "cron",
    "expr": "0 7 * * *",               // 7 AM daily
    "tz": "America/New_York",
    "staggerMs": 60000                 // Random delay up to 1 min
  }
}
```

### Session Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| `main` | Enqueues in main heartbeat context | Normal prompt flow |
| `isolated` | Dedicated session `cron:<jobId>` | Background/noisy tasks |
| `session:custom-id` | Persistent named session | Daily standups with context |

### Delivery Modes

| Mode | Behavior |
|------|----------|
| `announce` | Post to channel + main session summary |
| `webhook` | HTTP POST to URL when complete |
| `none` | Internal only, no output |

### CLI Commands

```bash
# Add one-shot reminder
openclaw cron add \
  --name "Reminder" \
  --at "2026-03-20T16:00:00Z" \
  --session main \
  --system-event "Time to review positions" \
  --wake now \
  --delete-after-run

# Add recurring job with Discord delivery
openclaw cron add \
  --name "Morning brief" \
  --cron "0 7 * * *" \
  --tz "America/New_York" \
  --session isolated \
  --agent-id chief \
  --message "Generate morning market brief" \
  --announce \
  --channel discord \
  --to "channel:1234567890123456789"

# List all jobs
openclaw cron list

# View job run history
openclaw cron runs --id <jobId> --limit 50

# Manually trigger a job
openclaw cron run <jobId>

# Edit existing job
openclaw cron edit <jobId> --message "Updated prompt"

# Remove job
openclaw cron remove <jobId>
```

### Example Jobs for Trading System

```json
[
  {
    "jobId": "pre-market-scan",
    "name": "Pre-Market Analysis",
    "enabled": true,
    "agentId": "chief",
    "schedule": {
      "kind": "cron",
      "expr": "0 8 * * 1-5",
      "tz": "America/New_York"
    },
    "sessionTarget": "session:daily-trading",
    "payload": {
      "kind": "agentTurn",
      "message": "Run pre-market scan. Check overnight news, earnings calendar, and agent health. Report to Discord.",
      "model": "anthropic/claude-sonnet-4-6",
      "timeoutSeconds": 120
    },
    "delivery": {
      "mode": "announce",
      "channel": "discord",
      "to": "channel:CHIEF_CHANNEL_ID"
    }
  },
  {
    "jobId": "eod-report",
    "name": "End of Day Report",
    "enabled": true,
    "agentId": "chief",
    "schedule": {
      "kind": "cron",
      "expr": "0 17 * * 1-5",
      "tz": "America/New_York"
    },
    "sessionTarget": "session:daily-trading",
    "payload": {
      "kind": "agentTurn",
      "message": "Generate end-of-day trading report. Summarize all agent performance, P&L, wins/losses, and lessons learned. Update MEMORY.md with insights.",
      "model": "anthropic/claude-opus-4-6",
      "thinking": "medium",
      "timeoutSeconds": 300
    },
    "delivery": {
      "mode": "announce",
      "channel": "discord",
      "to": "channel:REPORTS_CHANNEL_ID"
    }
  }
]
```

---

## Discord Integration

### Configuration

```json5
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": {
        "source": "env",
        "provider": "default",
        "id": "DISCORD_BOT_TOKEN"
      },
      "groupPolicy": "allowlist",      // "allowlist" | "open" | "disabled"
      "dmPolicy": "allowlist",         // "pairing" | "allowlist" | "open" | "disabled"
      "guilds": {
        "SERVER_ID": {
          "requireMention": true,
          "ignoreOtherMentions": true,
          "users": ["USER_ID_1", "USER_ID_2"],
          "roles": ["ROLE_ID"],
          "channels": {
            "CHANNEL_ID_1": { "allow": true, "requireMention": false },
            "CHANNEL_ID_2": { "allow": true, "requireMention": true }
          }
        }
      },
      "historyLimit": 20,
      "streaming": "partial",          // "off" | "partial" | "block" | "progress"
      "voice": {
        "enabled": false
      }
    }
  }
}
```

### Bot Setup

1. Create application at https://discord.com/developers/applications
2. Create bot, copy token
3. Enable privileged intents:
   - **Message Content Intent** (REQUIRED)
   - **Server Members Intent** (recommended)
   - **Presence Intent** (optional)
4. Add bot to server with OAuth2 URL:
   - Scopes: `bot`, `applications.commands`
   - Permissions: View Channels, Send Messages, Read Message History, Embed Links, Attach Files

### Role-Based Agent Routing

Route different Discord roles to different agents:

```json5
{
  "bindings": [
    {
      "agentId": "chief",
      "match": {
        "channel": "discord",
        "guildId": "SERVER_ID",
        "roles": ["ADMIN_ROLE_ID"]
      }
    },
    {
      "agentId": "spx-sniper",
      "match": {
        "channel": "discord",
        "guildId": "SERVER_ID",
        "peer": { "kind": "channel", "id": "SPX_CHANNEL_ID" }
      }
    },
    {
      "agentId": "chief",
      "match": {
        "channel": "discord",
        "guildId": "SERVER_ID"
      }
    }
  ]
}
```

### Sending Messages to Discord

```bash
# Via CLI
openclaw message send \
  --channel discord \
  --target channel:CHANNEL_ID \
  --message "Market alert: SPY breakout confirmed"

# Via cron job delivery
{
  "delivery": {
    "mode": "announce",
    "channel": "discord",
    "to": "channel:CHANNEL_ID"
  }
}

# Via webhook response
# Set deliver: true and channel: "discord" in webhook call
```

---

## n8n Integration Pattern

### Architecture: Agent-to-n8n (Recommended)

OpenClaw agents call n8n via webhooks. Agents never see credentials.

```
┌─────────────┐     HTTP POST      ┌────────────┐      API Call      ┌─────────────┐
│  OpenClaw   │ ───────────────→   │    n8n     │ ───────────────→   │  External   │
│   Agent     │                    │  Workflow  │                    │   Service   │
│ (no creds)  │                    │ (has creds)│                    │  (Broker)   │
└─────────────┘                    └────────────┘                    └─────────────┘
```

### Architecture: n8n-to-OpenClaw (Triggers)

n8n triggers OpenClaw agents via webhooks:

```
┌─────────────┐     Webhook        ┌─────────────┐    POST /hooks/agent   ┌───────────┐
│ TradingView │ ───────────────→   │     n8n     │ ───────────────────→   │ OpenClaw  │
│   Alert     │                    │  Workflow   │                        │   Agent   │
└─────────────┘                    └─────────────┘                        └───────────┘
```

### n8n Workflow: Trigger OpenClaw Agent

```json
{
  "name": "TradingView to OpenClaw",
  "nodes": [
    {
      "name": "TradingView Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "httpMethod": "POST",
        "path": "tradingview-alert",
        "responseMode": "onReceived"
      }
    },
    {
      "name": "Route to Agent",
      "type": "n8n-nodes-base.switch",
      "parameters": {
        "rules": [
          { "value1": "={{$json.ticker}}", "value2": "SPY", "output": 0 },
          { "value1": "={{$json.ticker}}", "value2": "BTC", "output": 1 },
          { "value1": "", "value2": "", "output": 2 }
        ]
      }
    },
    {
      "name": "Call SPX Sniper",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "http://localhost:18789/hooks/agent",
        "headers": {
          "Authorization": "Bearer {{$env.OPENCLAW_HOOK_TOKEN}}"
        },
        "body": {
          "message": "TradingView alert: {{$json.ticker}} {{$json.action}} at {{$json.price}}. Analyze and execute.",
          "agentId": "spx-sniper",
          "deliver": true,
          "channel": "discord",
          "to": "channel:SPX_CHANNEL_ID"
        }
      }
    }
  ]
}
```

### Security Best Practices

1. **Never give OpenClaw n8n admin access** - webhooks only
2. **Store credentials in n8n** - not in agent environment
3. **Lock workflows after setup** - prevent agent modification
4. **Use dedicated webhook tokens** - separate from gateway auth
5. **Rate limit n8n webhooks** - prevent runaway agents

---

## SwjshAK Implementation Plan

### Agent Mapping

| Agent | OpenClaw ID | Model | Workspace |
|-------|-------------|-------|-----------|
| Chief Orchestrator | `chief` | claude-opus-4-6 | `~/.openclaw/workspace-chief` |
| SPX Sniper | `spx-sniper` | claude-sonnet-4-6 | `~/.openclaw/workspace-spx-sniper` |
| Bitcoin Bob | `bitcoin-bob` | claude-sonnet-4-6 | `~/.openclaw/workspace-bitcoin-bob` |
| Sterling FX | `sterling-fx` | claude-sonnet-4-6 | `~/.openclaw/workspace-sterling-fx` |
| Boba Trades | `boba-trades` | claude-sonnet-4-6 | `~/.openclaw/workspace-boba-trades` |
| Pivot Pete | `pivot-pete` | claude-sonnet-4-6 | `~/.openclaw/workspace-pivot-pete` |

### Discord Channel Structure

```
SwjshAK Server
├── #chief-command (Chief only)
├── #agent-alerts (All agents post)
├── #spx-sniper (SPX Sniper channel binding)
├── #bitcoin-bob (Bitcoin Bob binding)
├── #sterling-fx (Sterling FX binding)
├── #boba-trades (Boba Trades binding)
├── #pivot-pete (Pivot Pete binding)
└── #audit-log (Read-only, all agent activity)
```

### Integration Flow

```
TradingView Alert
       │
       v
n8n Webhook (/webhook/tradingview)
       │
       v
n8n Routes by Ticker/Strategy
       │
       ├──→ SPY → POST /hooks/agent (agentId: spx-sniper)
       ├──→ BTC → POST /hooks/agent (agentId: bitcoin-bob)
       ├──→ GBP/USD → POST /hooks/agent (agentId: sterling-fx)
       └──→ Options → POST /hooks/agent (agentId: boba-trades)

OpenClaw Agent
       │
       v
Agent Analyzes + Decides
       │
       v
n8n Webhook (execute trade) ──→ Broker API (Alpaca/OANDA)
       │
       v
Response to Discord Channel
```

### Cron Schedule

| Time (ET) | Job | Agent |
|-----------|-----|-------|
| 8:00 AM | Pre-market scan | Chief |
| 9:30 AM | Market open check | Chief |
| 12:00 PM | Midday review | Chief |
| 4:00 PM | Market close | Chief |
| 5:00 PM | EOD report | Chief |
| 10:00 PM | Crypto overnight scan | Bitcoin Bob |

---

## Complete Configuration Examples

### Minimal SwjshAK Configuration

```json5
{
  "$schema": "https://openclaw.ai/schema/2026.3.json",

  "gateway": {
    "mode": "local",
    "port": 18789,
    "auth": {
      "token": "your-gateway-secret"
    }
  },

  "env": {
    "ANTHROPIC_API_KEY": "sk-ant-api03-...",
    "DISCORD_BOT_TOKEN": "..."
  },

  "models": {
    "providers": {
      "anthropic": {
        "apiKey": { "source": "env", "id": "ANTHROPIC_API_KEY" }
      }
    }
  },

  "agents": {
    "defaults": {
      "workspace": "~/.openclaw/workspace",
      "model": {
        "primary": "anthropic/claude-sonnet-4-6",
        "fallbacks": ["anthropic/claude-haiku-3-5"]
      }
    },
    "list": [
      {
        "id": "chief",
        "default": true,
        "name": "Chief Orchestrator",
        "workspace": "~/.openclaw/workspace-chief",
        "model": { "primary": "anthropic/claude-opus-4-6" }
      }
    ]
  },

  "channels": {
    "discord": {
      "enabled": true,
      "token": { "source": "env", "id": "DISCORD_BOT_TOKEN" },
      "groupPolicy": "allowlist",
      "guilds": {
        "YOUR_SERVER_ID": {
          "requireMention": true,
          "channels": {
            "CHIEF_CHANNEL_ID": { "allow": true, "requireMention": false }
          }
        }
      }
    }
  },

  "hooks": {
    "enabled": true,
    "token": "your-webhook-secret",
    "allowedAgentIds": ["chief"]
  },

  "cron": {
    "enabled": true
  }
}
```

### Full SwjshAK Configuration

```json5
{
  "$schema": "https://openclaw.ai/schema/2026.3.json",

  "meta": {
    "version": "2026.3.14",
    "lastTouched": "2026-03-20T12:00:00Z"
  },

  "gateway": {
    "mode": "local",
    "port": 18789,
    "bind": "127.0.0.1",
    "auth": {
      "token": "${OPENCLAW_GATEWAY_TOKEN}"
    },
    "reload": {
      "mode": "hybrid",
      "debounceMs": 500
    }
  },

  "env": {
    "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}",
    "DISCORD_BOT_TOKEN": "${DISCORD_BOT_TOKEN}",
    "OPENCLAW_GATEWAY_TOKEN": "${OPENCLAW_GATEWAY_TOKEN}",
    "OPENCLAW_HOOK_TOKEN": "${OPENCLAW_HOOK_TOKEN}"
  },

  "models": {
    "providers": {
      "anthropic": {
        "apiKey": { "source": "env", "id": "ANTHROPIC_API_KEY" }
      }
    }
  },

  "agents": {
    "defaults": {
      "workspace": "~/.openclaw/workspace",
      "model": {
        "primary": "anthropic/claude-sonnet-4-6",
        "fallbacks": ["anthropic/claude-haiku-3-5"]
      },
      "models": {
        "anthropic/claude-opus-4-6": {
          "params": {
            "thinking": "adaptive",
            "cacheRetention": "short"
          }
        }
      },
      "bootstrapMaxChars": 20000,
      "bootstrapTotalMaxChars": 150000,
      "heartbeat": {
        "every": "30m",
        "target": "last"
      },
      "subagents": {
        "maxSpawnDepth": 2,
        "maxChildrenPerAgent": 3,
        "model": "anthropic/claude-haiku-3-5"
      }
    },
    "list": [
      {
        "id": "chief",
        "default": true,
        "name": "Chief Orchestrator",
        "workspace": "~/.openclaw/workspace-chief",
        "model": { "primary": "anthropic/claude-opus-4-6" }
      },
      {
        "id": "spx-sniper",
        "name": "SPX Sniper",
        "workspace": "~/.openclaw/workspace-spx-sniper"
      },
      {
        "id": "bitcoin-bob",
        "name": "Bitcoin Bob",
        "workspace": "~/.openclaw/workspace-bitcoin-bob"
      },
      {
        "id": "sterling-fx",
        "name": "Sterling FX",
        "workspace": "~/.openclaw/workspace-sterling-fx"
      },
      {
        "id": "boba-trades",
        "name": "Boba Trades",
        "workspace": "~/.openclaw/workspace-boba-trades"
      },
      {
        "id": "pivot-pete",
        "name": "Pivot Pete",
        "workspace": "~/.openclaw/workspace-pivot-pete"
      }
    ]
  },

  "channels": {
    "discord": {
      "enabled": true,
      "token": { "source": "env", "id": "DISCORD_BOT_TOKEN" },
      "groupPolicy": "allowlist",
      "dmPolicy": "disabled",
      "guilds": {
        "YOUR_SERVER_ID": {
          "requireMention": true,
          "ignoreOtherMentions": true,
          "channels": {
            "CHIEF_CHANNEL_ID": { "allow": true, "requireMention": false },
            "SPX_CHANNEL_ID": { "allow": true },
            "BITCOIN_CHANNEL_ID": { "allow": true },
            "STERLING_CHANNEL_ID": { "allow": true },
            "BOBA_CHANNEL_ID": { "allow": true },
            "PIVOT_CHANNEL_ID": { "allow": true },
            "ALERTS_CHANNEL_ID": { "allow": true },
            "AUDIT_CHANNEL_ID": { "allow": true }
          }
        }
      },
      "historyLimit": 20,
      "streaming": "partial"
    }
  },

  "bindings": [
    // Webhook routing
    {
      "agentId": "chief",
      "match": { "channel": "hooks" }
    },
    // Channel-specific routing
    {
      "agentId": "spx-sniper",
      "match": {
        "channel": "discord",
        "guildId": "YOUR_SERVER_ID",
        "peer": { "kind": "channel", "id": "SPX_CHANNEL_ID" }
      }
    },
    {
      "agentId": "bitcoin-bob",
      "match": {
        "channel": "discord",
        "guildId": "YOUR_SERVER_ID",
        "peer": { "kind": "channel", "id": "BITCOIN_CHANNEL_ID" }
      }
    },
    {
      "agentId": "sterling-fx",
      "match": {
        "channel": "discord",
        "guildId": "YOUR_SERVER_ID",
        "peer": { "kind": "channel", "id": "STERLING_CHANNEL_ID" }
      }
    },
    {
      "agentId": "boba-trades",
      "match": {
        "channel": "discord",
        "guildId": "YOUR_SERVER_ID",
        "peer": { "kind": "channel", "id": "BOBA_CHANNEL_ID" }
      }
    },
    {
      "agentId": "pivot-pete",
      "match": {
        "channel": "discord",
        "guildId": "YOUR_SERVER_ID",
        "peer": { "kind": "channel", "id": "PIVOT_CHANNEL_ID" }
      }
    },
    // Default fallback
    {
      "agentId": "chief",
      "match": {
        "channel": "discord",
        "guildId": "YOUR_SERVER_ID"
      }
    }
  ],

  "hooks": {
    "enabled": true,
    "token": "${OPENCLAW_HOOK_TOKEN}",
    "path": "/hooks",
    "allowedAgentIds": ["chief", "spx-sniper", "bitcoin-bob", "sterling-fx", "boba-trades", "pivot-pete"],
    "defaultSessionKey": "hook:trading",
    "allowRequestSessionKey": true,
    "allowedSessionKeyPrefixes": ["hook:"]
  },

  "cron": {
    "enabled": true,
    "maxConcurrentRuns": 2,
    "sessionRetention": "48h"
  },

  "tools": {
    "agentToAgent": {
      "enabled": true,
      "allow": ["chief", "spx-sniper", "bitcoin-bob", "sterling-fx", "boba-trades", "pivot-pete"]
    }
  },

  "session": {
    "dmScope": "per-peer",
    "threadBindings": {
      "enabled": true,
      "idleHours": 24,
      "maxAgeHours": 168
    }
  }
}
```

---

## Troubleshooting

### "Gateway start blocked: set gateway.mode=local"

```bash
openclaw config set gateway.mode local
# OR for one-off run:
openclaw gateway --allow-unconfigured
```

### Validation Errors

```bash
# Diagnose and auto-fix
openclaw doctor --fix

# Check specific issues
openclaw doctor
```

### Discord Bot Not Responding

1. Verify bot token: `echo $DISCORD_BOT_TOKEN`
2. Check privileged intents enabled (Message Content Intent)
3. Verify bot has permissions in channel
4. Check guild/channel IDs in config
5. Review logs: `openclaw logs --tail 100`

### Webhooks Not Working

1. Verify `hooks.enabled: true`
2. Check token matches: `hooks.token`
3. Test with curl:
   ```bash
   curl -v -X POST http://localhost:18789/hooks/agent \
     -H "Authorization: Bearer your-token" \
     -H "Content-Type: application/json" \
     -d '{"message": "test"}'
   ```
4. Check response codes (401 = bad token, 400 = bad payload)

### Cron Jobs Not Running

1. Verify `cron.enabled: true`
2. Check job is enabled: `openclaw cron list`
3. Check timezone matches expectation
4. View run history: `openclaw cron runs --id <jobId>`
5. Manually trigger: `openclaw cron run <jobId>`

### Agent Not Found

1. Verify agent exists in `agents.list`
2. Check `agentId` spelling matches exactly
3. Verify `hooks.allowedAgentIds` includes the agent
4. Check bindings are correct

---

## References

### Official Documentation
- Configuration: https://docs.openclaw.ai/gateway/configuration
- Webhooks: https://docs.openclaw.ai/automation/webhook
- Cron Jobs: https://docs.openclaw.ai/automation/cron-jobs
- Discord: https://docs.openclaw.ai/channels/discord
- Multi-Agent: https://docs.openclaw.ai/concepts/multi-agent
- Agent Workspace: https://docs.openclaw.ai/concepts/agent-workspace
- Anthropic Provider: https://docs.openclaw.ai/providers/anthropic

### GitHub
- Main repo: https://github.com/openclaw/openclaw
- Zod Schema: https://github.com/openclaw/openclaw/blob/main/src/config/zod-schema.ts
- Agent Templates: https://github.com/mergisi/awesome-openclaw-agents

### Community Resources
- n8n Integration Stack: https://github.com/caprihan/openclaw-n8n-stack
- n8n Use Cases: https://github.com/hesamsheikh/awesome-openclaw-usecases
- JSON Schema Export: https://gist.github.com/Kaspre/f8857f5b650378ae900103f11154111e

---

*Document generated from extensive web research. All configurations should be validated against the official schema before deployment. Run `openclaw doctor --fix` after any configuration changes.*
