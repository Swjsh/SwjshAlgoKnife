'use client';

/**
 * Broker Setup Page
 *
 * Multi-broker connection wizard for SwjshAK
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

type BrokerType = 'ALPACA' | 'OANDA' | 'IBKR' | 'TASTYTRADE' | 'TRADOVATE';

interface BrokerInfo {
  name: string;
  signupUrl: string;
  paperUrl?: string;
  docsUrl: string;
  requirements: string[];
  supportedMarkets: string[];
  features: string[];
  setupSteps: string[];
  oauthUrl?: string;
  notes?: string;
}

interface ConnectionStatus {
  brokerType: BrokerType;
  connected: boolean;
  isPaper: boolean;
  supportedMarkets: string[];
  lastError?: string;
}

export default function BrokerSetupPage() {
  const [selectedBroker, setSelectedBroker] = useState<BrokerType | null>(null);
  const [brokerInfo, setBrokerInfo] = useState<BrokerInfo | null>(null);
  const [connectedBrokers, setConnectedBrokers] = useState<ConnectionStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [environment, setEnvironment] = useState<'paper' | 'live'>('paper');

  useEffect(() => {
    fetchBrokerStatus();
  }, []);

  useEffect(() => {
    if (selectedBroker) {
      fetchBrokerInfo(selectedBroker);
    }
  }, [selectedBroker]);

  async function fetchBrokerStatus() {
    try {
      const res = await fetch('/api/broker/status');
      const data = await res.json();
      if (data.success) {
        setConnectedBrokers(data.brokers);
      }
    } catch (err) {
      console.error('Failed to fetch broker status:', err);
    }
  }

  async function fetchBrokerInfo(broker: BrokerType) {
    try {
      const res = await fetch(`/api/broker/setup?broker=${broker}`);
      const data = await res.json();
      setBrokerInfo(data);
    } catch (err) {
      console.error('Failed to fetch broker info:', err);
    }
  }

  async function handleConnect() {
    if (!selectedBroker) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const credentials: Record<string, string | undefined> = {};

      switch (selectedBroker) {
        case 'ALPACA':
          credentials.apiKey = apiKey;
          credentials.apiSecret = apiSecret;
          break;
        case 'OANDA':
          credentials.accessToken = accessToken;
          credentials.accountId = accountId;
          break;
        case 'TASTYTRADE':
          credentials.apiKey = username; // username as apiKey
          credentials.apiSecret = password; // password as apiSecret
          break;
        case 'TRADOVATE':
        case 'IBKR':
          // These use different auth flows
          break;
      }

      const res = await fetch('/api/broker/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brokerType: selectedBroker,
          credentials,
          environment,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`Connected to ${selectedBroker}! Balance: $${data.accountInfo?.balance?.toFixed(2)}`);
        fetchBrokerStatus();
        clearForm();
      } else {
        setError(data.error || 'Connection failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setLoading(false);
    }
  }

  function clearForm() {
    setApiKey('');
    setApiSecret('');
    setAccessToken('');
    setAccountId('');
    setUsername('');
    setPassword('');
  }

  const brokerList: { type: BrokerType; name: string; icon: string; markets: string }[] = [
    { type: 'ALPACA', name: 'Alpaca', icon: '🦙', markets: 'Stocks, Options, Crypto' },
    { type: 'OANDA', name: 'OANDA', icon: '💱', markets: 'Forex' },
    { type: 'TASTYTRADE', name: 'tastytrade', icon: '🍬', markets: 'Options, Futures' },
    { type: 'TRADOVATE', name: 'Tradovate', icon: '📊', markets: 'Futures' },
    { type: 'IBKR', name: 'Interactive Brokers', icon: '🏦', markets: 'All Markets' },
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>🔗 Connect Your Brokers</h1>
        <p>Link multiple brokers to trade across all markets from one dashboard</p>
        <Link href="/broker-setup/routing" className={styles.routingLink}>
          🔀 Configure Order Routing →
        </Link>
      </header>

      {/* Connected Brokers Summary */}
      <section className={styles.connectedSection}>
        <h2>Connected Brokers ({connectedBrokers.filter(b => b.connected).length})</h2>
        <div className={styles.connectedList}>
          {connectedBrokers.length === 0 ? (
            <p className={styles.noConnections}>No brokers connected yet. Select one below to get started.</p>
          ) : (
            connectedBrokers.map((broker) => (
              <div
                key={broker.brokerType}
                className={`${styles.connectedCard} ${broker.connected ? styles.connected : styles.disconnected}`}
              >
                <span className={styles.statusDot} />
                <span className={styles.brokerName}>{broker.brokerType}</span>
                <span className={styles.envBadge}>{broker.isPaper ? 'PAPER' : 'LIVE'}</span>
                <span className={styles.markets}>{broker.supportedMarkets.join(', ')}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Broker Selection */}
      <section className={styles.selectSection}>
        <h2>Add a Broker</h2>
        <div className={styles.brokerGrid}>
          {brokerList.map((broker) => {
            const isConnected = connectedBrokers.some(
              (b) => b.brokerType === broker.type && b.connected
            );
            return (
              <button
                key={broker.type}
                className={`${styles.brokerCard} ${selectedBroker === broker.type ? styles.selected : ''} ${isConnected ? styles.alreadyConnected : ''}`}
                onClick={() => setSelectedBroker(broker.type)}
              >
                <span className={styles.brokerIcon}>{broker.icon}</span>
                <span className={styles.brokerTitle}>{broker.name}</span>
                <span className={styles.brokerMarkets}>{broker.markets}</span>
                {isConnected && <span className={styles.connectedBadge}>✓ Connected</span>}
              </button>
            );
          })}
        </div>
      </section>

      {/* Setup Form */}
      {selectedBroker && brokerInfo && (
        <section className={styles.setupSection}>
          <h2>Setup {brokerInfo.name}</h2>

          {/* Setup Steps */}
          <div className={styles.setupSteps}>
            <h3>How to Connect</h3>
            <ol>
              {brokerInfo.setupSteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <div className={styles.links}>
              <a href={brokerInfo.signupUrl} target="_blank" rel="noopener noreferrer">
                📝 Create Account
              </a>
              {brokerInfo.paperUrl && (
                <a href={brokerInfo.paperUrl} target="_blank" rel="noopener noreferrer">
                  🧪 Paper Trading
                </a>
              )}
              <a href={brokerInfo.docsUrl} target="_blank" rel="noopener noreferrer">
                📚 API Docs
              </a>
            </div>
          </div>

          {/* Credentials Form */}
          <div className={styles.credentialsForm}>
            <h3>Enter Credentials</h3>

            <div className={styles.envToggle}>
              <button
                className={environment === 'paper' ? styles.active : ''}
                onClick={() => setEnvironment('paper')}
              >
                🧪 Paper Trading
              </button>
              <button
                className={environment === 'live' ? styles.active : ''}
                onClick={() => setEnvironment('live')}
              >
                💰 Live Trading
              </button>
            </div>

            {selectedBroker === 'ALPACA' && (
              <>
                <label>
                  API Key ID
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="PKXXXXXXXXXXXXXXXX"
                  />
                </label>
                <label>
                  API Secret Key
                  <input
                    type="password"
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    placeholder="Your secret key"
                  />
                </label>
              </>
            )}

            {selectedBroker === 'OANDA' && (
              <>
                <label>
                  API Token
                  <input
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="Your OANDA API token"
                  />
                </label>
                <label>
                  Account ID
                  <input
                    type="text"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    placeholder="123-456-7890123-001"
                  />
                </label>
              </>
            )}

            {selectedBroker === 'TASTYTRADE' && (
              <>
                <label>
                  Username
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Your tastytrade username"
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                  />
                </label>
              </>
            )}

            {selectedBroker === 'TRADOVATE' && (
              <div className={styles.oauthSection}>
                <p>Tradovate uses OAuth for secure authentication.</p>
                <button className={styles.oauthBtn} disabled>
                  🔐 Connect with Tradovate (Coming Soon)
                </button>
              </div>
            )}

            {selectedBroker === 'IBKR' && (
              <div className={styles.gatewaySection}>
                <p>IBKR requires the Client Portal Gateway running locally.</p>
                <ol>
                  <li>Download <a href="https://www.interactivebrokers.com/en/trading/ib-api.php" target="_blank" rel="noopener noreferrer">Client Portal Gateway</a></li>
                  <li>Run: <code>java -jar clientportal.gw.jar</code></li>
                  <li>Open <a href="https://localhost:5000" target="_blank" rel="noopener noreferrer">https://localhost:5000</a> and login</li>
                  <li>Click Connect below</li>
                </ol>
              </div>
            )}

            {brokerInfo.notes && (
              <p className={styles.notes}>ℹ️ {brokerInfo.notes}</p>
            )}

            {error && <p className={styles.error}>❌ {error}</p>}
            {success && <p className={styles.success}>✅ {success}</p>}

            <button
              className={styles.connectBtn}
              onClick={handleConnect}
              disabled={loading || selectedBroker === 'TRADOVATE'}
            >
              {loading ? 'Connecting...' : `Connect ${brokerInfo.name}`}
            </button>
          </div>

          {/* Supported Markets */}
          <div className={styles.marketInfo}>
            <h3>Supported Markets</h3>
            <div className={styles.marketTags}>
              {brokerInfo.supportedMarkets.map((market) => (
                <span key={market} className={styles.marketTag}>
                  {market}
                </span>
              ))}
            </div>
            <h3>Features</h3>
            <ul className={styles.featureList}>
              {brokerInfo.features.map((feature, i) => (
                <li key={i}>{feature}</li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
