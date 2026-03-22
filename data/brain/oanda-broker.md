# OANDA Integration

---
tags: #broker #forex #integration
status: ✅ Active
---

## Overview

**OANDA** is the primary broker for forex and CFD trading.

**Website**: https://www.oanda.com

**Uses**:
- Forex trading (EUR/USD, GBP/USD, USD/JPY, etc.)
- Futures CFDs (ES, NQ, YM proxies)
- Market data

**Agents Using OANDA**:
- [[Pivot Pete]] (Futures)
- [[Sterling FX]] (Forex)

---

## Configuration

### Environment Variables

```env
# Practice account (recommended for development)
OANDA_API_KEY=your_access_token
OANDA_ACCOUNT_ID=your_account_id
OANDA_BASE_URL=https://api-fxpractice.oanda.com

# Live account (use with caution!)
# OANDA_BASE_URL=https://api-fxtrade.oanda.com
```

### API Token Setup

1. Create account at https://www.oanda.com
2. Navigate to Manage API Access
3. Generate Personal Access Token
4. Copy Account ID from dashboard
5. Add to `.env` file

---

## API Structure

OANDA uses REST API v20:

```typescript
const OANDA_BASE = process.env.OANDA_BASE_URL;
const headers = {
  'Authorization': `Bearer ${process.env.OANDA_API_KEY}`,
  'Content-Type': 'application/json'
};
```

---

## Market Data

### Get Current Price

```typescript
async function getPrice(instrument: string): Promise<Price> {
  const response = await fetch(
    `${OANDA_BASE}/v3/accounts/${ACCOUNT_ID}/pricing?instruments=${instrument}`,
    { headers }
  );

  const data = await response.json();
  return {
    bid: parseFloat(data.prices[0].bids[0].price),
    ask: parseFloat(data.prices[0].asks[0].price),
    spread: parseFloat(data.prices[0].asks[0].price) - parseFloat(data.prices[0].bids[0].price)
  };
}

// Usage
const price = await getPrice('EUR_USD');
console.log(`Bid: ${price.bid}, Ask: ${price.ask}`);
```

### Get Historical Candles

```typescript
async function getCandles(
  instrument: string,
  granularity: string = 'M1',
  count: number = 100
): Promise<Candle[]> {
  const response = await fetch(
    `${OANDA_BASE}/v3/instruments/${instrument}/candles?granularity=${granularity}&count=${count}`,
    { headers }
  );

  const data = await response.json();
  return data.candles.map(c => ({
    timestamp: c.time,
    open: parseFloat(c.mid.o),
    high: parseFloat(c.mid.h),
    low: parseFloat(c.mid.l),
    close: parseFloat(c.mid.c),
    volume: c.volume
  }));
}

// Granularity options: S5, S10, S15, S30, M1, M2, M4, M5, M10, M15, M30, H1, H2, H3, H4, H6, H8, H12, D, W, M
```

### Stream Real-Time Prices

```typescript
async function* streamPrices(instruments: string[]) {
  const url = `${OANDA_BASE}/v3/accounts/${ACCOUNT_ID}/pricing/stream?instruments=${instruments.join(',')}`;

  const response = await fetch(url, { headers });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const lines = decoder.decode(value).split('\n');
    for (const line of lines) {
      if (line.trim()) {
        const data = JSON.parse(line);
        if (data.type === 'PRICE') {
          yield data;
        }
      }
    }
  }
}
```

---

## Trading

### Submit Market Order

```typescript
async function marketOrder(
  instrument: string,
  units: number  // Positive = buy, negative = sell
): Promise<OrderResult> {
  const response = await fetch(
    `${OANDA_BASE}/v3/accounts/${ACCOUNT_ID}/orders`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        order: {
          instrument,
          units: String(units),
          type: 'MARKET',
          timeInForce: 'FOK'  // Fill or Kill
        }
      })
    }
  );

  const data = await response.json();
  return {
    success: !!data.orderFillTransaction,
    filled_price: data.orderFillTransaction?.price,
    filled_units: data.orderFillTransaction?.units,
    trade_id: data.orderFillTransaction?.tradeOpened?.tradeID
  };
}

// Buy 10,000 EUR/USD
const result = await marketOrder('EUR_USD', 10000);

// Sell 10,000 EUR/USD
const result = await marketOrder('EUR_USD', -10000);
```

### Submit Limit Order

```typescript
async function limitOrder(
  instrument: string,
  units: number,
  price: number
): Promise<OrderResult> {
  const response = await fetch(
    `${OANDA_BASE}/v3/accounts/${ACCOUNT_ID}/orders`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        order: {
          instrument,
          units: String(units),
          type: 'LIMIT',
          price: String(price),
          timeInForce: 'GTC'  // Good 'til Canceled
        }
      })
    }
  );

  return await response.json();
}
```

### Order with Stop Loss / Take Profit

```typescript
async function orderWithSLTP(
  instrument: string,
  units: number,
  stopLoss: number,
  takeProfit: number
): Promise<OrderResult> {
  const response = await fetch(
    `${OANDA_BASE}/v3/accounts/${ACCOUNT_ID}/orders`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        order: {
          instrument,
          units: String(units),
          type: 'MARKET',
          timeInForce: 'FOK',
          stopLossOnFill: {
            price: String(stopLoss)
          },
          takeProfitOnFill: {
            price: String(takeProfit)
          }
        }
      })
    }
  );

  return await response.json();
}
```

---

## Position Management

### Get Open Positions

```typescript
async function getPositions(): Promise<Position[]> {
  const response = await fetch(
    `${OANDA_BASE}/v3/accounts/${ACCOUNT_ID}/positions`,
    { headers }
  );

  const data = await response.json();
  return data.positions.filter(p => parseFloat(p.long.units) !== 0 || parseFloat(p.short.units) !== 0);
}
```

### Close Position

```typescript
async function closePosition(instrument: string): Promise<void> {
  const response = await fetch(
    `${OANDA_BASE}/v3/accounts/${ACCOUNT_ID}/positions/${instrument}/close`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        longUnits: 'ALL',
        shortUnits: 'ALL'
      })
    }
  );

  return await response.json();
}
```

### Modify Trade Stop/Target

```typescript
async function modifyTrade(
  tradeId: string,
  stopLoss?: number,
  takeProfit?: number
): Promise<void> {
  const body: any = {};
  if (stopLoss) body.stopLoss = { price: String(stopLoss) };
  if (takeProfit) body.takeProfit = { price: String(takeProfit) };

  await fetch(
    `${OANDA_BASE}/v3/accounts/${ACCOUNT_ID}/trades/${tradeId}/orders`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify(body)
    }
  );
}
```

---

## Account Information

### Get Account Details

```typescript
async function getAccount(): Promise<Account> {
  const response = await fetch(
    `${OANDA_BASE}/v3/accounts/${ACCOUNT_ID}`,
    { headers }
  );

  const data = await response.json();
  return {
    balance: parseFloat(data.account.balance),
    nav: parseFloat(data.account.NAV),
    unrealized_pl: parseFloat(data.account.unrealizedPL),
    margin_used: parseFloat(data.account.marginUsed),
    margin_available: parseFloat(data.account.marginAvailable),
    open_trades: data.account.openTradeCount
  };
}
```

### Get Trade History

```typescript
async function getTradeHistory(count: number = 50): Promise<Trade[]> {
  const response = await fetch(
    `${OANDA_BASE}/v3/accounts/${ACCOUNT_ID}/trades?state=CLOSED&count=${count}`,
    { headers }
  );

  const data = await response.json();
  return data.trades;
}
```

---

## Instrument Details

### OANDA Instrument Naming

| Market | OANDA Format | Example |
|--------|--------------|---------|
| Forex | BASE_QUOTE | EUR_USD, GBP_JPY |
| Indices | Name | US500, UK100, DE30 |
| Commodities | Name | XAU_USD, BCO_USD |

### Get Instrument Details

```typescript
async function getInstruments(): Promise<Instrument[]> {
  const response = await fetch(
    `${OANDA_BASE}/v3/accounts/${ACCOUNT_ID}/instruments`,
    { headers }
  );

  const data = await response.json();
  return data.instruments;
}
```

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `INVALID_ACCOUNT` | Wrong account ID | Check OANDA_ACCOUNT_ID |
| `UNAUTHORIZED` | Invalid/expired token | Regenerate API token |
| `MARKET_HALTED` | Market closed | Wait for market open |
| `INSUFFICIENT_MARGIN` | Not enough funds | Reduce position size |

### Error Handling Pattern

```typescript
async function safeOrder(params) {
  try {
    const result = await marketOrder(params);
    if (result.errorCode) {
      console.error('OANDA error:', result.errorMessage);
      return null;
    }
    return result;
  } catch (error) {
    console.error('Network error:', error.message);
    return null;
  }
}
```

---

## Lot Sizing

OANDA uses **units** not lots:

| Lot Type | Units |
|----------|-------|
| Standard | 100,000 |
| Mini | 10,000 |
| Micro | 1,000 |
| Nano | 1 |

```typescript
// Buy 0.1 lots EUR/USD = 10,000 units
await marketOrder('EUR_USD', 10000);

// Sell 0.5 lots GBP/USD = 50,000 units
await marketOrder('GBP_USD', -50000);
```

---

## Practice vs Live

### Practice Account
- URL: `https://api-fxpractice.oanda.com`
- Virtual $100,000 balance
- Real market data
- No real money risk

### Live Account
- URL: `https://api-fxtrade.oanda.com`
- Real money
- Real execution
- Regulatory requirements

---

## Related Pages

- [[Trade Execution]] - Order flow
- [[Pivot Pete]] - Futures agent using OANDA
- [[Sterling FX]] - Forex agent using OANDA
- [[Environment Variables]] - Configuration
- [[Alpaca Data]] - Alternative broker
- [[Three Ducks]] - Forex strategy
