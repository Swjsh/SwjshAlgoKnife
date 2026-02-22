import { describe, expect, test } from 'vitest';
import { AlpacaDataProvider } from './alpaca';

describe('AlpacaDataProvider', () => {
  test('maps ES/NQ/YM to ETF proxies by default', () => {
    const p = new AlpacaDataProvider({ apiKey: 'x', secretKey: 'y' });

    expect(p.resolveSymbol('ES').providerSymbol).toBe('SPY');
    expect(p.resolveSymbol('NQ').providerSymbol).toBe('QQQ');
    expect(p.resolveSymbol('YM').providerSymbol).toBe('DIA');
  });

  test('can disable ETF proxy mapping', () => {
    const p = new AlpacaDataProvider({ apiKey: 'x', secretKey: 'y', useEtfProxy: false });
    expect(p.resolveSymbol('ES').providerSymbol).toBe('ES');
  });
});
