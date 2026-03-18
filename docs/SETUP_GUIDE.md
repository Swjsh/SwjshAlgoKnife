# SwjshAK Multi-Tenant Setup Guide

## ✅ Completed So Far

- [x] Installed Prisma, Firebase client, encryption libraries
- [x] Created multi-tenant database schema
- [x] Created Firebase authentication helpers
- [x] Created encryption service for API keys
- [x] Set up route protection middleware

## 🎯 Next Steps (Do These Now)

### Step 1: Set Up Neon Database (2 minutes)

1. Go to https://neon.tech
2. Click **"Sign Up"** → Sign in with Google
3. Click **"Create a project"**
4. Name it `swjshak` (or whatever you want)
5. Select a region close to you
6. **COPY THE CONNECTION STRING** - it looks like:
   ```
   postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

### Step 2: Generate Encryption Key (30 seconds)

Run this command in PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**COPY THE OUTPUT** (64-character hex string)

### Step 3: Create Your `.env` File

Create a new file called `.env` (not `.env.example`) in the root folder with these values:

```env
# Database (paste your Neon connection string)
DATABASE_URL=postgresql://your-connection-string-here

# Firebase (copy from your existing .env or Firebase console)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Encryption (paste the 64-char key you generated)
ENCRYPTION_KEY=paste_your_64_character_hex_key_here

# Webhook (existing)
WEBHOOK_SECRET=your_secure_webhook_secret_here

# Trading (existing)
ACCOUNT_BALANCE=10000
RISK_PER_TRADE=1
```

### Step 4: Run Database Migration (1 minute)

```powershell
# Generate Prisma client
npx prisma generate

# Create the database tables
npx prisma migrate dev --name init_multi_tenant
```

This will create all the tables in your Neon database.

### Step 5: Verify Setup

```powershell
# View your database in a browser
npx prisma studio
```

This opens a GUI at `http://localhost:5555` where you can see your empty tables.

---

## 📁 What We Built

### New Files Created:

1. **`prisma/schema.prisma`** - Multi-tenant database schema
   - User, BrokerConfig, Bot, Trade, Signal, AuditLog, LegalAcceptance tables

2. **`src/lib/auth.ts`** - Server-side Firebase auth helpers
   - `requireUser()` - Get authenticated user
   - `getCurrentUser()` - Optional user fetch
   - `requireOwnership()` - Verify user owns resource

3. **`src/lib/encryption.ts`** - API key encryption/decryption
   - AES-256-GCM encryption for broker credentials

4. **`src/lib/firebase-client.ts`** - Client-side Firebase auth
   - `signIn()`, `signUp()`, `signOut()`
   - `getIdToken()` for API calls

5. **`src/lib/prisma.ts`** - Prisma client singleton

6. **`src/app/api/auth/session/route.ts`** - Session cookie management

7. **`src/app/api/me/route.ts`** - Current user API

8. **`middleware.ts`** - Route protection & onboarding flow

---

## 🚀 Next Phase: Build Onboarding UI

Once you've completed Steps 1-5 above, we'll build:

1. Sign-in/Sign-up pages
2. Legal acceptance page (disclaimers + waivers)
3. Broker connection page (Alpaca setup)
4. API route to verify broker credentials
5. Onboarding completion page

---

## 🆘 Troubleshooting

### "Can't find module '@prisma/client'"
Run: `npx prisma generate`

### "Environment variable not found: DATABASE_URL"
Make sure you created `.env` (not `.env.example`) and added your Neon connection string

### "Invalid encryption key"
Make sure `ENCRYPTION_KEY` is exactly 64 characters (32 bytes in hex)

### Firebase admin errors
Make sure you have the Firebase service account JSON file or Firebase Admin credentials configured

---

## ✨ Ready to Continue?

After you complete Steps 1-5 above, tell me and I'll build the onboarding UI pages!
