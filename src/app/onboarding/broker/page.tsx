'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getIdToken } from '@/lib/firebase-client';

type Environment = 'PAPER' | 'LIVE';

interface AccountPreview {
  id: string;
  accountNumber: string;
  status: string;
  currency: string;
  cash: number;
  buyingPower: number;
  equity: number;
  portfolioValue: number;
  patternDayTrader: boolean;
  tradingBlocked: boolean;
}

export default function BrokerSetupPage() {
  const router = useRouter();
  const [environment, setEnvironment] = useState<Environment>('PAPER');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [accountPreview, setAccountPreview] = useState<AccountPreview | null>(null);

  const handleTestConnection = async () => {
    setError('');
    setTesting(true);
    setAccountPreview(null);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/brokers/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ broker: 'ALPACA', environment, apiKey, apiSecret }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Connection test failed');
        return;
      }
      setAccountPreview(data.account);
    } catch (err: any) {
      setError(err.message || 'Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const token = await getIdToken();
      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      };

      const saveRes = await fetch('/api/brokers', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          broker: 'ALPACA',
          environment,
          label: environment === 'PAPER' ? 'Paper Trading' : 'Live Trading',
          apiKey,
          apiSecret,
        }),
      });
      if (!saveRes.ok) {
        const data = await saveRes.json();
        throw new Error(data.error || 'Failed to save broker configuration');
      }
      const { broker: savedBroker } = await saveRes.json();

      const verifyRes = await fetch(`/api/brokers/${savedBroker.id}/verify`, {
        method: 'POST',
        headers: authHeaders,
      });
      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        await fetch(`/api/brokers/${savedBroker.id}`, { method: 'DELETE', headers: authHeaders });
        let errorMsg = data.error || 'Failed to verify broker connection';
        if (data.details) errorMsg += '\n\n' + data.details;
        errorMsg += '\n\nPlease check your credentials and try again.';
        throw new Error(errorMsg);
      }
      router.push('/onboarding/complete');
    } catch (err: any) {
      console.error('Broker setup error:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        .bk-root {
          min-height: 100vh;
          background-color: #07070a;
          background-image:
            radial-gradient(ellipse 70% 40% at 10% 0%, rgba(168, 85, 247, 0.15) 0%, transparent 60%),
            radial-gradient(ellipse 50% 35% at 90% 100%, rgba(236, 72, 153, 0.1) 0%, transparent 60%);
          font-family: 'Inter', -apple-system, system-ui, sans-serif;
          padding: 32px 24px;
          position: relative;
        }

        .bk-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(168, 85, 247, 0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(168, 85, 247, 0.025) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
          z-index: 0;
        }

        .bk-container {
          max-width: 520px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }

        /* ── Progress ── */
        .bk-progress {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 32px;
        }

        .bk-step-pill {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 6px 14px;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 600;
        }

        .bk-step-pill.done {
          background: rgba(34, 197, 94, 0.08);
          border: 1px solid rgba(34, 197, 94, 0.2);
          color: #4ade80;
        }

        .bk-step-pill.active {
          background: rgba(168, 85, 247, 0.15);
          border: 1px solid rgba(168, 85, 247, 0.35);
          color: #c084fc;
        }

        .bk-step-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          flex-shrink: 0;
        }

        .bk-progress-line {
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.05);
        }

        /* ── Header ── */
        .bk-header {
          margin-bottom: 24px;
        }

        .bk-header-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 100px;
          background: rgba(168, 85, 247, 0.1);
          border: 1px solid rgba(168, 85, 247, 0.25);
          font-size: 11px;
          font-weight: 600;
          color: #a855f7;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 14px;
        }

        .bk-title {
          font-size: 26px;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0 0 8px;
          letter-spacing: -0.5px;
        }

        .bk-subtitle {
          font-size: 14px;
          color: #64748b;
          margin: 0;
        }

        /* ── Broker badge ── */
        .bk-broker-badge {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 18px;
          border-radius: 14px;
          background: rgba(17,17,22,0.8);
          border: 1px solid rgba(168,85,247,0.25);
          margin-bottom: 20px;
          box-shadow: 0 0 0 1px rgba(168,85,247,0.06), 0 8px 24px rgba(0,0,0,0.3);
        }

        .bk-broker-logo {
          width: 44px;
          height: 44px;
          border-radius: 11px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          flex-shrink: 0;
        }

        .bk-broker-info { flex: 1; }

        .bk-broker-name {
          font-size: 15px;
          font-weight: 600;
          color: #e2e8f0;
          margin: 0 0 3px;
        }

        .bk-broker-desc {
          font-size: 12px;
          color: #475569;
          margin: 0;
        }

        .bk-selected-tag {
          padding: 4px 10px;
          border-radius: 100px;
          background: rgba(168,85,247,0.12);
          border: 1px solid rgba(168,85,247,0.3);
          font-size: 11px;
          font-weight: 600;
          color: #c084fc;
          white-space: nowrap;
        }

        /* ── Environment toggle ── */
        .bk-env-label {
          font-size: 13px;
          font-weight: 500;
          color: #94a3b8;
          margin: 0 0 10px;
        }

        .bk-env-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 20px;
        }

        .bk-env-btn {
          padding: 14px 16px;
          border-radius: 12px;
          border: 1.5px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.02);
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
          font-family: inherit;
        }

        .bk-env-btn:hover:not(.active-paper):not(.active-live) {
          border-color: rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
        }

        .bk-env-btn.active-paper {
          border-color: rgba(168,85,247,0.45);
          background: rgba(168,85,247,0.08);
        }

        .bk-env-btn.active-live {
          border-color: rgba(239,68,68,0.4);
          background: rgba(239,68,68,0.07);
        }

        .bk-env-btn-main {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .bk-env-btn.active-paper .bk-env-btn-main { color: #c084fc; }
        .bk-env-btn.active-live  .bk-env-btn-main { color: #f87171; }
        .bk-env-btn:not(.active-paper):not(.active-live) .bk-env-btn-main { color: #64748b; }

        .bk-env-btn-sub {
          font-size: 11px;
          color: #374151;
        }

        /* ── Live warning ── */
        .bk-live-warning {
          padding: 14px 16px;
          border-radius: 12px;
          background: rgba(239,68,68,0.07);
          border: 1px solid rgba(239,68,68,0.2);
          margin-bottom: 20px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .bk-live-warning-icon {
          font-size: 16px;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .bk-live-warning-text {
          font-size: 13px;
          color: #fca5a5;
          line-height: 1.5;
          margin: 0;
        }

        /* ── Form ── */
        .bk-form { display: flex; flex-direction: column; gap: 0; }

        .bk-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
          margin-bottom: 14px;
        }

        .bk-field-label {
          font-size: 13px;
          font-weight: 500;
          color: #94a3b8;
        }

        .bk-input-wrap { position: relative; }

        .bk-input {
          width: 100%;
          padding: 11px 14px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          color: #f1f5f9;
          font-size: 13px;
          font-family: 'SFMono-Regular', 'Cascadia Code', 'Courier New', monospace;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          box-sizing: border-box;
        }

        .bk-input::placeholder { color: #1e293b; }

        .bk-input:focus {
          border-color: rgba(168, 85, 247, 0.5);
          background: rgba(168, 85, 247, 0.05);
          box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.12);
        }

        .bk-input-pw { padding-right: 44px; }

        .bk-pw-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #475569;
          padding: 4px;
          display: flex;
          align-items: center;
          transition: color 0.15s;
        }

        .bk-pw-toggle:hover { color: #94a3b8; }

        /* ── Help box ── */
        .bk-help {
          background: rgba(17,17,22,0.7);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .bk-help-title {
          font-size: 13px;
          font-weight: 600;
          color: #e2e8f0;
          margin: 0 0 10px;
        }

        .bk-help-steps {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
          counter-reset: help-counter;
        }

        .bk-help-steps li {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
          color: #64748b;
          counter-increment: help-counter;
        }

        .bk-help-steps li::before {
          content: counter(help-counter);
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(168,85,247,0.1);
          border: 1px solid rgba(168,85,247,0.2);
          color: #a855f7;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .bk-help-steps a {
          color: #a855f7;
          text-decoration: none;
          transition: color 0.15s;
        }

        .bk-help-steps a:hover { color: #c084fc; }

        /* ── Account preview ── */
        .bk-preview {
          border-radius: 12px;
          background: rgba(34,197,94,0.06);
          border: 1px solid rgba(34,197,94,0.2);
          padding: 16px;
          margin-bottom: 16px;
        }

        .bk-preview-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
        }

        .bk-preview-check {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(34,197,94,0.15);
          border: 1px solid rgba(34,197,94,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .bk-preview-title {
          font-size: 13px;
          font-weight: 600;
          color: #4ade80;
          margin: 0;
        }

        .bk-preview-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .bk-preview-item-label {
          font-size: 11px;
          color: #475569;
          margin: 0 0 3px;
        }

        .bk-preview-item-val {
          font-size: 13px;
          font-weight: 600;
          color: #e2e8f0;
          font-family: monospace;
          margin: 0;
        }

        .bk-preview-item-val.cyan { color: #22d3ee; }
        .bk-preview-item-val.green { color: #4ade80; }
        .bk-preview-item-val.yellow { color: #fbbf24; }

        /* ── Error ── */
        .bk-error {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 11px 14px;
          border-radius: 10px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.25);
          margin-bottom: 16px;
        }

        .bk-error p {
          margin: 0;
          font-size: 13px;
          color: #fca5a5;
          line-height: 1.4;
          white-space: pre-line;
        }

        /* ── Action buttons ── */
        .bk-actions {
          display: flex;
          gap: 10px;
          margin-bottom: 12px;
        }

        .bk-test-btn {
          flex: 1;
          padding: 12px 16px;
          border-radius: 12px;
          border: 1.5px solid rgba(168,85,247,0.4);
          background: rgba(168,85,247,0.06);
          color: #c084fc;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }

        .bk-test-btn:hover:not(:disabled) {
          background: rgba(168,85,247,0.12);
          border-color: rgba(168,85,247,0.6);
          color: #d8b4fe;
        }

        .bk-test-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .bk-save-btn {
          flex: 1;
          padding: 12px 16px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 16px rgba(168,85,247,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
        }

        .bk-save-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 60%);
          pointer-events: none;
        }

        .bk-save-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(168,85,247,0.45);
          filter: brightness(1.08);
        }

        .bk-save-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
          transform: none;
        }

        .bk-skip {
          display: block;
          text-align: center;
          width: 100%;
          background: none;
          border: none;
          font-family: inherit;
          font-size: 12px;
          color: #374151;
          cursor: pointer;
          transition: color 0.15s;
          padding: 8px;
        }

        .bk-skip:hover { color: #64748b; }

        .bk-spinner {
          display: inline-block;
          width: 13px;
          height: 13px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: bk-spin 0.7s linear infinite;
        }

        @keyframes bk-spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="bk-root">
        <div className="bk-container">

          {/* Progress */}
          <div className="bk-progress">
            <div className="bk-step-pill done">
              <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1.5,6 4.5,9 10.5,3"/>
              </svg>
              Step 1 — Legal
            </div>
            <div className="bk-progress-line" />
            <div className="bk-step-pill active">
              <div className="bk-step-dot" />
              Step 2 — Broker
            </div>
          </div>

          {/* Header */}
          <div className="bk-header">
            <div className="bk-header-badge">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 20V10M12 20V4M6 20v-6"/>
              </svg>
              Broker Setup
            </div>
            <h1 className="bk-title">Connect Your Broker</h1>
            <p className="bk-subtitle">We'll use your API credentials to place trades on your behalf.</p>
          </div>

          {/* Alpaca badge */}
          <div className="bk-broker-badge">
            <div className="bk-broker-logo">🦙</div>
            <div className="bk-broker-info">
              <p className="bk-broker-name">Alpaca Markets</p>
              <p className="bk-broker-desc">Commission-free stock & crypto trading</p>
            </div>
            <span className="bk-selected-tag">Selected</span>
          </div>

          {/* Environment */}
          <p className="bk-env-label">Trading Environment</p>
          <div className="bk-env-grid">
            <button
              type="button"
              onClick={() => setEnvironment('PAPER')}
              className={`bk-env-btn ${environment === 'PAPER' ? 'active-paper' : ''}`}
            >
              <div className="bk-env-btn-main">📝 Paper Trading</div>
              <div className="bk-env-btn-sub">Practice with simulated money</div>
            </button>
            <button
              type="button"
              onClick={() => setEnvironment('LIVE')}
              className={`bk-env-btn ${environment === 'LIVE' ? 'active-live' : ''}`}
            >
              <div className="bk-env-btn-main">⚡ Live Trading</div>
              <div className="bk-env-btn-sub">Trade with real money</div>
            </button>
          </div>

          {/* Live warning */}
          {environment === 'LIVE' && (
            <div className="bk-live-warning">
              <span className="bk-live-warning-icon">⚠️</span>
              <p className="bk-live-warning-text">
                <strong>Warning:</strong> Live trading uses real money. We strongly recommend testing strategies with Paper Trading first.
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="bk-form">
            <div className="bk-field">
              <label className="bk-field-label">API Key</label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="PK..."
                required
                className="bk-input"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>

            <div className="bk-field">
              <label className="bk-field-label">Secret Key</label>
              <div className="bk-input-wrap">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="••••••••••••••••••••"
                  required
                  className="bk-input bk-input-pw"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="bk-pw-toggle"
                  onClick={() => setShowSecret(!showSecret)}
                  tabIndex={-1}
                >
                  {showSecret ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Help */}
            <div className="bk-help">
              <p className="bk-help-title">Need API keys?</p>
              <ol className="bk-help-steps">
                <li>Go to <a href="https://alpaca.markets" target="_blank" rel="noopener noreferrer">alpaca.markets</a> and sign up</li>
                <li>Navigate to "API Keys" in your dashboard</li>
                <li>Generate {environment === 'PAPER' ? 'Paper' : 'Live'} Trading keys</li>
                <li>Copy and paste them into the fields above</li>
              </ol>
            </div>

            {/* Error */}
            {error && (
              <div className="bk-error">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:'1px'}}>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p>{error}</p>
              </div>
            )}

            {/* Account preview */}
            {accountPreview && (
              <div className="bk-preview">
                <div className="bk-preview-header">
                  <div className="bk-preview-check">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1.5,6 4.5,9 10.5,3"/>
                    </svg>
                  </div>
                  <p className="bk-preview-title">Connection Successful</p>
                </div>
                <div className="bk-preview-grid">
                  <div>
                    <p className="bk-preview-item-label">Account</p>
                    <p className="bk-preview-item-val">{accountPreview.accountNumber}</p>
                  </div>
                  <div>
                    <p className="bk-preview-item-label">Status</p>
                    <p className={`bk-preview-item-val ${accountPreview.status === 'ACTIVE' ? 'green' : 'yellow'}`}>{accountPreview.status}</p>
                  </div>
                  <div>
                    <p className="bk-preview-item-label">Cash Balance</p>
                    <p className="bk-preview-item-val">${accountPreview.cash.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="bk-preview-item-label">Buying Power</p>
                    <p className="bk-preview-item-val cyan">${accountPreview.buyingPower.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
                {accountPreview.tradingBlocked && (
                  <p style={{marginTop:'10px',fontSize:'12px',color:'#fbbf24'}}>⚠️ Trading is currently blocked on this account</p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="bk-actions">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing || !apiKey || !apiSecret}
                className="bk-test-btn"
              >
                {testing ? 'Testing…' : accountPreview ? 'Re-test' : 'Test Connection'}
              </button>
              <button
                type="submit"
                disabled={loading || !apiKey || !apiSecret}
                className="bk-save-btn"
              >
                {loading ? (
                  <span className="bk-spinner" />
                ) : (
                  <>
                    Connect & Save
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </>
                )}
              </button>
            </div>
          </form>

          <button onClick={() => router.push('/activity-feed')} className="bk-skip">
            Skip for now — add broker later in Settings
          </button>

        </div>
      </div>
    </>
  );
}
