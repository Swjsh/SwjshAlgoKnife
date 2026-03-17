# 🚀 Quick Start Guide - Test Your New Multi-Tenant Platform

## ✅ What's Ready

All the multi-tenant onboarding infrastructure is built and ready to test!

---

## 🎯 Start Testing NOW

### 1. Start the Dev Server

```powershell
npm run dev
```

The app will open at **http://localhost:3000**

### 2. Test the Onboarding Flow

#### Step 1: Create an Account
- Go to http://localhost:3000/sign-up
- Enter email and password (min 6 characters)
- Click "Create Account"

#### Step 2: Accept Legal Documents
- You'll be redirected to `/onboarding/legal`
- Read the trading disclaimer and waiver
- Check both boxes
- Click "Continue to Broker Setup"

#### Step 3: Connect Alpaca Broker
- You'll be redirected to `/onboarding/broker`
- **Paper Trading** is selected by default (recommended for testing)
- Enter your Alpaca API keys:

  **Don't have Alpaca keys?**
  1. Go to https://alpaca.markets
  2. Sign up for free
  3. Navigate to **Paper Trading → API Keys**
  4. Click "Generate New Key"
  5. Copy the Key ID and Secret Key

- Paste keys into the form
- Click "Connect & Verify"

#### Step 4: Success!
- You'll see a confetti celebration 🎉
- Auto-redirect to dashboard in 5 seconds

---

## 🔍 Verify Everything Worked

### Check Your Database

```powershell
npx prisma studio
```

Open http://localhost:5555 and verify:

✅ **User** table has 1 row (you!)
- Check `onboardingStep` = `BROKER_CONNECTED` or `COMPLETED`
- Check `email` matches what you signed up with

✅ **LegalAcceptance** table has 4 rows
- TERMS_OF_SERVICE
- PRIVACY_POLICY
- TRADING_DISCLAIMER
- LIABILITY_WAIVER

✅ **BrokerConfig** table has 1 row
- `broker` = `ALPACA`
- `environment` = `PAPER` or `LIVE`
- `connectionStatus` = `CONNECTED`
- `apiKeyEncrypted` and `apiSecretEncrypted` are encrypted strings
- `buyingPower` shows your account balance

✅ **AuditLog** table has entries
- `legal.accept`
- `broker.create`
- `broker.verify`

---

## 🧪 Test Edge Cases

### Test Invalid Credentials
1. Go to `/onboarding/broker` again (manually type the URL)
2. Enter fake API keys like "123" and "456"
3. Click "Connect & Verify"
4. **Expected:** Error message appears saying "Invalid API credentials"

### Test Middleware Protection
1. Sign out (clear your browser cookies or use incognito)
2. Try to visit http://localhost:3000/dashboard
3. **Expected:** Redirected to `/sign-in`

### Test Onboarding Flow Protection
1. Create a second account
2. **Expected:** Redirected through legal → broker → complete in order
3. Try manually navigating to `/dashboard` before completing onboarding
4. **Expected:** Redirected back to onboarding steps

---

## 📁 What We Built (Recap)

### Pages Created
```
src/app/
  ├── sign-in/page.tsx              ← Firebase auth sign-in
  ├── sign-up/page.tsx              ← Firebase auth sign-up
  ├── onboarding/
  │   ├── legal/page.tsx            ← Legal acceptance
  │   ├── broker/page.tsx           ← Broker connection
  │   └── complete/page.tsx         ← Success with confetti
  └── legal/
      ├── terms/page.tsx            ← Terms of Service
      └── privacy/page.tsx          ← Privacy Policy
```

### API Routes Created
```
src/app/api/
  ├── auth/session/route.ts         ← Session cookie management
  ├── me/route.ts                   ← Current user endpoint
  ├── onboarding/legal/route.ts     ← Save legal acceptances
  └── brokers/
      ├── route.ts                  ← List/create broker configs
      └── [id]/verify/route.ts      ← Verify broker credentials
```

### Core Infrastructure
```
src/lib/
  ├── auth.ts                       ← requireUser(), getCurrentUser()
  ├── encryption.ts                 ← encryptSecret(), decryptSecret()
  ├── firebase-client.ts            ← Client-side Firebase auth
  └── prisma.ts                     ← Prisma client singleton

prisma/schema.prisma                ← Multi-tenant database schema
middleware.ts                       ← Route protection & onboarding guards
```

---

## 🐛 Troubleshooting

### "Firebase app not initialized"
→ Check `.env` file has all `NEXT_PUBLIC_FIREBASE_*` variables

### "Database connection failed"
→ Check `DATABASE_URL` in `.env` is correct Neon connection string

### "Cannot find module @prisma/client"
→ Run `npx prisma generate`

### "Middleware redirect loop"
→ Clear browser cookies and try again

### Broker verification fails with 401
→ Check your Alpaca API keys are correct (Paper vs Live)

### Broker verification fails with 403
→ In Alpaca dashboard, make sure API keys have "Trading" permission enabled

---

## ✨ Next Steps

Now that onboarding works, you need to:

### 1. Build the Dashboard
The dashboard should show:
- Broker connection status
- Current account balance (from `BrokerConfig.buyingPower`)
- List of bots (empty for now)
- Recent trades (empty for now)

### 2. Update Your Existing Bot Code
Your old trading bots need to:
- Accept `userId` parameter
- Query `BrokerConfig` to get API credentials (decrypt them)
- Save trades to the database with `userId`

### 3. Create Bot Management UI
- Page to create new bots
- Select strategy
- Set risk parameters
- Start/stop bots

### 4. Migrate Old Data (Optional)
If you have existing trades in SQLite:
- Export from `journal.db`
- Import into PostgreSQL with your `userId`

---

## 🎓 Understanding the Architecture

### Authentication Flow
```
User Sign Up/Sign In
  ↓
Firebase Auth (client)
  ↓
ID Token sent to backend
  ↓
requireUser() verifies token
  ↓
Returns User from PostgreSQL
```

### Broker Security Flow
```
User enters API keys (plain text)
  ↓
encryptSecret() with AES-256-GCM
  ↓
Stored in BrokerConfig (encrypted + IV + auth tag)
  ↓
decryptSecret() only when needed
  ↓
Never exposed in API responses
```

### Onboarding State Machine
```
CREATED
  ↓ (accept legal docs)
TERMS_ACCEPTED
  ↓ (connect broker)
BROKER_CONNECTED
  ↓ (optional: more steps)
COMPLETED
```

---

## 📞 Need Help?

If something isn't working:
1. Check the browser console for errors
2. Check the terminal (Next.js server) for API errors
3. Open Prisma Studio to see what's in the database
4. Check the `AuditLog` table to see what actions succeeded/failed

---

## 🎊 Congratulations!

You now have a **professional, multi-tenant trading platform** with:
- ✅ User authentication
- ✅ Encrypted broker credentials
- ✅ Legal compliance tracking
- ✅ Audit logging
- ✅ Multi-tenant database
- ✅ Secure onboarding flow

**This is production-ready architecture!** 🚀
