# 🔄 Multi-Tenant Migration Plan

## Goal
Connect the new multi-tenant foundation (Prisma + Auth) to your existing single-user trading app (SQLite + Agents).

---

## Phase 1: Data Migration (SQLite → PostgreSQL)

### Step 1.1: Extend Prisma Schema to Match SQLite

**Current Prisma Tables:**
- ✅ User, BrokerConfig, Bot, Trade, Signal, AuditLog, LegalAcceptance

**Missing from Prisma (exists in SQLite):**
- ❌ journal_entries
- ❌ settings
- ❌ intel_signals
- ❌ accounts (different from BrokerConfig)
- ❌ transactions

**Action:** Add these to `prisma/schema.prisma`

### Step 1.2: Map SQLite → Prisma Models

| SQLite Table | Prisma Model | Changes Needed |
|--------------|--------------|----------------|
| `trades` | `Trade` | Add userId, botId, brokerConfigId |
| `signals` | `Signal` | Add userId, botId |
| `journal_entries` | `JournalEntry` (new) | Add userId, change PK from date to id |
| `settings` | `Setting` (new) | Add userId for user-specific settings |
| `intel_signals` | `IntelSignal` (new) | Add userId (or make global?) |
| `accounts` | Keep separate or merge? | Agent accounts vs broker accounts |
| `transactions` | `Transaction` (new) | Add userId, link to accounts |

### Step 1.3: Migrate Existing Data

**Option A: Assign All Data to First User**
```typescript
// Migration script
const firstUser = await prisma.user.findFirst();
// Copy all SQLite trades → Prisma with userId = firstUser.id
```

**Option B: Fresh Start**
- Keep SQLite as backup
- Start with empty PostgreSQL
- Users create new data going forward

---

## Phase 2: Update Existing API Routes

### Current State (No Auth)
```typescript
// OLD - src/app/api/trades/route.ts
export async function GET() {
  const db = getDB(); // SQLite
  const trades = db.prepare('SELECT * FROM trades').all();
  return NextResponse.json({ trades }); // Returns ALL trades
}
```

### Target State (Multi-Tenant)
```typescript
// NEW - src/app/api/trades/route.ts
export async function GET() {
  const user = await requireUser(); // Firebase auth
  const trades = await prisma.trade.findMany({
    where: { userId: user.id }, // Filter by current user
  });
  return NextResponse.json({ trades });
}
```

### Routes to Update
- ✅ `/api/trades` - Add requireUser(), filter by userId
- ✅ `/api/signals` - Add requireUser(), filter by userId
- ✅ `/api/journal` - Add requireUser(), filter by userId
- ✅ `/api/agents` - Filter agents by userId
- ✅ `/api/webhook/tradingview` - Link to user's broker config
- ⚠️ `/api/accounts` - Decide: per-user or global?
- ⚠️ `/api/intel` - Decide: per-user or shared intel?

---

## Phase 3: Connect Broker Integration

### Current State (Env Vars)
```env
APCA_API_KEY_ID=your_key_here
APCA_API_SECRET_KEY=your_secret_here
```

**Problem:** Only one broker per deployment. Can't support multiple users with different brokers.

### Target State (Database)
```typescript
// Get user's broker config from database
const user = await requireUser();
const brokerConfig = await prisma.brokerConfig.findFirst({
  where: {
    userId: user.id,
    broker: 'ALPACA',
    isActive: true
  }
});

// Decrypt credentials
const apiKey = decryptSecret({
  encrypted: brokerConfig.apiKeyEncrypted,
  iv: ivFromEncryptionIv,
  authTag: authTagFromEncryptionIv
});

// Use decrypted credentials
const alpacaClient = new AlpacaClient(apiKey, apiSecret);
```

### Files to Update
1. **src/lib/broker/alpaca.ts** - Accept credentials as constructor params (not env vars)
2. **src/lib/engine/executor.ts** - Query BrokerConfig before trade execution
3. **src/app/api/webhook/tradingview/route.ts** - Get broker from webhook user context

---

## Phase 4: Update Dashboard to Show User Data

### Current State (Global Data)
```typescript
// OLD - src/app/dashboard/page.tsx
const res = await fetch('/api/trades');
const { trades } = await res.json(); // All trades from all users
```

### Target State (User Data)
```typescript
// NEW - src/app/dashboard/page.tsx
const user = await getCurrentUser(); // From auth context
if (!user) redirect('/sign-in');

const res = await fetch('/api/trades', {
  headers: { Authorization: `Bearer ${await getIdToken()}` }
});
const { trades } = await res.json(); // Only current user's trades
```

### Pages to Update
- ✅ Dashboard - Filter KPIs, agents, signals by userId
- ✅ Agents - Show only user's agents
- ✅ Trades - Show only user's trades
- ✅ Journal - Show only user's journal entries
- ✅ Strategies - User-specific strategy configs
- ⚠️ Command Center - Decide: per-user or admin-only?

---

## Phase 5: Migrate Agent System (agents_db.json → Database)

### Current State (File-Based)
```json
// agents_db.json
{
  "bitcoin_bob": {
    "status": "active",
    "trades": [...],
    "performance": { "pnl": 1250.50, "winRate": 0.62 }
  }
}
```

**Problem:** Singleton file. All users share same agents or can't have persistent agents.

### Target State (Database Per-User)
```typescript
// Bot table in Prisma
const bot = await prisma.bot.create({
  data: {
    userId: user.id,
    name: 'Bitcoin Bob',
    strategy: 'SUPPLY_DEMAND',
    status: 'RUNNING',
    brokerConfigId: userBrokerConfig.id
  }
});
```

### Migration Steps
1. Create Bot records for each user's active agents
2. Update agent_runner.ts to:
   - Accept userId parameter
   - Query user's bots from database
   - Update bot status in database (not JSON file)
3. Update AgentContext to fetch from `/api/bots` instead of agents_db.json

---

## Phase 6: Handle Shared vs User-Specific Data

### Shared Data (Global)
- ✅ Market data (prices, sessions)
- ✅ Strategy definitions (code)
- ⚠️ Intel signals? (Decide: shared or per-user)

### User-Specific Data
- ✅ Trades
- ✅ Signals
- ✅ Journal entries
- ✅ Bots
- ✅ Broker configs
- ✅ Settings/preferences

### Master Account Question
**Current:** One "master" account with agent sub-accounts (capital allocation)

**Options:**
1. **Per-User Master Account** - Each user has own master account
2. **Global Pool** - All users share one pool (risky for beta)
3. **Hybrid** - Each user's broker account IS their master account

**Recommendation:** Option 1 - Each user's broker buying power = their master account balance.

---

## Phase 7: Testing Checklist

### Single-User Testing (Your Current Setup)
- [ ] Migrate your existing SQLite data to PostgreSQL
- [ ] Assign all data to your user account
- [ ] Verify dashboard still works
- [ ] Verify agents still execute trades
- [ ] Verify trades save to PostgreSQL with your userId

### Multi-User Testing
- [ ] Create second test account
- [ ] Connect different Alpaca keys
- [ ] Start a bot for user 2
- [ ] Verify user 1 cannot see user 2's trades
- [ ] Verify user 2 cannot see user 1's trades
- [ ] Test concurrent bot execution

### Security Testing
- [ ] Try accessing /api/trades without auth → 401
- [ ] Try accessing another user's trade by ID → 403
- [ ] Try using invalid broker credentials → error with retry
- [ ] Verify encrypted credentials cannot be read from database

---

## Implementation Order (Recommended)

### Week 1: Foundation
1. ✅ DONE - Prisma schema + auth + onboarding
2. Add missing Prisma models (JournalEntry, Setting, IntelSignal)
3. Run migration: `npx prisma migrate dev --name add_missing_tables`

### Week 2: Data Layer
4. Create migration script to copy SQLite → PostgreSQL
5. Test with your existing data
6. Update API routes to use Prisma + requireUser()

### Week 3: Broker Integration
7. Update TradeExecutor to query BrokerConfig
8. Update broker clients to accept credentials (not env vars)
9. Test with your Alpaca paper account

### Week 4: Dashboard & Agents
10. Update dashboard to filter by userId
11. Migrate agents_db.json to Bot table
12. Update agent_runner.ts to use database

### Week 5: Testing & Refinement
13. Create second test user
14. Test multi-tenant isolation
15. Fix any bugs

---

## Quick Win: Hybrid Mode (Keep Both Systems)

If you want to test incrementally:

1. **Keep SQLite for existing functionality** (backward compatible)
2. **Use Prisma for new users** (going forward)
3. **Add feature flag:**
   ```typescript
   const USE_MULTI_TENANT = process.env.MULTI_TENANT_MODE === 'true';

   if (USE_MULTI_TENANT) {
     const user = await requireUser();
     const trades = await prisma.trade.findMany({ where: { userId: user.id } });
   } else {
     const db = getDB();
     const trades = db.prepare('SELECT * FROM trades').all();
   }
   ```

This lets you switch between old/new systems without breaking anything.

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data loss during migration | 🔴 High | Backup SQLite before migration, test on copy first |
| Breaking existing agents | 🟡 Medium | Keep SQLite as fallback, test thoroughly |
| Auth bugs lock you out | 🟡 Medium | Create admin backdoor route for emergencies |
| Multi-user race conditions | 🟡 Medium | Use database transactions, test concurrent access |
| Broker API rate limits | 🟢 Low | Each user has own API keys = own limits |

---

## Next Step: What Do You Want to Tackle First?

**Option A: Data Migration (Fastest Path)**
- I'll write a script to migrate your SQLite → PostgreSQL
- Assign all existing data to your user account
- Get your current app working with Prisma

**Option B: New User Flow (Clean Start)**
- Leave your existing data in SQLite
- New users (including test accounts) use PostgreSQL
- You can migrate yourself later

**Option C: Hybrid Approach**
- Add feature flag to toggle old/new systems
- Test multi-tenant with a second account
- Migrate when confident

Which approach do you prefer?
