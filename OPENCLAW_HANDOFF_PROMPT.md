# OpenClaw Config Update — Contabo Server Handoff

## Your Task

Replace the OpenClaw config at `~/.openclaw/openclaw.json` with a new config that connects to our HQ Discord server. The current config is stale — it points to an old Discord server with old agents. We're starting fresh.

After updating the config: create agent workspace directories, copy SOUL files, set env vars, validate, and restart.

## Step 1: Back up the old config

```bash
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.bak.$(date +%s)
```

## Step 2: Find the codebase on this server

The SwjshAlgoKnife repo should be somewhere on this server. Find it:

```bash
find /root /home -maxdepth 3 -name "CLAUDE.md" -path "*/SwjshAlgoKnife/*" 2>/dev/null
```

Save whatever path comes back — you'll need it in Step 5 for SOUL files. If nothing comes back, check `/root/swjsh/` or ask Jack.

## Step 3: Write the new openclaw.json

Write this COMPLETE file to `~/.openclaw/openclaw.json`:

```json
{
  "models": {
    "providers": {
      "anthropic": {
        "baseUrl": "https://api.anthropic.com",
        "apiKey": "${ANTHROPIC_API_KEY}",
        "models": [
          {
            "id": "claude-sonnet-4-6",
            "name": "Claude Sonnet 4.6",
            "api": "anthropic-messages",
            "contextWindow": 200000,
            "maxTokens": 8096
          },
          {
            "id": "claude-haiku-4-5-20251001",
            "name": "Claude Haiku 4.5",
            "api": "anthropic-messages",
            "contextWindow": 200000,
            "maxTokens": 8096
          }
        ]
      }
    }
  },
  "channels": {
    "discord": {
      "accounts": {
        "main": {
          "token": "${DISCORD_TOKEN_CHIEF}",
          "guilds": {
            "1484377910503543068": {
              "channels": {
                "1484377912328192022": {},
                "1484382743893905468": {},
                "1484383542338125915": {},
                "1484383806889660508": {},
                "1484384117851426918": {},
                "1484389855776604171": {},
                "1484390046604722299": {},
                "1484390636504354857": {},
                "1484390857061961838": {},
                "1484391111060623371": {},
                "1484391350924480632": {},
                "1484391606256664657": {},
                "1484392326712266792": {},
                "1484392562965086420": {}
              }
            }
          }
        }
      }
    }
  },
  "bindings": [
    {
      "type": "acp",
      "agentId": "chief",
      "match": {
        "channel": "discord",
        "accountId": "main",
        "peer": { "kind": "channel", "id": "1484382743893905468" }
      },
      "acp": { "label": "chief-announcements" }
    },
    {
      "type": "acp",
      "agentId": "ops",
      "match": {
        "channel": "discord",
        "accountId": "main",
        "peer": { "kind": "channel", "id": "1484384117851426918" }
      },
      "acp": { "label": "pulse-alerts" }
    },
    {
      "type": "acp",
      "agentId": "hunter",
      "match": {
        "channel": "discord",
        "accountId": "main",
        "peer": { "kind": "channel", "id": "1484390046604722299" }
      },
      "acp": { "label": "infra-tasks" }
    },
    {
      "type": "acp",
      "agentId": "arbiter",
      "match": {
        "channel": "discord",
        "accountId": "main",
        "peer": { "kind": "channel", "id": "1484390857061961838" }
      },
      "acp": { "label": "grade-reviews" }
    },
    {
      "type": "acp",
      "agentId": "cortana",
      "match": {
        "channel": "discord",
        "accountId": "main",
        "peer": { "kind": "channel", "id": "1484391350924480632" }
      },
      "acp": { "label": "learn-patterns" }
    },
    {
      "type": "acp",
      "agentId": "scout",
      "match": {
        "channel": "discord",
        "accountId": "main",
        "peer": { "kind": "channel", "id": "1484392326712266792" }
      },
      "acp": { "label": "back-ideas" }
    }
  ],
  "agents": {
    "defaults": {
      "model": { "primary": "anthropic/claude-haiku-4-5-20251001" },
      "workspace": "/root/.openclaw/workspace",
      "heartbeat": {
        "every": "0m",
        "target": "none",
        "lightContext": true,
        "ackMaxChars": 300
      }
    },
    "list": [
      {
        "id": "chief",
        "default": true,
        "identity": { "name": "Chief", "emoji": "👑", "theme": "cyan" },
        "workspace": "/root/.openclaw/agents/chief",
        "model": { "primary": "anthropic/claude-sonnet-4-6" }
      },
      {
        "id": "ops",
        "identity": { "name": "Ops", "emoji": "🛡️", "theme": "green" },
        "workspace": "/root/.openclaw/agents/ops"
      },
      {
        "id": "hunter",
        "identity": { "name": "Hunter", "emoji": "🐛", "theme": "orange" },
        "workspace": "/root/.openclaw/agents/hunter"
      },
      {
        "id": "arbiter",
        "identity": { "name": "Arbiter", "emoji": "⚖️", "theme": "purple" },
        "workspace": "/root/.openclaw/agents/arbiter"
      },
      {
        "id": "cortana",
        "identity": { "name": "Cortana", "emoji": "🧠", "theme": "teal" },
        "workspace": "/root/.openclaw/agents/cortana"
      },
      {
        "id": "scout",
        "identity": { "name": "Scout", "emoji": "♟️", "theme": "amber" },
        "workspace": "/root/.openclaw/agents/scout"
      }
    ]
  },
  "cron": {
    "enabled": true,
    "maxConcurrentRuns": 3,
    "sessionRetention": "48h",
    "runLog": { "maxBytes": "5mb", "keepLines": 5000 }
  },
  "gateway": {
    "mode": "local",
    "auth": { "token": "${OPENCLAW_GATEWAY_TOKEN}" },
    "bind": "loopback",
    "port": 3001
  }
}
```

## Step 4: Create workspace directories and cron folder

```bash
mkdir -p /root/.openclaw/agents/{chief,ops,hunter,arbiter,cortana,scout}
mkdir -p /root/.openclaw/cron
```

## Step 5: Copy SOUL files

Using the codebase path you found in Step 2:

```bash
REPO="<path from step 2>/Library/agent-souls"

cp "$REPO/CHIEF_SOUL.md"   /root/.openclaw/agents/chief/SOUL.md
cp "$REPO/OPS_SOUL.md"     /root/.openclaw/agents/ops/SOUL.md
cp "$REPO/HUNTER_SOUL.md"  /root/.openclaw/agents/hunter/SOUL.md
cp "$REPO/ARBITER_SOUL.md" /root/.openclaw/agents/arbiter/SOUL.md
cp "$REPO/CORTANA_SOUL.md" /root/.openclaw/agents/cortana/SOUL.md
cp "$REPO/SCOUT_SOUL.md"   /root/.openclaw/agents/scout/SOUL.md
```

Verify they landed:

```bash
for agent in chief ops hunter arbiter cortana scout; do
  test -f "/root/.openclaw/agents/$agent/SOUL.md" && echo "$agent: OK" || echo "$agent: MISSING"
done
```

## Step 6: Set environment variables

Check what's already in `/root/.openclaw/.env`:

```bash
cat /root/.openclaw/.env 2>/dev/null || echo "No .env file exists yet"
```

You need these three vars set (add any that are missing):

```env
ANTHROPIC_API_KEY=<the Anthropic API key — should already be set if OpenClaw was running before>
DISCORD_TOKEN_CHIEF=<Chief Discord bot token — check /root/.env.discord or the Discord Developer Portal>
OPENCLAW_GATEWAY_TOKEN=<generate fresh: openssl rand -hex 32>
```

To find the Chief bot token if you don't have it:

```bash
grep -i "chief\|DISCORD.*TOKEN" /root/.env* 2>/dev/null
```

If nothing turns up, Jack will need to grab it from https://discord.com/developers/applications (Chief app → Bot → Token).

## Step 7: Validate and restart

```bash
# Validate JSON
python3 -m json.tool ~/.openclaw/openclaw.json > /dev/null && echo "JSON valid" || echo "JSON BROKEN — fix syntax before proceeding"

# Stop old instance
openclaw stop 2>/dev/null

# Start fresh
openclaw start

# Check status
openclaw status
```

If `openclaw start` fails, check:

```bash
# Most common issue:
cat ~/.openclaw/openclaw.json | python3 -c "import sys,json; json.load(sys.stdin); print('JSON OK')"

# Check logs
openclaw logs --tail 50
```

## Channel Reference (for your awareness)

These are the Discord channel IDs used in the config above:

```
Guild: 1484377910503543068 (HQ server)

#general              = 1484377912328192022
#chief-announcements  = 1484382743893905468   ← Chief binding
#daily-standup        = 1484383542338125915
#team-meetings        = 1484383806889660508
#pulse-alerts         = 1484384117851426918   ← Ops binding
#pulse-log            = 1484389855776604171
#infra-tasks          = 1484390046604722299   ← Hunter binding
#infra-log            = 1484390636504354857
#grade-reviews        = 1484390857061961838   ← Arbiter binding
#grade-reports        = 1484391111060623371
#learn-patterns       = 1484391350924480632   ← Cortana binding
#learn-insights       = 1484391606256664657
#back-ideas           = 1484392326712266792   ← Scout binding
#back-sprint          = 1484392562965086420
```

## Design Note: Bot Identity

This config uses Chief's bot token as the single Discord connection. That means when any agent posts via OpenClaw, it appears as "Chief" in Discord. This is fine for now — the cron job delivery messages identify which agent is speaking in the content. Later, if Jack wants each agent to post as their own bot (separate avatars), we'll set up Discord webhooks through n8n for outbound messages and keep OpenClaw for inbound listening only.

## What NOT to do

- Do NOT put cron jobs inside `openclaw.json` — they go in `~/.openclaw/cron/jobs.json` (separate file, we'll set those up later)
- Do NOT remove `"mode": "local"` from gateway — OpenClaw refuses to start without it
- Do NOT add `inputTypes` to model objects — it's not a valid field and causes validation errors
- Do NOT use Windows paths — this is a Linux server, use `/root/.openclaw/...`
