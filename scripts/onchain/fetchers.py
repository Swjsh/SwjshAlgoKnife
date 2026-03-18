"""
On-Chain Data Fetchers
======================
Abstraction layer for blockchain explorers (Etherscan, Solscan).
Returns normalized transaction records for the confluence detector.
"""

import os
import time
import json
import requests
from dataclasses import dataclass, asdict
from typing import List, Optional


@dataclass
class OnChainTransfer:
    """Normalized transfer record across all chains."""
    tx_hash: str
    chain: str              # ETH, SOL, BTC
    from_address: str
    to_address: str
    token: str              # ETH, USDT, USDC, SOL, etc.
    amount: float           # Human-readable amount
    amount_usd: float       # USD-equivalent at time of transfer
    block_number: int
    timestamp: int          # Unix epoch
    from_label: str = ""    # Resolved label if in watchlist
    to_label: str = ""


class EtherscanFetcher:
    """
    Fetches token transfers and ETH transactions from Etherscan.
    Free tier: 5 calls/sec, 100k calls/day.
    """

    BASE_URL = "https://api.etherscan.io/api"

    def __init__(self):
        self.api_key = os.environ.get("ETHERSCAN_API_KEY", "")
        self.session = requests.Session()
        self._last_call = 0.0

    def _rate_limit(self):
        """Ensure we don't exceed 5 calls/sec on free tier."""
        elapsed = time.time() - self._last_call
        if elapsed < 0.25:
            time.sleep(0.25 - elapsed)
        self._last_call = time.time()

    def get_eth_transfers(self, address: str, start_block: int = 0) -> List[OnChainTransfer]:
        """Get normal ETH transactions for an address."""
        self._rate_limit()

        params = {
            "module": "account",
            "action": "txlist",
            "address": address,
            "startblock": start_block,
            "endblock": 99999999,
            "sort": "desc",
            "page": 1,
            "offset": 50,
            "apikey": self.api_key,
        }

        try:
            resp = self.session.get(self.BASE_URL, params=params, timeout=15)
            data = resp.json()

            if data.get("status") != "1" or not data.get("result"):
                return []

            transfers = []
            for tx in data["result"]:
                value_eth = int(tx.get("value", "0")) / 1e18
                if value_eth < 0.01:  # Skip dust
                    continue

                transfers.append(OnChainTransfer(
                    tx_hash=tx["hash"],
                    chain="ETH",
                    from_address=tx["from"].lower(),
                    to_address=tx["to"].lower() if tx.get("to") else "",
                    token="ETH",
                    amount=value_eth,
                    amount_usd=0.0,  # Filled by confluence detector with live price
                    block_number=int(tx["blockNumber"]),
                    timestamp=int(tx["timeStamp"]),
                ))

            return transfers

        except Exception as e:
            print(f"[Etherscan] Error fetching ETH transfers: {e}")
            return []

    def get_erc20_transfers(self, address: str, contract: str = "", start_block: int = 0) -> List[OnChainTransfer]:
        """Get ERC-20 token transfers for an address."""
        self._rate_limit()

        params = {
            "module": "account",
            "action": "tokentx",
            "address": address,
            "startblock": start_block,
            "endblock": 99999999,
            "sort": "desc",
            "page": 1,
            "offset": 50,
            "apikey": self.api_key,
        }
        if contract:
            params["contractaddress"] = contract

        try:
            resp = self.session.get(self.BASE_URL, params=params, timeout=15)
            data = resp.json()

            if data.get("status") != "1" or not data.get("result"):
                return []

            transfers = []
            for tx in data["result"]:
                decimals = int(tx.get("tokenDecimal", "18"))
                amount = int(tx.get("value", "0")) / (10 ** decimals)

                transfers.append(OnChainTransfer(
                    tx_hash=tx["hash"],
                    chain="ETH",
                    from_address=tx["from"].lower(),
                    to_address=tx["to"].lower() if tx.get("to") else "",
                    token=tx.get("tokenSymbol", "UNKNOWN"),
                    amount=amount,
                    amount_usd=amount if tx.get("tokenSymbol") in ("USDT", "USDC", "DAI") else 0.0,
                    block_number=int(tx["blockNumber"]),
                    timestamp=int(tx["timeStamp"]),
                ))

            return transfers

        except Exception as e:
            print(f"[Etherscan] Error fetching ERC-20 transfers: {e}")
            return []


class PriceFetcher:
    """Simple price lookup for USD conversion."""

    COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price"

    def __init__(self):
        self._cache: dict = {}
        self._cache_ts: float = 0.0

    def get_price(self, token: str) -> float:
        """Get current USD price for a token. Cached for 60s."""
        now = time.time()
        if now - self._cache_ts < 60 and token in self._cache:
            return self._cache[token]

        token_map = {
            "ETH": "ethereum",
            "BTC": "bitcoin",
            "SOL": "solana",
        }

        cg_id = token_map.get(token.upper())
        if not cg_id:
            return 1.0  # Stablecoins

        try:
            resp = requests.get(
                self.COINGECKO_URL,
                params={"ids": cg_id, "vs_currencies": "usd"},
                timeout=10,
            )
            data = resp.json()
            price = data.get(cg_id, {}).get("usd", 0.0)
            self._cache[token] = price
            self._cache_ts = now
            return price
        except Exception:
            return self._cache.get(token, 0.0)
