#!/usr/bin/env python3
"""
SwjshAK Watchdog v2.0
Production-grade monitoring daemon. Pure Python — zero LLM calls, zero API cost.
Runs 24/7 on the GCP VM alongside the trading platform.

MONITORING TIERS:
  Tier 1 — Critical (every 1-3 min): Agent health, daily P&L, kill switch, services
  Tier 2 — Trading (every 5-10 min): Stale orders, active trade duration, signals, brokers
  Tier 3 — Performance (every 30 min): Win rates, friction, intel gating, strategy P&L
  Tier 4 — Daily (once per day): Professor digest, weekly trends, evolution triggers

Chief (OpenClaw/Sonnet) is ONLY woken when this script detects something that
requires AI judgment — not for routine reporting.
"""

import json
import os
import sqlite3
import time
import shutil
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
import logging

# ── Config ──────────────────────────────────────────────────────────────────
APP_DIR = Path(os.environ.get("APP_DIR", "/home/jackw/SwjshAlgoKnife"))
DB_PATH = Path(os.environ.get("DATABASE_PATH", str(APP_DIR / "journal.db")))
AGENTS_DB_PATH = Path(os.environ.get("AGENTS_DB_PATH", str(APP_DIR / "data" / "agents_db.json")))
DATA_DIR = Path(os.environ.get("DATA_DIR", str(APP_DIR / "data")))
BRAIN_DIR = APP_DIR / "data" / "brain"
PIPELINE_DIR = Path(os.environ.get("PIPELINE_DIR", os.path.expanduser("~/.openclaw/pipeline")))

OPENCLAW_GATEWAY = os.environ.get("OPENCLAW_GATEWAY", "http://127.0.0.1:3001")
OPENCLAW_TOKEN = os.environ.get("OPENCLAW_GATEWAY_TOKEN", "")
DISCORD_WEBHOOK = os.environ.get("DISCORD_CHIEF_WEBHOOK", "")

# ── Thresholds ──────────────────────────────────────────────────────────────
# Risk (match RiskEngine defaults in src/lib/engine/risk/RiskEngine.ts)
ACCOUNT_BALANCE = float(os.environ.get("ACCOUNT_BALANCE", "10000"))
MAX_DAILY_LOSS_PCT = 0.02                    # 2% = $200 on $10k
DAILY_LOSS_WARN = ACCOUNT_BALANCE * MAX_DAILY_LOSS_PCT * 0.5  # 50% of limit = warning
DAILY_LOSS_KILL = ACCOUNT_BALANCE * MAX_DAILY_LOSS_PCT         # 100% of limit = kill switch
MAX_CONCURRENT_TRADES = 3                     # per RiskEngine default
MAX_CORRELATED_EXPOSURE = 2                   # per RiskEngine default

# Agent health
AGENT_STALE_SECS = 120                        # 2 min without status update = stale
AGENT_DEAD_SECS = 600                         # 10 min = dead, needs restart investigation
RESTART_CRASH_THRESHOLD = 3                   # 3 restarts in 1 hour = crash loop
RESTART_CRASH_WINDOW_SECS = 3600

# Trade health
STALE_PENDING_TRADE_MINS = 30                 # SQLite PENDING trade older than this
STALE_PENDING_ORDER_MINS = 120                # agents_db pending_order older than this
MAX_TRADE_DURATION_MINS = 240                 # 4 hours = flag (news risk, set-and-forget overrun)
STERLING_WINDOW_CLOSE_HOUR = 12               # Sterling should close FX by noon ET

# Signal health
SIGNAL_DROUGHT_MINS = 120                     # No signals in 2 hours during market hours = flag
WEBHOOK_DROUGHT_MINS = 480                    # No webhooks in 8 hours during market hours = flag

# Performance
WIN_RATE_FLOOR = 35.0                         # Below 35% win rate over 20 trades = flag
FRICTION_WARN_PCT = 10.0                      # Friction > 10% of gross PnL = flag

# Disk
DISK_WARN_PCT = 85                            # Disk usage warning at 85%
DISK_CRITICAL_PCT = 95                        # Disk critical at 95%

# ── Agent Registry ──────────────────────────────────────────────────────────
# Maps agents_db.json keys to human names and expected data files
TRADING_AGENTS = {
    "fx":      {"name": "Sterling",    "market": "forex",   "data_file": "fx_agent_status.json"},
    "crypto":  {"name": "Bitcoin Bob", "market": "crypto",  "data_file": "crypto_agent_status.json"},
    "futures": {"name": "Pivot Pete",  "market": "futures", "data_file": "futures_agent_status.json"},
    "boba":    {"name": "Boba",        "market": "options", "data_file": None},
    "spx":     {"name": "SPX Sniper",  "market": "options", "data_file": "spx_agent_status.json"},
    "orb":     {"name": "ORB Runner",  "market": "futures", "data_file": None},
}

OVERSIGHT_AGENTS = {
    "professor": {"name": "The Professor"},
    "auditor":   {"name": "The Auditor"},
}

# Correlation groups (from RiskEngine)
CORRELATION_GROUPS = {
    "EUR_GBP": ["EURUSD", "GBPUSD", "EURGBP", "GBPJPY", "EURJPY"],
    "USD_JPY": ["USDJPY", "EURJPY", "GBPJPY"],
    "INDICES": ["ES", "NQ", "SPY", "QQQ", "SPXW"],
    "CRYPTO":  ["BTC-USD", "ETH-USD", "SOL-USD"],
}

# Market hours (ET)
MARKET_SESSIONS = {
    "london":  {"open_h": 3,  "open_m": 0,  "close_h": 11, "close_m": 30},
    "nyse":    {"open_h": 9,  "open_m": 30, "close_h": 16, "close_m": 0},
    "overlap": {"open_h": 8,  "open_m": 0,  "close_h": 12, "close_m": 0},
}

# ── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [WATCHDOG] %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("watchdog")


# ═══════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def post_discord(message: str, title: str = "", color: int = 0x06B6D4, level: str = "info"):
    """Fire a Discord webhook embed. level: info, warn, critical"""
    if not DISCORD_WEBHOOK:
        log.warning("DISCORD_CHIEF_WEBHOOK not set — skipping Discord post")
        return
    colors = {"info": 0x06B6D4, "warn": 0xF59E0B, "critical": 0xEF4444, "success": 0x22C55E}
    c = colors.get(level, color)
    try:
        payload = {"embeds": [{"title": title or "Watchdog", "description": message[:4000], "color": c,
                               "footer": {"text": f"SwjshAK Watchdog | {datetime.now().strftime('%H:%M ET')}"}}]}
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(DISCORD_WEBHOOK, data=data,
                                     headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=10):
            pass
    except Exception as e:
        log.error("Discord post failed: %s", e)


def wake_chief(reason: str, context: str):
    """Wake Chief (Sonnet) via OpenClaw gateway for AI judgment. Use sparingly."""
    log.warning("WAKING CHIEF: %s", reason)
    if not OPENCLAW_TOKEN:
        post_discord(f"**Watchdog needs Chief but gateway offline.**\n\n{reason}\n\n{context}", level="critical")
        return
    try:
        brain_dir = str(APP_DIR / "data" / "brain")
        payload = json.dumps({
            "agentId": "chief",
            "text": f"WATCHDOG ALERT: {reason}\n\nContext:\n{context}\n\n"
                    f"SELF-HEALING PROTOCOL:\n"
                    f"1. Read {brain_dir}/self-healing.md — check if this is a known issue with an auto-fix\n"
                    f"2. If known fix exists → apply it, log result to self-healing.md Remediation Log\n"
                    f"3. If unknown → log to self-healing.md New Issues Queue, post to Discord, escalate to Jack\n"
                    f"4. Log your decision to {brain_dir}/decisions-log.md\n"
                    f"5. Post your action (or escalation) to Discord #chief-main.",
            "mode": "now"
        }).encode("utf-8")
        req = urllib.request.Request(f"{OPENCLAW_GATEWAY}/system/event", data=payload,
                                     headers={"Content-Type": "application/json",
                                              "Authorization": f"Bearer {OPENCLAW_TOKEN}"}, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            log.info("Chief woken — gateway responded %s", resp.status)
    except Exception as e:
        log.error("Failed to wake Chief: %s", e)
        post_discord(f"**Failed to wake Chief.**\n{reason}\n\nGateway error: `{e}`", level="critical")


def write_error_task(task_id: str, title: str, description: str, severity: str = "medium"):
    """Write an error task to the pipeline outbox for Opus to diagnose on next cycle."""
    errors_dir = PIPELINE_DIR / "outbox" / "errors"
    errors_dir.mkdir(parents=True, exist_ok=True)
    task = {
        "taskId": task_id,
        "created": datetime.utcnow().isoformat() + "Z",
        "source": "watchdog",
        "severity": severity,
        "title": title,
        "description": description,
    }
    filepath = errors_dir / f"{task_id}.json"
    try:
        with open(filepath, "w") as f:
            json.dump(task, f, indent=2)
        log.info("Error task written: %s", filepath)
    except Exception as e:
        log.error("Failed to write error task: %s", e)


def db_query(sql: str, params=()):
    """Read-only query against journal.db. Returns list of dicts."""
    if not DB_PATH.exists():
        return []
    try:
        conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, timeout=5)
        conn.row_factory = sqlite3.Row
        rows = [dict(r) for r in conn.execute(sql, params).fetchall()]
        conn.close()
        return rows
    except Exception as e:
        log.error("DB query failed: %s | SQL: %s", e, sql[:100])
        return []


def load_agents_db() -> dict:
    if not AGENTS_DB_PATH.exists():
        return {}
    try:
        with open(AGENTS_DB_PATH) as f:
            return json.load(f)
    except Exception as e:
        log.error("Failed to load agents_db.json: %s", e)
        return {}


def load_data_file(filename: str) -> dict:
    path = DATA_DIR / filename
    if not path.exists():
        return {}
    try:
        with open(path) as f:
            return json.load(f)
    except Exception as e:
        log.warning(f"Failed to load data file {filename}: {e}")
        return {}


def now_et() -> datetime:
    """Current time. Assumes VM is set to ET or uses TZ env var."""
    return datetime.now()


def is_weekday() -> bool:
    return now_et().weekday() < 5


def is_market_session(session: str) -> bool:
    if not is_weekday():
        return False
    s = MARKET_SESSIONS.get(session, {})
    if not s:
        return False
    now = now_et()
    open_mins = s["open_h"] * 60 + s["open_m"]
    close_mins = s["close_h"] * 60 + s["close_m"]
    current_mins = now.hour * 60 + now.minute
    return open_mins <= current_mins < close_mins


def is_any_market_open() -> bool:
    """True if NYSE or London session is active, or if it's a weekday and crypto runs 24/7."""
    return is_market_session("nyse") or is_market_session("london")


def parse_iso(ts_str: str) -> Optional[datetime]:
    if not ts_str:
        return None
    try:
        # Handle various ISO formats
        cleaned = ts_str.replace("Z", "+00:00").split("+")[0].split(".")[0]
        return datetime.fromisoformat(cleaned)
    except Exception as e:
        log.debug(f"Failed to parse ISO timestamp '{ts_str}': {e}")
        return None


def seconds_since(ts_str: str) -> float:
    dt = parse_iso(ts_str)
    if not dt:
        return float("inf")
    return (datetime.now() - dt).total_seconds()


# ═══════════════════════════════════════════════════════════════════════════
# TIER 1 — CRITICAL CHECKS (every 1-3 minutes)
# ═══════════════════════════════════════════════════════════════════════════

def check_agent_health():
    """Verify every trading agent is alive and reporting."""
    agents = load_agents_db()
    if not agents:
        post_discord("**agents_db.json is empty or missing.** Cannot monitor agent health.", level="critical")
        wake_chief("agents_db.json missing or empty", "The agent state file is missing. "
                    "Either the trading app hasn't started or the file was deleted.")
        return

    issues = []
    for key, meta in TRADING_AGENTS.items():
        state = agents.get(key, {})
        if not isinstance(state, dict):
            issues.append(f"**{meta['name']}** ({key}): No state data at all")
            continue

        status = (state.get("status") or "UNKNOWN").upper()
        last_updated = state.get("last_updated", "")
        staleness = seconds_since(last_updated)

        # Check status
        if status == "HALTED":
            issues.append(f"**{meta['name']}**: HALTED")
        elif status not in ("ACTIVE", "ONLINE", "PAUSED"):
            issues.append(f"**{meta['name']}**: Unknown status `{status}`")

        # Check freshness (only during market hours for that agent's market)
        if meta["market"] == "crypto" or is_any_market_open():
            if staleness > AGENT_DEAD_SECS:
                issues.append(f"**{meta['name']}**: Last update {int(staleness)}s ago (DEAD?)")
            elif staleness > AGENT_STALE_SECS:
                issues.append(f"**{meta['name']}**: Last update {int(staleness)}s ago (stale)")

    if issues:
        msg = "\n".join(f"- {i}" for i in issues)
        severity = "critical" if any("HALTED" in i or "DEAD" in i for i in issues) else "warn"
        post_discord(msg, title="Agent Health Issues", level=severity)

        # Wake Chief only for HALTED or DEAD agents
        critical = [i for i in issues if "HALTED" in i or "DEAD" in i]
        if critical:
            wake_chief("Agent(s) HALTED or DEAD", "\n".join(critical))


def check_daily_pnl():
    """Monitor today's realized P&L against risk limits."""
    rows = db_query("""
        SELECT ROUND(SUM(pnl), 2) as daily_pnl,
               COUNT(*) as total,
               SUM(CASE WHEN status='WIN' THEN 1 ELSE 0 END) as wins,
               SUM(CASE WHEN status='LOSS' THEN 1 ELSE 0 END) as losses
        FROM trades
        WHERE date(exit_date) = date('now') AND status IN ('WIN', 'LOSS')
    """)
    if not rows or rows[0]["daily_pnl"] is None:
        return

    pnl = rows[0]["daily_pnl"]
    wins = rows[0]["wins"] or 0
    losses = rows[0]["losses"] or 0

    if pnl <= -DAILY_LOSS_KILL:
        wake_chief(
            f"KILL SWITCH: Daily P&L ${pnl:.2f} breaches -{DAILY_LOSS_KILL:.0f} limit",
            f"Today: {wins}W/{losses}L = ${pnl:.2f}\n"
            f"Account: ${ACCOUNT_BALANCE:.0f} | Limit: {MAX_DAILY_LOSS_PCT*100:.0f}% = ${DAILY_LOSS_KILL:.0f}\n"
            f"Recommend: Halt all trading agents immediately. Query agents_db.json and halt each."
        )
        write_error_task(
            f"kill-switch-{datetime.now().strftime('%Y%m%d')}",
            f"Kill switch triggered: ${pnl:.2f} daily loss",
            f"Daily loss of ${pnl:.2f} exceeded {MAX_DAILY_LOSS_PCT*100:.0f}% limit on ${ACCOUNT_BALANCE:.0f} account.",
            severity="critical"
        )
    elif pnl <= -DAILY_LOSS_WARN:
        post_discord(
            f"Daily P&L: **${pnl:.2f}** ({wins}W/{losses}L)\n"
            f"At **{abs(pnl)/DAILY_LOSS_KILL*100:.0f}%** of kill switch limit (${DAILY_LOSS_KILL:.0f})",
            title="Drawdown Warning", level="warn"
        )


def check_active_trade_count():
    """Monitor concurrent open trades vs RiskEngine max."""
    agents = load_agents_db()
    total_active = 0
    per_agent = {}
    correlated = {}

    for key in TRADING_AGENTS:
        state = agents.get(key, {})
        active = state.get("active_trades", [])
        count = len(active) if isinstance(active, list) else 0
        per_agent[key] = count
        total_active += count

        # Check correlation groups
        for trade in (active if isinstance(active, list) else []):
            ticker = trade.get("ticker", "")
            for group_name, symbols in CORRELATION_GROUPS.items():
                if ticker in symbols:
                    correlated.setdefault(group_name, []).append(
                        f"{TRADING_AGENTS[key]['name']}: {ticker} {trade.get('side', '?')}"
                    )

    # Flag if total active exceeds max
    if total_active > MAX_CONCURRENT_TRADES:
        details = ", ".join(f"{TRADING_AGENTS[k]['name']}={v}" for k, v in per_agent.items() if v > 0)
        post_discord(
            f"**{total_active} concurrent trades** (max: {MAX_CONCURRENT_TRADES})\n{details}",
            title="Concurrent Trade Limit", level="warn"
        )

    # Flag correlated exposure
    for group, trades in correlated.items():
        if len(trades) > MAX_CORRELATED_EXPOSURE:
            post_discord(
                f"**{group}** group has {len(trades)} positions:\n" +
                "\n".join(f"- {t}" for t in trades),
                title="Correlation Exposure Warning", level="warn"
            )


def check_services():
    """Verify the trading dashboard API is responding."""
    try:
        req = urllib.request.Request("http://localhost:3000/api/agents", method="GET")
        with urllib.request.urlopen(req, timeout=8) as resp:
            if resp.status != 200:
                raise Exception(f"HTTP {resp.status}")
            data = json.loads(resp.read())
            # Verify the response has expected structure
            if "agents" not in data and not isinstance(data, dict):
                raise Exception("Unexpected response structure")
    except Exception as e:
        post_discord(f"Dashboard API not responding: `{e}`", title="Service Down", level="critical")


def check_disk_space():
    """Monitor VM disk usage."""
    try:
        usage = shutil.disk_usage("/")
        pct = (usage.used / usage.total) * 100
        if pct >= DISK_CRITICAL_PCT:
            post_discord(f"Disk usage: **{pct:.1f}%** — CRITICAL. System may fail.",
                         title="Disk Space Critical", level="critical")
        elif pct >= DISK_WARN_PCT:
            post_discord(f"Disk usage: **{pct:.1f}%** — clean up logs or old data.",
                         title="Disk Space Warning", level="warn")
    except Exception as e:
        log.warning(f"Failed to check disk space: {e}")


# ═══════════════════════════════════════════════════════════════════════════
# TIER 2 — TRADING CHECKS (every 5-10 minutes)
# ═══════════════════════════════════════════════════════════════════════════

def check_stale_pending_trades():
    """Flag PENDING trades in SQLite stuck too long."""
    rows = db_query(f"""
        SELECT id, symbol, strategy, entry_date,
               CAST((julianday('now') - julianday(entry_date)) * 1440 AS INTEGER) as mins_pending
        FROM trades
        WHERE status = 'PENDING'
        AND datetime(entry_date) < datetime('now', '-{STALE_PENDING_TRADE_MINS} minutes')
    """)
    if rows:
        details = "\n".join(f"- #{r['id']} {r['symbol']} ({r['strategy']}) — {r['mins_pending']} min"
                            for r in rows[:10])
        post_discord(f"**{len(rows)} stale PENDING trade(s)**:\n{details}",
                     title="Stale Trades", level="warn")


def check_stale_pending_orders():
    """Flag pending_orders in agents_db.json that are too old."""
    agents = load_agents_db()
    stale = []

    for key, meta in TRADING_AGENTS.items():
        state = agents.get(key, {})
        orders = state.get("pending_orders", [])
        if not isinstance(orders, list):
            continue
        for order in orders:
            created = order.get("created_at", "")
            age_secs = seconds_since(created)
            if age_secs > STALE_PENDING_ORDER_MINS * 60:
                age_mins = int(age_secs / 60)
                ticker = order.get("ticker", "?")
                stale.append(f"**{meta['name']}**: {ticker} pending for {age_mins} min")

    if stale:
        post_discord("\n".join(f"- {s}" for s in stale),
                     title="Stale Pending Orders", level="warn")


def check_active_trade_duration():
    """Flag trades open longer than MAX_TRADE_DURATION_MINS."""
    agents = load_agents_db()
    long_trades = []

    for key, meta in TRADING_AGENTS.items():
        state = agents.get(key, {})
        active = state.get("active_trades", [])
        if not isinstance(active, list):
            continue
        for trade in active:
            entry_time = trade.get("entry_time", "")
            duration_secs = seconds_since(entry_time)
            duration_mins = int(duration_secs / 60)
            if duration_mins > MAX_TRADE_DURATION_MINS:
                ticker = trade.get("ticker", "?")
                side = trade.get("side", "?")
                long_trades.append(f"**{meta['name']}**: {ticker} {side} open for {duration_mins} min")

    if long_trades:
        post_discord(
            "\n".join(f"- {t}" for t in long_trades) +
            f"\n\nMax expected hold: {MAX_TRADE_DURATION_MINS} min. News event risk.",
            title="Long-Duration Trades", level="warn"
        )


def check_sterling_noon_window():
    """Verify Sterling closes FX positions by noon ET on weekdays."""
    now = now_et()
    if not is_weekday() or now.hour < STERLING_WINDOW_CLOSE_HOUR or now.hour > 13:
        return

    agents = load_agents_db()
    fx = agents.get("fx", {})
    active = fx.get("active_trades", [])
    if isinstance(active, list) and len(active) > 0:
        tickers = [t.get("ticker", "?") for t in active]
        post_discord(
            f"Sterling has **{len(active)} open FX position(s)** past noon ET: {', '.join(tickers)}\n"
            f"Set-and-forget window should have closed these.",
            title="Sterling Window Overrun", level="warn"
        )


def check_overnight_positions():
    """Flag open positions held from previous day."""
    now = now_et()
    if not (0 <= now.hour < 9) or not is_weekday():
        return

    rows = db_query("""
        SELECT symbol, direction, strategy, entry_date,
               CAST((julianday('now') - julianday(entry_date)) * 24 AS INTEGER) as hours_held
        FROM trades WHERE status = 'OPEN' AND date(entry_date) < date('now')
    """)
    if rows:
        details = "\n".join(f"- {r['symbol']} {r['direction']} ({r['strategy']}) — {r['hours_held']}h"
                            for r in rows)
        post_discord(f"**{len(rows)} overnight position(s):**\n{details}",
                     title="Overnight Positions", level="warn")


def check_signal_pipeline():
    """Verify signals are flowing during market hours."""
    if not is_any_market_open():
        return

    rows = db_query(f"""
        SELECT COUNT(*) as cnt,
               MAX(timestamp) as last_signal
        FROM signals
        WHERE datetime(timestamp) > datetime('now', '-{SIGNAL_DROUGHT_MINS} minutes')
    """)
    if rows and rows[0]["cnt"] == 0:
        last = db_query("SELECT MAX(timestamp) as ts FROM signals")
        last_ts = last[0]["ts"] if last else "never"
        post_discord(
            f"No signals received in the last **{SIGNAL_DROUGHT_MINS} min** during market hours.\n"
            f"Last signal: `{last_ts}`\n"
            f"Check: TradingView alerts, webhook endpoint, agent_runner.ts",
            title="Signal Drought", level="warn"
        )


def check_broker_connectivity():
    """Check broker status from agents_db.json meta."""
    agents = load_agents_db()
    disconnected = []

    for key, meta in TRADING_AGENTS.items():
        state = agents.get(key, {})
        agent_meta = state.get("meta", {})
        broker = agent_meta.get("broker", {})
        if broker and broker.get("status") == "unlinked":
            disconnected.append(f"**{meta['name']}** ({key}): broker `{broker.get('platform', '?')}` unlinked")

    if disconnected:
        post_discord("\n".join(f"- {d}" for d in disconnected),
                     title="Broker Disconnected", level="warn")


def check_consecutive_losses():
    """Check for strategies with dangerous loss streaks."""
    rows = db_query("""
        SELECT strategy, COUNT(*) as recent_losses
        FROM trades
        WHERE status = 'LOSS' AND datetime(entry_date) >= datetime('now', '-48 hours')
        GROUP BY strategy ORDER BY recent_losses DESC
    """)
    for row in rows:
        strat = row["strategy"]
        n = row["recent_losses"]
        if n >= 3:
            wake_chief(
                f"Strategy '{strat}' has {n} losses in 48 hours",
                f"This breaches the kill switch threshold of 3 consecutive losses.\n"
                f"Query agents_db.json, check if the strategy's agent should be halted.\n"
                f"Check Professor reviews for pattern analysis."
            )
            write_error_task(
                f"loss-streak-{strat.lower().replace(' ', '-')}-{datetime.now().strftime('%Y%m%d')}",
                f"{strat}: {n} losses in 48 hours",
                f"Strategy {strat} has {n} losses in the last 48 hours. "
                f"Analyze Professor grades, check for pattern, consider parameter adjustment.",
                severity="high"
            )
        elif n >= 2:
            post_discord(f"**{strat}**: {n} losses in 48h. Watching.",
                         title="Loss Streak Forming", level="warn")


# ═══════════════════════════════════════════════════════════════════════════
# TIER 3 — PERFORMANCE CHECKS (every 30 minutes)
# ═══════════════════════════════════════════════════════════════════════════

def check_win_rates():
    """Monitor rolling win rate per agent. Flag if below floor."""
    agents = load_agents_db()
    weak = []

    for key, meta in TRADING_AGENTS.items():
        state = agents.get(key, {})
        perf = state.get("performance", {})
        win_rate = perf.get("win_rate", 0)
        trades = perf.get("trades", 0)

        if trades >= 20 and win_rate < WIN_RATE_FLOOR:
            weak.append(f"**{meta['name']}**: {win_rate:.0f}% win rate over {trades} trades")

    if weak:
        msg = "\n".join(f"- {w}" for w in weak)
        post_discord(msg + f"\n\nFloor: {WIN_RATE_FLOOR}%. Consider strategy review.",
                     title="Low Win Rate Alert", level="warn")
        write_error_task(
            f"low-winrate-{datetime.now().strftime('%Y%m%d')}",
            "Agent(s) below win rate floor",
            "\n".join(weak) + f"\nWin rate floor: {WIN_RATE_FLOOR}%.",
            severity="medium"
        )


def check_friction():
    """Monitor slippage and friction costs across agents."""
    agents = load_agents_db()
    high_friction = []

    for key, meta in TRADING_AGENTS.items():
        state = agents.get(key, {})
        closed = state.get("closed_trades", [])
        if not isinstance(closed, list) or len(closed) < 5:
            continue

        # Look at recent trades
        recent = closed[-20:]
        total_gross = sum(abs(t.get("grossPnL", t.get("pnl", 0))) for t in recent)
        total_friction = sum(abs(t.get("frictionCost", 0)) for t in recent)

        if total_gross > 0:
            friction_pct = (total_friction / total_gross) * 100
            if friction_pct > FRICTION_WARN_PCT:
                high_friction.append(
                    f"**{meta['name']}**: {friction_pct:.1f}% friction "
                    f"(${total_friction:.2f} of ${total_gross:.2f} gross over {len(recent)} trades)"
                )

    if high_friction:
        post_discord("\n".join(f"- {h}" for h in high_friction),
                     title="High Friction/Slippage", level="warn")


def check_strategy_pnl_breakdown():
    """Per-strategy P&L for today. Informational during market hours."""
    if not is_market_session("nyse"):
        return

    rows = db_query("""
        SELECT strategy,
               COUNT(*) as trades,
               SUM(CASE WHEN status='WIN' THEN 1 ELSE 0 END) as wins,
               ROUND(SUM(pnl), 2) as total_pnl
        FROM trades
        WHERE date(exit_date) = date('now') AND status IN ('WIN', 'LOSS')
        GROUP BY strategy ORDER BY total_pnl DESC
    """)
    if not rows:
        return

    # Only post if there's meaningful activity (3+ trades)
    total_trades = sum(r["trades"] for r in rows)
    if total_trades < 3:
        return

    lines = []
    for r in rows:
        wr = (r["wins"] / r["trades"] * 100) if r["trades"] > 0 else 0
        emoji = "+" if r["total_pnl"] >= 0 else ""
        lines.append(f"**{r['strategy']}**: {emoji}${r['total_pnl']:.2f} ({r['wins']}W/{r['trades']-r['wins']}L = {wr:.0f}%)")

    total_pnl = sum(r["total_pnl"] for r in rows)
    lines.append(f"\n**Total: {'+'if total_pnl >= 0 else ''}${total_pnl:.2f}** across {total_trades} trades")

    post_discord("\n".join(lines), title="Midday Strategy Breakdown", level="info")


def check_intel_gating():
    """Monitor intel preflight decisions — is the gate working?"""
    rows = db_query("""
        SELECT decision, COUNT(*) as cnt
        FROM intel_preflight_log
        WHERE datetime(timestamp) >= datetime('now', '-24 hours')
        GROUP BY decision
    """)
    if not rows:
        return

    decisions = {r["decision"]: r["cnt"] for r in rows}
    total = sum(decisions.values())
    if total < 5:
        return

    no_go = decisions.get("NO_GO", 0)
    reduced = decisions.get("REDUCED", 0)
    go = decisions.get("GO", 0)

    block_rate = ((no_go + reduced) / total * 100) if total > 0 else 0

    # If intel is blocking >60% of trades, something might be misconfigured
    if block_rate > 60:
        post_discord(
            f"Intel gating in last 24h: **{go} GO**, **{reduced} REDUCED**, **{no_go} NO_GO**\n"
            f"Block rate: **{block_rate:.0f}%** — intel may be too restrictive.",
            title="Intel Gate: High Block Rate", level="warn"
        )
    # If intel never blocks anything, it's not adding value
    elif block_rate < 5 and total > 20:
        post_discord(
            f"Intel gating in last 24h: **{go} GO**, **{reduced} REDUCED**, **{no_go} NO_GO**\n"
            f"Block rate: **{block_rate:.0f}%** — intel gate may not be effective.",
            title="Intel Gate: Low Block Rate", level="info"
        )


# ═══════════════════════════════════════════════════════════════════════════
# TIER 4 — DAILY CHECKS (once per day)
# ═══════════════════════════════════════════════════════════════════════════

def daily_professor_digest():
    """Summarize Professor grades from yesterday."""
    agents = load_agents_db()
    prof = agents.get("professor", {})
    reviews = prof.get("reviews", [])
    if not isinstance(reviews, list) or not reviews:
        return

    # Filter to recent reviews (last 24h)
    recent = []
    for r in reviews:
        if seconds_since(r.get("timestamp", "")) < 86400:
            recent.append(r)

    if not recent:
        return

    grade_counts = {}
    for r in recent:
        g = r.get("grade", "?")
        grade_counts[g] = grade_counts.get(g, 0) + 1

    grades_str = ", ".join(f"{g}: {c}" for g, c in sorted(grade_counts.items()))
    bad_grades = sum(grade_counts.get(g, 0) for g in ["D", "F", "C-"])
    good_grades = sum(grade_counts.get(g, 0) for g in ["A", "A-", "B+", "B"])

    msg = f"**{len(recent)} trades graded**: {grades_str}\n"
    if bad_grades > good_grades:
        msg += f"More bad grades ({bad_grades}) than good ({good_grades}). Review execution quality."
    else:
        msg += f"Good: {good_grades} | Bad: {bad_grades}"

    post_discord(msg, title="Professor Daily Digest", level="info")


def daily_system_health_report():
    """Comprehensive daily health report at market close."""
    now = now_et()
    if not is_weekday() or now.hour != 16 or now.minute > 5:
        return

    agents = load_agents_db()
    lines = ["**End-of-Day System Health**\n"]

    # Agent status summary
    active_count = 0
    for key, meta in TRADING_AGENTS.items():
        state = agents.get(key, {})
        status = (state.get("status") or "?").upper()
        perf = state.get("performance", {})
        pnl = perf.get("total_pnl", 0)
        if status in ("ACTIVE", "ONLINE"):
            active_count += 1
        lines.append(f"- {meta['name']}: {status} | PnL: ${pnl:.2f}")

    lines.append(f"\n**{active_count}/{len(TRADING_AGENTS)} agents active**")

    # Today's trades
    rows = db_query("""
        SELECT COUNT(*) as total,
               SUM(CASE WHEN status='WIN' THEN 1 ELSE 0 END) as wins,
               SUM(CASE WHEN status='LOSS' THEN 1 ELSE 0 END) as losses,
               ROUND(SUM(pnl), 2) as pnl
        FROM trades WHERE date(exit_date) = date('now') AND status IN ('WIN', 'LOSS')
    """)
    if rows and rows[0]["total"]:
        r = rows[0]
        wr = (r["wins"] / r["total"] * 100) if r["total"] > 0 else 0
        lines.append(f"\n**Today**: {r['total']} trades | {r['wins']}W/{r['losses']}L ({wr:.0f}%) | P&L: ${r['pnl']:.2f}")

    # Disk
    try:
        usage = shutil.disk_usage("/")
        pct = (usage.used / usage.total) * 100
        lines.append(f"\n**Disk**: {pct:.1f}% used")
    except Exception as e:
        log.debug(f"Could not get disk usage for EOD report: {e}")

    post_discord("\n".join(lines), title="EOD System Report", level="info")


# ═══════════════════════════════════════════════════════════════════════════
# ALERT THROTTLE
# ═══════════════════════════════════════════════════════════════════════════

class AlertThrottle:
    """Prevent repeated alerts for the same issue within a cooldown window."""
    def __init__(self):
        self._last: dict[str, float] = {}

    def should_fire(self, key: str, cooldown_secs: int) -> bool:
        now = time.time()
        if now - self._last.get(key, 0) >= cooldown_secs:
            self._last[key] = now
            return True
        return False


throttle = AlertThrottle()


# ═══════════════════════════════════════════════════════════════════════════
# MAIN LOOP
# ═══════════════════════════════════════════════════════════════════════════

def run_cycle():
    """Execute all monitoring checks at appropriate intervals."""

    # ── TIER 1: Critical (every 2-3 min) ──
    if throttle.should_fire("agent_health", 120):
        check_agent_health()

    if throttle.should_fire("daily_pnl", 180):
        check_daily_pnl()

    if throttle.should_fire("active_trades", 180):
        check_active_trade_count()

    if throttle.should_fire("services", 180):
        check_services()

    if throttle.should_fire("disk", 3600):
        check_disk_space()

    # ── TIER 2: Trading (every 5-10 min) ──
    if throttle.should_fire("stale_pending", 600):
        check_stale_pending_trades()

    if throttle.should_fire("stale_orders", 600):
        check_stale_pending_orders()

    if throttle.should_fire("trade_duration", 600):
        check_active_trade_duration()

    if throttle.should_fire("sterling_noon", 300):
        check_sterling_noon_window()

    if throttle.should_fire("overnight", 3600):
        check_overnight_positions()

    if throttle.should_fire("signals", 900):
        check_signal_pipeline()

    if throttle.should_fire("brokers", 1800):
        check_broker_connectivity()

    if throttle.should_fire("consec_losses", 1800):
        check_consecutive_losses()

    # ── TIER 3: Performance (every 30 min) ──
    if throttle.should_fire("win_rates", 1800):
        check_win_rates()

    if throttle.should_fire("friction", 1800):
        check_friction()

    if throttle.should_fire("strategy_pnl", 1800):
        check_strategy_pnl_breakdown()

    if throttle.should_fire("intel_gate", 3600):
        check_intel_gating()

    # ── TIER 4: Daily ──
    if throttle.should_fire("professor_digest", 86400):
        daily_professor_digest()

    if throttle.should_fire("eod_report", 300):
        daily_system_health_report()


def main():
    log.info("=" * 60)
    log.info("SwjshAK Watchdog v2.0 starting")
    log.info("App dir: %s", APP_DIR)
    log.info("DB path: %s (exists: %s)", DB_PATH, DB_PATH.exists())
    log.info("Agents DB: %s (exists: %s)", AGENTS_DB_PATH, AGENTS_DB_PATH.exists())
    log.info("Account: $%.0f | Daily loss limit: $%.0f (%.0f%%)",
             ACCOUNT_BALANCE, DAILY_LOSS_KILL, MAX_DAILY_LOSS_PCT * 100)
    log.info("Checks: %d total across 4 tiers", 18)
    log.info("=" * 60)

    # Create pipeline directories
    for d in ["inbox/pending", "inbox/active", "inbox/completed", "outbox/reports", "outbox/errors", "schemas"]:
        (PIPELINE_DIR / d).mkdir(parents=True, exist_ok=True)

    post_discord(
        f"**18 checks** across 4 tiers | Account: ${ACCOUNT_BALANCE:.0f}\n"
        f"Daily loss limit: ${DAILY_LOSS_KILL:.0f} | Max concurrent: {MAX_CONCURRENT_TRADES}\n"
        f"Chief woken only for kill switch, dead agents, or loss streaks.",
        title="Watchdog v2.0 Online",
        level="success"
    )

    LOOP_INTERVAL = 60  # Check every 60 seconds, throttle handles cadence per check

    while True:
        try:
            run_cycle()
        except Exception as e:
            log.error("Unhandled error in run_cycle: %s", e, exc_info=True)
        time.sleep(LOOP_INTERVAL)


if __name__ == "__main__":
    main()
