"""
Sentiment Data Sources — Collects headlines and market fear/greed data.
Each source returns normalized HeadlineItem or FearGreedData.
"""

import requests
import os
import time
from dataclasses import dataclass, asdict
from typing import List, Optional
from datetime import datetime


@dataclass
class HeadlineItem:
    text: str
    source: str           # 'cryptopanic', 'finnhub', 'feargreed'
    symbol: Optional[str] # None if general market sentiment
    timestamp: str        # ISO 8601
    url: Optional[str]


@dataclass
class FearGreedData:
    value: int            # 0–100
    classification: str   # 'Extreme Fear', 'Fear', 'Neutral', 'Greed', 'Extreme Greed'
    timestamp: str


class FearGreedSource:
    """Alternative.me Crypto Fear & Greed Index — free, no auth."""

    URL = "https://api.alternative.me/fng/?limit=1"

    def fetch(self) -> Optional[FearGreedData]:
        try:
            resp = requests.get(self.URL, timeout=10)
            resp.raise_for_status()
            data = resp.json()["data"][0]
            return FearGreedData(
                value=int(data["value"]),
                classification=data["value_classification"],
                timestamp=datetime.utcnow().isoformat() + "Z",
            )
        except Exception as e:
            print(f"[Sentiment] Fear & Greed fetch failed: {e}")
            return None


class CryptoPanicSource:
    """CryptoPanic API — free tier available (requires API key for full access)."""

    BASE_URL = "https://cryptopanic.com/api/free/v1/posts/"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("CRYPTOPANIC_API_KEY")

    def fetch(self, limit: int = 20) -> List[HeadlineItem]:
        if not self.api_key:
            # Use free public endpoint (limited)
            return self._fetch_free(limit)

        try:
            resp = requests.get(
                self.BASE_URL,
                params={"auth_token": self.api_key, "filter": "hot", "public": "true"},
                timeout=10,
            )
            resp.raise_for_status()
            results = resp.json().get("results", [])

            items = []
            for r in results[:limit]:
                # Extract primary currency if available
                currencies = r.get("currencies", [])
                symbol = currencies[0]["code"] if currencies else None

                items.append(HeadlineItem(
                    text=r.get("title", ""),
                    source="cryptopanic",
                    symbol=symbol,
                    timestamp=r.get("published_at", datetime.utcnow().isoformat() + "Z"),
                    url=r.get("url"),
                ))
            return items
        except Exception as e:
            print(f"[Sentiment] CryptoPanic fetch failed: {e}")
            return []

    def _fetch_free(self, limit: int) -> List[HeadlineItem]:
        """Fallback: scrape CryptoPanic's free public feed."""
        try:
            resp = requests.get(
                "https://cryptopanic.com/api/free/v1/posts/?public=true",
                timeout=10,
            )
            if resp.status_code != 200:
                return []
            results = resp.json().get("results", [])
            items = []
            for r in results[:limit]:
                currencies = r.get("currencies", [])
                symbol = currencies[0]["code"] if currencies else None
                items.append(HeadlineItem(
                    text=r.get("title", ""),
                    source="cryptopanic",
                    symbol=symbol,
                    timestamp=r.get("published_at", datetime.utcnow().isoformat() + "Z"),
                    url=r.get("url"),
                ))
            return items
        except Exception:
            return []


class FinnhubNewsSource:
    """Finnhub general news — uses existing FINNHUB_KEY."""

    BASE_URL = "https://finnhub.io/api/v1/news"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("NEXT_PUBLIC_FINNHUB_KEY")

    def fetch(self, category: str = "general", limit: int = 20) -> List[HeadlineItem]:
        if not self.api_key:
            print("[Sentiment] No Finnhub API key — skipping news source.")
            return []

        try:
            resp = requests.get(
                self.BASE_URL,
                params={"category": category, "token": self.api_key},
                timeout=10,
            )
            resp.raise_for_status()
            articles = resp.json()

            items = []
            for a in articles[:limit]:
                items.append(HeadlineItem(
                    text=a.get("headline", ""),
                    source="finnhub",
                    symbol=None,  # General news — no specific symbol
                    timestamp=datetime.utcfromtimestamp(a.get("datetime", 0)).isoformat() + "Z",
                    url=a.get("url"),
                ))
            return items
        except Exception as e:
            print(f"[Sentiment] Finnhub fetch failed: {e}")
            return []
