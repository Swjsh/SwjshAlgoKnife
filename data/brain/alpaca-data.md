# Alpaca Integration

---
tags: #broker #data #integration
status: ✅ Active
---

## Overview

**Alpaca** is the primary broker/data provider for stocks, options, and crypto.

**Website**: https://alpaca.markets

**Uses**:
- Market data (real-time and historical)
- Trade execution (stocks, options, crypto)
- Account management

**Agents Using Alpaca**:
- [[Boba Trades]] (Options)
- [[Bitcoin Bob]] (Crypto)
- [[SPX Sniper]] (Options)
- [[Pivot Pete]] (Data only - executes via OANDA)

---

## Configuration

### Environment Variables

```env
# Paper trading (recommended for development)
ALPACA_API_KEY=your_api_key
ALPACA_SECRET_KEY=your_secret_key
ALPACA_BASE_URL=https://paper-api.alpaca.markets

# Live trading (use with caution!)
# ALPACA_BASE_URL=https://api.alpaca.markets
```

### API Key Setup

1. Create account at https://alpaca.markets
2. Navigate to Dashboard → Paper Trading
3. Generate API keys
4. Copy to `.env` file

---

## Client Setup

**File**: `src/lib/data-providers/alpaca.ts`

```typescript
import Alpaca from '@alpacahq/alpaca-trade-api';

const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_SECRET_KEY,
  baseUrl: process.env.ALPACA_BASE_URL,
  paper: true,  // Set to false for live
  feed: 'iex'   // 'iex' (free) or 'sip' (paid)
});

export default alpaca;
```

---

## Market Data

### Get Current Price

```typescript
const quote = await alpaca.getLatestQuote('SPY');
console.log(quote.AskPrice, quote.BidPrice);
```

### Get Historical Bars

```typescript
import { StockHistoricalDataClient, StockBarsRequest, TimeFrame } from '@alpacahq/alpaca-trade-api';

const client = new StockHistoricalDataClient({
  keyId: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_SECRET_KEY
});

const request = new StockBarsRequest({
  symbol_or_symbols: ['SPY', 'QQQ'],
  timeframe: TimeFrame.Minute,
  start: new Date('2026-03-01'),
  end: new Date('2026-03-15')
});

const bars = await client.getBars(request);
```

### Stream Real-Time Data

```typescript
const websocket = alpaca.data_stream_v2;

websocket.onConnect(() => {
  console.log('Connected to Alpaca stream');
  websocket.subscribeForBars(['SPY', 'QQQ']);
});

websocket.onBar((bar) => {
  console.log('Bar received:', bar);
  // Process bar through strategy engine
});

websocket.connect();
```

---

## Trading

### Submit Order

```typescript
// Market order
const order = await alpaca.createOrder({
  symbol: 'SPY',
  qty: 10,
  side: 'buy',
  type: 'market',
  time_in_force: 'day'
});

// Limit order
const limitOrder = await alpaca.createOrder({
  symbol: 'SPY',
  qty: 10,
  side: 'buy',
  type: 'limit',
  limit_price: 450.00,
  time_in_force: 'gtc'
});

// Bracket order (entry + stop + target)
const bracketOrder = await alpaca.createOrder({
  symbol: 'SPY',
  qty: 10,
  side: 'buy',
  type: 'market',
  time_in_force: 'day',
  order_class: 'bracket',
  take_profit: { limit_price: 460.00 },
  stop_loss: { stop_price: 445.00 }
});
```

### Get Positions

```typescript
const positions = await alpaca.getPositions();

for (const position of positions) {
  console.log({
    symbol: position.symbol,
    qty: position.qty,
    side: position.side,
    entry_price: position.avg_entry_price,
    current_price: position.current_price,
    unrealized_pl: position.unrealized_pl
  });
}
```

### Close Position

```typescript
// Close specific position
await alpaca.closePosition('SPY');

// Close all positions
await alpaca.closeAllPositions();
```

---

## Options Trading

### Get Options Chain

```typescript
// Using REST API
const response = await fetch(
  `${ALPACA_BASE_URL}/v1/options/chains?symbol=SPY&expiration=2026-03-20`,
  {
    headers: {
      'APCA-API-KEY-ID': process.env.ALPACA_API_KEY,
      'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY
    }
  }
);

const chain = await response.json();
```

### Submit Options Order

```typescript
const optionOrder = await alpaca.createOrder({
  symbol: 'SPY260320C00450000',  // OCC format
  qty: 1,
  side: 'buy',
  type: 'limit',
  limit_price: 5.50,
  time_in_force: 'day'
});
```

---

## Crypto Trading

### Get Crypto Price

```typescript
const btcQuote = await alpaca.getLatestCryptoQuote('BTC/USD');
console.log(btcQuote.ap);  // Ask price
```

### Trade Crypto

```typescript
const cryptoOrder = await alpaca.createOrder({
  symbol: 'BTC/USD',
  qty: 0.1,  // Fractional supported
  side: 'buy',
  type: 'market',
  time_in_force: 'gtc'
});
```

---

## Account Information

### Get Account

```typescript
const account = await alpaca.getAccount();

console.log({
  buying_power: account.buying_power,
  equity: account.equity,
  cash: account.cash,
  portfolio_value: account.portfolio_value,
  status: account.status,
  trading_blocked: account.trading_blocked
});
```

### Get Orders

```typescript
// All open orders
const openOrders = await alpaca.getOrders({ status: 'open' });

// Recent filled orders
const filledOrders = await alpaca.getOrders({
  status: 'filled',
  limit: 50,
  after: '2026-03-01'
});
```

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `forbidden` | Invalid API keys | Check keys in .env |
| `insufficient buying power` | Not enough funds | Reduce order size |
| `market is closed` | Outside trading hours | Wait for market open |
| `symbol not found` | Invalid ticker | Verify symbol format |

### Error Handling Pattern

```typescript
try {
  const order = await alpaca.createOrder({...});
  console.log('Order placed:', order.id);
} catch (error) {
  if (error.code === 40310000) {
    console.error('Insufficient buying power');
  } else if (error.code === 40010001) {
    console.error('Invalid symbol');
  } else {
    console.error('Order failed:', error.message);
  }
}
```

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| Data API | 200 req/min |
| Trading API | 200 req/min |
| Account API | 200 req/min |

### Handling Rate Limits

```typescript
// Exponential backoff
async function withRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.code === 429 && i < maxRetries - 1) {
        await sleep(1000 * Math.pow(2, i));
        continue;
      }
      throw error;
    }
  }
}
```

---

## Paper vs Live

### Paper Trading
- URL: `https://paper-api.alpaca.markets`
- Simulated fills
- Reset account balance anytime
- No real money at risk

### Live Trading
- URL: `https://api.alpaca.markets`
- Real market execution
- Real money
- All regulatory rules apply

### Switching

```env
# .env for paper
ALPACA_BASE_URL=https://paper-api.alpaca.markets

# .env for live (be careful!)
ALPACA_BASE_URL=https://api.alpaca.markets
```

---

## Related Pages

- [[Trade Execution]] - Order flow
- [[Boba Trades]] - Options agent
- [[Bitcoin Bob]] - Crypto agent
- [[SPX Sniper]] - Options agent
- [[Environment Variables]] - Configuration
- [[OANDA Broker]] - Alternative broker
