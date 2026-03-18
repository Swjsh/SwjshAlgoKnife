"""
Confluence Detector
===================
Monitors multiple tracked wallets for convergent behavior:
  - Multiple wallets accumulating the same token = BULLISH confluence
  - Multiple wallets distributing to exchanges = BEARISH confluence
  - Large stablecoin movements to exchanges = potential buying pressure

Outputs AGENT_STATUS_UPDATE signals when confluence thresholds are met.
"""

import time
import json
from dataclasses import dataclass, field
from typing import Dict, List, Set, Tuple, Optional
from fetchers import OnChainTransfer


@dataclass
class WalletActivity:
    """Tracks recent activity for a single wallet."""
    address: str
    label: str
    wallet_type: str  # EXCHANGE, WHALE, FUND
    # token -> (net_flow_usd, last_seen_ts)
    token_flows: Dict[str, Tuple[float, int]] = field(default_factory=dict)


@dataclass
class ConfluenceSignal:
    """A detected confluence event."""
    symbol: str
    direction: str       # BULLISH, BEARISH, ALERT
    confidence: float
    summary: str
    wallets_involved: List[str]
    net_flow_usd: float
    source: str = "ONCHAIN_CONFLUENCE"


class ConfluenceDetector:
    """
    Detects when multiple tracked wallets converge on the same behavior.

    Confluence Score = (wallets_acting / wallets_tracked) * flow_magnitude_factor

    Thresholds:
      - 2+ wallets same direction → ALERT (conf 0.4)
      - 3+ wallets same direction → signal (conf 0.6)
      - 5+ wallets OR > $10M net flow → strong signal (conf 0.8)
    """

    def __init__(self, exchange_addresses: Set[str]):
        self.exchange_addresses = exchange_addresses
        self.wallet_activities: Dict[str, WalletActivity] = {}
        self.recent_signals: List[ConfluenceSignal] = []
        # Dedup: track recent signal keys to avoid spamming
        self._signal_keys: Dict[str, float] = {}
        self._signal_cooldown = 900  # 15 min cooldown per signal key

    def ingest_transfers(
        self,
        wallet_address: str,
        wallet_label: str,
        wallet_type: str,
        transfers: List[OnChainTransfer],
        price_lookup: callable,
    ):
        """Process transfers for a tracked wallet and update activity state."""
        if wallet_address not in self.wallet_activities:
            self.wallet_activities[wallet_address] = WalletActivity(
                address=wallet_address,
                label=wallet_label,
                wallet_type=wallet_type,
            )

        activity = self.wallet_activities[wallet_address]
        now = int(time.time())

        for tx in transfers:
            # Skip old transfers (> 2 hours)
            if now - tx.timestamp > 7200:
                continue

            # Calculate USD value
            usd_value = tx.amount_usd
            if usd_value <= 0:
                price = price_lookup(tx.token)
                usd_value = tx.amount * price

            # Skip small transfers
            if usd_value < 50_000:
                continue

            # Determine flow direction relative to this wallet
            is_outflow = tx.from_address.lower() == wallet_address.lower()
            is_to_exchange = tx.to_address.lower() in self.exchange_addresses
            is_from_exchange = tx.from_address.lower() in self.exchange_addresses

            # Net flow: positive = accumulating, negative = distributing
            net_delta = -usd_value if is_outflow else usd_value

            # Exchange-specific logic
            if wallet_type == "EXCHANGE":
                # For exchange wallets, inflows = users depositing (bearish)
                # outflows = users withdrawing (bullish)
                net_delta = -net_delta

            token = tx.token
            prev_flow, _ = activity.token_flows.get(token, (0.0, 0))
            activity.token_flows[token] = (prev_flow + net_delta, tx.timestamp)

    def detect(self) -> List[ConfluenceSignal]:
        """
        Analyze all wallet activities and detect confluence patterns.
        Returns new signals since last detection.
        """
        signals: List[ConfluenceSignal] = []
        now = time.time()

        # Group wallet flows by token
        # token -> [(wallet_label, net_flow_usd, wallet_type)]
        token_consensus: Dict[str, List[Tuple[str, float, str]]] = {}

        for addr, activity in self.wallet_activities.items():
            for token, (net_flow, last_ts) in activity.token_flows.items():
                # Skip stale data (> 2 hours old)
                if now - last_ts > 7200:
                    continue
                if abs(net_flow) < 50_000:
                    continue

                if token not in token_consensus:
                    token_consensus[token] = []
                token_consensus[token].append((
                    activity.label,
                    net_flow,
                    activity.wallet_type,
                ))

        # Check each token for confluence
        for token, flows in token_consensus.items():
            bullish = [(l, f, t) for l, f, t in flows if f > 0]
            bearish = [(l, f, t) for l, f, t in flows if f < 0]

            # --- Bullish Confluence ---
            if len(bullish) >= 2:
                total_flow = sum(f for _, f, _ in bullish)
                wallet_names = [l for l, _, _ in bullish]
                confidence = self._calc_confidence(len(bullish), total_flow)

                sig = ConfluenceSignal(
                    symbol=self._token_to_symbol(token),
                    direction="BULLISH",
                    confidence=confidence,
                    summary=f"{len(bullish)} wallets accumulating {token} (${total_flow:,.0f} net inflow)",
                    wallets_involved=wallet_names,
                    net_flow_usd=total_flow,
                )

                if self._should_emit(sig):
                    signals.append(sig)

            # --- Bearish Confluence ---
            if len(bearish) >= 2:
                total_flow = sum(abs(f) for _, f, _ in bearish)
                wallet_names = [l for l, _, _ in bearish]
                confidence = self._calc_confidence(len(bearish), total_flow)

                sig = ConfluenceSignal(
                    symbol=self._token_to_symbol(token),
                    direction="BEARISH",
                    confidence=confidence,
                    summary=f"{len(bearish)} wallets distributing {token} (${total_flow:,.0f} net outflow)",
                    wallets_involved=wallet_names,
                    net_flow_usd=total_flow,
                )

                if self._should_emit(sig):
                    signals.append(sig)

        self.recent_signals = signals
        return signals

    def _calc_confidence(self, wallet_count: int, total_flow_usd: float) -> float:
        """Calculate confidence based on wallet count and flow magnitude."""
        base = 0.3
        # Wallet count bonus
        if wallet_count >= 5:
            base = 0.75
        elif wallet_count >= 3:
            base = 0.55
        elif wallet_count >= 2:
            base = 0.4

        # Flow magnitude bonus
        if total_flow_usd >= 10_000_000:
            base += 0.15
        elif total_flow_usd >= 5_000_000:
            base += 0.1
        elif total_flow_usd >= 1_000_000:
            base += 0.05

        return min(base, 0.95)

    def _token_to_symbol(self, token: str) -> str:
        """Map token name to trading symbol."""
        mapping = {
            "ETH": "ETHUSD",
            "BTC": "BTCUSD",
            "SOL": "SOLUSD",
            "USDT": "STABLECOIN",
            "USDC": "STABLECOIN",
            "DAI": "STABLECOIN",
        }
        return mapping.get(token.upper(), f"{token.upper()}USD")

    def _should_emit(self, signal: ConfluenceSignal) -> bool:
        """Dedup: only emit if we haven't signaled this recently."""
        key = f"{signal.symbol}:{signal.direction}"
        now = time.time()

        last_emit = self._signal_keys.get(key, 0)
        if now - last_emit < self._signal_cooldown:
            return False

        self._signal_keys[key] = now
        return True

    def reset_stale(self):
        """Clear wallet activities older than 2 hours."""
        now = time.time()
        for activity in self.wallet_activities.values():
            stale_tokens = [
                t for t, (_, ts) in activity.token_flows.items()
                if now - ts > 7200
            ]
            for t in stale_tokens:
                del activity.token_flows[t]
