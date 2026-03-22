"""
Options Contract Utilities — SwjshAlgoKnife
=============================================
Shared module for Boba and SPX Sniper to select real options contracts.

Provides:
  - Options chain fetching via yfinance (free, real-time)
  - Strike selection (ATM, OTM by delta, nearest to target)
  - Expiration selection (0DTE, weekly, monthly, nearest)
  - Greeks estimation (Black-Scholes for delta, gamma, theta, vega)
  - OCC contract symbol generation (e.g., SPY260320C00570000)
  - Premium-based SL/TP calculations
  - IV rank and IV percentile filtering

Usage:
  from options_utils import OptionsChain
  chain = OptionsChain('SPY')
  contract = chain.select_call(target_delta=0.30, expiry_type='weekly')
  print(contract)
"""

import math
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta, date
from typing import Optional, Literal
from dataclasses import dataclass, field


# ═══════════════════════════════════════════════════════════════
#  DATA TYPES
# ═══════════════════════════════════════════════════════════════

@dataclass
class OptionContract:
    """A fully described options contract ready for execution."""
    symbol: str               # Underlying (SPY, SPX, QQQ)
    contract_type: str        # CALL or PUT
    strike: float
    expiration: str           # YYYY-MM-DD
    bid: float
    ask: float
    mid: float                # (bid + ask) / 2
    last_price: float
    volume: int
    open_interest: int
    implied_volatility: float

    # Estimated Greeks
    delta: float = 0.0
    gamma: float = 0.0
    theta: float = 0.0
    vega: float = 0.0

    # Derived fields
    occ_symbol: str = ""      # Standard OCC symbol (SPY260320C00570000)
    dte: int = 0              # Days to expiration
    moneyness: str = ""       # ITM, ATM, OTM
    spread_pct: float = 0.0   # bid-ask spread as % of mid

    def __post_init__(self):
        if not self.occ_symbol:
            self.occ_symbol = build_occ_symbol(
                self.symbol, self.expiration, self.contract_type, self.strike
            )
        if self.mid > 0:
            self.spread_pct = round((self.ask - self.bid) / self.mid * 100, 2)


@dataclass
class OptionsTrade:
    """A paper options trade with premium-based risk management."""
    contract: OptionContract
    direction: str            # LONG or SHORT (debit vs credit)
    entry_premium: float      # Price paid per contract
    qty: int                  # Number of contracts
    entry_time: str

    # Risk management (all in premium terms)
    stop_loss_premium: float = 0.0     # Exit if premium drops to this
    take_profit_premium: float = 0.0   # Exit if premium rises to this
    max_loss_pct: float = 0.50         # Max % loss on premium (default 50%)
    max_gain_pct: float = 1.00         # Target % gain on premium (default 100%)

    # State
    status: str = "OPEN"
    exit_premium: float = 0.0
    exit_time: str = ""
    pnl: float = 0.0

    def __post_init__(self):
        if self.stop_loss_premium == 0:
            self.stop_loss_premium = round(self.entry_premium * (1 - self.max_loss_pct), 2)
        if self.take_profit_premium == 0:
            self.take_profit_premium = round(self.entry_premium * (1 + self.max_gain_pct), 2)


# ═══════════════════════════════════════════════════════════════
#  OCC SYMBOL GENERATION
# ═══════════════════════════════════════════════════════════════

def build_occ_symbol(underlying: str, expiration: str, contract_type: str, strike: float) -> str:
    """
    Build standard OCC options symbol.
    Example: SPY260320C00570000 = SPY March 20 2026 Call $570.00

    Format: SYMBOL + YYMMDD + C/P + 8-digit strike (strike * 1000, zero-padded)
    """
    symbol = underlying.upper().replace("^", "").ljust(6)[:6]

    exp_dt = datetime.strptime(expiration, "%Y-%m-%d")
    date_part = exp_dt.strftime("%y%m%d")

    cp = "C" if contract_type.upper() == "CALL" else "P"

    # Strike: multiply by 1000 and zero-pad to 8 digits
    strike_int = int(round(strike * 1000))
    strike_part = f"{strike_int:08d}"

    return f"{symbol.strip()}{date_part}{cp}{strike_part}"


def parse_occ_symbol(occ: str) -> dict:
    """Parse an OCC symbol back into components."""
    # Find where the date starts (first digit after letters)
    i = 0
    while i < len(occ) and not occ[i].isdigit():
        i += 1

    underlying = occ[:i].strip()
    date_part = occ[i:i+6]
    cp = occ[i+6]
    strike_part = occ[i+7:]

    exp_date = datetime.strptime(date_part, "%y%m%d").strftime("%Y-%m-%d")
    contract_type = "CALL" if cp == "C" else "PUT"
    strike = int(strike_part) / 1000

    return {
        "underlying": underlying,
        "expiration": exp_date,
        "contract_type": contract_type,
        "strike": strike,
    }


# ═══════════════════════════════════════════════════════════════
#  BLACK-SCHOLES GREEKS ESTIMATION
# ═══════════════════════════════════════════════════════════════

def _norm_cdf(x):
    """Cumulative normal distribution (no scipy dependency)."""
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def _norm_pdf(x):
    """Standard normal probability density."""
    return math.exp(-0.5 * x * x) / math.sqrt(2 * math.pi)


def bs_greeks(
    spot: float,
    strike: float,
    dte: int,
    iv: float,
    r: float = 0.045,      # Risk-free rate
    contract_type: str = "CALL",
) -> dict:
    """
    Estimate Black-Scholes Greeks.

    Args:
        spot: Current underlying price
        strike: Strike price
        dte: Days to expiration
        iv: Implied volatility (decimal, e.g., 0.20 for 20%)
        r: Risk-free rate (default 4.5%)
        contract_type: CALL or PUT

    Returns:
        dict with delta, gamma, theta, vega, theoretical_price
    """
    if dte <= 0 or iv <= 0 or spot <= 0 or strike <= 0:
        return {"delta": 0, "gamma": 0, "theta": 0, "vega": 0, "price": 0}

    T = dte / 365.0
    sqrt_T = math.sqrt(T)

    d1 = (math.log(spot / strike) + (r + 0.5 * iv * iv) * T) / (iv * sqrt_T)
    d2 = d1 - iv * sqrt_T

    if contract_type.upper() == "CALL":
        delta = _norm_cdf(d1)
        price = spot * _norm_cdf(d1) - strike * math.exp(-r * T) * _norm_cdf(d2)
    else:
        delta = _norm_cdf(d1) - 1
        price = strike * math.exp(-r * T) * _norm_cdf(-d2) - spot * _norm_cdf(-d1)

    gamma = _norm_pdf(d1) / (spot * iv * sqrt_T)
    theta = (
        -(spot * _norm_pdf(d1) * iv) / (2 * sqrt_T)
        - r * strike * math.exp(-r * T) * _norm_cdf(d2 if contract_type.upper() == "CALL" else -d2)
    ) / 365  # Per day

    vega = spot * _norm_pdf(d1) * sqrt_T / 100  # Per 1% IV move

    return {
        "delta": round(delta, 4),
        "gamma": round(gamma, 6),
        "theta": round(theta, 4),
        "vega": round(vega, 4),
        "price": round(max(price, 0), 4),
    }


# ═══════════════════════════════════════════════════════════════
#  OPTIONS CHAIN — Main interface
# ═══════════════════════════════════════════════════════════════

class OptionsChain:
    """
    Fetch and filter live options chains from yfinance.

    Usage:
        chain = OptionsChain('SPY')
        call = chain.select_call(target_delta=0.30, expiry_type='weekly')
        put = chain.select_put(target_delta=-0.30, expiry_type='0dte')
        atm_call = chain.select_call(selection='atm', expiry_type='nearest')
    """

    def __init__(self, underlying: str):
        self.underlying = underlying
        self.ticker = yf.Ticker(underlying)
        self._spot_price = None
        self._expirations = None
        self._chain_cache = {}

    @property
    def spot(self) -> float:
        """Get current underlying price."""
        if self._spot_price is None:
            try:
                hist = self.ticker.history(period="1d", interval="5m")
                if not hist.empty:
                    self._spot_price = float(hist["Close"].iloc[-1])
                else:
                    # Fallback: use info
                    info = self.ticker.info
                    self._spot_price = info.get("regularMarketPrice", info.get("previousClose", 0))
            except Exception as e:
                print(f"[OptionsChain] Price fetch error: {e}")
                self._spot_price = 0
        return self._spot_price

    @property
    def expirations(self) -> list:
        """Get available expiration dates as list of YYYY-MM-DD strings."""
        if self._expirations is None:
            try:
                raw = self.ticker.options  # Returns tuple of date strings
                self._expirations = sorted(raw)
            except Exception as e:
                print(f"[OptionsChain] Failed to fetch expirations: {e}")
                self._expirations = []
        return self._expirations

    def get_chain(self, expiration: str) -> tuple:
        """
        Get options chain for a specific expiration.
        Returns (calls_df, puts_df).
        """
        if expiration in self._chain_cache:
            return self._chain_cache[expiration]

        try:
            chain = self.ticker.option_chain(expiration)
            self._chain_cache[expiration] = (chain.calls, chain.puts)
            return chain.calls, chain.puts
        except Exception as e:
            print(f"[OptionsChain] Chain fetch error for {expiration}: {e}")
            return pd.DataFrame(), pd.DataFrame()

    # ── Expiration Selection ────────────────────────────────────

    def find_expiration(
        self,
        expiry_type: Literal["0dte", "nearest", "weekly", "monthly", "specific"] = "nearest",
        target_dte: Optional[int] = None,
        target_date: Optional[str] = None,
    ) -> Optional[str]:
        """
        Select an expiration date based on criteria.

        Args:
            expiry_type:
                '0dte'     — Today's expiration (or nearest if none today)
                'nearest'  — Closest expiration to today
                'weekly'   — Nearest Friday expiration within 7 days
                'monthly'  — Third Friday of the month
                'specific' — Closest to target_dte days out or target_date
        """
        if not self.expirations:
            return None

        today = date.today()

        if expiry_type == "0dte":
            today_str = today.strftime("%Y-%m-%d")
            if today_str in self.expirations:
                return today_str
            # No 0DTE available — try tomorrow (for MWF SPY schedule)
            # but ONLY if it's 1 DTE max. Never pick a multi-day expiry for 0DTE.
            for exp in self.expirations:
                exp_date = datetime.strptime(exp, "%Y-%m-%d").date()
                dte = (exp_date - today).days
                if dte <= 1:
                    print(f"[OptionsChain] No 0DTE found, using {exp} ({dte} DTE)")
                    return exp
            # Nothing within 1 day — no valid 0DTE
            print(f"[OptionsChain] WARNING: No 0DTE or 1DTE expiry available")
            return None

        if expiry_type == "nearest":
            return self.expirations[0] if self.expirations else None

        if expiry_type == "weekly":
            # Find nearest FRIDAY expiry within 7 days (for multi-day theta profile)
            # SPY has MWF expirations — we want Fridays for Boba's hold strategy
            cutoff = today + timedelta(days=7)
            friday_candidates = []
            all_candidates = []
            for exp in self.expirations:
                exp_date = datetime.strptime(exp, "%Y-%m-%d").date()
                if exp_date < today:
                    continue
                if exp_date > cutoff:
                    break
                all_candidates.append(exp)
                if exp_date.weekday() == 4:  # Friday
                    friday_candidates.append(exp)

            # Prefer Friday expirations (better theta decay profile for multi-day holds)
            if friday_candidates:
                return friday_candidates[0]
            # Fallback: any expiry with at least 2 DTE (not a 0-1 DTE accident)
            for exp in all_candidates:
                exp_date = datetime.strptime(exp, "%Y-%m-%d").date()
                if (exp_date - today).days >= 2:
                    return exp
            # Last resort: nearest available within 7 days
            if all_candidates:
                return all_candidates[0]
            return self.expirations[0] if self.expirations else None

        if expiry_type == "monthly":
            # Find third Friday of current or next month
            for exp in self.expirations:
                exp_date = datetime.strptime(exp, "%Y-%m-%d").date()
                if exp_date.weekday() == 4:  # Friday
                    # Check if it's the third Friday
                    first_day = exp_date.replace(day=1)
                    first_friday = first_day + timedelta(days=(4 - first_day.weekday()) % 7)
                    third_friday = first_friday + timedelta(weeks=2)
                    if exp_date == third_friday and exp_date >= today:
                        return exp
            return None

        if expiry_type == "specific":
            if target_date:
                # Find closest to target_date
                target = datetime.strptime(target_date, "%Y-%m-%d").date()
            elif target_dte is not None:
                target = today + timedelta(days=target_dte)
            else:
                return self.expirations[0] if self.expirations else None

            best = None
            best_diff = float("inf")
            for exp in self.expirations:
                exp_date = datetime.strptime(exp, "%Y-%m-%d").date()
                diff = abs((exp_date - target).days)
                if diff < best_diff:
                    best_diff = diff
                    best = exp
            return best

        return self.expirations[0] if self.expirations else None

    # ── Strike Selection ────────────────────────────────────────

    def _enrich_greeks(self, row, contract_type: str, expiration: str) -> dict:
        """Compute Greeks for a single chain row."""
        exp_date = datetime.strptime(expiration, "%Y-%m-%d").date()
        dte = max((exp_date - date.today()).days, 0)

        iv = float(row.get("impliedVolatility", 0.20))
        strike = float(row["strike"])

        greeks = bs_greeks(self.spot, strike, dte, iv, contract_type=contract_type)
        return {**greeks, "dte": dte}

    def _select_contract(
        self,
        contract_type: str,
        expiry_type: str = "nearest",
        selection: str = "atm",
        target_delta: Optional[float] = None,
        target_dte: Optional[int] = None,
        min_volume: int = 0,
        min_oi: int = 0,
        max_spread_pct: float = 20.0,
    ) -> Optional[OptionContract]:
        """
        Core strike selection logic.

        Args:
            contract_type: 'CALL' or 'PUT'
            expiry_type: '0dte', 'nearest', 'weekly', 'monthly'
            selection:
                'atm'    — Strike closest to current price
                'delta'  — Strike closest to target_delta
                'otm_1'  — 1 strike OTM from ATM
                'otm_2'  — 2 strikes OTM from ATM
                'itm_1'  — 1 strike ITM from ATM
            target_delta: Target delta (e.g., 0.30 for calls, -0.30 for puts)
            min_volume: Minimum volume filter
            min_oi: Minimum open interest filter
            max_spread_pct: Maximum bid-ask spread as % of mid
        """
        # Find expiration
        expiration = self.find_expiration(expiry_type, target_dte=target_dte)
        if not expiration:
            print(f"[OptionsChain] No expiration found for {expiry_type}")
            return None

        # Get chain
        calls_df, puts_df = self.get_chain(expiration)
        df = calls_df if contract_type == "CALL" else puts_df

        if df.empty:
            print(f"[OptionsChain] Empty chain for {self.underlying} {expiration} {contract_type}")
            return None

        # Apply liquidity filters
        if min_volume > 0:
            df = df[df["volume"] >= min_volume]
        if min_oi > 0:
            df = df[df["openInterest"] >= min_oi]

        # Filter out zero-bid contracts
        df = df[df["bid"] > 0]

        if df.empty:
            print(f"[OptionsChain] No contracts pass liquidity filters")
            return None

        # Spread filter
        df = df.copy()
        df["mid"] = (df["bid"] + df["ask"]) / 2
        df["spread_pct"] = ((df["ask"] - df["bid"]) / df["mid"] * 100).fillna(999)
        df = df[df["spread_pct"] <= max_spread_pct]

        if df.empty:
            print(f"[OptionsChain] No contracts pass spread filter (<{max_spread_pct}%)")
            return None

        # Select strike
        spot = self.spot
        if spot <= 0:
            return None

        if selection == "delta" and target_delta is not None:
            # Compute delta for each strike and find closest to target
            best_row = None
            best_diff = float("inf")
            for _, row in df.iterrows():
                greeks = self._enrich_greeks(row, contract_type, expiration)
                diff = abs(greeks["delta"] - target_delta)
                if diff < best_diff:
                    best_diff = diff
                    best_row = row
                    best_greeks = greeks
            if best_row is None:
                return None
            row = best_row
            greeks = best_greeks

        elif selection in ("otm_1", "otm_2", "itm_1"):
            # Sort by distance from ATM
            df = df.copy()
            df["dist"] = abs(df["strike"] - spot)
            df = df.sort_values("dist")

            # ATM index
            atm_idx = 0
            if selection == "otm_1":
                # 1 strike OTM
                if contract_type == "CALL":
                    candidates = df[df["strike"] > spot].head(1)
                else:
                    candidates = df[df["strike"] < spot].head(1)
            elif selection == "otm_2":
                if contract_type == "CALL":
                    candidates = df[df["strike"] > spot].head(2).tail(1)
                else:
                    candidates = df[df["strike"] < spot].head(2).tail(1)
            elif selection == "itm_1":
                if contract_type == "CALL":
                    candidates = df[df["strike"] < spot].tail(1)
                else:
                    candidates = df[df["strike"] > spot].tail(1)
            else:
                candidates = pd.DataFrame()

            if candidates.empty:
                # Fall back to ATM
                row = df.iloc[0]
            else:
                row = candidates.iloc[0]

            greeks = self._enrich_greeks(row, contract_type, expiration)

        else:
            # ATM: closest strike to spot
            df = df.copy()
            df["dist"] = abs(df["strike"] - spot)
            df = df.sort_values("dist")
            row = df.iloc[0]
            greeks = self._enrich_greeks(row, contract_type, expiration)

        # Determine moneyness
        strike = float(row["strike"])
        if contract_type == "CALL":
            if strike < spot * 0.998:
                moneyness = "ITM"
            elif strike > spot * 1.002:
                moneyness = "OTM"
            else:
                moneyness = "ATM"
        else:
            if strike > spot * 1.002:
                moneyness = "ITM"
            elif strike < spot * 0.998:
                moneyness = "OTM"
            else:
                moneyness = "ATM"

        exp_date = datetime.strptime(expiration, "%Y-%m-%d").date()
        dte = max((exp_date - date.today()).days, 0)

        return OptionContract(
            symbol=self.underlying,
            contract_type=contract_type,
            strike=strike,
            expiration=expiration,
            bid=float(row.get("bid", 0)),
            ask=float(row.get("ask", 0)),
            mid=float(row.get("mid", (row.get("bid", 0) + row.get("ask", 0)) / 2)),
            last_price=float(row.get("lastPrice", 0)),
            volume=int(row.get("volume", 0)),
            open_interest=int(row.get("openInterest", 0)),
            implied_volatility=float(row.get("impliedVolatility", 0)),
            delta=greeks["delta"],
            gamma=greeks["gamma"],
            theta=greeks["theta"],
            vega=greeks["vega"],
            dte=dte,
            moneyness=moneyness,
        )

    # ── Public API ──────────────────────────────────────────────

    def select_call(self, **kwargs) -> Optional[OptionContract]:
        """Select a CALL contract. See _select_contract for kwargs."""
        return self._select_contract("CALL", **kwargs)

    def select_put(self, **kwargs) -> Optional[OptionContract]:
        """Select a PUT contract. See _select_contract for kwargs."""
        return self._select_contract("PUT", **kwargs)

    def check_iv_environment(self, max_iv_rank: float = 80.0) -> dict:
        """
        Check if the IV environment is favorable for buying options.

        High IV rank (>80) means premiums are expensive relative to history —
        bad for debit entries. Returns dict with rank, assessment, and go/no-go.
        """
        try:
            # Get ATM IV from the nearest expiration
            nearest = self.find_expiration("nearest")
            if not nearest:
                return {"iv_rank": None, "favorable": True, "reason": "No chain data"}

            calls_df, _ = self.get_chain(nearest)
            if calls_df.empty:
                return {"iv_rank": None, "favorable": True, "reason": "Empty chain"}

            # Get ATM implied vol
            calls_df = calls_df.copy()
            calls_df["dist"] = abs(calls_df["strike"] - self.spot)
            atm_row = calls_df.sort_values("dist").iloc[0]
            current_iv = float(atm_row.get("impliedVolatility", 0.20))

            rank = iv_rank(self.underlying, current_iv)
            if rank is None:
                return {"iv_rank": None, "favorable": True, "reason": "IV rank unavailable"}

            favorable = rank <= max_iv_rank
            if rank > 80:
                assessment = "VERY_HIGH"
            elif rank > 60:
                assessment = "ELEVATED"
            elif rank > 40:
                assessment = "NORMAL"
            else:
                assessment = "LOW"

            return {
                "iv_rank": round(rank, 1),
                "current_iv": round(current_iv, 4),
                "assessment": assessment,
                "favorable": favorable,
                "reason": f"IV Rank {rank:.0f}% ({assessment})" + ("" if favorable else " — premiums expensive, consider skipping"),
            }
        except Exception as e:
            return {"iv_rank": None, "favorable": True, "reason": f"IV check error: {e}"}

    def get_premium(
        self,
        expiration: str,
        strike: float,
        contract_type: str,
        max_cache_age: float = 60.0,
    ) -> Optional[float]:
        """
        Fast targeted premium check for a specific contract.
        Uses chain cache (max_cache_age seconds) to avoid re-fetching the full chain
        on every scan cycle. Cache is invalidated automatically when stale.

        This is the right way to monitor an open position's premium — much faster
        than creating a new OptionsChain() instance every 5 minutes.

        Args:
            expiration:     YYYY-MM-DD expiry of the contract
            strike:         Strike price
            contract_type:  'CALL' or 'PUT'
            max_cache_age:  Max seconds before chain data is considered stale (default 60s)

        Returns:
            Mid price of the contract, or None if not found
        """
        import time as _time

        # Check if cache is too old — invalidate it to force a fresh fetch
        cache_key = f"__ts_{expiration}"
        last_fetch = self._chain_cache.get(cache_key, 0)
        if isinstance(last_fetch, (int, float)) and (_time.time() - last_fetch) > max_cache_age:
            # Remove stale chain data for this expiration
            self._chain_cache.pop(expiration, None)

        # Fetch (or use cache)
        calls_df, puts_df = self.get_chain(expiration)
        # Timestamp this fetch
        self._chain_cache[cache_key] = _time.time()

        df = calls_df if contract_type.upper() == 'CALL' else puts_df
        if df.empty:
            return None

        row = df[abs(df['strike'] - strike) < 0.01]
        if row.empty:
            return None

        r = row.iloc[0]
        bid = float(r.get('bid', 0) or 0)
        ask = float(r.get('ask', 0) or 0)
        last = float(r.get('lastPrice', 0) or 0)

        if bid > 0 and ask > 0:
            return round((bid + ask) / 2, 2)
        if last > 0:
            return round(last, 2)
        return None

    def get_atm_straddle(self, expiry_type="nearest") -> Optional[tuple]:
        """Get ATM call + put for the same strike/expiry (straddle)."""
        call = self.select_call(selection="atm", expiry_type=expiry_type)
        if not call:
            return None
        put = self.select_put(selection="atm", expiry_type=expiry_type)
        if not put:
            return None
        return call, put


# ═══════════════════════════════════════════════════════════════
#  PREMIUM-BASED RISK MANAGEMENT
# ═══════════════════════════════════════════════════════════════

def calculate_options_risk(
    contract: OptionContract,
    account_balance: float,
    risk_pct: float = 0.02,
    max_loss_pct: float = 0.50,
    target_gain_pct: float = 1.00,
) -> dict:
    """
    Calculate position sizing and risk for an options trade.

    Unlike equity trades where SL/TP are based on underlying price,
    options risk is managed by PREMIUM movement.

    Args:
        contract: The selected option contract
        account_balance: Current account balance
        risk_pct: Max % of account to risk (default 2%)
        max_loss_pct: % of premium willing to lose (default 50%)
        target_gain_pct: Target % gain on premium (default 100% = double)

    Returns:
        dict with qty, risk_amount, stop_premium, target_premium, max_cost
    """
    entry_premium = contract.mid
    if entry_premium <= 0:
        return {"qty": 0, "error": "Zero premium"}

    # How much we're willing to risk in dollars
    risk_amount = account_balance * risk_pct

    # Each contract = 100 shares, so cost = premium * 100 * qty
    cost_per_contract = entry_premium * 100

    # Max loss per contract = premium * max_loss_pct * 100
    loss_per_contract = entry_premium * max_loss_pct * 100

    # Position size = risk_amount / loss_per_contract
    qty = max(1, int(risk_amount / loss_per_contract)) if loss_per_contract > 0 else 1

    # Cap at affordable quantity
    max_affordable = int(account_balance * 0.10 / cost_per_contract) if cost_per_contract > 0 else 1
    qty = min(qty, max(1, max_affordable))

    stop_premium = round(entry_premium * (1 - max_loss_pct), 2)
    target_premium = round(entry_premium * (1 + target_gain_pct), 2)
    total_cost = cost_per_contract * qty
    max_loss = loss_per_contract * qty
    max_gain = entry_premium * target_gain_pct * 100 * qty

    return {
        "qty": qty,
        "entry_premium": entry_premium,
        "cost_per_contract": round(cost_per_contract, 2),
        "total_cost": round(total_cost, 2),
        "stop_premium": stop_premium,
        "target_premium": target_premium,
        "max_loss": round(max_loss, 2),
        "max_gain": round(max_gain, 2),
        "risk_reward": round(max_gain / max_loss, 2) if max_loss > 0 else 0,
    }


# ═══════════════════════════════════════════════════════════════
#  IV RANK / IV PERCENTILE
# ═══════════════════════════════════════════════════════════════

def iv_rank(underlying: str, current_iv: float, lookback_days: int = 252) -> Optional[float]:
    """
    Calculate IV Rank: where current IV sits relative to its 1-year range.
    IV Rank = (Current IV - 52w Low IV) / (52w High IV - 52w Low IV)

    Returns 0-100 or None if data unavailable.
    Note: This is an approximation using historical volatility as a proxy
    since yfinance doesn't provide historical IV data.
    """
    try:
        ticker = yf.Ticker(underlying)
        hist = ticker.history(period=f"{lookback_days + 30}d")  # Buffer for rolling calc
        if hist.empty or len(hist) < 30:
            return None

        # Calculate realized vol as IV proxy
        returns = hist["Close"].pct_change().dropna()
        rolling_vol = returns.rolling(window=20).std() * math.sqrt(252)
        rolling_vol = rolling_vol.dropna()

        if rolling_vol.empty:
            return None

        low_iv = rolling_vol.min()
        high_iv = rolling_vol.max()

        if high_iv == low_iv:
            return 50.0

        rank = (current_iv - low_iv) / (high_iv - low_iv) * 100
        return round(max(0, min(100, rank)), 1)
    except Exception as e:
        print(f"[options_utils] Failed to calculate IV rank for {underlying}: {e}")
        return None


# ═══════════════════════════════════════════════════════════════
#  QUICK TEST
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("\nOptions Utils — Quick Test")
    print("=" * 50)

    # Test OCC symbol
    occ = build_occ_symbol("SPY", "2026-03-20", "CALL", 570.00)
    print(f"\nOCC Symbol: {occ}")
    parsed = parse_occ_symbol(occ)
    print(f"Parsed: {parsed}")

    # Test Black-Scholes
    greeks = bs_greeks(spot=570, strike=575, dte=5, iv=0.15, contract_type="CALL")
    print(f"\nGreeks (SPY 575C, 5 DTE, 15% IV):")
    for k, v in greeks.items():
        print(f"  {k}: {v}")

    # Test chain (requires internet)
    try:
        chain = OptionsChain("SPY")
        print(f"\nSPY spot: ${chain.spot:.2f}")
        print(f"Expirations: {chain.expirations[:5]}...")

        call = chain.select_call(selection="atm", expiry_type="nearest")
        if call:
            print(f"\nATM Call: {call.occ_symbol}")
            print(f"  Strike: ${call.strike} | Mid: ${call.mid:.2f}")
            print(f"  Delta: {call.delta} | Theta: {call.theta}")
            print(f"  IV: {call.implied_volatility:.2%} | DTE: {call.dte}")
            print(f"  Spread: {call.spread_pct:.1f}% | Vol: {call.volume} | OI: {call.open_interest}")

            risk = calculate_options_risk(call, account_balance=25000)
            print(f"\nRisk Calc ($25k account, 2% risk):")
            for k, v in risk.items():
                print(f"  {k}: {v}")

        put_30d = chain.select_put(selection="delta", target_delta=-0.30, expiry_type="weekly")
        if put_30d:
            print(f"\n30-Delta Put: {put_30d.occ_symbol}")
            print(f"  Strike: ${put_30d.strike} | Delta: {put_30d.delta}")

    except Exception as e:
        print(f"\nChain test skipped (no internet?): {e}")

    print("\nDone.")
