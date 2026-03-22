import json
import os
import random
import requests
from datetime import datetime
from pathlib import Path

# ── Data directory (mirrors agent_runner.ts / dataPaths.ts) ─────────────────
# Docker/GCP: DATA_DIR=/app/data (set by supervisord/ecosystem.config.js)
# Local dev:  defaults to project root (same fallback as the TypeScript side)
_DATA_DIR = Path(os.environ.get('DATA_DIR', Path(__file__).parent.parent))

LOG_FILE = _DATA_DIR / 'agent_logs.json'

# Max log entries kept in agent_logs.json — oldest are dropped on rotation
LOG_MAX_ENTRIES = 500

# ── Intel Integration ────────────────────────────────────────────────────────
# Configurable via INTEL_API_BASE env var for split-host deployments.
# Defaults to localhost:3000 when dashboard and runner share the same host.
INTEL_API_BASE = os.environ.get('INTEL_API_BASE', 'http://localhost:3000/api/intel')

def log_message(agent_id, content, type='status'):
    """Appends an IM-style message to the agent logs"""
    
    if not LOG_FILE.exists():
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG_FILE, 'w') as f:
            json.dump([], f)
            
    try:
        with open(LOG_FILE, 'r') as f:
            logs = json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"[agent_utils] Warning: Could not read log file, starting fresh: {e}")
        logs = []
        
    new_message = {
        'timestamp': datetime.now().isoformat(),
        'agentId': agent_id,
        'content': content,
        'type': type,
        'id': f"{agent_id}-{int(datetime.now().timestamp())}"
    }
    
    logs.append(new_message)

    # Rotate: keep the most recent LOG_MAX_ENTRIES entries
    if len(logs) > LOG_MAX_ENTRIES:
        logs = logs[-LOG_MAX_ENTRIES:]
    
    with open(LOG_FILE, 'w') as f:
        json.dump(logs, f, indent=2)

def get_random_quip(agent_id):
    from agent_personas import PERSONAS
    if agent_id in PERSONAS:
        return random.choice(PERSONAS[agent_id]['quips'])
    return "Scanning markets..."


# ═══════════════════════════════════════════════════════════════
# INTEL PREFLIGHT — Call before every trade decision
# ═══════════════════════════════════════════════════════════════

def call_preflight(agent_id: str, symbol: str, direction: str, strategy: str = None) -> dict:
    """
    Query the Intel Preflight API before placing a trade.

    Returns dict with:
        - decision: 'GO' | 'NO_GO' | 'REDUCED'
        - sizeMultiplier: 0.0 - 1.0
        - intelScore: -1.0 to +1.0
        - regime: market regime string
        - reasons: list of explanation strings
        - adaptations: dict of parameter adjustments

    On error, returns a safe default (GO with full size) so the agent
    doesn't stall if the dashboard is down.
    """
    try:
        payload = {
            'agentId': agent_id,
            'symbol': symbol.upper().replace('/', '').replace('_', ''),
            'direction': direction.upper(),
        }
        if strategy:
            payload['strategy'] = strategy

        resp = requests.post(
            f'{INTEL_API_BASE}/preflight',
            json=payload,
            timeout=5,
        )

        if resp.status_code == 200:
            data = resp.json()
            log_message(agent_id,
                f"🧠 Intel preflight: {data.get('decision', '?')} "
                f"(score: {data.get('intelScore', 0):.2f}, "
                f"regime: {data.get('regime', '?')}, "
                f"size: {data.get('sizeMultiplier', 1.0):.0%})",
                type='intel'
            )
            return data
        else:
            log_message(agent_id, f"⚠️ Intel preflight returned {resp.status_code}", type='warning')
            return _default_preflight()

    except requests.exceptions.ConnectionError:
        # Dashboard not running — safe fallback
        return _default_preflight()
    except Exception as e:
        log_message(agent_id, f"⚠️ Intel preflight error: {str(e)}", type='warning')
        return _default_preflight()


def _default_preflight() -> dict:
    """Safe default when intel is unavailable — don't block trades."""
    return {
        'decision': 'GO',
        'sizeMultiplier': 0.75,  # Slight reduction when flying blind
        'intelScore': 0,
        'regime': 'UNKNOWN',
        'reasons': ['Intel unavailable — using conservative defaults'],
        'adaptations': {},
        'signalCount': 0,
        'signals': [],
        'timestamp': datetime.now().isoformat(),
    }


# ═══════════════════════════════════════════════════════════════
# FEEDBACK — Report trade outcomes back to intel
# ═══════════════════════════════════════════════════════════════

def send_feedback(
    agent_id: str,
    symbol: str,
    direction: str,
    outcome: str,
    pnl: float = None,
    duration_minutes: float = None,
    strategy: str = None,
    trade_id: int = None,
    intel_score_at_entry: float = None,
    intel_decision_at_entry: str = None,
    notes: str = None,
) -> bool:
    """
    Report a trade outcome back to the Intel system for learning.

    Args:
        outcome: 'WIN' | 'LOSS' | 'BE' | 'TIMEOUT' | 'MANUAL_CLOSE'

    Returns True if feedback was recorded successfully.
    """
    try:
        payload = {
            'agentId': agent_id,
            'symbol': symbol.upper().replace('/', '').replace('_', ''),
            'direction': direction.upper(),
            'outcome': outcome.upper(),
        }
        if pnl is not None: payload['pnl'] = pnl
        if duration_minutes is not None: payload['durationMinutes'] = duration_minutes
        if strategy: payload['strategy'] = strategy
        if trade_id is not None: payload['tradeId'] = trade_id
        if intel_score_at_entry is not None: payload['intelScoreAtEntry'] = intel_score_at_entry
        if intel_decision_at_entry: payload['intelDecisionAtEntry'] = intel_decision_at_entry
        if notes: payload['notes'] = notes

        resp = requests.post(
            f'{INTEL_API_BASE}/feedback',
            json=payload,
            timeout=5,
        )

        if resp.status_code == 200:
            log_message(agent_id,
                f"📊 Feedback sent: {outcome} on {symbol} "
                f"(PnL: ${pnl:.2f})" if pnl else f"📊 Feedback sent: {outcome} on {symbol}",
                type='feedback'
            )
            return True
        return False

    except Exception as e:
        # Feedback is fire-and-forget — never block on this, but log for debugging
        print(f"[agent_utils] Feedback send failed (non-blocking): {e}")
        return False


def should_take_trade(preflight: dict) -> bool:
    """
    Simple helper: should the agent take the trade based on preflight?
    Returns False only on explicit NO_GO.
    """
    return preflight.get('decision') != 'NO_GO'


def get_size_multiplier(preflight: dict) -> float:
    """Get the intel-recommended size multiplier from a preflight response."""
    return preflight.get('sizeMultiplier', 1.0)


# ═══════════════════════════════════════════════════════════════
# STATE PERSISTENCE — Survive agent crashes and restarts
# ═══════════════════════════════════════════════════════════════

STATE_DIR = _DATA_DIR / 'agent_state'


def save_agent_state(agent_id: str, state: dict) -> bool:
    """
    Persist agent state (active trades, zones, counters) to JSON.
    Called after every trade open/close and on each scan cycle.
    Returns True on success.
    """
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        state_file = STATE_DIR / f'{agent_id}_state.json'
        # Atomic-ish write: write to temp then rename
        tmp_file = STATE_DIR / f'{agent_id}_state.tmp'
        payload = {
            'agent_id': agent_id,
            'saved_at': datetime.now().isoformat(),
            'state': state,
        }
        with open(tmp_file, 'w') as f:
            json.dump(payload, f, indent=2, default=str)
        tmp_file.replace(state_file)
        return True
    except Exception as e:
        print(f"[{agent_id}] State save error: {e}")
        return False


def load_agent_state(agent_id: str) -> dict:
    """
    Load persisted agent state on boot. Returns empty dict if no saved state.
    """
    try:
        state_file = STATE_DIR / f'{agent_id}_state.json'
        if not state_file.exists():
            return {}
        with open(state_file, 'r') as f:
            payload = json.load(f)
        saved_at = payload.get('saved_at', 'unknown')
        print(f"[{agent_id}] Loaded saved state from {saved_at}")
        return payload.get('state', {})
    except Exception as e:
        print(f"[{agent_id}] State load error: {e}")
        return {}


def save_risk_state(agent_id: str, risk_data: dict) -> bool:
    """
    Persist risk counters (daily PnL, consecutive losses, trade count).
    These reset only when the trading date changes.
    """
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        risk_file = STATE_DIR / f'{agent_id}_risk.json'
        payload = {
            'agent_id': agent_id,
            'trade_date': datetime.now().strftime('%Y-%m-%d'),
            'saved_at': datetime.now().isoformat(),
            **risk_data,
        }
        with open(risk_file, 'w') as f:
            json.dump(payload, f, indent=2)
        return True
    except Exception as e:
        print(f"[{agent_id}] Risk state save error: {e}")
        return False


def load_risk_state(agent_id: str) -> dict:
    """
    Load persisted risk counters. If the trade_date differs from today,
    returns empty dict (forces a daily reset).
    """
    try:
        risk_file = STATE_DIR / f'{agent_id}_risk.json'
        if not risk_file.exists():
            return {}
        with open(risk_file, 'r') as f:
            data = json.load(f)
        # Only restore if same trading day
        today = datetime.now().strftime('%Y-%m-%d')
        if data.get('trade_date') != today:
            print(f"[{agent_id}] Risk state from {data.get('trade_date')} — new day, resetting.")
            return {}
        print(f"[{agent_id}] Restored risk state: "
              f"daily_pnl=${data.get('daily_pnl', 0):.2f}, "
              f"consecutive_losses={data.get('consecutive_losses', 0)}, "
              f"trades_today={data.get('trades_today', 0)}")
        return data
    except Exception as e:
        print(f"[{agent_id}] Risk state load error: {e}")
        return {}
