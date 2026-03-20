# SwjshAK Reactive Workflows

Production-ready n8n workflows for autonomous trading operations.

---

## Workflow Overview

| ID | Name | Nodes | Triggers | Purpose |
|----|------|-------|----------|---------|
| WF-P01 | Trade Grading Pipeline | 27 | Webhook | Grade every closed trade using AI |
| WF-S02 | Self-Healing Incident Response | 38 | Webhook + Schedule (2 min) | Auto-remediate system issues |
| WF-P02 | Code Review Pipeline | 22 | Webhook + Schedule (daily) | AI code review for PRs |
| WF-SC01 | Pattern Detection Processor | 20 | Schedule (5 PM ET) | Discover trading patterns |

---

## Webhook URLs

After deploying to n8n, these webhooks will be available:

| Workflow | Path | Method | Auth |
|----------|------|--------|------|
| Trade Grading | `/webhook/trade-closed` | POST | Header: X-Webhook-Secret |
| Incident Response | `/webhook/alert` | POST | Header: X-Webhook-Secret |
| Code Review | `/webhook/code-review` | POST | Header: X-Webhook-Secret |

### Example Webhook Payloads

**Trade Closed (WF-P01):**
```json
{
  "id": "trade-123",
  "symbol": "BTCUSD",
  "side": "buy",
  "entry_price": 67000,
  "exit_price": 68500,
  "entry_time": "2026-03-20T10:30:00Z",
  "exit_time": "2026-03-20T14:45:00Z",
  "realized_pnl": 1500,
  "strategy": "ORB",
  "agent_id": "bitcoin_bob"
}
```

**Alert (WF-S02):**
```json
{
  "type": "agent_unresponsive",
  "component": "bitcoin_bob",
  "componentName": "Bitcoin Bob",
  "severity": "P2",
  "message": "Agent unresponsive for 10 minutes",
  "context": {
    "lastHeartbeat": "2026-03-20T14:30:00Z"
  }
}
```

**PR Opened (WF-P02):**
GitHub webhook payload (pull_request event) or:
```json
{
  "pull_request": {
    "number": 42,
    "title": "Add new strategy",
    "user": { "login": "developer" },
    "head": { "ref": "feature/new-strategy" },
    "base": { "ref": "main" },
    "html_url": "https://github.com/org/repo/pull/42"
  }
}
```

---

## Required Credentials

Configure these in n8n before deploying:

### 1. Webhook Header Auth
- **Name:** `Webhook Header Auth`
- **Header Name:** `X-Webhook-Secret`
- **Header Value:** Your secret (match `WEBHOOK_SECRET` env var)

### 2. Discord Bot
- **Name:** `Discord Bot`
- **Bot Token:** Your Discord bot token
- Required permissions: Send Messages, Embed Links, Mention Everyone

### 3. Jira Cloud API
- **Name:** `Jira Cloud`
- **Email:** Your Atlassian email
- **API Token:** Generate at https://id.atlassian.com/manage-profile/security/api-tokens
- **Domain:** your-domain.atlassian.net

### 4. GitHub API
- **Name:** `GitHub API`
- **Access Token:** Personal access token with `repo` scope

---

## Environment Variables

Set these in n8n or your deployment:

```env
# Discord Channels
DISCORD_WINS_CHANNEL=<channel-id>
DISCORD_TRADES_CHANNEL=<channel-id>
DISCORD_ALERTS_CHANNEL=<channel-id>
DISCORD_CHIEF_CHANNEL=<channel-id>
DISCORD_SYSTEM_CHANNEL=<channel-id>
DISCORD_STANDUP_CHANNEL=<channel-id>

# GitHub
GITHUB_OWNER=your-org
GITHUB_REPO=SwjshAlgoKnife

# APIs
POLYGON_API_KEY=your-polygon-key
ANTHROPIC_API_KEY=your-anthropic-key

# n8n
N8N_WEBHOOK_BASE=https://your-n8n.example.com
```

---

## Jira Projects

These workflows create tickets in specific Jira projects:

| Project | Purpose | Workflows |
|---------|---------|-----------|
| **GRADE** | Trade and code review records | WF-P01, WF-P02 |
| **LEARN** | Lessons, hypotheses, patterns | WF-P01, WF-SC01 |
| **INFRA** | System improvements, confirmed patterns | WF-P01, WF-SC01 |
| **PULSE** | Incidents, escalations | WF-S02 |

Create these projects in Jira before deploying.

---

## Deployment Steps

1. **Import Workflow:**
   - Open n8n
   - Go to Workflows > Import from File
   - Select the JSON file

2. **Configure Credentials:**
   - Go to Credentials in the workflow
   - Connect each credential node to your configured credentials

3. **Set Environment Variables:**
   - Go to Settings > Variables
   - Add all required env vars

4. **Test Manually:**
   - Open workflow
   - Click "Test Workflow"
   - Provide sample input data

5. **Activate:**
   - Toggle workflow to Active
   - For webhook workflows: Copy the production webhook URL

---

## Workflow Details

### WF-P01: Trade Grading Pipeline

**Flow:**
1. Receive trade closed webhook
2. Validate trade data (reject invalid)
3. Fetch context in parallel:
   - Strategy rules
   - Market data at entry
   - VIX at entry
   - Similar past trades
4. Build analysis prompt with all context
5. Call OpenClaw Professor for AI grading
6. Parse grade (A through F)
7. Route by grade:
   - A/A-: Post to #wins
   - B range: Post to #trades
   - C range: Post to #trades + LEARN ticket
   - D/F: Alert #alerts + HIGH priority LEARN ticket
8. Check for recurring patterns -> INFRA ticket
9. Store grade in database
10. Create GRADE ticket
11. Return grade summary

**Error Handling:**
- Invalid data: 400 response with error
- API failures: Continue with partial data
- AI parsing failure: Default to grade C

---

### WF-S02: Self-Healing Incident Response

**Flow:**
1. Dual trigger: Webhook alerts + 2-min health check
2. For scheduled: Fetch system health, detect issues
3. For webhook: Normalize alert format
4. Classify severity (P1/P2/P3/P4)
5. Determine fix capability and strategy
6. If can auto-fix:
   - Execute fix (restart agent, clear cache, etc.)
   - Wait 30 seconds
   - Verify fix
   - If failed: Check retry count
   - If retries exhausted: Escalate
7. If cannot auto-fix: Mark for escalation
8. Aggregate results
9. If escalations:
   - Alert #chief Discord
   - Create PULSE ticket
   - If P1/P2: Trigger post-mortem workflow
10. Log incident to database

**Auto-Fix Strategies:**
- `restart_agent`: POST /api/control with restart command
- `restart_service`: Docker restart
- `clear_cache`: Cache invalidation
- `reconnect_broker`: Broker reconnection

**Retry Logic:**
- P1: 3 retries, 30s delay
- P2: 2 retries, 45s delay
- P3: 1 retry, 60s delay

---

### WF-P02: Code Review Pipeline

**Flow:**
1. Dual trigger: PR webhook + daily scan at 9 AM
2. For scheduled: Fetch open PRs, filter unreviewed
3. Fetch changed files from GitHub
4. Categorize files (TypeScript, Python, config, tests)
5. Build comprehensive review prompt
6. Call OpenClaw Professor for AI review
7. Parse review response
8. If critical issues:
   - Post REQUEST_CHANGES review to GitHub
   - Alert #chief Discord
9. Else:
   - Post APPROVE or COMMENT review
10. Add `ai-reviewed` label
11. Create GRADE ticket
12. Post summary to #system Discord

**Review Criteria:**
- Code quality
- Security concerns
- Trading logic correctness
- Error handling
- Performance
- Test coverage

---

### WF-SC01: Pattern Detection Processor

**Flow:**
1. Schedule: Daily at 5 PM ET (after market close)
2. Fetch last 30 days of trades
3. Group by analysis dimensions:
   - Hour of day
   - Day of week
   - Strategy
   - Symbol
   - Trade duration
   - Market session
   - P&L range
   - Win/loss streaks
4. Calculate statistical metrics:
   - Z-score for proportion test
   - p-value for significance
5. Filter significant patterns (p < 0.05)
6. Build AI analysis prompt
7. Call Claude for pattern validation
8. Fetch existing hypotheses from DB
9. Process patterns:
   - New: Create LEARN ticket + store hypothesis
   - Existing: Update confirmation count
   - Confirmed 3+ weeks: Create INFRA ticket
10. Post discoveries to #daily-standup

**Statistical Methods:**
- Z-score compares group win rate to base rate
- Significance at 95% confidence (z > 1.96)
- Minimum 5 trades per group
- AI validates to avoid false positives
- 3-week confirmation period required

---

## Error Workflow

Create a global error handler workflow and set it in each workflow's settings:

```
Settings > Error Workflow > Select "Global Error Handler"
```

The error handler should:
1. Format error details
2. Post to #system Discord
3. Create PULSE ticket if critical
4. Log to error database

---

## Testing

### Manual Testing

1. **Trade Grading:**
   ```bash
   curl -X POST http://localhost:5678/webhook/trade-closed \
     -H "Content-Type: application/json" \
     -H "X-Webhook-Secret: your-secret" \
     -d '{"id":"test-1","symbol":"BTCUSD","side":"buy","entry_price":67000,"exit_price":68500,"entry_time":"2026-03-20T10:30:00Z","exit_time":"2026-03-20T14:45:00Z","realized_pnl":1500,"strategy":"ORB"}'
   ```

2. **Incident Alert:**
   ```bash
   curl -X POST http://localhost:5678/webhook/alert \
     -H "Content-Type: application/json" \
     -H "X-Webhook-Secret: your-secret" \
     -d '{"type":"agent_stale","component":"test_agent","severity":"P3","message":"Test alert"}'
   ```

### Validation

Before deploying, validate each workflow:
```bash
# Use n8n CLI or API
n8n workflow:validate --input WF-P01-trade-grading.json
```

---

## Monitoring

After deployment, monitor:

1. **n8n Executions:** Check for failed executions daily
2. **Discord Channels:** Verify messages are posting correctly
3. **Jira:** Verify tickets are being created
4. **Database:** Check grades and patterns are being stored

Set up alerts for:
- Workflow execution failures
- No activity for 24+ hours (scheduled workflows)
- High error rate

---

## Maintenance

### Weekly
- Review failed executions
- Check hypothesis confirmation progress
- Verify credential validity

### Monthly
- Review pattern detection accuracy
- Tune statistical thresholds if needed
- Update AI prompts based on feedback

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-20 | Initial production release |

---

*Generated for SwjshAK Autonomous Trading Platform*
