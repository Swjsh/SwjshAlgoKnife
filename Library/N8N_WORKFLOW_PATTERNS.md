# n8n Production Workflow Patterns

**Created**: 2026-03-20
**Purpose**: Comprehensive research on production-quality n8n workflows based on real template analysis
**Status**: Reference document for building complex SwjshAK automations

---

## Executive Summary

After extensive research of n8n's template library and node documentation, this document captures what **real production workflows** look like. The previous 47 workflow concepts were shallow 4-step ideas. Real n8n workflows are:

- **15-50+ nodes** (not 3-4)
- **Multi-branch with error handling**
- **Heavy use of Code nodes for data transformation**
- **Wait nodes for async operations**
- **Merge nodes to combine parallel data streams**
- **Extensive filtering and validation**

---

## Part 1: Template Analysis

### Template 3442: Fully Automated AI Video Generation (51 nodes)

**URL**: https://n8n.io/workflows/3442
**Complexity**: Very High (51 nodes, multi-branch, retry logic)

#### Node Breakdown

| Node Type | Count | Purpose |
|-----------|-------|---------|
| `httpRequest` | 13 | API calls to PiAPI, Creatomate, upload-post |
| `wait` | 5 | Poll for async job completion (3min, 5min, 10min) |
| `code` | 6 | Data transformation, list building, token calculation |
| `openAi` | 5 | Generate captions, prompts, scripts, audio extraction |
| `if` | 3 | Fail checks, validation |
| `merge` | 2 | Combine video clips with audio |
| `googleDrive` | 4 | Upload/permission management |
| `googleSheets` | 2 | Load input, update output |
| `discord` | 1 | Final notification |
| `scheduleTrigger` | 1 | Daily execution |
| `set` | 1 | API key configuration |
| `stickyNote` | 7 | Documentation |
| `readBinaryFile` | 1 | Read video for upload |
| `writeBinaryFile` | 1 | Save video locally |

#### Key Patterns Observed

1. **Async Job Polling Pattern**
```
[Start Job] -> [Wait 3min] -> [Check Status] -> [If Failed] -> [Wait to Retry] -> [Retry]
                                             -> [If Success] -> [Continue]
```

2. **Parallel Processing with Merge**
```
[Trigger] -> [Generate Captions] -> [Create List] --------> [Merge: Match captions with videos]
          -> [Generate Images] -> [Image to Video] ------> [Merge]
          -> [Generate Script] -> [Generate Voice] -------> [Merge: Pair Videos with Audio]
```

3. **Multi-Stage Retry Logic**
```javascript
// In "Fail check" node
{
  "conditions": {
    "string": [{
      "value1": "={{ $json.status }}",
      "operation": "equals",
      "value2": "failed"
    }]
  }
}
// Output 0 -> Retry path
// Output 1 -> Success path
```

---

### Template 5706: BTC & ETH Market Analysis (56 nodes)

**URL**: https://n8n.io/workflows/5706
**Complexity**: Very High (56 nodes, massive parallel RSS aggregation)

#### Hunterure Pattern

```
[Schedule Trigger]
    |
    +-> [RSS Feed 1: Google BTC] ----+
    +-> [RSS Feed 2: Cointelegraph] -+
    +-> [RSS Feed 3: NewsBTC] -------+
    +-> [RSS Feed 4: Bitcoinist] ----+---> [Merge (10 inputs)] -> [Date Filter] -> [Keyword Filter]
    +-> [RSS Feed 5: Cryptoslate] ---+                                                    |
    +-> [RSS Feed 6: CryptoNews] ----+                                                    v
    +-> [RSS Feed 7: CryptoBriefing] +                                           [Code: Organize]
    +-> [RSS Feed 8: ActionForex] ---+                                                    |
    +-> [RSS Feed 9: DailyForex] ----+                                                    v
    +-> [RSS Feed 10: Another] ------+                                    [AI Agent: Sentiment Analyst]
                                                                                          |
                                                                          +---------------+---------------+
                                                                          |                               |
                                                                    [Telegram]                      [Discord]
```

#### Key Patterns

1. **Massive Parallel Fan-Out**: Single trigger spawns 20 parallel RSS reads
2. **Multi-Input Merge**: Merge node with 10 inputs combining all feeds
3. **Cascading Filters**: Date filter -> Keyword filter -> Code transformation
4. **Dual Output**: Same analysis sent to both Telegram and Discord

#### Code Node: Data Organization
```javascript
// Organize Content For GPT node
const items = $input.all();
const organized = items.map(item => ({
  title: item.json.title,
  link: item.json.link,
  pubDate: item.json.pubDate,
  source: item.json.feedUrl?.split('/')[2] || 'unknown'
}));

// Group by source, limit per source
const grouped = {};
organized.forEach(item => {
  if (!grouped[item.source]) grouped[item.source] = [];
  if (grouped[item.source].length < 5) {
    grouped[item.source].push(item);
  }
});

return [{
  json: {
    articles: Object.values(grouped).flat(),
    totalCount: organized.length,
    timestamp: new Date().toISOString()
  }
}];
```

---

### Template 5629: Multi-Channel Error Alerts (8 nodes)

**URL**: https://n8n.io/workflows/5629
**Complexity**: Medium (8 nodes, but demonstrates error handling pattern)

#### Error Handling Pattern

```
[Error Trigger] -> [Code: Format Error] -> [Telegram]
                                        -> [Gmail]
                                        -> [Discord] (disabled)
                                        -> [Slack] (disabled)
                                        -> [WhatsApp] (disabled)
```

#### Error Formatting Code
```javascript
const errorData = $input.first().json;
const execution = errorData.execution;
const workflow = errorData.workflow;
const error = execution.error;

const message = `🚨 <b>WORKFLOW ERROR</b>\n\n` +
  `📋 Workflow: <b>${workflow.name}</b>\n` +
  `⚙️ Node: <code>${error.node.name}</code>\n` +
  `❌ Error: <code>${error.message}</code>\n` +
  `📝 Description: <i>${error.description}</i>\n` +
  `🕐 Time: ${new Date(error.timestamp).toLocaleString()}\n` +
  `🔍 Execution: <a href="${execution.url}">${execution.id}</a>\n` +
  `⚠️ Level: ${error.level.toUpperCase()}`;

return {
  message: message,
  parse_mode: 'HTML',
  chat_id: '621412350'
};
```

---

## Part 2: Node Deep Dive

### Critical Nodes for SwjshAK

#### 1. Schedule Trigger
```yaml
purpose: Cron-based workflow execution
key_options:
  - Seconds/Minutes/Hours/Days/Weeks/Months intervals
  - Custom cron expression: "*/5 * * * *" (every 5 min)
  - Multiple trigger rules in single node

common_patterns:
  - Market hours only: "0 9-16 * * 1-5" (9am-4pm weekdays)
  - Daily reports: "0 17 * * 1-5" (5pm weekdays)
  - Health checks: "*/2 * * * *" (every 2 minutes)

gotchas:
  - Uses n8n server timezone, NOT workflow timezone
  - Workflow must be ACTIVE for triggers to fire
  - Variables in cron only evaluated on workflow activation
```

#### 2. Webhook
```yaml
purpose: Receive HTTP requests to trigger workflows
key_options:
  HTTP_methods: [GET, POST, PUT, PATCH, DELETE, HEAD]
  authentication: [None, Basic, Header, JWT]
  respond_modes:
    - Immediately (returns "Workflow started")
    - When Last Node Finishes (returns final data)
    - Using Respond to Webhook node (custom response)

security:
  - Use Header Auth with X-Webhook-Secret
  - IP whitelist option available
  - Max payload: 16MB (configurable via N8N_PAYLOAD_SIZE_MAX)

expression_for_path: "={{ $execution.id }}"  # Dynamic paths

common_patterns:
  tradingview_alerts:
    path: /tradingview/{{strategy}}
    method: POST
    auth: Header (X-Webhook-Secret)

  health_check:
    path: /health
    method: GET
    respond: Immediately
```

#### 3. HTTP Request
```yaml
purpose: Call external APIs
key_options:
  methods: [GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS]
  authentication: [Predefined Credential, Generic Credentials]
  body_types: [JSON, Form-URLencoded, Form-Data, Binary, Raw]

advanced_features:
  pagination:
    modes: [Update Parameter, Response Contains Next URL]
    built_in_variables:
      - $pageCount
      - $response (previous response)
      - $request (current request config)

  batching:
    items_per_batch: 10
    batch_interval_ms: 1000  # Rate limit protection

  response_options:
    include_headers: true
    never_error: true  # Don't fail on 4xx/5xx
    response_format: [Autodetect, JSON, Text, File]

common_patterns:
  claude_api_call:
    url: "https://api.anthropic.com/v1/messages"
    method: POST
    headers:
      x-api-key: "={{$credentials.anthropicApi.apiKey}}"
      anthropic-version: "2024-06-01"
    body:
      model: "claude-3-5-sonnet-20241022"
      max_tokens: 1024
      messages: "={{ $json.messages }}"
```

#### 4. If Node
```yaml
purpose: Binary conditional branching
outputs:
  - Output 0: TRUE branch
  - Output 1: FALSE branch

condition_types:
  string: [equals, not_equals, contains, starts_with, ends_with, regex]
  number: [equals, not_equals, gt, lt, gte, lte]
  boolean: [true, false]
  dateTime: [before, after, equals]

combining_conditions:
  - AND: All conditions must match
  - OR: Any condition can match
  - Cannot mix AND/OR in single If node (use nested If)

expression_examples:
  check_status: "={{ $json.status === 'success' }}"
  check_array_length: "={{ $json.items.length > 0 }}"
  check_time_window: "={{ new Date().getHours() >= 9 && new Date().getHours() < 16 }}"
```

#### 5. Switch Node
```yaml
purpose: Multi-path routing (more than 2 branches)
modes:
  rules: Build matching rules for each output
  expression: Write expression returning output index

key_options:
  fallback_output: [None, Extra Output, Output 0]
  send_to_all_matching: true/false

example_trading_router:
  rules:
    - output_0: $json.type === 'entry'
    - output_1: $json.type === 'exit'
    - output_2: $json.type === 'alert'
    - output_3: $json.type === 'error'
  fallback: Extra Output (unknown types)
```

#### 6. Code Node
```yaml
purpose: JavaScript execution for data transformation
modes:
  - Run Once for All Items (aggregate)
  - Run Once for Each Item (transform each)

built_in_variables:
  $input.all()      # All input items
  $input.first()    # First input item
  $input.item       # Current item (in each-item mode)
  $json             # Current item's JSON data
  $binary           # Current item's binary data
  $env              # Environment variables
  $now              # Current datetime
  $today            # Current date
  $execution.id     # Execution ID
  $workflow.id      # Workflow ID

return_format:
  single_item: "return { json: { key: 'value' } }"
  multiple_items: "return [{ json: {...} }, { json: {...} }]"
  with_binary: "return { json: {...}, binary: { data: {...} } }"

example_aggregate:
  |
  const items = $input.all();
  const total = items.reduce((sum, item) => sum + item.json.pnl, 0);
  const winners = items.filter(i => i.json.pnl > 0).length;

  return {
    json: {
      totalPnL: total,
      winRate: (winners / items.length * 100).toFixed(1) + '%',
      tradeCount: items.length
    }
  };
```

#### 7. Wait Node
```yaml
purpose: Pause execution, poll for async jobs
resume_conditions:
  - After Time Interval (seconds/minutes/hours/days)
  - At Specified Time (datetime picker)
  - On Webhook Call (external signal)
  - On Form Submitted (user input)

async_polling_pattern:
  # Common for APIs that return job IDs
  1. Start job -> Get job_id
  2. Wait 30 seconds
  3. Check job status
  4. If not done -> Wait again (retry limit!)
  5. If done -> Continue

webhook_resume:
  url: "={{ $execution.resumeUrl }}"  # Built-in resume URL
  auth: [Basic, Header, JWT]
  timeout_limit: true  # Auto-resume after X time

important_notes:
  - Waits < 65 seconds keep process alive
  - Waits >= 65 seconds persist to database
  - Uses n8n server timezone
```

#### 8. Merge Node
```yaml
purpose: Combine data from multiple branches
modes:
  append:
    description: Keep all data from all inputs (like UNION)
    inputs: 2+ (configurable in v1.49+)

  combine:
    matching_fields:
      description: Join on field values (like SQL JOIN)
      output_types:
        - Keep Matches (INNER JOIN)
        - Keep Non-Matches
        - Keep Everything (OUTER JOIN)
        - Enrich Input 1 (LEFT JOIN)
        - Enrich Input 2 (RIGHT JOIN)

    position:
      description: Combine by index position

    all_combinations:
      description: Cartesian product

  sql_query:
    description: Write SQL to join data
    example: "SELECT * FROM input1 LEFT JOIN input2 ON input1.id = input2.trade_id"

  choose_branch:
    description: Pick one input, ignore others
    options: [Input 1, Input 2, Empty Item]

common_patterns:
  parallel_api_enrichment:
    # Fetch base data
    # PARALLEL: Fetch market data, Fetch strategy rules, Fetch historical context
    # Merge all by trade_id
```

#### 9. Loop Over Items (Split in Batches)
```yaml
purpose: Process items in batches with controlled iteration
key_parameters:
  batch_size: 1  # Items per iteration

outputs:
  ⚠️ CRITICAL - Counterintuitive indexing:
  - Output 0 ("done"): Final processed data when loop completes
  - Output 1 ("loop"): Current batch during iteration

connection_pattern:
  [Loop Node Output 1] -> [Processing Nodes] -> [Back to Loop Node]
  [Loop Node Output 0] -> [Post-Loop Nodes]

useful_expressions:
  remaining_items: "={{ $node['Loop Over Items'].context['noItemsLeft'] }}"
  current_index: "={{ $node['Loop Over Items'].context['currentRunIndex'] }}"

common_patterns:
  rate_limited_api:
    batch_size: 1
    add_wait_node: 2 seconds between items
```

#### 10. Error Trigger
```yaml
purpose: Catch errors from other workflows
setup:
  1. Create error workflow with Error Trigger
  2. In target workflow: Settings -> Error Workflow -> Select error workflow

error_data_structure:
  execution:
    id: "execution_id"
    url: "https://n8n.example.com/execution/123"
    error:
      message: "Error message"
      description: "Detailed description"
      node:
        name: "Node that failed"
        type: "nodeType"
      timestamp: "ISO date"
      level: "error|warning"
  workflow:
    id: "workflow_id"
    name: "Workflow name"

important_notes:
  - Error workflows don't need to be activated
  - Can't test manually (only fires on real errors)
  - Use Stop And Error node to send custom error data
```

#### 11. Discord Node
```yaml
purpose: Send messages to Discord channels
operations:
  message:
    - Send (simple message)
    - Send and Wait for Response (async)
    - Delete
    - Get / Get Many
    - React with Emoji
  channel:
    - Create / Delete / Update / Get
  member:
    - Get Many / Role Add / Role Remove

authentication:
  bot: Full Discord Bot (OAuth2)
  webhook: Webhook URL only (simpler, send-only)

embed_example:
  content: ""
  embeds:
    - title: "Trade Alert"
      color: 3066993  # Green
      fields:
        - name: "Symbol"
          value: "={{ $json.symbol }}"
          inline: true
        - name: "Direction"
          value: "={{ $json.direction }}"
          inline: true
      timestamp: "={{ new Date().toISOString() }}"

webhook_url_format: "https://discord.com/api/webhooks/{id}/{token}"
```

#### 12. AI Agent Node
```yaml
purpose: Autonomous AI agent with tool calling
version: 3.1 (latest)

inputs:
  - ai_languageModel: Connect chat model (OpenAI, Claude, Gemini)
  - ai_tool: Connect tools (HTTP Request, Jira, etc.)
  - ai_memory: Optional conversation memory
  - ai_outputParser: Optional structured output

prompt_sources:
  - auto: Connected Chat Trigger
  - define: Hardcoded prompt
  - guardrails: Connected Guardrails node

options:
  hasOutputParser: true  # Require JSON output
  needsFallback: true    # Use backup model on failure

agent_types:
  tools_agent: Uses function calling (recommended)
  react_agent: Chain of thought reasoning

common_patterns:
  trade_analyzer:
    model: claude-3-5-sonnet
    system_prompt: "You are a trading analyst..."
    tools: [HTTP Request to market API, Database lookup]
    output_parser: JSON schema for structured analysis
```

---

## Part 3: Expression Syntax Reference

### Basic Expressions

```javascript
// Access current item data
{{ $json.fieldName }}
{{ $json.nested.field }}
{{ $json['field-with-dashes'] }}

// Access previous node data
{{ $('NodeName').item.json.field }}
{{ $('NodeName').first().json.field }}
{{ $('NodeName').all() }}  // Array of all items

// Access binary data
{{ $binary.data.fileName }}
{{ $binary.data.mimeType }}

// Environment variables
{{ $env.MY_VAR }}

// Execution context
{{ $execution.id }}
{{ $execution.resumeUrl }}
{{ $workflow.id }}
{{ $workflow.name }}

// Date/time
{{ $now }}  // Current datetime
{{ $today }}  // Current date
{{ new Date().toISOString() }}
{{ DateTime.now().toFormat('yyyy-MM-dd') }}  // Luxon
```

### Conditional Expressions

```javascript
// Ternary
{{ $json.status === 'success' ? 'green' : 'red' }}

// Nullish coalescing
{{ $json.value ?? 'default' }}

// Optional chaining
{{ $json.data?.nested?.field }}

// Complex conditionals
{{
  $json.grade === 'A' ? 'Excellent' :
  $json.grade === 'B' ? 'Good' :
  $json.grade === 'C' ? 'Average' : 'Needs Improvement'
}}
```

### Array Operations

```javascript
// Filter
{{ $json.trades.filter(t => t.pnl > 0) }}

// Map
{{ $json.trades.map(t => t.symbol) }}

// Reduce
{{ $json.trades.reduce((sum, t) => sum + t.pnl, 0) }}

// Find
{{ $json.trades.find(t => t.symbol === 'BTCUSD') }}

// Some/Every
{{ $json.trades.some(t => t.pnl < -100) }}  // Any big loss?
{{ $json.trades.every(t => t.hasStopLoss) }}  // All have stops?

// Sort
{{ $json.trades.sort((a, b) => b.pnl - a.pnl) }}  // Descending by PnL

// Slice
{{ $json.trades.slice(0, 10) }}  // First 10
```

### String Operations

```javascript
// Template literals
{{ `Trade ${$json.symbol} closed at ${$json.price}` }}

// Methods
{{ $json.symbol.toLowerCase() }}
{{ $json.description.substring(0, 100) + '...' }}
{{ $json.tags.join(', ') }}
{{ $json.text.replace(/\n/g, '<br>') }}

// Regex
{{ $json.message.match(/ERROR: (.+)/)?.[1] || 'Unknown' }}
```

### Date Operations (Luxon)

```javascript
// Parse
{{ DateTime.fromISO($json.timestamp) }}
{{ DateTime.fromFormat($json.date, 'MM/dd/yyyy') }}

// Format
{{ DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss') }}
{{ DateTime.now().toRelative() }}  // "2 hours ago"

// Manipulate
{{ DateTime.now().minus({ days: 7 }).toISO() }}
{{ DateTime.now().startOf('week').toISO() }}

// Compare
{{ DateTime.fromISO($json.timestamp) > DateTime.now().minus({ hours: 24 }) }}
```

---

## Part 4: Complex Workflow Designs for SwjshAK

Based on research, here are properly complex workflow designs.

### WF-COMPLEX-001: CEO Morning Briefing (22 nodes)

```yaml
name: CEO Morning Briefing
trigger: Schedule (6:30 AM ET, weekdays)
node_count: 22
estimated_build_time: 2 hours

architecture:
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                          TRIGGER PHASE                                   │
  └─────────────────────────────────────────────────────────────────────────┘

  [Schedule Trigger 6:30 AM]
       │
       ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                      PARALLEL DATA COLLECTION                           │
  └─────────────────────────────────────────────────────────────────────────┘
       │
       ├──► [HTTP: Fetch Yesterday's Trades from /api/trades]
       │
       ├──► [HTTP: Fetch Agent Status from /api/agents]
       │
       ├──► [HTTP: Fetch Open Positions from /api/brokers/positions]
       │
       ├──► [HTTP: Fetch Jira Sprint Status from Jira API]
       │
       ├──► [HTTP: Fetch Fear & Greed Index]
       │
       └──► [HTTP: Fetch Economic Calendar (today's events)]

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                         DATA AGGREGATION                                 │
  └─────────────────────────────────────────────────────────────────────────┘
       │
       ▼
  [Merge: Combine All Data (6 inputs)]
       │
       ▼
  [Code: Calculate Metrics]
       │
       │   // Code node content:
       │   const trades = $('Fetch Trades').first().json;
       │   const agents = $('Fetch Agents').first().json;
       │   const positions = $('Fetch Positions').first().json;
       │   const sprint = $('Fetch Sprint').first().json;
       │
       │   const yesterdayPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
       │   const winRate = trades.filter(t => t.pnl > 0).length / trades.length;
       │   const healthyAgents = agents.filter(a => a.status === 'running').length;
       │   const totalAgents = agents.length;
       │   const openExposure = positions.reduce((sum, p) => sum + Math.abs(p.value), 0);
       │
       │   return {
       │     json: {
       │       yesterdayPnL,
       │       winRate: (winRate * 100).toFixed(1) + '%',
       │       agentHealth: `${healthyAgents}/${totalAgents}`,
       │       openExposure,
       │       sprintProgress: sprint.completedPoints / sprint.totalPoints,
       │       rawData: { trades, agents, positions, sprint }
       │     }
       │   };
       │
       ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                         AI ANALYSIS                                      │
  └─────────────────────────────────────────────────────────────────────────┘
       │
       ▼
  [AI Agent: Generate Briefing]
       │
       │   System Prompt:
       │   "You are the Chief executive assistant for SwjshAK trading system.
       │    Generate a concise morning briefing in this format:
       │
       │    ## Morning Briefing - {date}
       │
       │    ### Performance
       │    - Yesterday's P&L: $X (emoji based on positive/negative)
       │    - Win Rate: X%
       │    - MTD Performance: $X
       │
       │    ### System Health
       │    - Agents: X/Y running
       │    - Open Exposure: $X
       │    - Any alerts or concerns
       │
       │    ### Market Context
       │    - Fear & Greed: X (interpretation)
       │    - Key events today: ...
       │
       │    ### Sprint Progress
       │    - Current sprint: X% complete
       │    - Blockers: ...
       │
       │    ### Recommendations
       │    - 2-3 actionable items for today
       │
       │    Keep it under 500 words. Be direct and actionable."
       │
       │   Connected: Google Gemini Chat Model (cheaper for daily reports)
       │
       ▼
  [Code: Format Discord Embed]
       │
       │   // Create rich embed
       │   const analysis = $json.output;
       │   const metrics = $('Calculate Metrics').first().json;
       │
       │   const color = metrics.yesterdayPnL >= 0 ? 3066993 : 15158332;
       │
       │   return {
       │     json: {
       │       embeds: [{
       │         title: `Morning Briefing - ${new Date().toLocaleDateString()}`,
       │         description: analysis,
       │         color: color,
       │         fields: [
       │           { name: 'P&L', value: `$${metrics.yesterdayPnL.toFixed(2)}`, inline: true },
       │           { name: 'Win Rate', value: metrics.winRate, inline: true },
       │           { name: 'Agents', value: metrics.agentHealth, inline: true }
       │         ],
       │         footer: { text: 'SwjshAK Autonomous Trading' },
       │         timestamp: new Date().toISOString()
       │       }]
       │     }
       │   };
       │
       ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                         OUTPUT & STORAGE                                 │
  └─────────────────────────────────────────────────────────────────────────┘
       │
       ├──► [Discord: Post to #chief channel]
       │
       ├──► [HTTP: Create MGMT Jira ticket "Briefing {date}"]
       │
       └──► [HTTP: Store in /data/briefings/ for historical reference]

nodes:
  - id: trigger
    type: scheduleTrigger
    params:
      rule:
        interval: days
        daysInterval: 1
        triggerAtHour: 6
        triggerAtMinute: 30

  - id: fetchTrades
    type: httpRequest
    params:
      url: "http://localhost:3000/api/trades?date=yesterday"
      method: GET

  - id: fetchAgents
    type: httpRequest
    params:
      url: "http://localhost:3000/api/agents"
      method: GET

  # ... (13 more nodes)

error_handling:
  - Add Error Trigger workflow
  - If any HTTP fails: Continue with partial data
  - Add "never_error" option to non-critical fetches
  - Log errors to separate error workflow
```

---

### WF-COMPLEX-002: Trade Grading Pipeline (25 nodes)

```yaml
name: Trade Grading Pipeline
trigger: Webhook (POST /webhook/trade-closed)
node_count: 25
estimated_build_time: 3 hours

architecture:
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                          TRIGGER & VALIDATION                           │
  └─────────────────────────────────────────────────────────────────────────┘

  [Webhook: /webhook/trade-closed]
       │
       ▼
  [If: Valid Trade Data?]
       │
       ├── FALSE ──► [HTTP: Log Invalid Request] ──► [Stop]
       │
       └── TRUE
            │
            ▼
  [Set: Extract Trade Fields]
       │
       │   // Normalize incoming data
       │   {
       │     "tradeId": "={{ $json.id }}",
       │     "symbol": "={{ $json.symbol }}",
       │     "direction": "={{ $json.side === 'buy' ? 'LONG' : 'SHORT' }}",
       │     "entryPrice": "={{ $json.entry_price }}",
       │     "exitPrice": "={{ $json.exit_price }}",
       │     "entryTime": "={{ $json.entry_time }}",
       │     "exitTime": "={{ $json.exit_time }}",
       │     "pnl": "={{ $json.realized_pnl }}",
       │     "strategy": "={{ $json.strategy }}"
       │   }
       │
       ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                      PARALLEL CONTEXT FETCHING                          │
  └─────────────────────────────────────────────────────────────────────────┘
       │
       ├──► [HTTP: Fetch Strategy Rules from /api/strategies/{strategy}]
       │
       ├──► [HTTP: Fetch Market Data at Entry Time]
       │         url: "https://api.polygon.io/v2/aggs/ticker/{symbol}/range/1/minute/{entryTime}/{entryTime}"
       │
       ├──► [HTTP: Fetch VIX at Entry]
       │         url: "https://api.polygon.io/v2/aggs/ticker/VIX/..."
       │
       └──► [HTTP: Fetch Similar Past Trades]
                url: "http://localhost:3000/api/trades?symbol={symbol}&strategy={strategy}&limit=10"

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                         MERGE & PREPARE                                  │
  └─────────────────────────────────────────────────────────────────────────┘
       │
       ▼
  [Merge: Combine All Context (5 inputs)]
       │
       ▼
  [Code: Build Analysis Prompt]
       │
       │   const trade = $('Extract Trade Fields').first().json;
       │   const strategy = $('Fetch Strategy').first().json;
       │   const market = $('Fetch Market Data').first().json;
       │   const vix = $('Fetch VIX').first().json;
       │   const similar = $('Fetch Similar Trades').first().json;
       │
       │   const pnlPercent = ((trade.exitPrice - trade.entryPrice) / trade.entryPrice * 100);
       │   const duration = (new Date(trade.exitTime) - new Date(trade.entryTime)) / 60000;
       │
       │   return {
       │     json: {
       │       prompt: `
       │         Grade this trade using these criteria:
       │
       │         TRADE DETAILS:
       │         - Symbol: ${trade.symbol}
       │         - Direction: ${trade.direction}
       │         - Entry: $${trade.entryPrice} at ${trade.entryTime}
       │         - Exit: $${trade.exitPrice} at ${trade.exitTime}
       │         - Duration: ${duration.toFixed(0)} minutes
       │         - P&L: $${trade.pnl} (${pnlPercent.toFixed(2)}%)
       │         - Strategy: ${trade.strategy}
       │
       │         STRATEGY RULES:
       │         ${JSON.stringify(strategy.rules, null, 2)}
       │
       │         MARKET CONTEXT:
       │         - VIX at entry: ${vix.results?.[0]?.c || 'N/A'}
       │         - Price range at entry: ${market.results?.[0]?.l} - ${market.results?.[0]?.h}
       │
       │         SIMILAR PAST TRADES (same symbol/strategy):
       │         - Average P&L: $${similar.reduce((s,t) => s + t.pnl, 0) / similar.length}
       │         - Win rate: ${(similar.filter(t => t.pnl > 0).length / similar.length * 100).toFixed(0)}%
       │
       │         Return JSON:
       │         {
       │           "grade": "A/A-/B+/B/B-/C+/C/C-/D/F",
       │           "score": 0-100,
       │           "entry_quality": { "score": 0-100, "notes": "..." },
       │           "exit_quality": { "score": 0-100, "notes": "..." },
       │           "risk_management": { "score": 0-100, "notes": "..." },
       │           "strategy_adherence": { "score": 0-100, "notes": "..." },
       │           "strengths": ["..."],
       │           "weaknesses": ["..."],
       │           "lessons": ["..."],
       │           "pattern_detected": "premature_exit|perfect_execution|overtrading|null",
       │           "recommendation": "..."
       │         }
       │       `,
       │       trade: trade
       │     }
       │   };
       │
       ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                         AI GRADING                                       │
  └─────────────────────────────────────────────────────────────────────────┘
       │
       ▼
  [AI Agent: Arbiter Trade Grader]
       │
       │   Connected:
       │   - Claude 3.5 Sonnet (nuanced analysis)
       │   - Output Parser (JSON schema)
       │
       ▼
  [Code: Parse and Validate Grade]
       │
       │   const output = JSON.parse($json.output);
       │
       │   // Validate grade format
       │   const validGrades = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'];
       │   if (!validGrades.includes(output.grade)) {
       │     output.grade = 'C'; // Default if invalid
       │   }
       │
       │   return { json: output };
       │
       ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                    CONDITIONAL ACTIONS                                   │
  └─────────────────────────────────────────────────────────────────────────┘
       │
       ▼
  [Switch: Route by Grade]
       │
       ├── A/A- ──► [Discord: Post to #wins "Excellent trade!"]
       │
       ├── B+/B/B- ──► [Discord: Post to #trades "Good trade"]
       │
       ├── C+/C/C- ──► [Discord: Post to #trades "Average trade"]
       │                    │
       │                    ▼
       │              [HTTP: Create LEARN Jira Ticket]
       │                    │
       │                    │   "Lesson from {symbol} trade: {lessons[0]}"
       │
       └── D/F ──► [Discord: Post to #alerts "Poor trade - review needed"]
                        │
                        ▼
                  [HTTP: Create LEARN Jira Ticket (HIGH priority)]
                        │
                        ▼
                  [HTTP: Create linked INFRA Ticket if pattern recurring]

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                    STORAGE & NOTIFICATION                                │
  └─────────────────────────────────────────────────────────────────────────┘
       │
       ▼
  [Merge: Combine All Paths]
       │
       ▼
  [HTTP: Store Grade in Database]
       │
       │   POST /api/trades/{tradeId}/grade
       │   {
       │     "grade": "={{ $json.grade }}",
       │     "score": "={{ $json.score }}",
       │     "analysis": "={{ JSON.stringify($json) }}"
       │   }
       │
       ▼
  [HTTP: Create GRADE Jira Ticket]
       │
       │   POST /rest/api/3/issue
       │   {
       │     "fields": {
       │       "project": { "key": "GRADE" },
       │       "summary": "Trade Review: {symbol} {grade} ({pnl})",
       │       "issuetype": { "name": "Task" },
       │       "labels": ["trade-review", "grade-{gradeFirstLetter}"],
       │       "description": {
       │         "type": "doc",
       │         "content": [...]  // ADF format
       │       }
       │     }
       │   }
       │
       ▼
  [Respond to Webhook: Return grade summary]
       │
       │   { "success": true, "grade": "B+", "ticketKey": "GRADE-42" }

error_handling:
  - Webhook auth: Header X-Webhook-Secret required
  - API failures: Continue on fail for non-critical fetches
  - AI timeout: 30 second limit, fallback to simple rule-based grade
  - Invalid JSON from AI: Use Code node to attempt repair or default
```

---

### WF-COMPLEX-003: Self-Healing Incident Response (28 nodes)

```yaml
name: Self-Healing Incident Response
triggers:
  - Webhook: /webhook/alert (from health monitors)
  - Schedule: Every 2 minutes (proactive health check)
node_count: 28
estimated_build_time: 4 hours

architecture:
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                          DUAL TRIGGER                                    │
  └─────────────────────────────────────────────────────────────────────────┘

  [Webhook: /webhook/alert] ──┐
                              ├──► [Merge: Incoming Alerts]
  [Schedule: Every 2 min] ────┘         │
       │                                │
       ▼                                │
  [HTTP: Proactive Health Check]        │
       │                                │
       ▼                                │
  [Code: Detect Issues] ────────────────┘
       │
       │   // For proactive checks
       │   const agents = $json.agents || [];
       │   const alerts = [];
       │
       │   agents.forEach(agent => {
       │     const lastHeartbeat = new Date(agent.lastHeartbeat);
       │     const minutesSince = (Date.now() - lastHeartbeat) / 60000;
       │
       │     if (minutesSince > 10) {
       │       alerts.push({
       │         type: 'agent_unresponsive',
       │         component: agent.name,
       │         severity: 'high',
       │         message: `Agent ${agent.name} unresponsive for ${minutesSince.toFixed(0)} minutes`,
       │         context: { lastHeartbeat: agent.lastHeartbeat }
       │       });
       │     } else if (minutesSince > 5) {
       │       alerts.push({
       │         type: 'agent_stale',
       │         component: agent.name,
       │         severity: 'medium',
       │         message: `Agent ${agent.name} heartbeat delayed`,
       │         context: { lastHeartbeat: agent.lastHeartbeat }
       │       });
       │     }
       │   });
       │
       │   return alerts.map(a => ({ json: a }));
       │
       ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                     SEVERITY CLASSIFICATION                              │
  └─────────────────────────────────────────────────────────────────────────┘
       │
       ▼
  [If: Any Alerts?]
       │
       ├── NO ──► [Stop: System Healthy]
       │
       └── YES
            │
            ▼
  [Loop Over Items: Process Each Alert]
       │
       │  ┌─────────── LOOP (Output 1) ───────────┐
       │  │                                       │
       │  ▼                                       │
       │  [Switch: Severity]                      │
       │  │                                       │
       │  ├── critical ──┐                        │
       │  ├── high ──────┤                        │
       │  ├── medium ────┤                        │
       │  └── low ───────┤                        │
       │                 │                        │
       │                 ▼                        │
       │  [Code: Classify & Prepare Response]     │
       │  │                                       │
       │  │   // Determine auto-fix capability    │
       │  │   const autoFixable = {               │
       │  │     'agent_unresponsive': true,       │
       │  │     'agent_stale': true,              │
       │  │     'high_memory': true,              │
       │  │     'api_timeout': false,             │
       │  │     'database_error': false,          │
       │  │     'broker_connection': false        │
       │  │   };                                  │
       │  │                                       │
       │  │   return {                            │
       │  │     json: {                           │
       │  │       ...alert,                       │
       │  │       canAutoFix: autoFixable[alert.type] || false,
       │  │       fixStrategy: getFixStrategy(alert.type),
       │  │       maxRetries: 3                   │
       │  │     }                                 │
       │  │   };                                  │
       │  │                                       │
       │  ▼                                       │
       │  [If: Can Auto-Fix?]                     │
       │  │                                       │
       │  ├── YES                                 │
       │  │   │                                   │
       │  │   ▼                                   │
       │  │   [Switch: Fix Strategy]              │
       │  │   │                                   │
       │  │   ├── restart_agent ─────────────────┐│
       │  │   │   │                              ││
       │  │   │   ▼                              ││
       │  │   │   [HTTP: POST /api/control]      ││
       │  │   │   │   {"command": "restart",     ││
       │  │   │   │    "agentId": "{component}"} ││
       │  │   │   │                              ││
       │  │   │   ▼                              ││
       │  │   │   [Wait: 30 seconds]             ││
       │  │   │   │                              ││
       │  │   │   ▼                              ││
       │  │   │   [HTTP: Verify Agent Status]    ││
       │  │   │   │                              ││
       │  │   │   ▼                              ││
       │  │   │   [If: Fixed?]                   ││
       │  │   │   │                              ││
       │  │   │   ├── YES ──► [Set: resolved]    ││
       │  │   │   │                              ││
       │  │   │   └── NO                         ││
       │  │   │       │                          ││
       │  │   │       ▼                          ││
       │  │   │       [Code: Increment Retry]    ││
       │  │   │       │                          ││
       │  │   │       ▼                          ││
       │  │   │       [If: Retries < Max?]       ││
       │  │   │       │                          ││
       │  │   │       ├── YES ──► [Back to Fix] ─┘│
       │  │   │       │                           │
       │  │   │       └── NO ──► [Escalate]       │
       │  │   │                                   │
       │  │   ├── clear_cache ───────────────────┘│
       │  │   │       (similar pattern)           │
       │  │   │                                   │
       │  │   └── restart_process ───────────────┘│
       │  │           (similar pattern)           │
       │  │                                       │
       │  └── NO (Cannot Auto-Fix)                │
       │      │                                   │
       │      ▼                                   │
       │      [Set: requires_human = true]        │
       │      │                                   │
       │      └───────────────────────────────────┘
       │
       └── DONE (Output 0) ──► [Continue Below]

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                     POST-PROCESSING                                      │
  └─────────────────────────────────────────────────────────────────────────┘
       │
       ▼
  [Code: Aggregate Results]
       │
       │   const items = $input.all();
       │   const resolved = items.filter(i => i.json.status === 'resolved');
       │   const escalated = items.filter(i => i.json.requires_human);
       │   const failed = items.filter(i => i.json.status === 'failed');
       │
       │   return {
       │     json: {
       │       summary: {
       │         total: items.length,
       │         resolved: resolved.length,
       │         escalated: escalated.length,
       │         failed: failed.length
       │       },
       │       details: items.map(i => i.json)
       │     }
       │   };
       │
       ▼
  [If: Any Escalations?]
       │
       ├── YES
       │   │
       │   ▼
       │   [PARALLEL]
       │   │
       │   ├──► [Discord: @here CRITICAL Alert in #chief]
       │   │         │
       │   │         │   embed:
       │   │         │     title: "INCIDENT: Auto-remediation Failed"
       │   │         │     color: 15158332 (red)
       │   │         │     fields:
       │   │         │       - Affected: {component}
       │   │         │       - Attempts: {retryCount}
       │   │         │       - Status: Requires Human
       │   │
       │   ├──► [HTTP: Create PULSE Jira Ticket (CRITICAL)]
       │   │
       │   └──► [HTTP: Send Email/SMS to Jack]
       │
       └── NO
            │
            ▼
       [If: Any Auto-Resolved?]
            │
            ├── YES ──► [Discord: Post to #system "Auto-resolved: ..."]
            │
            └── NO ──► [Stop: Nothing to report]

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                     LEARNING & METRICS                                   │
  └─────────────────────────────────────────────────────────────────────────┘
       │
       ▼
  [HTTP: Log Incident to /api/incidents]
       │
       │   {
       │     "timestamp": "{$now}",
       │     "alerts": "{details}",
       │     "autoResolved": {resolved.length},
       │     "humanRequired": {escalated.length}
       │   }
       │
       ▼
  [If: New Pattern Detected?]
       │
       ├── YES ──► [HTTP: Create LEARN Ticket "Pattern: {pattern}"]
       │
       └── NO ──► [End]

error_handling:
  workflow_level:
    - Dedicated Error Trigger workflow
    - If this workflow fails: Alert via backup channel (email)

  node_level:
    - HTTP nodes: continueOnFail = true
    - Retry logic built into loop
    - Timeout: 120 seconds per remediation attempt

  circuit_breaker:
    - If same component fails 5+ times in 1 hour
    - Stop attempting auto-fix
    - Immediately escalate to human
    - Create INFRA ticket for investigation
```

---

## Part 5: What We Got Wrong

### Previous 47 Workflows: Why They Were Inadequate

| Issue | Example | Reality |
|-------|---------|---------|
| **Too few nodes** | "Fetch data -> Send Discord" (3 nodes) | Real workflows have 15-50 nodes |
| **No error handling** | Assumed happy path | Need Error Trigger, If checks, retries |
| **No data transformation** | Direct passthrough | Code nodes for parsing, aggregation, formatting |
| **No async handling** | Synchronous only | Wait nodes for polling, webhooks for callbacks |
| **No parallel execution** | Sequential chains | Multiple branches merged together |
| **No validation** | Trust all input | If nodes to validate, Filter to clean |
| **No context enrichment** | Single data source | Parallel fetches, Merge to combine |
| **Shallow AI prompts** | "Summarize this" | Detailed context, structured output, validation |

### What Real n8n Workflows Need

1. **Trigger Phase** (1-2 nodes)
   - Schedule Trigger OR Webhook with auth
   - Optional: If to validate trigger conditions

2. **Data Collection Phase** (3-10 nodes)
   - Multiple parallel HTTP requests
   - Database queries
   - External API enrichment

3. **Data Aggregation Phase** (2-5 nodes)
   - Merge node to combine parallel results
   - Code node to transform/calculate
   - Set node to normalize fields

4. **Processing Phase** (5-15 nodes)
   - AI analysis with proper prompts
   - Multiple conditional branches (Switch)
   - Retry logic with Wait nodes
   - Validation checks

5. **Output Phase** (3-8 nodes)
   - Multiple destinations (Discord, Jira, Database)
   - Formatted embeds/messages
   - Error logging

6. **Error Handling** (2-5 nodes per workflow)
   - Error Trigger workflow
   - continueOnFail options
   - Fallback paths

### How Many Workflows We Actually Need

Instead of 47 shallow workflows, we need approximately **12-15 complex workflows**:

| Priority | Workflow | Nodes | Purpose |
|----------|----------|-------|---------|
| P1 | Self-Healing Incident Response | 28 | Foundation for autonomous operation |
| P1 | Agent Health Monitor | 18 | Keep all agents running |
| P1 | Global Error Handler | 12 | Catch all workflow failures |
| P2 | CEO Morning Briefing | 22 | Daily system overview |
| P2 | Trade Grading Pipeline | 25 | Learning from trades |
| P2 | Signal Processing Router | 20 | Handle TradingView alerts |
| P3 | Jira Ticket Triage | 15 | Auto-categorize new tickets |
| P3 | Weekly Pattern Detection | 20 | Find trading patterns |
| P3 | Sprint Planning Assistant | 18 | AI-assisted planning |
| P4 | Knowledge Base Builder | 15 | Extract lessons from tickets |
| P4 | Daily Standup Generator | 16 | Automated status updates |
| P4 | Retrospective Facilitator | 18 | End-of-sprint analysis |

**Total: 12 workflows, ~230 nodes**

This is more realistic than 47 workflows because:
- Each workflow does one thing completely
- Proper error handling in each
- Reusable sub-workflows via Execute Workflow node
- Clear boundaries and responsibilities

---

## Part 6: Implementation Checklist

### Before Building Any Workflow

- [ ] Define clear trigger conditions
- [ ] Map all required data sources
- [ ] Design error handling strategy
- [ ] Identify parallel vs sequential operations
- [ ] Plan AI prompts with structured output
- [ ] Define success criteria

### Node Configuration Standards

```yaml
http_request:
  always_include:
    - Authentication
    - Timeout (30s default)
    - continueOnFail: true (for non-critical)

code_node:
  always_include:
    - Try/catch for error handling
    - Input validation
    - Clear return structure

ai_agent:
  always_include:
    - System prompt with persona
    - Structured output parser
    - Temperature setting (0.3-0.5 for consistency)
    - Max tokens limit

discord:
  always_include:
    - Embed with color coding
    - Timestamp
    - Source identification
```

### Testing Protocol

1. **Manual trigger first** - Never enable schedule until tested
2. **Error injection** - Test with bad data
3. **Timeout testing** - Test with slow APIs
4. **Volume testing** - Test with many items
5. **Production monitoring** - Watch first 24 hours closely

---

## Appendix: n8n Expression Cheat Sheet

```javascript
// CURRENT ITEM
{{ $json.field }}                    // Direct field access
{{ $json.nested?.field }}            // Optional chaining
{{ $json.field ?? 'default' }}       // Nullish coalescing

// PREVIOUS NODES
{{ $('NodeName').first().json.field }}
{{ $('NodeName').all() }}
{{ $('NodeName').item.json.field }}  // In loop context

// EXECUTION CONTEXT
{{ $execution.id }}
{{ $execution.resumeUrl }}
{{ $workflow.id }}
{{ $workflow.name }}

// DATE/TIME (Luxon)
{{ $now }}
{{ $today }}
{{ DateTime.now().toFormat('yyyy-MM-dd') }}
{{ DateTime.fromISO($json.date).toRelative() }}

// CONDITIONALS
{{ $json.pnl > 0 ? 'profit' : 'loss' }}

// ARRAYS
{{ $json.items.filter(i => i.active) }}
{{ $json.items.map(i => i.name).join(', ') }}
{{ $json.items.reduce((s, i) => s + i.value, 0) }}

// STRINGS
{{ `Trade: ${$json.symbol} at ${$json.price}` }}
{{ $json.text.substring(0, 100) + '...' }}
```

---

*Document generated from extensive n8n template research and node documentation analysis.*
