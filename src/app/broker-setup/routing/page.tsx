'use client';

/**
 * Broker Routing Configuration Page
 *
 * Configure which broker handles which market type
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

type BrokerType = 'ALPACA' | 'OANDA' | 'IBKR' | 'TASTYTRADE' | 'TRADOVATE';
type MarketType = 'EQUITY' | 'OPTIONS' | 'FUTURES' | 'FOREX' | 'CRYPTO';

interface RoutingRule {
  marketType: MarketType;
  preferredBroker: BrokerType;
  fallbackBrokers: BrokerType[];
}

interface RoutingSummary {
  rules: RoutingRule[];
  connectedBrokers: BrokerType[];
  marketCoverage: Record<MarketType, BrokerType | null>;
}

const MARKET_INFO: Record<MarketType, { icon: string; description: string }> = {
  EQUITY: { icon: '📈', description: 'Stocks & ETFs' },
  OPTIONS: { icon: '🎯', description: 'Stock & Index Options' },
  FUTURES: { icon: '📊', description: 'Futures Contracts' },
  FOREX: { icon: '💱', description: 'Currency Pairs' },
  CRYPTO: { icon: '₿', description: 'Cryptocurrencies' },
};

const BROKER_INFO: Record<BrokerType, { name: string; color: string; markets: MarketType[] }> = {
  ALPACA: { name: 'Alpaca', color: '#FFDC00', markets: ['EQUITY', 'OPTIONS', 'CRYPTO'] },
  OANDA: { name: 'OANDA', color: '#00B050', markets: ['FOREX'] },
  TASTYTRADE: { name: 'tastytrade', color: '#FF6B35', markets: ['EQUITY', 'OPTIONS', 'FUTURES'] },
  TRADOVATE: { name: 'Tradovate', color: '#4A90E2', markets: ['FUTURES'] },
  IBKR: { name: 'IBKR', color: '#D62839', markets: ['EQUITY', 'OPTIONS', 'FUTURES', 'FOREX', 'CRYPTO'] },
};

export default function RoutingConfigPage() {
  const [routing, setRouting] = useState<RoutingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchRouting();
  }, []);

  async function fetchRouting() {
    try {
      const res = await fetch('/api/broker/routing');
      const data = await res.json();
      if (data.success) {
        setRouting(data.routing);
      }
    } catch (err) {
      setError('Failed to load routing configuration');
    } finally {
      setLoading(false);
    }
  }

  async function updateRule(marketType: MarketType, preferredBroker: BrokerType) {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/broker/routing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketType, preferredBroker }),
      });

      const data = await res.json();
      if (data.success) {
        setRouting(data.routing);
        setSuccess(`${marketType} orders will now route to ${preferredBroker}`);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to update routing');
    } finally {
      setSaving(false);
    }
  }

  async function resetToDefaults() {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/broker/routing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });

      const data = await res.json();
      if (data.success) {
        setRouting(data.routing);
        setSuccess('Routing reset to defaults');
      }
    } catch (err) {
      setError('Failed to reset routing');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading routing configuration...</div>
      </div>
    );
  }

  const markets: MarketType[] = ['EQUITY', 'OPTIONS', 'FUTURES', 'FOREX', 'CRYPTO'];
  const connectedBrokers = routing?.connectedBrokers || [];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/broker-setup" className={styles.backLink}>
            ← Back to Broker Setup
          </Link>
          <h1>🔀 Order Routing</h1>
          <p>Configure which broker handles each market type</p>
        </div>
        <button
          className={styles.resetBtn}
          onClick={resetToDefaults}
          disabled={saving}
        >
          Reset to Defaults
        </button>
      </header>

      {error && <div className={styles.error}>❌ {error}</div>}
      {success && <div className={styles.success}>✅ {success}</div>}

      {/* Connected Brokers */}
      <section className={styles.connectedSection}>
        <h2>Connected Brokers</h2>
        <div className={styles.brokerChips}>
          {connectedBrokers.length === 0 ? (
            <p className={styles.noBrokers}>
              No brokers connected. <Link href="/broker-setup">Add a broker</Link> first.
            </p>
          ) : (
            connectedBrokers.map((broker) => (
              <span
                key={broker}
                className={styles.brokerChip}
                style={{ borderColor: BROKER_INFO[broker].color }}
              >
                <span
                  className={styles.brokerDot}
                  style={{ background: BROKER_INFO[broker].color }}
                />
                {BROKER_INFO[broker].name}
              </span>
            ))
          )}
        </div>
      </section>

      {/* Routing Rules */}
      <section className={styles.routingSection}>
        <h2>Market Routing</h2>
        <p className={styles.subtitle}>
          Select which broker should handle orders for each market type.
        </p>

        <div className={styles.routingGrid}>
          {markets.map((market) => {
            const currentBroker = routing?.marketCoverage[market];
            const marketInfo = MARKET_INFO[market];

            return (
              <div key={market} className={styles.marketCard}>
                <div className={styles.marketHeader}>
                  <span className={styles.marketIcon}>{marketInfo.icon}</span>
                  <div>
                    <h3>{market}</h3>
                    <span className={styles.marketDesc}>{marketInfo.description}</span>
                  </div>
                </div>

                <div className={styles.brokerSelect}>
                  <span className={styles.selectLabel}>Route to:</span>
                  <div className={styles.brokerOptions}>
                    {(Object.keys(BROKER_INFO) as BrokerType[]).map((broker) => {
                      const info = BROKER_INFO[broker];
                      const supportsMarket = info.markets.includes(market);
                      const isConnected = connectedBrokers.includes(broker);
                      const isSelected = currentBroker === broker;
                      const isDisabled = !supportsMarket || !isConnected;

                      return (
                        <button
                          key={broker}
                          className={`${styles.brokerOption} ${isSelected ? styles.selected : ''} ${isDisabled ? styles.disabled : ''}`}
                          style={isSelected ? { borderColor: info.color, background: `${info.color}22` } : undefined}
                          onClick={() => !isDisabled && updateRule(market, broker)}
                          disabled={isDisabled || saving}
                          title={
                            !supportsMarket
                              ? `${info.name} doesn't support ${market}`
                              : !isConnected
                              ? `${info.name} not connected`
                              : `Route ${market} to ${info.name}`
                          }
                        >
                          <span
                            className={styles.optionDot}
                            style={isSelected ? { background: info.color } : undefined}
                          />
                          {info.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {currentBroker && (
                  <div
                    className={styles.currentRoute}
                    style={{ borderColor: BROKER_INFO[currentBroker].color }}
                  >
                    Currently: <strong>{BROKER_INFO[currentBroker].name}</strong>
                  </div>
                )}
                {!currentBroker && (
                  <div className={styles.noRoute}>
                    ⚠️ No broker available
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* How It Works */}
      <section className={styles.howItWorks}>
        <h3>How Order Routing Works</h3>
        <ol>
          <li>When you submit an order, the system detects the symbol&apos;s market type</li>
          <li>It looks up the preferred broker for that market</li>
          <li>If the preferred broker is unavailable, it tries fallback brokers</li>
          <li>The order is automatically formatted for the target broker&apos;s API</li>
        </ol>
      </section>
    </div>
  );
}
