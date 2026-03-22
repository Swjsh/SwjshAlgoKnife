"""
Real-Time Data Feeds — SwjshAlgoKnife
======================================
Shared module providing real-time price feeds for all Python agents.
Replaces yfinance polling with WebSocket streams where available.

TIER SUMMARY (cheapest → most expensive):
  FREE (no account):     Binance WebSocket (BTC/ETH/SOL)
  FREE (need account):   OANDA Streaming (FX + futures proxies)
  FREE (need account):   Alpaca WebSocket IEX (equities: SPY, QQQ etc.)
  PAID (~$25-75/mo):     ThetaData (real-time options chains)
  PAID (~$199/mo):       Polygon/Massive.com (everything)

Usage:
    from data_feeds import PriceFeed, get_latest_price

    # One-shot blocking fetch (drops back to yfinance if no WebSocket available)
    price = get_latest_price('SPY')

    # Live streaming (non-blocking, runs in background thread)
    feed = PriceFeed()
    feed.subscribe_alpaca(['SPY', 'QQQ'])     # needs APCA keys in env
    feed.subscribe_binance(['BTCUSDT'])        # no auth needed
    feed.subscribe_oanda(['EUR_USD'])          # needs OANDA_API_TOKEN in env

    price = feed.get('SPY')                    # get latest cached price
    feed.stop()                                # clean shutdown
"""

import os
import json
import math
import time
import threading
import logging
from datetime import datetime, timezone
from typing import Optional, Callable

import yfinance as yf

log = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
#  PRICE CACHE — shared in-process store
# ═══════════════════════════════════════════════════════════════

class _PriceCache:
    """Thread-safe latest-price cache."""

    def __init__(self):
        self._prices: dict[str, float] = {}
        self._timestamps: dict[str, datetime] = {}
        self._lock = threading.Lock()

    def set(self, symbol: str, price: float):
        with self._lock:
            self._prices[symbol.upper()] = price
            self._timestamps[symbol.upper()] = datetime.now(timezone.utc)

    def get(self, symbol: str) -> Optional[float]:
        return self._prices.get(symbol.upper())

    def age_seconds(self, symbol: str) -> float:
        ts = self._timestamps.get(symbol.upper())
        if ts is None:
            return float('inf')
        return (datetime.now(timezone.utc) - ts).total_seconds()

    def all(self) -> dict:
        with self._lock:
            return dict(self._prices)


_cache = _PriceCache()


# ═══════════════════════════════════════════════════════════════
#  ONE-SHOT PRICE FETCH (with WebSocket cache hit first)
# ═══════════════════════════════════════════════════════════════

def get_latest_price(symbol: str, max_cache_age: float = 30.0) -> Optional[float]:
    """
    Get the latest price for a symbol.
    1. Checks in-process WebSocket cache first (if age < max_cache_age seconds)
    2. Falls back to yfinance REST call if cache is stale/empty

    Args:
        symbol:         Ticker (e.g. 'SPY', 'BTC-USD', 'EURUSD=X')
        max_cache_age:  Max seconds before cache is considered stale (default 30s)

    Returns:
        Latest price as float, or None on failure
    """
    cached = _cache.get(symbol)
    if cached is not None and _cache.age_seconds(symbol) < max_cache_age:
        return cached

    # Fall back to yfinance
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period='1d', interval='1m')
        if not hist.empty:
            price = float(hist['Close'].iloc[-1])
            _cache.set(symbol, price)
            return price
        info = ticker.info
        price = info.get('regularMarketPrice') or info.get('previousClose')
        if price:
            _cache.set(symbol, float(price))
            return float(price)
    except Exception as e:
        log.warning(f"[DataFeeds] yfinance fallback failed for {symbol}: {e}")

    return cached  # Return stale cache rather than None if available


# ═══════════════════════════════════════════════════════════════
#  BINANCE WEBSOCKET — Free, no auth, real-time BTC/ETH/SOL
# ═══════════════════════════════════════════════════════════════

class BinanceFeed(threading.Thread):
    """
    Real-time crypto prices from Binance US WebSocket.
    FREE — no API key required for public trade streams.

    Symbols format: 'BTCUSDT', 'ETHUSDT', 'SOLUSDT'
    Cache key format: 'BTC-USD', 'ETH-USD', 'SOL-USD' (yfinance compatible)
    """

    WS_URL = "wss://stream.binance.us:9443/ws"
    # Fallback for non-US: "wss://stream.binance.com:9443/ws"

    BINANCE_TO_YF = {
        'BTCUSDT': 'BTC-USD',
        'ETHUSDT': 'ETH-USD',
        'SOLUSDT': 'SOL-USD',
        'BNBUSDT': 'BNB-USD',
    }

    def __init__(self, symbols: list[str]):
        """
        Args:
            symbols: Binance symbols e.g. ['BTCUSDT', 'ETHUSDT']
        """
        super().__init__(daemon=True, name="BinanceFeed")
        self.symbols = [s.lower() for s in symbols]
        self._stop = threading.Event()
        self._ws = None

    def run(self):
        try:
            import websocket as ws_lib
        except ImportError:
            log.error("[BinanceFeed] websocket-client not installed. Run: pip install websocket-client")
            return

        stream = '/'.join(f"{s}@trade" for s in self.symbols)
        url = f"{self.WS_URL}/{stream}"

        def on_message(ws, message):
            try:
                data = json.loads(message)
                symbol = data.get('s', '').upper()  # e.g. 'BTCUSDT'
                price = float(data.get('p', 0))
                if symbol and price > 0:
                    yf_key = self.BINANCE_TO_YF.get(symbol, symbol)
                    _cache.set(yf_key, price)
            except Exception as e:
                log.debug(f"[BinanceFeed] parse error: {e}")

        def on_error(ws, error):
            log.warning(f"[BinanceFeed] WebSocket error: {error}")

        def on_close(ws, code, msg):
            log.info(f"[BinanceFeed] Connection closed ({code})")
            if not self._stop.is_set():
                log.info("[BinanceFeed] Reconnecting in 5s...")
                time.sleep(5)
                self.run()  # Reconnect

        def on_open(ws):
            symbols_str = ', '.join(s.upper() for s in self.symbols)
            log.info(f"[BinanceFeed] Connected — streaming {symbols_str}")

        self._ws = ws_lib.WebSocketApp(
            url,
            on_message=on_message,
            on_error=on_error,
            on_close=on_close,
            on_open=on_open,
        )
        self._ws.run_forever(ping_interval=30, ping_timeout=10)

    def stop(self):
        self._stop.set()
        if self._ws:
            try:
                self._ws.close()
            except Exception as e:
                log.debug(f"[BinanceFeed] Error closing WebSocket (non-critical): {e}")


# ═══════════════════════════════════════════════════════════════
#  OANDA STREAMING — Free with practice account, FX + futures
# ═══════════════════════════════════════════════════════════════

class OANDAStreamFeed(threading.Thread):
    """
    Real-time FX/futures prices from OANDA practice account streaming API.
    FREE with a free OANDA practice account (OANDA_API_TOKEN required).

    Instruments: 'EUR_USD', 'GBP_USD', 'USD_JPY', 'AUD_USD', 'USD_CAD'
                 'US500_USD' (ES proxy), 'NAS100_USD' (NQ proxy), 'XAU_USD' (Gold)

    Requires env vars:
        OANDA_API_TOKEN   — from practice.oanda.com
        OANDA_ACCOUNT_ID  — your practice account ID
    """

    OANDA_ENV_MAP = {
        'EURUSD=X':  'EUR_USD',
        'GBPUSD=X':  'GBP_USD',
        'USDJPY=X':  'USD_JPY',
        'AUDUSD=X':  'AUD_USD',
        'USDCAD=X':  'USD_CAD',
        'USDCHF=X':  'USD_CHF',
        'EURJPY=X':  'EUR_JPY',
        'GBPJPY=X':  'GBP_JPY',
    }
    # Reverse: OANDA instrument → yfinance-style cache key
    OANDA_TO_YF = {v: k for k, v in OANDA_ENV_MAP.items()}

    STREAM_URL = "https://stream-fxpractice.oanda.com/v3/accounts/{account_id}/pricing/stream"

    def __init__(self, instruments: list[str], yf_format: bool = True):
        """
        Args:
            instruments: OANDA format e.g. ['EUR_USD', 'GBP_USD'] OR
                         yfinance format e.g. ['EURUSD=X', 'GBPUSD=X']
            yf_format:   If True, instruments are in yfinance format (auto-converts)
        """
        super().__init__(daemon=True, name="OANDAStreamFeed")
        if yf_format:
            self.instruments = [self.OANDA_ENV_MAP.get(i, i) for i in instruments]
        else:
            self.instruments = instruments
        self._stop = threading.Event()
        self._token = os.getenv('OANDA_API_TOKEN', '')
        self._account = os.getenv('OANDA_ACCOUNT_ID', '')

    def run(self):
        if not self._token or not self._account:
            log.error("[OANDAStream] OANDA_API_TOKEN or OANDA_ACCOUNT_ID not set — cannot stream")
            return

        import requests
        url = self.STREAM_URL.format(account_id=self._account)
        headers = {'Authorization': f'Bearer {self._token}'}
        params = {'instruments': ','.join(self.instruments)}

        while not self._stop.is_set():
            try:
                log.info(f"[OANDAStream] Connecting to {', '.join(self.instruments)}...")
                with requests.get(url, headers=headers, params=params, stream=True, timeout=30) as resp:
                    if resp.status_code != 200:
                        log.error(f"[OANDAStream] HTTP {resp.status_code}: {resp.text[:200]}")
                        time.sleep(10)
                        continue

                    for line in resp.iter_lines():
                        if self._stop.is_set():
                            break
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                            if data.get('type') != 'PRICE':
                                continue
                            instrument = data.get('instrument', '')
                            bids = data.get('bids', [])
                            asks = data.get('asks', [])
                            if bids and asks:
                                mid = (float(bids[0]['price']) + float(asks[0]['price'])) / 2
                                yf_key = self.OANDA_TO_YF.get(instrument, instrument)
                                _cache.set(yf_key, mid)
                        except Exception as e:
                            log.debug(f"[OANDAStream] parse error: {e}")

            except Exception as e:
                if not self._stop.is_set():
                    log.warning(f"[OANDAStream] Connection error: {e} — reconnecting in 5s")
                    time.sleep(5)

    def stop(self):
        self._stop.set()


# ═══════════════════════════════════════════════════════════════
#  ALPACA WEBSOCKET — Free with paper account, equities
# ═══════════════════════════════════════════════════════════════

class AlpacaFeed(threading.Thread):
    """
    Real-time equity prices from Alpaca's WebSocket.
    FREE with a paper trading account (free to open).

    Free tier uses IEX data feed (~90% coverage, ~0.5s latency).
    The underlying price for signal generation is what matters — this replaces
    the 5-15 minute yfinance delay with sub-second updates.

    For SPY and major ETFs, IEX coverage is effectively 100%.

    Requires env vars:
        APCA_API_KEY_ID      — Alpaca paper API key
        APCA_API_SECRET_KEY  — Alpaca paper API secret
    """

    WS_URL_PAPER = "wss://stream.data.alpaca.markets/v2/iex"  # Free IEX feed
    WS_URL_LIVE  = "wss://stream.data.alpaca.markets/v2/sip"  # SIP (requires paid plan)
    WS_URL_CRYPTO = "wss://stream.data.alpaca.markets/v1beta3/crypto/us"  # Free crypto

    def __init__(self, symbols: list[str], crypto: bool = False):
        """
        Args:
            symbols: Alpaca format e.g. ['SPY', 'QQQ', 'SPX']
            crypto:  If True, uses crypto WebSocket (no auth needed for crypto)
        """
        super().__init__(daemon=True, name="AlpacaFeed")
        self.symbols = [s.upper() for s in symbols]
        self.crypto = crypto
        self._stop = threading.Event()
        self._ws = None
        self._key = os.getenv('APCA_API_KEY_ID', '')
        self._secret = os.getenv('APCA_API_SECRET_KEY', '')

    def run(self):
        try:
            import websocket as ws_lib
        except ImportError:
            log.error("[AlpacaFeed] websocket-client not installed. Run: pip install websocket-client")
            return

        if not self._key or not self._secret:
            log.error("[AlpacaFeed] APCA_API_KEY_ID or APCA_API_SECRET_KEY not set")
            return

        url = self.WS_URL_CRYPTO if self.crypto else self.WS_URL_PAPER
        authenticated = threading.Event()

        def on_message(ws, message):
            try:
                msgs = json.loads(message)
                if not isinstance(msgs, list):
                    msgs = [msgs]

                for msg in msgs:
                    t = msg.get('T')

                    # Authentication response
                    if t == 'success' and msg.get('msg') == 'authenticated':
                        authenticated.set()
                        log.info(f"[AlpacaFeed] Authenticated — subscribing to {self.symbols}")
                        sub = {'action': 'subscribe', 'bars': self.symbols}
                        ws.send(json.dumps(sub))

                    # Connected — need to auth
                    elif t == 'success' and msg.get('msg') == 'connected':
                        auth_msg = {'action': 'auth', 'key': self._key, 'secret': self._secret}
                        ws.send(json.dumps(auth_msg))

                    # Minute bar update (low latency, regular updates)
                    elif t == 'b':
                        symbol = msg.get('S', '')
                        close = msg.get('c')  # close price of the bar
                        if symbol and close:
                            _cache.set(symbol, float(close))

                    # Trade update (tick level, most real-time)
                    elif t == 't':
                        symbol = msg.get('S', '')
                        price = msg.get('p')
                        if symbol and price:
                            _cache.set(symbol, float(price))

                    # Quote update
                    elif t == 'q':
                        symbol = msg.get('S', '')
                        bid = msg.get('bp', 0)
                        ask = msg.get('ap', 0)
                        if symbol and bid and ask:
                            _cache.set(symbol, (float(bid) + float(ask)) / 2)

            except Exception as e:
                log.debug(f"[AlpacaFeed] parse error: {e}")

        def on_error(ws, error):
            log.warning(f"[AlpacaFeed] WebSocket error: {error}")

        def on_close(ws, code, msg):
            log.info(f"[AlpacaFeed] Connection closed ({code})")
            if not self._stop.is_set():
                log.info("[AlpacaFeed] Reconnecting in 5s...")
                time.sleep(5)
                self.run()

        def on_open(ws):
            log.info(f"[AlpacaFeed] WebSocket connected to {url}")

        self._ws = ws_lib.WebSocketApp(
            url,
            on_message=on_message,
            on_error=on_error,
            on_close=on_close,
            on_open=on_open,
        )
        self._ws.run_forever(ping_interval=30, ping_timeout=10)

    def stop(self):
        self._stop.set()
        if self._ws:
            try:
                self._ws.close()
            except Exception as e:
                log.debug(f"[AlpacaFeed] Error closing WebSocket (non-critical): {e}")


# ═══════════════════════════════════════════════════════════════
#  UNIFIED FEED MANAGER
# ═══════════════════════════════════════════════════════════════

class PriceFeed:
    """
    Unified feed manager — starts the right WebSocket for each symbol type.

    Usage:
        feed = PriceFeed()
        feed.subscribe_binance(['BTCUSDT', 'ETHUSDT'])  # free, no auth
        feed.subscribe_alpaca(['SPY', 'QQQ'])            # free, needs APCA keys
        feed.subscribe_oanda(['EUR_USD', 'GBP_USD'])     # free, needs OANDA token

        price = feed.get('BTC-USD')
        feed.stop()
    """

    def __init__(self):
        self._feeds: list = []

    def subscribe_binance(self, symbols: list[str]) -> 'PriceFeed':
        """Subscribe to Binance crypto stream (FREE, no auth)."""
        feed = BinanceFeed(symbols)
        feed.start()
        self._feeds.append(feed)
        return self

    def subscribe_alpaca(self, symbols: list[str], crypto: bool = False) -> 'PriceFeed':
        """Subscribe to Alpaca equity/crypto stream (FREE with paper account)."""
        feed = AlpacaFeed(symbols, crypto=crypto)
        feed.start()
        self._feeds.append(feed)
        return self

    def subscribe_oanda(self, instruments: list[str], yf_format: bool = True) -> 'PriceFeed':
        """Subscribe to OANDA FX stream (FREE with practice account)."""
        feed = OANDAStreamFeed(instruments, yf_format=yf_format)
        feed.start()
        self._feeds.append(feed)
        return self

    def get(self, symbol: str, max_age: float = 30.0) -> Optional[float]:
        """
        Get latest price. Falls back to yfinance if WebSocket cache is stale.

        Args:
            symbol:   Ticker in any format ('SPY', 'BTC-USD', 'EURUSD=X')
            max_age:  Max acceptable cache age in seconds (default 30s)
        """
        return get_latest_price(symbol, max_cache_age=max_age)

    def get_cached(self, symbol: str) -> Optional[float]:
        """Get cached price only — no fallback."""
        return _cache.get(symbol)

    def cache_age(self, symbol: str) -> float:
        """Returns seconds since last price update for this symbol."""
        return _cache.age_seconds(symbol)

    def warm_up(self, symbols: list[str]):
        """
        Pre-warm the cache via yfinance before WebSocket stream catches up.
        Call this at startup to avoid stale reads in the first few seconds.
        """
        for symbol in symbols:
            try:
                price = get_latest_price(symbol, max_cache_age=0)  # Force fresh fetch
                if price:
                    print(f"[DataFeeds] Warmed {symbol}: ${price:.4f}")
            except Exception as e:
                log.warning(f"[DataFeeds] Warm-up failed for {symbol}: {e}")

    def stop(self):
        """Stop all WebSocket feeds."""
        for feed in self._feeds:
            try:
                feed.stop()
            except Exception as e:
                log.debug(f"[PriceFeed] Error stopping feed (non-critical): {e}")


# ═══════════════════════════════════════════════════════════════
#  AUTO-CONFIGURE (convenience factory)
# ═══════════════════════════════════════════════════════════════

def build_feed_for_agent(agent: str) -> PriceFeed:
    """
    Build the optimal PriceFeed for a given agent, using whatever
    credentials are available in the environment.

    Args:
        agent: 'boba' | 'spx_sniper' | 'bitcoin_bob' | 'sterling' | 'pivot_pete'
    """
    feed = PriceFeed()
    has_alpaca = bool(os.getenv('APCA_API_KEY_ID') and os.getenv('APCA_API_SECRET_KEY'))
    has_oanda  = bool(os.getenv('OANDA_API_TOKEN') and os.getenv('OANDA_ACCOUNT_ID'))

    if agent in ('boba', 'spx_sniper'):
        if has_alpaca:
            feed.subscribe_alpaca(['SPY'])
            print("[DataFeeds] Alpaca WebSocket active for SPY (real-time IEX)")
        else:
            print("[DataFeeds] WARNING: No Alpaca keys — using yfinance fallback for SPY (15m delay)")
        feed.warm_up(['SPY'])

    elif agent == 'bitcoin_bob':
        # Binance needs no auth — always prefer it
        feed.subscribe_binance(['BTCUSDT', 'ETHUSDT', 'SOLUSDT'])
        print("[DataFeeds] Binance WebSocket active for BTC/ETH/SOL (real-time, no auth)")
        feed.warm_up(['BTC-USD', 'ETH-USD', 'SOL-USD'])

    elif agent == 'sterling':
        if has_oanda:
            pairs = ['EURUSD=X', 'GBPUSD=X', 'USDJPY=X', 'AUDUSD=X', 'USDCAD=X']
            feed.subscribe_oanda(pairs, yf_format=True)
            print("[DataFeeds] OANDA Streaming active for FX pairs (real-time)")
        else:
            print("[DataFeeds] WARNING: No OANDA keys — using yfinance fallback for FX (30s delay)")
        feed.warm_up(['EURUSD=X', 'GBPUSD=X', 'USDJPY=X', 'AUDUSD=X', 'USDCAD=X'])

    elif agent == 'pivot_pete':
        # Pivot Pete already has OANDA polling — add streaming as upgrade
        if has_oanda:
            feed.subscribe_oanda(['EUR_USD', 'US500_USD', 'NAS100_USD', 'XAU_USD'], yf_format=False)
            print("[DataFeeds] OANDA Streaming active for Pivot Pete instruments (real-time)")

    return feed


# ═══════════════════════════════════════════════════════════════
#  QUICK TEST
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("\nData Feeds — Connectivity Test")
    print("=" * 50)

    print("\n--- yfinance fallback test ---")
    for sym in ['SPY', 'BTC-USD', 'EURUSD=X']:
        p = get_latest_price(sym)
        print(f"  {sym:12s}: ${p:.4f}" if p else f"  {sym:12s}: FAILED")

    print("\n--- WebSocket availability ---")
    try:
        import websocket
        print("  websocket-client: INSTALLED")
    except ImportError:
        print("  websocket-client: NOT INSTALLED (run: pip install websocket-client)")

    has_alpaca = bool(os.getenv('APCA_API_KEY_ID'))
    has_oanda  = bool(os.getenv('OANDA_API_TOKEN'))
    print(f"  Alpaca keys:      {'FOUND' if has_alpaca else 'NOT SET (set APCA_API_KEY_ID)'}")
    print(f"  OANDA keys:       {'FOUND' if has_oanda else 'NOT SET (set OANDA_API_TOKEN)'}")
    print(f"  Binance (no auth): ALWAYS AVAILABLE")

    print("\n--- Live WebSocket test (10s) ---")
    feed = PriceFeed()
    feed.subscribe_binance(['BTCUSDT'])
    print("  Waiting 10s for BTC tick...")
    time.sleep(10)
    btc = feed.get_cached('BTC-USD')
    if btc:
        print(f"  BTC-USD (Binance WebSocket): ${btc:,.2f} [age: {feed.cache_age('BTC-USD'):.1f}s]")
    else:
        print("  BTC-USD: No data received (check network/firewall)")
    feed.stop()

    print("\nDone.")
