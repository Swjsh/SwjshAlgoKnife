"""
On-Chain Confluence Service
===========================
Main polling loop that:
  1. Loads wallet watchlist from data/wallet_watchlist.json
  2. Fetches recent transfers for each tracked wallet
  3. Runs confluence detection
  4. Outputs AGENT_STATUS_UPDATE signals to stdout

Polling interval: 10 minutes (respects API rate limits)
"""

import os
import sys
import json
import time
import signal
import traceback
from pathlib import Path

# Add script directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fetchers import EtherscanFetcher, PriceFetcher, OnChainTransfer
from confluence import ConfluenceDetector, ConfluenceSignal


def emit(data: dict):
    """Output an AGENT_STATUS_UPDATE line for the TypeScript bridge."""
    print(f"AGENT_STATUS_UPDATE:{json.dumps(data)}", flush=True)


def emit_heartbeat(cycle: int, signals_total: int):
    """Send periodic heartbeat."""
    emit({
        "type": "HEARTBEAT",
        "cycle": cycle,
        "signals_total": signals_total,
    })


class OnChainService:
    """Main service loop for on-chain confluence detection."""

    def __init__(self):
        self.running = True
        self.poll_interval = 600  # 10 minutes
        self.cycle = 0
        self.signals_total = 0

        # Data sources
        self.etherscan = EtherscanFetcher()
        self.prices = PriceFetcher()

        # Watchlist
        self.wallets = []
        self.exchange_addresses: set = set()
        self.token_config = {}

        # Detector
        self.detector: ConfluenceDetector = None  # type: ignore

        # Graceful shutdown
        signal.signal(signal.SIGTERM, self._shutdown)
        signal.signal(signal.SIGINT, self._shutdown)

    def _shutdown(self, *args):
        print("[OnChain] Shutting down...", flush=True)
        self.running = False

    def load_watchlist(self):
        """Load wallet watchlist from JSON config."""
        watchlist_path = Path(__file__).parent.parent.parent / "data" / "wallet_watchlist.json"

        if not watchlist_path.exists():
            print(f"[OnChain] WARNING: No watchlist found at {watchlist_path}", flush=True)
            return

        with open(watchlist_path, "r") as f:
            data = json.load(f)

        self.wallets = data.get("wallets", [])
        self.token_config = data.get("tokens", {})

        # Build exchange address set for the detector
        self.exchange_addresses = {
            w["address"].lower()
            for w in self.wallets
            if w.get("type") == "EXCHANGE"
        }

        self.detector = ConfluenceDetector(self.exchange_addresses)

        print(f"[OnChain] Loaded {len(self.wallets)} wallets, "
              f"{len(self.exchange_addresses)} exchange addresses", flush=True)

    def poll_wallets(self):
        """Fetch recent transfers for all tracked wallets."""
        if not self.wallets:
            return

        for wallet in self.wallets:
            address = wallet["address"]
            label = wallet.get("label", address[:10])
            chain = wallet.get("chain", "ETH")
            wallet_type = wallet.get("type", "WHALE")

            if chain != "ETH":
                continue  # Only ETH supported for now

            try:
                # Fetch native ETH transfers
                eth_transfers = self.etherscan.get_eth_transfers(address)

                # Fetch ERC-20 transfers for tracked tokens
                erc20_transfers = []
                for token_name, token_info in self.token_config.items():
                    contract = token_info.get("contract", "")
                    if contract:
                        txs = self.etherscan.get_erc20_transfers(address, contract)
                        erc20_transfers.extend(txs)

                all_transfers = eth_transfers + erc20_transfers

                if all_transfers:
                    print(f"[OnChain] {label}: {len(all_transfers)} recent transfers", flush=True)

                # Feed into confluence detector
                self.detector.ingest_transfers(
                    wallet_address=address.lower(),
                    wallet_label=label,
                    wallet_type=wallet_type,
                    transfers=all_transfers,
                    price_lookup=self.prices.get_price,
                )

            except Exception as e:
                print(f"[OnChain] Error polling {label}: {e}", flush=True)

    def check_confluence(self):
        """Run confluence detection and emit signals."""
        signals = self.detector.detect()

        for sig in signals:
            emit({
                "source": "ONCHAIN_CONFLUENCE",
                "symbol": sig.symbol,
                "direction": sig.direction,
                "confidence": sig.confidence,
                "summary": sig.summary,
                "payload": {
                    "wallets_involved": sig.wallets_involved,
                    "net_flow_usd": sig.net_flow_usd,
                },
            })
            self.signals_total += 1
            print(f"[OnChain] SIGNAL: {sig.direction} {sig.symbol} "
                  f"(conf={sig.confidence:.2f}) — {sig.summary}", flush=True)

        # Cleanup stale data
        self.detector.reset_stale()

    def run(self):
        """Main service loop."""
        print("[OnChain] Service starting...", flush=True)
        self.load_watchlist()

        if not self.wallets:
            print("[OnChain] No wallets configured. Add wallets to data/wallet_watchlist.json", flush=True)
            # Still run to emit heartbeats — user might add wallets later
            while self.running:
                emit_heartbeat(self.cycle, self.signals_total)
                self.cycle += 1
                time.sleep(self.poll_interval)
            return

        if not self.etherscan.api_key:
            print("[OnChain] WARNING: No ETHERSCAN_API_KEY set. "
                  "Service will run but API calls may be rate-limited.", flush=True)

        emit_heartbeat(0, 0)

        while self.running:
            try:
                self.cycle += 1
                print(f"\n[OnChain] === Cycle {self.cycle} ===", flush=True)

                # Poll all wallets
                self.poll_wallets()

                # Check for confluence
                self.check_confluence()

                # Heartbeat
                emit_heartbeat(self.cycle, self.signals_total)

                # Wait for next cycle
                for _ in range(self.poll_interval):
                    if not self.running:
                        break
                    time.sleep(1)

            except Exception as e:
                print(f"[OnChain] ERROR in main loop: {e}", flush=True)
                traceback.print_exc()
                time.sleep(60)  # Back off on error

        print("[OnChain] Service stopped.", flush=True)


if __name__ == "__main__":
    service = OnChainService()
    service.run()
