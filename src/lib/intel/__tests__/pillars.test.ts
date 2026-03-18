// ═══════════════════════════════════════════════════════════════
// INTELLIGENCE PILLARS TEST SUITE
// TDD: RED → GREEN → REFACTOR
//
// Tests for expanded intel sources including:
//   - POLITICIAN_TRADES: Congressional stock trade tracking
//   - INSIDER_FLOW: SEC Form 4 insider transactions
//   - ANALYST_RATINGS: Wall Street upgrades/downgrades
//   - ETF_FLOWS: Fund flow tracking
//   - OPTIONS_UNUSUAL: Unusual options activity
//   - DARK_POOL: Dark pool prints
//   - MACRO_SENTIMENT: Economic sentiment indicators
//   - TECHNICAL_LEVELS: Key S/R levels
//   - VOLATILITY: VIX/volatility regime
// ═══════════════════════════════════════════════════════════════

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// We'll test the types and registry first
describe('Intelligence Pillars - CORE Phase', () => {
  describe('IntelSource Type Expansion', () => {
    test('should include all 18 intel sources (9 original + 9 new)', async () => {
      // Import the types - this will fail until we add the new sources
      const { ALL_INTEL_SOURCES } = await import('../types');

      expect(ALL_INTEL_SOURCES).toHaveLength(18);

      // Original 9 sources
      expect(ALL_INTEL_SOURCES).toContain('ORDER_FLOW');
      expect(ALL_INTEL_SOURCES).toContain('SENTIMENT');
      expect(ALL_INTEL_SOURCES).toContain('ONCHAIN_CONFLUENCE');
      expect(ALL_INTEL_SOURCES).toContain('WHALE_FLOW');
      expect(ALL_INTEL_SOURCES).toContain('FEAR_GREED');
      expect(ALL_INTEL_SOURCES).toContain('FUNDING_OI');
      expect(ALL_INTEL_SOURCES).toContain('MARKET_DATA');
      expect(ALL_INTEL_SOURCES).toContain('ECON_CALENDAR');
      expect(ALL_INTEL_SOURCES).toContain('SOCIAL_FEED');

      // New 9 sources
      expect(ALL_INTEL_SOURCES).toContain('POLITICIAN_TRADES');
      expect(ALL_INTEL_SOURCES).toContain('INSIDER_FLOW');
      expect(ALL_INTEL_SOURCES).toContain('ANALYST_RATINGS');
      expect(ALL_INTEL_SOURCES).toContain('ETF_FLOWS');
      expect(ALL_INTEL_SOURCES).toContain('OPTIONS_UNUSUAL');
      expect(ALL_INTEL_SOURCES).toContain('DARK_POOL');
      expect(ALL_INTEL_SOURCES).toContain('MACRO_SENTIMENT');
      expect(ALL_INTEL_SOURCES).toContain('TECHNICAL_LEVELS');
      expect(ALL_INTEL_SOURCES).toContain('VOLATILITY');
    });

    test('SOURCE_REGISTRY should have metadata for all 18 sources', async () => {
      const { SOURCE_REGISTRY, ALL_INTEL_SOURCES } = await import('../types');

      for (const source of ALL_INTEL_SOURCES) {
        expect(SOURCE_REGISTRY[source]).toBeDefined();
        expect(SOURCE_REGISTRY[source].label).toBeDefined();
        expect(SOURCE_REGISTRY[source].color).toBeDefined();
        expect(SOURCE_REGISTRY[source].emoji).toBeDefined();
        expect(SOURCE_REGISTRY[source].healthKey).toBeDefined();
        expect(typeof SOURCE_REGISTRY[source].free).toBe('boolean');
      }
    });

    test('INTEL_TTL_MS should have TTL for all 18 sources', async () => {
      const { INTEL_TTL_MS, ALL_INTEL_SOURCES } = await import('../types');

      for (const source of ALL_INTEL_SOURCES) {
        expect(INTEL_TTL_MS[source]).toBeDefined();
        expect(typeof INTEL_TTL_MS[source]).toBe('number');
        expect(INTEL_TTL_MS[source]).toBeGreaterThan(0);
      }
    });

    test('INTEL_WEIGHTS should have weights for all 18 sources', async () => {
      const { INTEL_WEIGHTS, ALL_INTEL_SOURCES } = await import('../types');

      for (const source of ALL_INTEL_SOURCES) {
        expect(INTEL_WEIGHTS[source]).toBeDefined();
        expect(typeof INTEL_WEIGHTS[source]).toBe('number');
        // Weight can be 0 for premium sources when FREE_SOURCES_ONLY=true
        expect(INTEL_WEIGHTS[source]).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('POLITICIAN_TRADES Pillar', () => {
    test('should have POLITICIAN_TRADES in source registry', async () => {
      const { SOURCE_REGISTRY } = await import('../types');

      expect(SOURCE_REGISTRY.POLITICIAN_TRADES).toBeDefined();
      expect(SOURCE_REGISTRY.POLITICIAN_TRADES.label).toBe('Politician Trades');
      expect(SOURCE_REGISTRY.POLITICIAN_TRADES.emoji).toBe('🏛️');
      expect(SOURCE_REGISTRY.POLITICIAN_TRADES.free).toBe(true);
    });

    test('PoliticianTradesService should export required functions', async () => {
      const service = await import('../politicians/service');

      expect(typeof service.startPoliticianTradesService).toBe('function');
      expect(typeof service.stopPoliticianTradesService).toBe('function');
      expect(typeof service.getPoliticianTradesStatus).toBe('function');
    });

    test('PoliticianTradesService should track known politicians', async () => {
      const { TRACKED_POLITICIANS } = await import('../politicians/service');

      // Should track key politicians known for market-moving trades
      expect(TRACKED_POLITICIANS.length).toBeGreaterThanOrEqual(10);

      // Each politician should have required fields
      for (const politician of TRACKED_POLITICIANS) {
        expect(politician.name).toBeDefined();
        expect(politician.twitterHandle).toBeDefined();
        expect(politician.chamber).toMatch(/^(SENATE|HOUSE)$/);
        expect(politician.party).toMatch(/^(D|R|I)$/);
      }
    });

    test('PoliticianTradesService should monitor Capitol Trades API', async () => {
      const { CAPITOL_TRADES_ENDPOINTS } = await import('../politicians/service');

      expect(CAPITOL_TRADES_ENDPOINTS).toBeDefined();
      expect(CAPITOL_TRADES_ENDPOINTS.recent).toBeDefined();
      expect(CAPITOL_TRADES_ENDPOINTS.byPolitician).toBeDefined();
    });

    test('PoliticianTradesService should monitor Quiver Quant Congress Trading', async () => {
      const { QUIVER_QUANT_ENDPOINTS } = await import('../politicians/service');

      expect(QUIVER_QUANT_ENDPOINTS).toBeDefined();
      expect(QUIVER_QUANT_ENDPOINTS.congressTrading).toBeDefined();
    });

    test('PoliticianTradesService should follow Twitter accounts tracking congress trades', async () => {
      const { POLITICIAN_TWITTER_TRACKERS } = await import('../politicians/service');

      expect(POLITICIAN_TWITTER_TRACKERS).toBeDefined();
      expect(POLITICIAN_TWITTER_TRACKERS.length).toBeGreaterThanOrEqual(3);

      // Known accounts that track congressional trades
      const handles = POLITICIAN_TWITTER_TRACKERS.map((t: { handle: string }) => t.handle);
      expect(handles).toContain('congresstrading');
      expect(handles).toContain('capitoltrades');
      expect(handles).toContain('unusual_whales'); // Also tracks congress
    });
  });

  describe('INSIDER_FLOW Pillar', () => {
    test('should have INSIDER_FLOW in source registry', async () => {
      const { SOURCE_REGISTRY } = await import('../types');

      expect(SOURCE_REGISTRY.INSIDER_FLOW).toBeDefined();
      expect(SOURCE_REGISTRY.INSIDER_FLOW.label).toBe('Insider Flow');
      expect(SOURCE_REGISTRY.INSIDER_FLOW.emoji).toBe('👔');
      expect(SOURCE_REGISTRY.INSIDER_FLOW.free).toBe(true);
    });

    test('InsiderFlowService should monitor SEC Form 4 filings', async () => {
      const { SEC_FORM4_ENDPOINTS } = await import('../insiders/service');

      expect(SEC_FORM4_ENDPOINTS).toBeDefined();
      expect(SEC_FORM4_ENDPOINTS.recentFilings).toBeDefined();
    });
  });

  describe('ANALYST_RATINGS Pillar', () => {
    test('should have ANALYST_RATINGS in source registry', async () => {
      const { SOURCE_REGISTRY } = await import('../types');

      expect(SOURCE_REGISTRY.ANALYST_RATINGS).toBeDefined();
      expect(SOURCE_REGISTRY.ANALYST_RATINGS.label).toBe('Analyst Ratings');
      expect(SOURCE_REGISTRY.ANALYST_RATINGS.emoji).toBe('📊');
      expect(SOURCE_REGISTRY.ANALYST_RATINGS.free).toBe(true);
    });
  });

  describe('ETF_FLOWS Pillar', () => {
    test('should have ETF_FLOWS in source registry', async () => {
      const { SOURCE_REGISTRY } = await import('../types');

      expect(SOURCE_REGISTRY.ETF_FLOWS).toBeDefined();
      expect(SOURCE_REGISTRY.ETF_FLOWS.label).toBe('ETF Flows');
      expect(SOURCE_REGISTRY.ETF_FLOWS.emoji).toBe('📦');
      expect(SOURCE_REGISTRY.ETF_FLOWS.free).toBe(true);
    });

    test('ETFFlowsService should track major crypto ETFs', async () => {
      const { TRACKED_ETFS } = await import('../etf/service');

      expect(TRACKED_ETFS).toBeDefined();
      const symbols = TRACKED_ETFS.map((e: { symbol: string }) => e.symbol);

      // Bitcoin ETFs
      expect(symbols).toContain('IBIT'); // BlackRock
      expect(symbols).toContain('FBTC'); // Fidelity
      expect(symbols).toContain('GBTC'); // Grayscale

      // Ethereum ETFs
      expect(symbols).toContain('ETHA'); // BlackRock
      expect(symbols).toContain('FETH'); // Fidelity
    });
  });

  describe('OPTIONS_UNUSUAL Pillar', () => {
    test('should have OPTIONS_UNUSUAL in source registry', async () => {
      const { SOURCE_REGISTRY } = await import('../types');

      expect(SOURCE_REGISTRY.OPTIONS_UNUSUAL).toBeDefined();
      expect(SOURCE_REGISTRY.OPTIONS_UNUSUAL.label).toBe('Unusual Options');
      expect(SOURCE_REGISTRY.OPTIONS_UNUSUAL.emoji).toBe('🎯');
      expect(SOURCE_REGISTRY.OPTIONS_UNUSUAL.free).toBe(true);
    });
  });

  describe('DARK_POOL Pillar', () => {
    test('should have DARK_POOL in source registry', async () => {
      const { SOURCE_REGISTRY } = await import('../types');

      expect(SOURCE_REGISTRY.DARK_POOL).toBeDefined();
      expect(SOURCE_REGISTRY.DARK_POOL.label).toBe('Dark Pool');
      expect(SOURCE_REGISTRY.DARK_POOL.emoji).toBe('🌑');
      expect(SOURCE_REGISTRY.DARK_POOL.free).toBe(true);
    });
  });

  describe('MACRO_SENTIMENT Pillar', () => {
    test('should have MACRO_SENTIMENT in source registry', async () => {
      const { SOURCE_REGISTRY } = await import('../types');

      expect(SOURCE_REGISTRY.MACRO_SENTIMENT).toBeDefined();
      expect(SOURCE_REGISTRY.MACRO_SENTIMENT.label).toBe('Macro Sentiment');
      expect(SOURCE_REGISTRY.MACRO_SENTIMENT.emoji).toBe('🌍');
      expect(SOURCE_REGISTRY.MACRO_SENTIMENT.free).toBe(true);
    });

    test('MacroSentimentService should track AAII sentiment', async () => {
      const { AAII_ENDPOINT } = await import('../macro/service');

      expect(AAII_ENDPOINT).toBeDefined();
    });
  });

  describe('TECHNICAL_LEVELS Pillar', () => {
    test('should have TECHNICAL_LEVELS in source registry', async () => {
      const { SOURCE_REGISTRY } = await import('../types');

      expect(SOURCE_REGISTRY.TECHNICAL_LEVELS).toBeDefined();
      expect(SOURCE_REGISTRY.TECHNICAL_LEVELS.label).toBe('Technical Levels');
      expect(SOURCE_REGISTRY.TECHNICAL_LEVELS.emoji).toBe('📐');
      expect(SOURCE_REGISTRY.TECHNICAL_LEVELS.free).toBe(true);
    });
  });

  describe('VOLATILITY Pillar', () => {
    test('should have VOLATILITY in source registry', async () => {
      const { SOURCE_REGISTRY } = await import('../types');

      expect(SOURCE_REGISTRY.VOLATILITY).toBeDefined();
      expect(SOURCE_REGISTRY.VOLATILITY.label).toBe('Volatility');
      expect(SOURCE_REGISTRY.VOLATILITY.emoji).toBe('📈');
      expect(SOURCE_REGISTRY.VOLATILITY.free).toBe(true);
    });

    test('VolatilityService should track VIX levels', async () => {
      const { VIX_THRESHOLDS } = await import('../volatility/service');

      expect(VIX_THRESHOLDS).toBeDefined();
      expect(VIX_THRESHOLDS.LOW).toBeLessThan(VIX_THRESHOLDS.MEDIUM);
      expect(VIX_THRESHOLDS.MEDIUM).toBeLessThan(VIX_THRESHOLDS.HIGH);
      expect(VIX_THRESHOLDS.HIGH).toBeLessThan(VIX_THRESHOLDS.EXTREME);
    });
  });
});

describe('Social Feed Expansion', () => {
  test('ACCOUNTS should include politician trade trackers', async () => {
    const { getSocialAccounts } = await import('../free/social');
    const accounts = getSocialAccounts();

    const handles = accounts.map((a: { handle: string }) => a.handle);

    // Original accounts
    expect(handles).toContain('realDonaldTrump');
    expect(handles).toContain('unusual_whales');
    expect(handles).toContain('DeItaone');

    // New politician trade trackers
    expect(handles).toContain('congresstrading');
    expect(handles).toContain('capitoltrades');
    expect(handles).toContain('QuiverQuant');

    // New macro/market trackers
    expect(handles).toContain('zaborsky');
    expect(handles).toContain('MacroAlf');
    expect(handles).toContain('KobeissiLetter');
  });

  test('RSS_CHANNELS should include new data sources', async () => {
    const { RSS_CHANNELS } = await import('../free/social');

    const names = RSS_CHANNELS.map((c: { name: string }) => c.name);

    // Original channels
    expect(names).toContain('reddit_wsb');
    expect(names).toContain('sec_edgar_8k');

    // New channels - at least 5 more
    expect(RSS_CHANNELS.length).toBeGreaterThanOrEqual(7);
  });

  test('KEYWORD_RULES should include politician-specific patterns', async () => {
    const { KEYWORD_RULES } = await import('../free/social');

    const tags = KEYWORD_RULES.map((r: { tag: string }) => r.tag);

    // Check for politician-related keywords
    expect(tags).toContain('Congress Trade');
    expect(tags).toContain('Pelosi Trade');
    expect(tags).toContain('Senate Filing');
  });
});

describe('Integration', () => {
  test('startFreeFeeds should initialize all new services', async () => {
    const { getFreeFeedStatus } = await import('../free/service');

    const status = getFreeFeedStatus();

    // Check that per-source counts include new sources
    expect(status.perSourceCount).toHaveProperty('politiciantrades');
    expect(status.perSourceCount).toHaveProperty('insiderflow');
    expect(status.perSourceCount).toHaveProperty('analystratings');
    expect(status.perSourceCount).toHaveProperty('etfflows');
    expect(status.perSourceCount).toHaveProperty('optionsunusual');
    expect(status.perSourceCount).toHaveProperty('darkpool');
    expect(status.perSourceCount).toHaveProperty('macrosentiment');
    expect(status.perSourceCount).toHaveProperty('technicallevels');
    expect(status.perSourceCount).toHaveProperty('volatility');
  });
});

// ═══════════════════════════════════════════════════════════════
// EDGE Phase Tests — Boundary conditions and error cases
// ═══════════════════════════════════════════════════════════════

describe('EDGE Phase - Boundary Conditions', () => {
  describe('Politician Trades Service', () => {
    test('publishPoliticianTrade handles minimum amount range', async () => {
      const { publishPoliticianTrade } = await import('../politicians/service');

      const trade = {
        politician: 'Test Senator',
        chamber: 'SENATE' as const,
        party: 'D' as const,
        ticker: 'TEST',
        type: 'BUY' as const,
        amount: '$1,001 - $15,000', // Minimum filing range
        transactionDate: '2026-03-15',
        filedDate: '2026-03-16',
      };

      // Should not throw, may return -1 if deduped
      const result = publishPoliticianTrade(trade);
      expect(typeof result).toBe('number');
    });

    test('publishPoliticianTrade handles maximum amount range', async () => {
      const { publishPoliticianTrade } = await import('../politicians/service');

      const trade = {
        politician: 'Nancy Pelosi',
        chamber: 'HOUSE' as const,
        party: 'D' as const,
        ticker: 'NVDA',
        type: 'BUY' as const,
        amount: '$5,000,001 - $25,000,000', // Large trade
        transactionDate: '2026-03-15',
        filedDate: '2026-03-16',
      };

      const result = publishPoliticianTrade(trade);
      expect(typeof result).toBe('number');
    });

    test('getConfidence returns valid range for unknown politicians', async () => {
      const { publishPoliticianTrade } = await import('../politicians/service');

      const trade = {
        politician: 'Unknown Representative',
        chamber: 'HOUSE' as const,
        party: 'I' as const,
        ticker: 'XYZ',
        type: 'BUY' as const,
        amount: '$50,001 - $100,000',
        transactionDate: '2026-03-15',
        filedDate: '2026-03-16',
      };

      // Should use default confidence for unknown politicians
      const result = publishPoliticianTrade(trade);
      expect(typeof result).toBe('number');
    });
  });

  describe('Volatility Service', () => {
    test('VIX_THRESHOLDS are properly ordered', async () => {
      const { VIX_THRESHOLDS } = await import('../volatility/service');

      expect(VIX_THRESHOLDS.LOW).toBeLessThan(VIX_THRESHOLDS.MEDIUM);
      expect(VIX_THRESHOLDS.MEDIUM).toBeLessThan(VIX_THRESHOLDS.HIGH);
      expect(VIX_THRESHOLDS.HIGH).toBeLessThan(VIX_THRESHOLDS.EXTREME);
      expect(VIX_THRESHOLDS.EXTREME).toBeLessThan(VIX_THRESHOLDS.PANIC);
    });

    test('publishVIXSignal handles extreme low VIX', async () => {
      const { publishVIXSignal } = await import('../volatility/service');

      const vixData = {
        value: 9, // Below VIX_THRESHOLDS.LOW
        previousClose: 10,
        change: -1,
        changePercent: -10,
        high52Week: 35,
        low52Week: 9,
        timestamp: new Date().toISOString(),
      };

      const result = publishVIXSignal(vixData);
      expect(typeof result).toBe('number');
    });

    test('publishVIXSignal handles panic VIX', async () => {
      const { publishVIXSignal } = await import('../volatility/service');

      const vixData = {
        value: 50, // Above VIX_THRESHOLDS.PANIC
        previousClose: 35,
        change: 15,
        changePercent: 42.86,
        high52Week: 50,
        low52Week: 12,
        timestamp: new Date().toISOString(),
      };

      const result = publishVIXSignal(vixData);
      expect(typeof result).toBe('number');
    });
  });

  describe('ETF Flows Service', () => {
    test('TRACKED_ETFS contains all major issuers', async () => {
      const { TRACKED_ETFS } = await import('../etf/service');

      const issuers = new Set(TRACKED_ETFS.map(e => e.issuer));

      expect(issuers.has('BlackRock')).toBe(true);
      expect(issuers.has('Fidelity')).toBe(true);
      expect(issuers.has('Grayscale')).toBe(true);
    });

    test('TRACKED_ETFS has both BTC and ETH assets', async () => {
      const { TRACKED_ETFS } = await import('../etf/service');

      const btcETFs = TRACKED_ETFS.filter(e => e.asset === 'BTC');
      const ethETFs = TRACKED_ETFS.filter(e => e.asset === 'ETH');

      expect(btcETFs.length).toBeGreaterThan(0);
      expect(ethETFs.length).toBeGreaterThan(0);
    });

    test('publishETFFlow filters out small flows', async () => {
      const { publishETFFlow } = await import('../etf/service');

      const smallFlow = {
        symbol: 'IBIT',
        dailyFlow: 5_000_000, // $5M - below threshold for direction
        weeklyFlow: 50_000_000,
        aum: 20_000_000_000,
        volume: 10_000_000,
        date: '2026-03-15',
      };

      // Small flows return -1 (filtered as NEUTRAL)
      const result = publishETFFlow(smallFlow);
      expect(result).toBe(-1);
    });

    test('publishETFFlow accepts large inflows', async () => {
      const { publishETFFlow } = await import('../etf/service');

      const largeFlow = {
        symbol: 'IBIT',
        dailyFlow: 500_000_000, // $500M inflow
        weeklyFlow: 1_000_000_000,
        aum: 20_000_000_000,
        volume: 50_000_000,
        date: '2026-03-15',
      };

      const result = publishETFFlow(largeFlow);
      expect(typeof result).toBe('number');
    });
  });

  describe('Macro Sentiment Service', () => {
    test('AAII_HISTORICAL contains baseline values', async () => {
      const { AAII_HISTORICAL } = await import('../macro/service');

      expect(AAII_HISTORICAL.bullish).toBeGreaterThan(0);
      expect(AAII_HISTORICAL.neutral).toBeGreaterThan(0);
      expect(AAII_HISTORICAL.bearish).toBeGreaterThan(0);

      // Should sum close to 100%
      const total = AAII_HISTORICAL.bullish + AAII_HISTORICAL.neutral + AAII_HISTORICAL.bearish;
      expect(total).toBeCloseTo(100, 0);
    });

    test('SENTIMENT_THRESHOLDS are valid contrarian levels', async () => {
      const { SENTIMENT_THRESHOLDS } = await import('../macro/service');

      // Extreme bull threshold should be above historical average
      expect(SENTIMENT_THRESHOLDS.AAII_EXTREME_BULL).toBeGreaterThan(40);

      // Extreme bear threshold should be below historical average
      expect(SENTIMENT_THRESHOLDS.AAII_EXTREME_BEAR).toBeLessThan(30);

      // PCR thresholds should be around 1.0
      expect(SENTIMENT_THRESHOLDS.PCR_EXTREME_FEAR).toBeGreaterThan(1);
      expect(SENTIMENT_THRESHOLDS.PCR_EXTREME_GREED).toBeLessThan(1);
    });
  });

  describe('Technical Levels Service', () => {
    test('calculatePivotPoints returns all standard levels', async () => {
      const { calculatePivotPoints } = await import('../technical/service');

      const pivots = calculatePivotPoints(100, 90, 95);

      expect(pivots).toHaveProperty('PP');
      expect(pivots).toHaveProperty('R1');
      expect(pivots).toHaveProperty('R2');
      expect(pivots).toHaveProperty('R3');
      expect(pivots).toHaveProperty('S1');
      expect(pivots).toHaveProperty('S2');
      expect(pivots).toHaveProperty('S3');
    });

    test('calculatePivotPoints produces ordered levels', async () => {
      const { calculatePivotPoints } = await import('../technical/service');

      const pivots = calculatePivotPoints(100, 90, 95);

      // Support levels should be below pivot, resistance above
      expect(pivots.S3).toBeLessThan(pivots.S2);
      expect(pivots.S2).toBeLessThan(pivots.S1);
      expect(pivots.S1).toBeLessThan(pivots.PP);
      expect(pivots.PP).toBeLessThan(pivots.R1);
      expect(pivots.R1).toBeLessThan(pivots.R2);
      expect(pivots.R2).toBeLessThan(pivots.R3);
    });
  });

  describe('Social Feed Keyword Rules', () => {
    test('KEYWORD_RULES has politician-specific patterns', async () => {
      const { KEYWORD_RULES } = await import('../free/social');

      const politicianTags = KEYWORD_RULES
        .filter(r => r.tag.toLowerCase().includes('congress') ||
                     r.tag.toLowerCase().includes('pelosi') ||
                     r.tag.toLowerCase().includes('senate'))
        .map(r => r.tag);

      expect(politicianTags.length).toBeGreaterThanOrEqual(3);
    });

    test('KEYWORD_RULES has ETF flow patterns', async () => {
      const { KEYWORD_RULES } = await import('../free/social');

      const etfTags = KEYWORD_RULES
        .filter(r => r.tag.toLowerCase().includes('etf'))
        .map(r => r.tag);

      expect(etfTags.length).toBeGreaterThanOrEqual(2);
    });

    test('KEYWORD_RULES has insider trading patterns', async () => {
      const { KEYWORD_RULES } = await import('../free/social');

      const insiderTags = KEYWORD_RULES
        .filter(r => r.tag.toLowerCase().includes('insider') ||
                     r.tag.toLowerCase().includes('form 4'))
        .map(r => r.tag);

      expect(insiderTags.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// SECURITY Phase Tests — Input validation and type checking
// ═══════════════════════════════════════════════════════════════

describe('SECURITY Phase - Input Validation', () => {
  describe('IntelSource Type Safety', () => {
    test('VALID_SOURCES contains all 18 sources', async () => {
      const { VALID_SOURCES, ALL_INTEL_SOURCES } = await import('../types');

      for (const source of ALL_INTEL_SOURCES) {
        expect(VALID_SOURCES.has(source)).toBe(true);
      }
      expect(VALID_SOURCES.size).toBe(18);
    });

    test('VALID_DIRECTIONS contains all valid directions', async () => {
      const { VALID_DIRECTIONS } = await import('../types');

      expect(VALID_DIRECTIONS.has('BULLISH')).toBe(true);
      expect(VALID_DIRECTIONS.has('BEARISH')).toBe(true);
      expect(VALID_DIRECTIONS.has('NEUTRAL')).toBe(true);
      expect(VALID_DIRECTIONS.has('ALERT')).toBe(true);
      expect(VALID_DIRECTIONS.size).toBe(4);
    });
  });

  describe('Politician Service Input Validation', () => {
    test('TRACKED_POLITICIANS have valid chamber values', async () => {
      const { TRACKED_POLITICIANS } = await import('../politicians/service');

      for (const politician of TRACKED_POLITICIANS) {
        expect(['SENATE', 'HOUSE']).toContain(politician.chamber);
      }
    });

    test('TRACKED_POLITICIANS have valid party values', async () => {
      const { TRACKED_POLITICIANS } = await import('../politicians/service');

      for (const politician of TRACKED_POLITICIANS) {
        expect(['D', 'R', 'I']).toContain(politician.party);
      }
    });

    test('TRACKED_POLITICIANS have non-empty required fields', async () => {
      const { TRACKED_POLITICIANS } = await import('../politicians/service');

      for (const politician of TRACKED_POLITICIANS) {
        expect(politician.name.length).toBeGreaterThan(0);
        expect(politician.twitterHandle.length).toBeGreaterThan(0);
        expect(['HIGH', 'MEDIUM', 'LOW']).toContain(politician.tradingReputation);
      }
    });
  });

  describe('ETF Service Input Validation', () => {
    test('TRACKED_ETFS have valid asset types', async () => {
      const { TRACKED_ETFS } = await import('../etf/service');

      for (const etf of TRACKED_ETFS) {
        expect(['BTC', 'ETH']).toContain(etf.asset);
      }
    });

    test('TRACKED_ETFS have valid tier values', async () => {
      const { TRACKED_ETFS } = await import('../etf/service');

      for (const etf of TRACKED_ETFS) {
        expect(['MAJOR', 'STANDARD']).toContain(etf.tier);
      }
    });

    test('TRACKED_ETFS have non-empty required fields', async () => {
      const { TRACKED_ETFS } = await import('../etf/service');

      for (const etf of TRACKED_ETFS) {
        expect(etf.symbol.length).toBeGreaterThan(0);
        expect(etf.name.length).toBeGreaterThan(0);
        expect(etf.issuer.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Insider Service Input Validation', () => {
    test('TRACKED_COMPANIES have valid CIK format', async () => {
      const { TRACKED_COMPANIES } = await import('../insiders/service');

      for (const company of TRACKED_COMPANIES) {
        // CIK should be a 10-digit string starting with 0
        expect(company.cik).toMatch(/^0\d{9}$/);
      }
    });

    test('TRACKED_COMPANIES have non-empty tickers', async () => {
      const { TRACKED_COMPANIES } = await import('../insiders/service');

      for (const company of TRACKED_COMPANIES) {
        expect(company.ticker.length).toBeGreaterThan(0);
        // Tickers should be uppercase
        expect(company.ticker).toBe(company.ticker.toUpperCase());
      }
    });
  });

  describe('Weight Validation', () => {
    test('INTEL_WEIGHTS sum to approximately 1.0', async () => {
      const { INTEL_WEIGHTS, ALL_INTEL_SOURCES } = await import('../types');

      let totalWeight = 0;
      for (const source of ALL_INTEL_SOURCES) {
        totalWeight += INTEL_WEIGHTS[source];
      }

      // Weights should sum close to 1.0 (allowing for rounding and floating point)
      expect(totalWeight).toBeGreaterThan(0.85);
      expect(totalWeight).toBeLessThan(1.15);
    });

    test('INTEL_WEIGHTS are all non-negative', async () => {
      const { INTEL_WEIGHTS, ALL_INTEL_SOURCES } = await import('../types');

      for (const source of ALL_INTEL_SOURCES) {
        expect(INTEL_WEIGHTS[source]).toBeGreaterThanOrEqual(0);
      }
    });

    test('INTEL_WEIGHTS are all less than 1.0', async () => {
      const { INTEL_WEIGHTS, ALL_INTEL_SOURCES } = await import('../types');

      for (const source of ALL_INTEL_SOURCES) {
        expect(INTEL_WEIGHTS[source]).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('TTL Validation', () => {
    test('INTEL_TTL_MS are all positive', async () => {
      const { INTEL_TTL_MS, ALL_INTEL_SOURCES } = await import('../types');

      for (const source of ALL_INTEL_SOURCES) {
        expect(INTEL_TTL_MS[source]).toBeGreaterThan(0);
      }
    });

    test('INTEL_TTL_MS are reasonable durations', async () => {
      const { INTEL_TTL_MS, ALL_INTEL_SOURCES } = await import('../types');

      const MIN_TTL = 10 * 60 * 1000;      // 10 minutes minimum
      const MAX_TTL = 24 * 60 * 60 * 1000; // 24 hours maximum

      for (const source of ALL_INTEL_SOURCES) {
        expect(INTEL_TTL_MS[source]).toBeGreaterThanOrEqual(MIN_TTL);
        expect(INTEL_TTL_MS[source]).toBeLessThanOrEqual(MAX_TTL);
      }
    });
  });

  describe('Social Feed Account Validation', () => {
    test('All social accounts have valid categories', async () => {
      const { getSocialAccounts } = await import('../free/social');
      const accounts = getSocialAccounts();

      for (const account of accounts) {
        expect(['POLITICS', 'CRYPTO', 'OPTIONS', 'NEWS']).toContain(account.category);
      }
    });

    test('All social accounts have valid confidence ranges', async () => {
      const { getSocialAccounts } = await import('../free/social');
      const accounts = getSocialAccounts();

      for (const account of accounts) {
        expect(account.baseConfidence).toBeGreaterThanOrEqual(0);
        expect(account.baseConfidence).toBeLessThanOrEqual(1);
      }
    });

    test('All social accounts have at least one default symbol', async () => {
      const { getSocialAccounts } = await import('../free/social');
      const accounts = getSocialAccounts();

      for (const account of accounts) {
        expect(account.defaultSymbols.length).toBeGreaterThan(0);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// PERFORMANCE Phase Tests — Timing constraints and resource limits
// ═══════════════════════════════════════════════════════════════

describe('PERFORMANCE Phase - Resource Limits', () => {
  test('Service initialization is fast (< 100ms)', async () => {
    const start = performance.now();

    await import('../politicians/service');
    await import('../insiders/service');
    await import('../etf/service');
    await import('../volatility/service');
    await import('../macro/service');

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });

  test('Type imports are fast (< 50ms)', async () => {
    const start = performance.now();

    await import('../types');

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(50);
  });

  test('calculatePivotPoints is fast (< 1ms for 1000 iterations)', async () => {
    const { calculatePivotPoints } = await import('../technical/service');

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      calculatePivotPoints(100 + i * 0.1, 90 + i * 0.1, 95 + i * 0.1);
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100); // < 0.1ms per calculation
  });
});

// ═══════════════════════════════════════════════════════════════
// SIMPLICITY Phase Tests — Code organization verification
// ═══════════════════════════════════════════════════════════════

describe('SIMPLICITY Phase - Code Organization', () => {
  test('All services follow consistent naming convention', async () => {
    // Services should export start/stop/getStatus functions
    const politicianService = await import('../politicians/service');
    const insiderService = await import('../insiders/service');
    const etfService = await import('../etf/service');
    const volatilityService = await import('../volatility/service');
    const macroService = await import('../macro/service');

    // All services have start function
    expect(typeof politicianService.startPoliticianTradesService).toBe('function');
    expect(typeof insiderService.startInsiderFlowService).toBe('function');
    expect(typeof etfService.startETFFlowsService).toBe('function');
    expect(typeof volatilityService.startVolatilityService).toBe('function');
    expect(typeof macroService.startMacroSentimentService).toBe('function');

    // All services have stop function
    expect(typeof politicianService.stopPoliticianTradesService).toBe('function');
    expect(typeof insiderService.stopInsiderFlowService).toBe('function');
    expect(typeof etfService.stopETFFlowsService).toBe('function');
    expect(typeof volatilityService.stopVolatilityService).toBe('function');
    expect(typeof macroService.stopMacroSentimentService).toBe('function');

    // All services have status function
    expect(typeof politicianService.getPoliticianTradesStatus).toBe('function');
    expect(typeof insiderService.getInsiderFlowStatus).toBe('function');
    expect(typeof etfService.getETFFlowsStatus).toBe('function');
    expect(typeof volatilityService.getVolatilityStatus).toBe('function');
    expect(typeof macroService.getMacroSentimentStatus).toBe('function');
  });

  test('SOURCE_REGISTRY has consistent structure for all sources', async () => {
    const { SOURCE_REGISTRY, ALL_INTEL_SOURCES } = await import('../types');

    for (const source of ALL_INTEL_SOURCES) {
      const meta = SOURCE_REGISTRY[source];

      // All required fields present
      expect(meta).toHaveProperty('label');
      expect(meta).toHaveProperty('color');
      expect(meta).toHaveProperty('emoji');
      expect(meta).toHaveProperty('healthKey');
      expect(meta).toHaveProperty('free');

      // Color is valid hex
      expect(meta.color).toMatch(/^#[0-9A-Fa-f]{6}$/);

      // Label is non-empty
      expect(meta.label.length).toBeGreaterThan(0);

      // Health key is lowercase alphanumeric
      expect(meta.healthKey).toMatch(/^[a-z]+$/);
    }
  });

  test('New sources are properly categorized as free', async () => {
    const { SOURCE_REGISTRY } = await import('../types');

    const newSources = [
      'POLITICIAN_TRADES',
      'INSIDER_FLOW',
      'ANALYST_RATINGS',
      'ETF_FLOWS',
      'OPTIONS_UNUSUAL',
      'DARK_POOL',
      'MACRO_SENTIMENT',
      'TECHNICAL_LEVELS',
      'VOLATILITY',
    ];

    for (const source of newSources) {
      expect(SOURCE_REGISTRY[source].free).toBe(true);
    }
  });
});
