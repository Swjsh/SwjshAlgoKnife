# SwjshAK Chief — openclaw Setup Guide

This folder contains a complete openclaw configuration for the SwjshAK trading platform.
Copy files to the locations below. Fill in your credentials. Chief will be live.

> ⚠️ **Regenerate your Discord bot token immediately.** It was shared in a chat session.
> Go to https://discord.com/developers/applications → your app → Bot → Reset Token.
> Paste the new token into `.env` before running openclaw.

---

## Step 1 — Install openclaw (if not already done)

```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

Skip the interactive wizard — we have a pre-built config. Just install and stop.

---

## Step 2 — Create a Discord Bot

Your Discord bot (Chief) is already created. You just need to **regenerate the token** since it was shared in chat.

1. Go to https://discord.com/developers/applications
2. Open your existing **Chief** app
3. Go to **Bot** tab → click **Add Bot** → **Reset Token** → copy the token
4. Under **Privileged Gateway Intents**, enable:
   - ✅ Server Members Intent
   - ✅ Message Content Intent
5. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Read Messages/View Channels`, `Embed Links`, `Read Message History`
6. Copy the generated URL and open it in your browser to invite the bot to your server

Your Discord channels are already configured. The mapping is:
- `#chief` (1465522015095099549) — Chief talks to you here, you talk to Chief
- `#forex` (1467174412615942186) — Sterling's channel. FX alerts, zone updates, session closes.
- `#crypto` (1467174512377200640) — Bitcoin Bob's channel. Crypto zone alerts only.

**Enable Developer Mode in Discord:** Settings → Advanced → Developer Mode ON
Then right-click your server name → **Copy Server ID**
Right-click each channel → **Copy Channel ID**

---

## Step 3 — Fill In Your Credentials

Open `openclaw-setup/.env` and fill in every value:

```env
ANTHROPIC_API_KEY=sk-ant-...         # Your Anthropic API key
DISCORD_BOT_TOKEN=...                # Bot token from Step 2
DISCORD_GUILD_ID=...                 # Server ID
DISCORD_MAIN_CHANNEL_ID=...          # #jarvis-main channel ID
DISCORD_ALERTS_CHANNEL_ID=...        # #jarvis-alerts channel ID
DISCORD_TRADES_CHANNEL_ID=...        # #jarvis-trades channel ID
OPENCLAW_GATEWAY_TOKEN=...           # Generate: openssl rand -hex 32
```

---

## Step 4 — Deploy the Files

Copy everything to the correct locations:

### Main config + env
```
openclaw-setup/openclaw.json  →  C:\Users\jackw\.openclaw\openclaw.json
openclaw-setup/.env           →  C:\Users\jackw\.openclaw\.env
```

### Jarvis workspace (main agent)
```
openclaw-setup/workspace/SOUL.md    →  C:\Users\jackw\.openclaw\workspace\SOUL.md
openclaw-setup/workspace/USER.md    →  C:\Users\jackw\.openclaw\workspace\USER.md
openclaw-setup/workspace/AGENTS.md  →  C:\Users\jackw\.openclaw\workspace\AGENTS.md
openclaw-setup/workspace/TOOLS.md   →  C:\Users\jackw\.openclaw\workspace\TOOLS.md
openclaw-setup/workspace/MEMORY.md  →  C:\Users\jackw\.openclaw\workspace\MEMORY.md
```

### Sub-agent workspaces
```
openclaw-setup/agents/overseer/SOUL.md      →  C:\Users\jackw\.openclaw\agents\overseer\SOUL.md
openclaw-setup/agents/professor/SOUL.md     →  C:\Users\jackw\.openclaw\agents\professor\SOUL.md
openclaw-setup/agents/sterling/SOUL.md      →  C:\Users\jackw\.openclaw\agents\sterling\SOUL.md
openclaw-setup/agents/bitcoin-bob/SOUL.md   →  C:\Users\jackw\.openclaw\agents\bitcoin-bob\SOUL.md
openclaw-setup/agents/pivot-pete/SOUL.md    →  C:\Users\jackw\.openclaw\agents\pivot-pete\SOUL.md
openclaw-setup/agents/boba/SOUL.md          →  C:\Users\jackw\.openclaw\agents\boba\SOUL.md
openclaw-setup/agents/spx-sniper/SOUL.md    →  C:\Users\jackw\.openclaw\agents\spx-sniper\SOUL.md
```

**PowerShell one-liner** (run from SwjshAlgoKnife root):
```powershell
# Create directories
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.openclaw\workspace"
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.openclaw\workspace\memory"
foreach ($agent in @('overseer','professor','sterling','bitcoin-bob','pivot-pete','boba','spx-sniper')) {
    New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.openclaw\agents\$agent"
}

# Copy config files
Copy-Item "openclaw-setup\openclaw.json" "$env:USERPROFILE\.openclaw\openclaw.json"
Copy-Item "openclaw-setup\.env" "$env:USERPROFILE\.openclaw\.env"
Copy-Item "openclaw-setup\workspace\*" "$env:USERPROFILE\.openclaw\workspace\" -Recurse

# Copy sub-agent SOUL files
foreach ($agent in @('overseer','professor','sterling','bitcoin-bob','pivot-pete','boba','spx-sniper')) {
    Copy-Item "openclaw-setup\agents\$agent\SOUL.md" "$env:USERPROFILE\.openclaw\agents\$agent\SOUL.md"
}

Write-Host "Done. Fill in .env then run: openclaw start"
```

---

## Step 5 — Start Jarvis

```bash
openclaw start
```

openclaw will:
1. Load `openclaw.json`
2. Read env vars from `.env`
3. Connect to Discord using your bot token
4. Start the cron scheduler (8 AM briefing, hourly heartbeat, etc.)
5. Jarvis will send a startup message to `#jarvis-main`

---

## Cron Schedule Summary

| Job | Schedule | Agent | Channel | What it does |
|---|---|---|---|---|
| Heartbeat | Every hour, Mon–Fri | Chief | #chief | Quick system pulse, surface anomalies only |
| Morning Briefing | 8:00 AM ET, Mon–Fri | Chief | #chief | Pre-market check, yesterday's PnL, today's macro |
| London Open | 3:00 AM ET, Mon–Fri | Sterling | #forex | FX landscape check, GBP/USD daily bias |
| NY Overlap | 8:30 AM ET, Mon–Fri | Sterling | #forex | Best FX liquidity window — active zones |
| Market Open | 9:30 AM ET, Mon–Fri | Chief | #chief | Confirm all agents active, early signals |
| FX Scan | Every 2 hours, Mon–Fri | Sterling | #forex | Zone scan — posts ONLY if something changed |
| Midday Check | 12:00 PM ET, Mon–Fri | Chief | #chief | Morning PnL, Sterling 4h window close status |
| Sterling Close | 12:00 PM ET, Mon–Fri | Sterling | #forex | Set-and-forget window close, session PnL |
| EOD Grade | 4:15 PM ET, Mon–Fri | Professor | #chief | Grade all today's trades A–F |
| EOD Risk | 4:30 PM ET, Mon–Fri | Overseer | #chief | Kill switch check, drawdown audit |
| BTC Watch | Every 4 hours, 24/7 | Bitcoin Bob | #crypto | Impulse zone scan — posts only on signal |
| Weekly Review | 6:00 PM ET, Sunday | Chief | #chief | Full week stats, FX/crypto breakdown, next week prep |

---

## Talking to Chief

Once running, type in your `#chief` Discord channel:

```
Chief, what's today's PnL?
Chief, run a system check
What did Sterling do today?
Professor, grade my last trade
Overseer, what's the drawdown?
Bob, anything happening with BTC?
Show me all active agents
```

Chief responds in #chief. Sterling responds in #forex. Bitcoin Bob in #crypto.

---

## Discord Webhook vs Discord Bot

You have **two Discord integrations**:

| | `DISCORD_CHIEF_WEBHOOK` | `DISCORD_BOT_TOKEN` |
|---|---|---|
| Location | SwjshAlgoKnife `.env.local` | openclaw `.env` |
| Direction | One-way: app → Discord | Two-way: Jarvis listens + talks |
| Used by | TradeExecutor, TheProfessor (code) | openclaw cron jobs + chat |
| Format | Webhook POST | Bot message via Discord gateway |

Both coexist — the app fires webhook alerts when trades happen, openclaw Jarvis handles the autonomous monitoring and conversation.

---

## Troubleshooting

**Jarvis isn't responding in Discord:**
- Check bot is invited to the server with correct permissions
- Confirm `DISCORD_BOT_TOKEN` in `.env` is correct
- Confirm `DISCORD_GUILD_ID` and channel IDs are correct
- Run `openclaw logs` to see connection errors

**Cron jobs not firing:**
- Check `openclaw.json` has `"cron": { "enabled": true }`
- Timezone is set to `"America/New_York"` — confirm system time is correct
- Run `openclaw cron:list` to see scheduled jobs

**"Cannot read agents_db.json":**
- Make sure the SwjshAlgoKnife project path in the cron prompts matches where the project is actually installed
- Update the paths in `openclaw.json` cron job prompts if the project is in a different location
