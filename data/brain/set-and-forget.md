# Set and Forget

---
tags: #strategy #swing-trading #multi-timeframe
status: Active
file: `src/lib/engine/strategies/setAndForget.ts`
category: FOREX
---

## Overview

**FXALEXG Style Swing Trading** — A comprehensive multi-timeframe analysis strategy based on supply/demand zones, market structure, and candlestick confirmation. Designed for "set it and forget it" swing trades.

## Core Concepts

- **Top-down analysis**: Weekly → Daily → 4H → 30m/1H
- **Supply/Demand zones** (Areas of Interest)
- **Market structure** (HH/HL/LH/LL patterns)
- **Candlestick confirmation** patterns

## The 5-Box System

### Box 1: Weekly Analysis
- Identify market structure (bullish/bearish/neutral)
- Find Areas of Interest (AOI)
- **Must be at Position 3** (at AOI) to consider trades

### Box 2: Daily Analysis
- Calculate confluence score
- Need **at least 2 confluence factors**

### Box 3: 4H Setup
- Look for potential HL forming (longs) or LH forming (shorts)
- Confirms weekly direction

### Box 4: Structure Shift (30m/1H)
- Detect shift in market structure on lower timeframe
- Must align with trade direction

### Box 5: Entry Confirmation
- Wait for candlestick pattern:
  - Longs: Bullish engulfing, morning star, hammer
  - Shorts: Bearish engulfing, evening star, shooting star

## Confluence Factors

| Factor | Description |
|--------|-------------|
| Rejection Candle | Reversal candlestick pattern |
| At AOI | Price at supply/demand zone |
| Psych Level | Round number (.000, .500, etc.) |
| Structure Point | At swing high/low |
| EMA Rejection | Bouncing off 200 EMA |

## Requirements for Valid Setup

- Weekly at Position 3 (at AOI)
- Daily confluence score ≥ 2
- 4H forming correct structure (HL for long, LH for short)
- Structure shift detected on 30m or 1H
- Confirmation candlestick pattern
- Risk:Reward ≥ 2:1

## Key Functions

- `findSwingPoints()` - Detect swing highs/lows
- `identifyMarketStructure()` - Determine trend direction
- `findAreasOfInterest()` - Build supply/demand zones
- `detectCandlePattern()` - Identify entry patterns
- `detectStructureShift()` - Spot trend changes
- `calculateConfluence()` - Score setup quality
- `analyzeSetup()` - Full multi-timeframe analysis

## Related

- [[Three Ducks]] - Another multi-timeframe strategy
- [[Support Resistance]] - Zone-based trading
- [[Strategies Overview]]
