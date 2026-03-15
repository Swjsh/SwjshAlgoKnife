# SwjshAK End-to-End Testing Guide

## Complete User Journey Testing

This guide walks through testing the entire user experience from signup to placing a paper trade.

---

## Test Scenario: New User Onboarding

### 1. SIGN UP (New User)

**URL:** `http://localhost:3000/sign-up`

**Test with Email/Password:**
```
Email: test@example.com
Password: test123456
```

**Expected Flow:**
- ✅ Create account with Firebase
- ✅ Session cookie stored
- ✅ Redirect to `/onboarding/legal`

**Test with Google:**
- Click "Continue with Google"
- Use test Google account
- Same redirect to `/onboarding/legal`

---

### 2. LEGAL ACCEPTANCE

**URL:** `http://localhost:3000/onboarding/legal`

**Steps:**
1. Read Terms of Service & Privacy Policy
2. Read Liability Waiver
3. Check both boxes
4. Click "Accept & Continue"

**Expected:**
- ✅ POST to `/api/onboarding/legal`
- ✅ 4 legal acceptance records created in DB
- ✅ User's `onboardingStep` updated to `TERMS_ACCEPTED`
- ✅ Redirect to `/onboarding/broker`

---

### 3. BROKER CONNECTION

**URL:** `http://localhost:3000/onboarding/broker`

#### Test Case 3A: Valid Alpaca Paper Trading Credentials

**Steps:**
1. Select "Paper Trading" environment
2. Enter valid Alpaca Paper API credentials:
   ```
   API Key: PK... (your paper key)
   Secret Key: ... (your paper secret)
   ```
3. Click "Connect & Verify"

**Expected:**
- ✅ POST to `/api/brokers` creates broker config
- ✅ POST to `/api/brokers/{id}/verify` verifies connection
- ✅ Broker status updated to `CONNECTED`
- ✅ Account info fetched (ID, type, buying power)
- ✅ User's `onboardingStep` updated to `BROKER_CONNECTED`
- ✅ Redirect to `/onboarding/complete`

#### Test Case 3B: Invalid/Fake Broker Credentials

**Steps:**
1. Select "Paper Trading"
2. Enter FAKE credentials:
   ```
   API Key: PKfakekey123
   Secret Key: fakesecret456
   ```
3. Click "Connect & Verify"

**Expected Behavior:**
- ✅ POST to `/api/brokers` succeeds (saves encrypted creds)
- ❌ POST to `/api/brokers/{id}/verify` FAILS
- ✅ Broker status updated to `FAILED`
- ✅ Error message stored: "API Error: 401..."
- ✅ User sees error: "Invalid API key or secret. Please verify your credentials."
- ✅ Broker config remains in database with FAILED status
- ❌ User stuck on onboarding page (no retry path)

**Current Issue:**
- User can't easily retry after failure
- Broker config is created but marked as FAILED
- Need to delete failed config or allow re-verification

#### Test Case 3C: Skip Broker Setup

**Steps:**
1. Click "Skip for now (you can add this later)"

**Expected:**
- ✅ Redirect directly to `/dashboard`
- ⚠️ User has no broker connected
- ⚠️ Cannot create bots until broker is added

---

### 4. ONBOARDING COMPLETE

**URL:** `http://localhost:3000/onboarding/complete`

**Expected:**
- ✅ Confetti animation (3 seconds)
- ✅ Success message displayed
- ✅ Auto-redirect to dashboard after 5 seconds
- ❌ NO API call to mark onboarding as `COMPLETED` (missing)

**Issue:** User's `onboardingStep` is still `BROKER_CONNECTED`, never set to `COMPLETED`

---

### 5. DASHBOARD

**URL:** `http://localhost:3000/dashboard`

**Expected:**
- ✅ Greeting with user's name
- ✅ KPI cards (P&L, Positions, Win Rate, Agents)
- ✅ Market sessions tracker
- ✅ Recent signals and trades
- ❌ No first-time user guidance or "Create Your First Bot" wizard

---

## Test Scenario: Password Reset Flow

### 6. FORGOT PASSWORD

**URL:** `http://localhost:3000/forgot-password`

**Steps:**
1. Enter email: `test@example.com`
2. Click "Send Reset Link"

**Expected:**
- ✅ Firebase sends password reset email
- ✅ Success screen: "Check Your Email"
- ✅ Email contains link: `http://localhost:3000/reset-password?oobCode=...`

**Test with Invalid Email:**
- Enter: `nonexistent@example.com`
- Expected error: "No account found with this email address"

---

### 7. RESET PASSWORD

**URL:** `http://localhost:3000/reset-password?oobCode=ABC123...`

**Steps:**
1. Click link from email (includes `oobCode` parameter)
2. Page verifies reset code
3. Enter new password: `newpassword123`
4. Confirm password: `newpassword123`
5. Click "Reset Password"

**Expected:**
- ✅ Firebase verifies `oobCode` is valid
- ✅ Password updated successfully
- ✅ Success message: "Password Reset Successful"
- ✅ Auto-redirect to `/sign-in` after 3 seconds

**Test with Expired Code:**
- Use old reset link (expired)
- Expected error: "This reset link has expired. Please request a new one."

---

## Test Scenario: Broker Management

### 8. ADD BROKER (Post-Onboarding)

**URL:** `http://localhost:3000/brokers`

**Steps:**
1. Click "Add Broker"
2. Select Alpaca
3. Choose Paper Trading
4. Enter label: "My Test Alpaca Account"
5. Enter API credentials
6. Click "Connect Broker"

**Expected:**
- Same flow as onboarding
- Broker verified and added to list
- Connection status badge shows "CONNECTED"

**Test Invalid Credentials:**
- Same as Test Case 3B above
- Error displayed in modal
- User can cancel and try again

---

### 9. DELETE BROKER

**Steps:**
1. Find broker in list
2. Click "Remove" button
3. Confirm deletion

**Expected:**
- ✅ Confirmation prompt
- ✅ DELETE to `/api/brokers/{id}`
- ✅ Broker removed from list
- ✅ Audit log created

---

## Test Scenario: Bot Management

### 10. CREATE BOT

**URL:** `http://localhost:3000/bots`

**Current State:** ❌ NO UI TO CREATE BOT

**Missing Features:**
- No "Create Bot" button on `/bots` page
- No bot creation modal/wizard
- API endpoint exists (`POST /api/bots`) but no UI

**Manual API Test:**
```bash
curl -X POST http://localhost:3000/api/bots \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Bot",
    "strategy": "ORB",
    "maxPositionSize": 1000,
    "maxOpenPositions": 1
  }'
```

**Expected:**
- ✅ Bot created with STOPPED status
- ✅ Uses primary connected broker
- ✅ Returns error if no broker connected

---

### 11. START/STOP BOT

**Current State:** ❌ NO API ENDPOINT FOR BOT CONTROL

**Missing:**
- No `POST /api/bots/{id}/start` endpoint
- No `POST /api/bots/{id}/stop` endpoint
- No `POST /api/bots/{id}/pause` endpoint
- Bots page UI has buttons but they don't work

**Expected Flow:**
```bash
# Start bot
POST /api/bots/{id}/start

# Stop bot
POST /api/bots/{id}/stop

# Pause bot
POST /api/bots/{id}/pause
```

---

## Test Scenario: Manual Trade

### 12. PLACE MANUAL PAPER TRADE

**Current State:** ❌ NO MANUAL TRADE UI

**Missing Features:**
- No manual trade entry form
- No quick trade button on dashboard
- Must rely on TradingView webhooks or autonomous agents

**Workaround - Manual Database Insert:**
```sql
INSERT INTO trades (
  userId, symbol, side, quantity, entryPrice,
  entryTime, status, strategy
) VALUES (
  'user_id_here', 'AAPL', 'BUY', 10, 150.00,
  datetime('now'), 'OPEN', 'Manual'
);
```

---

## Critical Issues Found

### High Priority (Blocking User Experience)

1. **No Bot Creation UI**
   - Users cannot create bots through the interface
   - API exists but no form/modal

2. **No Bot Control Endpoints**
   - Start/Stop/Pause buttons exist but do nothing
   - Need dedicated bot control API routes

3. **No Manual Trade UI**
   - No way to test trading without setting up webhooks
   - Need quick trade entry form

4. **Invalid Broker Credentials Handling**
   - User gets stuck with FAILED broker config
   - No way to retry verification or delete failed config
   - Should allow retry or show "Edit" option

5. **No Onboarding Completion Tracking**
   - User's `onboardingStep` never set to `COMPLETED`
   - Missing final API call in onboarding flow

### Medium Priority (UX Improvements)

6. **No Email Verification Enforcement**
   - Users can proceed without verifying email
   - Should prompt/block until verified

7. **No Account Settings Collection**
   - Account balance not collected during onboarding
   - Risk-per-trade settings not configured
   - Relies on environment variables instead

8. **No First Bot Wizard**
   - Dashboard shows empty state but no guided setup
   - Should prompt "Create Your First Bot" after onboarding

9. **Auth Context Inconsistency**
   - Mixed use of Firestore and Prisma for user data
   - Preferences may not sync properly

---

## Recommended Test Data

### Valid Alpaca Paper Trading Credentials
```
API Key: Get from alpaca.markets dashboard
Secret Key: Get from alpaca.markets dashboard
Base URL: https://paper-api.alpaca.markets
```

### Fake Test Credentials (For Error Testing)
```
API Key: PKfakekey123456789
Secret Key: fakesecret987654321
Expected Error: 401 Unauthorized
```

### Test User Accounts
```
Email: test1@example.com
Password: testpass123

Email: test2@example.com
Password: testpass456
```

---

## Next Steps to Complete Testing

To fully test the platform, you need to implement:

1. ✅ **Bot Creation Modal** - UI to create bots
2. ✅ **Bot Control API** - Start/stop/pause endpoints
3. ✅ **Manual Trade Form** - Quick trade entry
4. ✅ **Broker Retry Logic** - Allow re-verification of failed brokers
5. ✅ **Onboarding Completion** - API call to mark onboarding complete
6. ✅ **Account Settings Page** - Collect balance and risk settings

After implementing these, you can run a complete end-to-end test:
1. Sign up new user
2. Accept legal terms
3. Connect valid paper broker
4. Complete onboarding
5. Create first bot
6. Start bot
7. Place manual test trade
8. View trade in journal
9. Stop bot
10. Review performance metrics

---

## Database Verification Queries

After each test step, verify data in the database:

```sql
-- Check user onboarding status
SELECT id, email, onboardingStep FROM users WHERE email = 'test@example.com';

-- Check legal acceptances
SELECT * FROM legal_acceptances WHERE userId = 'user_id';

-- Check broker configs
SELECT id, broker, environment, connectionStatus, lastErrorMessage
FROM broker_configs WHERE userId = 'user_id';

-- Check bots
SELECT id, name, strategy, status, totalTrades, totalPnl
FROM bots WHERE userId = 'user_id';

-- Check trades
SELECT id, symbol, side, quantity, entryPrice, exitPrice, pnl, status
FROM trades WHERE userId = 'user_id';

-- Check audit logs
SELECT action, resourceType, status, createdAt
FROM audit_logs WHERE userId = 'user_id'
ORDER BY createdAt DESC;
```

---

## Conclusion

The authentication and onboarding flow is mostly complete, but critical pieces are missing for actually using the platform:

- ✅ Auth works (email, password, Google, password reset)
- ✅ Onboarding flow works (legal, broker, complete)
- ❌ Bot creation UI missing
- ❌ Bot control missing
- ❌ Manual trade UI missing
- ❌ Account settings missing

Once these are implemented, you'll have a complete testable user journey from signup to making trades.
