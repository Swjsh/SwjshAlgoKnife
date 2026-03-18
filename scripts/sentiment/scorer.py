"""
Sentiment Scorer — Keyword-based (default) with optional FinBERT upgrade.

Default: Fast keyword/phrase matching tuned for financial headlines.
Upgrade: ProsusAI/finbert transformer model (requires torch + transformers).

The service auto-detects which backend is available.
"""

import re
from typing import List, Tuple, Optional
from dataclasses import dataclass


@dataclass
class ScoredHeadline:
    text: str
    score: float        # -1.0 (very bearish) to +1.0 (very bullish)
    source: str
    symbol: Optional[str]


# ── Keyword Scorer (Default — zero dependencies) ────────────────

BULLISH_PHRASES = [
    (r'\brally\b', 0.6), (r'\bsurge[sd]?\b', 0.7), (r'\bsoar[sed]*\b', 0.7),
    (r'\bbullish\b', 0.8), (r'\ball[- ]time high\b', 0.9), (r'\bATH\b', 0.8),
    (r'\bbreakout\b', 0.5), (r'\bupgrade[sd]?\b', 0.5), (r'\brecovery\b', 0.4),
    (r'\bgain[sed]*\b', 0.4), (r'\bjump[sed]*\b', 0.5), (r'\brise[sd]?\b', 0.3),
    (r'\boptimis[tm]\b', 0.5), (r'\baccumulation\b', 0.6), (r'\badopt[ion]*\b', 0.5),
    (r'\bapproval\b', 0.6), (r'\bpartnership\b', 0.4), (r'\binstitutional\b', 0.4),
    (r'\bETF\b.*\bapprove\b', 0.8), (r'\bbuy\b', 0.3), (r'\bpump\b', 0.5),
    (r'\bmomentum\b', 0.3), (r'\bstrong\b', 0.3),
]

BEARISH_PHRASES = [
    (r'\bcrash\b', -0.8), (r'\bplunge[sd]?\b', -0.7), (r'\bdump\b', -0.6),
    (r'\bbearish\b', -0.8), (r'\bsell[- ]?off\b', -0.6), (r'\bcollapse[sd]?\b', -0.8),
    (r'\bhack\b', -0.7), (r'\bbreach\b', -0.6), (r'\bfraud\b', -0.8),
    (r'\bban\b', -0.7), (r'\bregulation\b', -0.3), (r'\bcrackdown\b', -0.6),
    (r'\blawsuit\b', -0.5), (r'\bSEC\b.*\bcharge\b', -0.7), (r'\bfine[sd]?\b', -0.4),
    (r'\bbankrupt\b', -0.9), (r'\binsolven\b', -0.9), (r'\bliquidat\b', -0.7),
    (r'\bdecline[sd]?\b', -0.4), (r'\bdrop\b', -0.4), (r'\bfall[s]?\b', -0.3),
    (r'\bfear\b', -0.4), (r'\bpanic\b', -0.6), (r'\bwarn\b', -0.3),
    (r'\brug[- ]?pull\b', -0.9), (r'\bexploit\b', -0.7), (r'\bvulnerabilit\b', -0.5),
]


def keyword_score(text: str) -> float:
    """Score a headline using keyword matching. Returns -1.0 to +1.0."""
    text_lower = text.lower()
    scores = []

    for pattern, weight in BULLISH_PHRASES:
        if re.search(pattern, text_lower):
            scores.append(weight)

    for pattern, weight in BEARISH_PHRASES:
        if re.search(pattern, text_lower):
            scores.append(weight)

    if not scores:
        return 0.0

    # Average of matched scores, clamped to [-1, 1]
    avg = sum(scores) / len(scores)
    return max(-1.0, min(1.0, avg))


# ── FinBERT Scorer (Optional upgrade) ───────────────────────────

_finbert_pipeline = None
_finbert_available = None


def _check_finbert() -> bool:
    global _finbert_available
    if _finbert_available is not None:
        return _finbert_available
    try:
        import transformers  # noqa: F401
        import torch  # noqa: F401
        _finbert_available = True
        print("[Scorer] FinBERT available — using ML-based sentiment.")
    except ImportError:
        _finbert_available = False
        print("[Scorer] FinBERT not installed — using keyword scorer (fast mode).")
    return _finbert_available


def _get_finbert():
    global _finbert_pipeline
    if _finbert_pipeline is None:
        from transformers import pipeline
        _finbert_pipeline = pipeline(
            "sentiment-analysis",
            model="ProsusAI/finbert",
            tokenizer="ProsusAI/finbert",
        )
    return _finbert_pipeline


def finbert_score(text: str) -> float:
    """Score using FinBERT. Returns -1.0 to +1.0."""
    pipe = _get_finbert()
    result = pipe(text[:512])[0]  # Truncate to model max

    label = result["label"].lower()
    conf = result["score"]

    if label == "positive":
        return conf
    elif label == "negative":
        return -conf
    else:
        return 0.0


# ── Public API ───────────────────────────────────────────────────

def score_headline(text: str) -> float:
    """Score a single headline. Auto-selects best available backend."""
    if _check_finbert():
        try:
            return finbert_score(text)
        except Exception:
            return keyword_score(text)
    return keyword_score(text)


def score_headlines(headlines) -> List[ScoredHeadline]:
    """Score a batch of HeadlineItem objects."""
    results = []
    for h in headlines:
        s = score_headline(h.text)
        results.append(ScoredHeadline(
            text=h.text,
            score=s,
            source=h.source,
            symbol=h.symbol,
        ))
    return results


def aggregate_sentiment(scored: List[ScoredHeadline], symbol: Optional[str] = None) -> float:
    """
    Aggregate sentiment for a symbol (or overall if symbol is None).
    Weights more recent headlines higher (assumes list is ordered by recency).
    Returns -1.0 to +1.0.
    """
    relevant = [s for s in scored if symbol is None or s.symbol == symbol]
    if not relevant:
        return 0.0

    # Recency weighting: first item gets weight 1.0, last gets 0.5
    total_weight = 0.0
    weighted_sum = 0.0

    for i, s in enumerate(relevant):
        weight = 1.0 - (i / len(relevant)) * 0.5  # 1.0 → 0.5
        weighted_sum += s.score * weight
        total_weight += weight

    return weighted_sum / total_weight if total_weight > 0 else 0.0
