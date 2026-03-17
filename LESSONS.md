# Lessons Learned

Things we've discovered the hard way so we don't repeat the same mistakes.

---

## Environment & Config

- **OANDA keys in `.env` are placeholders** — They ship as `your_demo_account_id` / `your_api_token`. Always verify real credentials are set before debugging API connection issues.
- **Missing env vars cause silent 31-day outages** — The system ran for a month with zero trades because DATABASE_URL and ENCRYPTION_KEY were missing. Watchdog only checked process health, not pipeline health. Fixed: Added Tier 0 pipeline checks to watchdog.py (March 2026).
- **Account balance mismatch ($100k vs $10k)** — db.ts initialized accounts with hardcoded $100,000 but brain docs and ACCOUNT_BALANCE env said $10,000. This causes 10x position sizing errors. Fixed: db.ts now reads from ACCOUNT_BALANCE env var (March 2026).
- **Mock DB swallows errors silently** — If better-sqlite3 fails at runtime, the mock DB returns empty results. Trades execute but never persist. Fixed: Mock DB now only activates during build time, throws at runtime (March 2026).
- **Timing-safe comparison defeated by === pre-check** — The webhook route checked `authHeader === expected` before calling `timingSafeEqual`. The === leaks timing info, defeating the purpose. Fixed: Length check + timingSafeEqual only (March 2026).
- **OANDA pip value is NOT 10 for all pairs** — JPY pairs have different pip values. Using pipValue=10 universally causes wrong position sizes. Fixed: Dynamic calculation based on instrument (March 2026).
- **Never commit server IPs to version control** — CONTABO_SERVER_SETUP.md had the real IP hardcoded. Anyone with repo access sees it. Use encrypted vault instead (March 2026).
- **PBKDF2 needs 600k+ iterations (2024 OWASP)** — 100k iterations is from 2021 standards. Upgraded to 600k. Note: existing vaults encrypted with 100k won't decrypt with 600k — re-run `store` command.

## Security

- **Always require WEBHOOK_SECRET** — If the env var is unset, all webhook requests were accepted without auth. Now the route hard-fails in production AND development if WEBHOOK_SECRET is missing.
- **readBrainFile() needs path validation** — Without checking for `..` in the filename parameter, attackers can read arbitrary server files via `/api/brain?file=../../../etc/passwd`. Always validate and resolve paths.
- **Trade status should include PENDING and REJECTED** — Inserting trades as 'OPEN' before broker confirmation means failed broker calls orphan fake 'LOSS' records. Insert as PENDING first, then update after broker confirms.
- **CONTROL_API_KEY must be set in production** — Without it, anyone can killswitch the trading system or pause agents via unauthenticated POST to /api/control.
