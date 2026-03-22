# Environment Variables

---
tags: #configuration #reference #environment
status: 📘 Reference (mostly resolved)
updated: 2026-03-21
---

## Overview

Environment variables configure the SwjshAK system for different environments (development, production, paper trading, live trading).

**File**: `.env.local` (active config, not committed)
**Template**: `.env.example` (needs update)

---

## ✅ Audit Findings (2026-03-15, updated 2026-03-21)

> **Status**: Most critical issues resolved. 2 minor items remaining.

### Critical Issues Found

| Issue | Impact | Fix |
|-------|--------|-----|
| **7 .env files** with overlapping definitions | Confusion, wrong values | Consolidate to 2 files |
| **OANDA_API_KEY vs OANDA_API_TOKEN** | Auth failures | Standardize to `OANDA_API_TOKEN` |
| **WEBHOOK_SECRET hardcoded** in 6 engines | Security risk | Move to .env |
| **Missing from .env.example** | Setup failures | Add all required vars |

### Files to Clean Up

**DELETE** (redundant):
- `.env.integration`
- `.env.template`

**KEEP**:
- `.env.local` - Active credentials
- `.env.local.example` - Template for local dev
- `.env.example` - Public template (update this!)

### Action Items

- [x] ~~Standardize on `OANDA_API_TOKEN` in all code~~ ✅ Done (2026-03-15)
- [x] ~~Add `APCA_API_BASE_URL` to .env.example~~ ✅ Done (2026-03-15)
- [x] ~~Un-hardcode `WEBHOOK_SECRET` from engine files~~ ✅ Done (8 files fixed)
- [x] ~~Add missing vars: `PIVOT_PETE_DATA_PROVIDER`, `APCA_DATA_URL`, etc.~~ ✅ Done
- [ ] Delete redundant `.env.integration`, `.env.template`
- [ ] Create validation script (`scripts/validate_env.py`)

---

---

## Quick Setup

```powershell
# Copy template
cp .env.example .env

# Edit with your values
notepad .env
```

---

## Required Variables

### Core Application

```env
# Webhook authentication (TradingView alerts)
WEBHOOK_SECRET=your_secret_here_minimum_16_chars

# Account configuration
ACCOUNT_BALANCE=10000
RISK_PER_TRADE=1
```

### Alpaca (Stocks, Options, Crypto)

```env
# Paper trading
ALPACA_API_KEY=your_alpaca_api_key
ALPACA_SECRET_KEY=your_alpaca_secret_key
ALPACA_BASE_URL=https://paper-api.alpaca.markets

# Live trading (use with caution!)
# ALPACA_BASE_URL=https://api.alpaca.markets
```

### OANDA (Forex, Futures)

```env
# Paper trading
OANDA_API_KEY=your_oanda_api_token
OANDA_ACCOUNT_ID=your_oanda_account_id
OANDA_BASE_URL=https://api-fxpractice.oanda.com

# Live trading (use with caution!)
# OANDA_BASE_URL=https://api-fxtrade.oanda.com
```

---

## Optional Variables

### Risk Management

```env
# Daily loss limits
MAX_DAILY_LOSS_PCT=3
MAX_DAILY_LOSS_ABSOLUTE=500

# Position limits
MAX_POSITIONS=10
MAX_SINGLE_POSITION_PCT=20
```

### Database

```env
# SQLite path (default: ./swjsh.db)
DATABASE_PATH=./swjsh.db

# Prisma (if using)
DATABASE_URL=file:./swjsh.db
```

### Authentication (Multi-user)

```env
# Firebase (if using auth features)
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id

# NextAuth (alternative)
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
```

### Notifications

```env
# Discord (alerts)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Telegram (alerts)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Email (alerts)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

### External Data

```env
# Polygon (alternative data source)
POLYGON_API_KEY=your_polygon_key

# Alpha Vantage
ALPHA_VANTAGE_KEY=your_av_key

# News API
NEWS_API_KEY=your_news_api_key
```

---

## Environment-Specific Configs

### Development

```env
NODE_ENV=development
ALPACA_BASE_URL=https://paper-api.alpaca.markets
OANDA_BASE_URL=https://api-fxpractice.oanda.com
LOG_LEVEL=debug
```

### Production (Paper Trading)

```env
NODE_ENV=production
ALPACA_BASE_URL=https://paper-api.alpaca.markets
OANDA_BASE_URL=https://api-fxpractice.oanda.com
LOG_LEVEL=info
```

### Production (Live Trading)

```env
NODE_ENV=production
ALPACA_BASE_URL=https://api.alpaca.markets
OANDA_BASE_URL=https://api-fxtrade.oanda.com
LOG_LEVEL=warn
```

---

## Agent-Specific Variables

### Pivot Pete

```env
# Data source
PIVOT_PETE_DATA_SOURCE=alpaca  # or 'oanda'

# Strategy parameters
ORB_RANGE_MINUTES=15
ORB_STOP_MULTIPLIER=1.5
```

### Bitcoin Bob

```env
# Crypto-specific
CRYPTO_SESSION_LENGTH=8  # hours per "session"
BTC_POSITION_LIMIT=1.0   # max BTC exposure
```

### SPX Sniper

```env
# 0DTE-specific
ZERO_DTE_MAX_TRADES=10
ZERO_DTE_CLOSE_TIME=15:45  # ET, close all positions
```

---

## Variable Reference

### Complete List

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WEBHOOK_SECRET` | Yes | - | TradingView webhook auth |
| `ACCOUNT_BALANCE` | Yes | 10000 | Starting account balance |
| `RISK_PER_TRADE` | Yes | 1 | Risk percentage per trade |
| `ALPACA_API_KEY` | Yes* | - | Alpaca API key |
| `ALPACA_SECRET_KEY` | Yes* | - | Alpaca secret key |
| `ALPACA_BASE_URL` | Yes* | paper URL | Alpaca API endpoint |
| `OANDA_API_KEY` | Yes* | - | OANDA access token |
| `OANDA_ACCOUNT_ID` | Yes* | - | OANDA account ID |
| `OANDA_BASE_URL` | Yes* | practice URL | OANDA API endpoint |
| `MAX_DAILY_LOSS_PCT` | No | 3 | Auto-stop after X% loss |
| `MAX_POSITIONS` | No | 10 | Max concurrent positions |
| `DATABASE_PATH` | No | ./swjsh.db | SQLite file path |
| `LOG_LEVEL` | No | info | debug/info/warn/error |

*Required for respective broker integrations

---

## Security Best Practices

### 1. Never Commit .env

```gitignore
# .gitignore
.env
.env.local
.env.*.local
```

### 2. Use Strong Secrets

```bash
# Generate secure webhook secret
openssl rand -hex 32
```

### 3. Rotate Keys Regularly

- Change API keys every 90 days
- Immediately rotate if compromised
- Use separate keys for paper vs live

### 4. Restrict API Key Permissions

**Alpaca**:
- Paper keys: Full access OK
- Live keys: Only enable what's needed

**OANDA**:
- Practice accounts: Full access OK
- Live accounts: Consider IP restrictions

---

## Loading Variables

### In Node.js

```typescript
// Loaded automatically by Next.js from .env
const apiKey = process.env.ALPACA_API_KEY;
```

### In Python

```python
import os
from dotenv import load_dotenv

load_dotenv()  # Load from .env file
api_key = os.environ.get('ALPACA_API_KEY')
```

### In PowerShell

```powershell
# Load .env file
Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
    }
}
```

---

## Validation

### Check Required Variables

```typescript
function validateEnv() {
  const required = [
    'WEBHOOK_SECRET',
    'ACCOUNT_BALANCE',
    'ALPACA_API_KEY',
    'ALPACA_SECRET_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}
```

### Startup Validation

Run `npm run dev` - the app will error on missing required variables.

---

## Troubleshooting

### Variables Not Loading

1. Check file is named exactly `.env` (not `.env.txt`)
2. No spaces around `=` signs
3. Restart the application after changes

### Python Not Finding Variables

```python
# Ensure dotenv is installed
pip install python-dotenv

# Load at top of script
from dotenv import load_dotenv
load_dotenv()
```

### Docker Variables

```yaml
# docker-compose.yml
services:
  app:
    env_file:
      - .env
    environment:
      - NODE_ENV=production
```

---

## Consolidated .env.example Template (2026-03-15)

> Use this as the master template for `.env.example`

```bash
# ============================================
# SwjshAlgoKnife — Unified Environment Config
# ============================================

# DATABASE (Neon PostgreSQL)
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require

# ENCRYPTION (API Key Storage)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your_64_character_hex_string_here

# WEBHOOK SECURITY
# Generate: openssl rand -hex 32
WEBHOOK_SECRET=your_secure_webhook_secret_here

# TRADING CONFIGURATION
ACCOUNT_BALANCE=10000
RISK_PER_TRADE=1

# ALPACA MARKETS (Paper Trading)
APCA_API_KEY_ID=your_alpaca_api_key_id
APCA_API_SECRET_KEY=your_alpaca_api_secret_key
APCA_API_BASE_URL=https://paper-api.alpaca.markets
APCA_DATA_URL=https://data.alpaca.markets
APCA_DATA_FEED=iex

# OANDA (Forex Practice Account)
# NOTE: Use OANDA_API_TOKEN (not OANDA_API_KEY)
OANDA_API_TOKEN=your_oanda_api_token
OANDA_ACCOUNT_ID=your_demo_account_id
OANDA_ENVIRONMENT=practice

# MARKET DATA
NEXT_PUBLIC_FINNHUB_KEY=your_finnhub_api_key

# FIREBASE (Frontend Auth)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id

# DISCORD NOTIFICATIONS (Optional)
DISCORD_CHIEF_WEBHOOK=your_discord_main_webhook_url
DISCORD_FOREX_WEBHOOK=your_discord_forex_webhook_url
DISCORD_CRYPTO_WEBHOOK=your_discord_crypto_webhook_url

# AGENT CONFIG (Optional)
PIVOT_PETE_DATA_PROVIDER=OANDA
PIVOT_PETE_FORCE_SCAN=0
```

---

## Related Pages

- [[Startup Commands]] - Using environment in startup
- [[Deployment]] - Production environment setup
- [[Troubleshooting]] - Common env issues
- [[System Architecture]] - How components use config
- [[🎯 Master Tracker]] - Env cleanup is paper trading blocker
