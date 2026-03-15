"""
Sentiment Service — Main loop that polls sources, scores headlines,
and outputs AGENT_STATUS_UPDATE signals for the TypeScript bridge.

Launch: python scripts/sentiment/service.py
"""

import json
import sys
import time
import os
from datetime import datetime
from typing import Optional

# Add project root to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from sources import FearGreedSource, CryptoPanicSource, FinnhubNewsSource, HeadlineItem
from scorer import score_headlines, aggregate_sentiment


# ── Configuration ────────────────────────────────────────────────

POLL_INTERVAL_SEC = int(os.environ.get("SENTIMENT_POLL_INTERVAL", "300"))  # 5 min default
FEAR_GREED_INTERVAL_SEC = 900  # 15 min for Fear & Greed (slow-changing)

# Sentiment thresholds for signal generation
BULLISH_THRESHOLD = 0.4    # Aggregate > 0.4 → BULLISH signal
BEARISH_THRESHOLD = -0.4   # Aggregate < -0.4 → BEARISH signal
FEAR_GREED_EXTREME_LOW = 20   # Extreme Fear → contrarian BULLISH
FEAR_GREED_EXTREME_HIGH = 80  # Extreme Greed → contrarian BEARISH


def emit_signal(signal: dict):
    """Output signal in AGENT_STATUS_UPDATE format for TS bridge."""
    line = f"AGENT_STATUS_UPDATE:{json.dumps(signal)}"
    print(line, flush=True)


def run():
    print("[Sentiment Service] Starting...", flush=True)
    print(f"  Poll interval: {POLL_INTERVAL_SEC}s", flush=True)
    print(f"  Thresholds: bullish={BULLISH_THRESHOLD}, bearish={BEARISH_THRESHOLD}", flush=True)

    # Initialize sources
    fear_greed = FearGreedSource()
    cryptopanic = CryptoPanicSource()
    finnhub = FinnhubNewsSource()

    last_fear_greed_check = 0
    last_fear_greed_value: Optional[int] = None

    while True:
        try:
            now = time.time()

            # ── Collect Headlines ────────────────────────────────
            headlines = []

            cp_headlines = cryptopanic.fetch(limit=20)
            headlines.extend(cp_headlines)
            print(f"  [CryptoPanic] {len(cp_headlines)} headlines", flush=True)

            fh_headlines = finnhub.fetch(limit=15)
            headlines.extend(fh_headlines)
            print(f"  [Finnhub] {len(fh_headlines)} headlines", flush=True)

            # ── Score Headlines ──────────────────────────────────
            if headlines:
                scored = score_headlines(headlines)

                # Overall market sentiment
                overall = aggregate_sentiment(scored)
                print(f"  [Score] Overall market sentiment: {overall:.3f}", flush=True)

                # Per-symbol sentiment for known crypto symbols
                symbols_seen = set(s.symbol for s in scored if s.symbol)
                for sym in symbols_seen:
                    sym_score = aggregate_sentiment(scored, symbol=sym)
                    if abs(sym_score) >= 0.3:
                        print(f"  [Score] {sym}: {sym_score:.3f}", flush=True)

                    # Generate per-symbol signals
                    if sym_score > BULLISH_THRESHOLD:
                        emit_signal({
                            "source": "SENTIMENT",
                            "symbol": f"{sym}USD" if len(sym) <= 5 else sym,
                            "direction": "BULLISH",
                            "confidence": min(0.85, abs(sym_score) * 0.8),
                            "summary": f"Headline sentiment bullish for {sym}: {sym_score:.2f} ({len([s for s in scored if s.symbol == sym])} headlines)",
                            "payload": {
                                "type": "HEADLINE_SENTIMENT",
                                "aggregateScore": sym_score,
                                "headlineCount": len([s for s in scored if s.symbol == sym]),
                            },
                        })
                    elif sym_score < BEARISH_THRESHOLD:
                        emit_signal({
                            "source": "SENTIMENT",
                            "symbol": f"{sym}USD" if len(sym) <= 5 else sym,
                            "direction": "BEARISH",
                            "confidence": min(0.85, abs(sym_score) * 0.8),
                            "summary": f"Headline sentiment bearish for {sym}: {sym_score:.2f} ({len([s for s in scored if s.symbol == sym])} headlines)",
                            "payload": {
                                "type": "HEADLINE_SENTIMENT",
                                "aggregateScore": sym_score,
                                "headlineCount": len([s for s in scored if s.symbol == sym]),
                            },
                        })

            # ── Fear & Greed Index ───────────────────────────────
            if now - last_fear_greed_check >= FEAR_GREED_INTERVAL_SEC:
                last_fear_greed_check = now
                fg = fear_greed.fetch()

                if fg:
                    last_fear_greed_value = fg.value
                    print(f"  [Fear&Greed] {fg.value} — {fg.classification}", flush=True)

                    # Contrarian signals at extremes
                    if fg.value <= FEAR_GREED_EXTREME_LOW:
                        emit_signal({
                            "source": "SENTIMENT",
                            "symbol": "BTCUSD",
                            "direction": "BULLISH",
                            "confidence": 0.6,
                            "summary": f"Extreme Fear ({fg.value}) — contrarian bullish signal",
                            "payload": {
                                "type": "FEAR_GREED",
                                "value": fg.value,
                                "classification": fg.classification,
                            },
                        })
                    elif fg.value >= FEAR_GREED_EXTREME_HIGH:
                        emit_signal({
                            "source": "SENTIMENT",
                            "symbol": "BTCUSD",
                            "direction": "BEARISH",
                            "confidence": 0.6,
                            "summary": f"Extreme Greed ({fg.value}) — contrarian bearish signal",
                            "payload": {
                                "type": "FEAR_GREED",
                                "value": fg.value,
                                "classification": fg.classification,
                            },
                        })

            # Heartbeat
            emit_signal({
                "type": "HEARTBEAT",
                "service": "sentiment",
                "fearGreed": last_fear_greed_value,
                "timestamp": datetime.utcnow().isoformat() + "Z",
            })

        except Exception as e:
            print(f"[Sentiment Service] Error in main loop: {e}", flush=True)

        time.sleep(POLL_INTERVAL_SEC)


if __name__ == "__main__":
    run()
