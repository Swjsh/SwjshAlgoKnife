'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getIdToken } from '@/lib/firebase-client';

export default function LegalPage() {
  const router = useRouter();
  const [accepted, setAccepted] = useState({ tos: false, waiver: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!accepted.tos || !accepted.waiver) {
      setError('You must accept both agreements to continue');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      if (!token) {
        setError('You must be signed in to continue. Please sign in and try again.');
        setLoading(false);
        return;
      }
      const res = await fetch('/api/onboarding/legal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ acceptedTerms: true, acceptedWaiver: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save legal acceptance');
      }
      router.push('/onboarding/broker');
    } catch (err: any) {
      console.error('Legal acceptance error:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const allAccepted = accepted.tos && accepted.waiver;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        .lg-root {
          min-height: 100vh;
          background-color: #07070a;
          background-image:
            radial-gradient(ellipse 70% 40% at 10% 0%, rgba(168, 85, 247, 0.15) 0%, transparent 60%),
            radial-gradient(ellipse 50% 35% at 90% 100%, rgba(236, 72, 153, 0.1) 0%, transparent 60%);
          font-family: 'Inter', -apple-system, system-ui, sans-serif;
          padding: 32px 24px;
          position: relative;
        }

        .lg-root::before {
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

        .lg-container {
          max-width: 600px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }

        /* ── Progress ── */
        .lg-progress {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 32px;
        }

        .lg-step-pill {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 6px 14px;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.2s;
        }

        .lg-step-pill.active {
          background: rgba(168, 85, 247, 0.15);
          border: 1px solid rgba(168, 85, 247, 0.35);
          color: #c084fc;
        }

        .lg-step-pill.done {
          background: rgba(34, 197, 94, 0.08);
          border: 1px solid rgba(34, 197, 94, 0.2);
          color: #4ade80;
        }

        .lg-step-pill.pending {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          color: #374151;
        }

        .lg-step-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          flex-shrink: 0;
        }

        .lg-progress-line {
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.05);
        }

        /* ── Header ── */
        .lg-header {
          margin-bottom: 24px;
        }

        .lg-header-badge {
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

        .lg-title {
          font-size: 26px;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0 0 8px;
          letter-spacing: -0.5px;
        }

        .lg-subtitle {
          font-size: 14px;
          color: #64748b;
          margin: 0;
        }

        /* ── Warning card ── */
        .lg-warning {
          background: rgba(234, 179, 8, 0.06);
          border: 1px solid rgba(234, 179, 8, 0.2);
          border-radius: 16px;
          padding: 20px 22px;
          margin-bottom: 16px;
        }

        .lg-warning-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 15px;
          font-weight: 600;
          color: #fbbf24;
          margin: 0 0 12px;
        }

        .lg-warning-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(234,179,8,0.12);
          border: 1px solid rgba(234,179,8,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 16px;
        }

        .lg-warning-body {
          font-size: 13px;
          color: #94a3b8;
          line-height: 1.65;
        }

        .lg-warning-body p { margin: 0 0 8px; }
        .lg-warning-body p:last-child { margin-bottom: 0; }

        /* ── Waiver card ── */
        .lg-waiver {
          background: rgba(17, 17, 22, 0.8);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 16px;
          padding: 20px 22px;
          margin-bottom: 20px;
          box-shadow: 0 0 0 1px rgba(168,85,247,0.05), 0 16px 32px rgba(0,0,0,0.4);
        }

        .lg-waiver-title {
          font-size: 15px;
          font-weight: 600;
          color: #e2e8f0;
          margin: 0 0 14px;
        }

        .lg-waiver-scroll {
          max-height: 220px;
          overflow-y: auto;
          padding-right: 6px;
          scrollbar-width: thin;
          scrollbar-color: rgba(168,85,247,0.3) transparent;
        }

        .lg-waiver-scroll::-webkit-scrollbar { width: 4px; }
        .lg-waiver-scroll::-webkit-scrollbar-track { background: transparent; }
        .lg-waiver-scroll::-webkit-scrollbar-thumb {
          background: rgba(168,85,247,0.3);
          border-radius: 2px;
        }

        .lg-waiver-intro {
          font-size: 13px;
          font-weight: 500;
          color: #94a3b8;
          margin: 0 0 10px;
        }

        .lg-waiver-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .lg-waiver-list li {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 13px;
          color: #64748b;
          line-height: 1.5;
        }

        .lg-waiver-list li::before {
          content: '';
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: rgba(168,85,247,0.5);
          flex-shrink: 0;
          margin-top: 7px;
        }

        /* ── Checkboxes ── */
        .lg-checks {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
        }

        .lg-check-label {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          cursor: pointer;
          padding: 14px 16px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02);
          transition: border-color 0.2s, background 0.2s;
        }

        .lg-check-label:hover {
          border-color: rgba(168,85,247,0.2);
          background: rgba(168,85,247,0.03);
        }

        .lg-check-label.checked {
          border-color: rgba(168,85,247,0.3);
          background: rgba(168,85,247,0.06);
        }

        .lg-checkbox-wrap {
          position: relative;
          width: 20px;
          height: 20px;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .lg-checkbox-wrap input {
          position: absolute;
          opacity: 0;
          width: 100%;
          height: 100%;
          cursor: pointer;
          margin: 0;
          z-index: 2;
        }

        .lg-checkbox-custom {
          width: 20px;
          height: 20px;
          border-radius: 6px;
          border: 1.5px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          pointer-events: none;
        }

        .lg-checkbox-wrap input:checked ~ .lg-checkbox-custom {
          background: linear-gradient(135deg, #a855f7, #ec4899);
          border-color: transparent;
          box-shadow: 0 0 12px rgba(168,85,247,0.4);
        }

        .lg-checkbox-custom svg {
          display: none;
        }

        .lg-checkbox-wrap input:checked ~ .lg-checkbox-custom svg {
          display: block;
        }

        .lg-check-text {
          font-size: 13px;
          color: #94a3b8;
          line-height: 1.5;
          flex: 1;
        }

        .lg-check-text a {
          color: #a855f7;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.15s;
        }

        .lg-check-text a:hover { color: #c084fc; }

        /* ── Error ── */
        .lg-error {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 11px 14px;
          border-radius: 10px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.25);
          margin-bottom: 16px;
        }

        .lg-error p {
          margin: 0;
          font-size: 13px;
          color: #fca5a5;
          line-height: 1.4;
        }

        /* ── Continue button ── */
        .lg-submit-btn {
          width: 100%;
          padding: 13px 20px;
          border-radius: 13px;
          border: none;
          background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
          letter-spacing: 0.2px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(168, 85, 247, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .lg-submit-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%);
          pointer-events: none;
        }

        .lg-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 28px rgba(168, 85, 247, 0.5);
          filter: brightness(1.08);
        }

        .lg-submit-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .lg-submit-btn svg {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }

        .lg-spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: lg-spin 0.7s linear infinite;
        }

        @keyframes lg-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className="lg-root">
        <div className="lg-container">

          {/* Progress indicator */}
          <div className="lg-progress">
            <div className="lg-step-pill active">
              <div className="lg-step-dot" />
              Step 1 — Legal
            </div>
            <div className="lg-progress-line" />
            <div className="lg-step-pill pending">
              <div className="lg-step-dot" />
              Step 2 — Broker
            </div>
          </div>

          {/* Header */}
          <div className="lg-header">
            <div className="lg-header-badge">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Before You Begin
            </div>
            <h1 className="lg-title">Legal & Risk Disclosure</h1>
            <p className="lg-subtitle">Please review and acknowledge the following before proceeding.</p>
          </div>

          {/* Warning */}
          <div className="lg-warning">
            <div className="lg-warning-title">
              <div className="lg-warning-icon">⚠️</div>
              Not Financial Advice
            </div>
            <div className="lg-warning-body">
              <p>SwjshAK is a software tool for automated trading. <strong style={{color:'#e2e8f0'}}>All trading involves substantial risk of loss.</strong> Past performance does not guarantee future results.</p>
              <p>The creators of this software are not registered investment advisors. Nothing in this application constitutes financial advice.</p>
              <p><strong style={{color:'#e2e8f0'}}>You are solely responsible for your trading decisions.</strong> SwjshAK and its creators are not liable for any losses incurred through the use of this platform.</p>
            </div>
          </div>

          {/* Waiver */}
          <div className="lg-waiver">
            <p className="lg-waiver-title">User Liability Waiver</p>
            <div className="lg-waiver-scroll">
              <p className="lg-waiver-intro">By using SwjshAK, you acknowledge and agree that:</p>
              <ul className="lg-waiver-list">
                <li>Trading involves substantial risk of loss</li>
                <li>Automated trading systems can malfunction or produce unexpected results</li>
                <li>You will only trade with funds you can afford to lose</li>
                <li>You understand how to use Paper Trading before attempting Live Trading</li>
                <li>You will not hold SwjshAK, its creators, or operators liable for any trading losses</li>
                <li>You are responsible for securing your API credentials and account access</li>
                <li>Market conditions can change rapidly and past performance does not indicate future results</li>
                <li>You have read and understood the risks associated with algorithmic trading</li>
                <li>You are legally permitted to trade in your jurisdiction</li>
                <li>You will comply with all applicable laws and regulations</li>
              </ul>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="lg-checks">
            <label className={`lg-check-label ${accepted.tos ? 'checked' : ''}`}>
              <div className="lg-checkbox-wrap">
                <input
                  type="checkbox"
                  checked={accepted.tos}
                  onChange={(e) => setAccepted({ ...accepted, tos: e.target.checked })}
                />
                <div className="lg-checkbox-custom">
                  <svg viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="10" height="10">
                    <polyline points="1.5,6 4.5,9 10.5,3"/>
                  </svg>
                </div>
              </div>
              <span className="lg-check-text">
                I have read and accept the{' '}
                <a href="/legal/terms" target="_blank" onClick={(e) => e.stopPropagation()}>Terms of Service</a>
                {' '}and{' '}
                <a href="/legal/privacy" target="_blank" onClick={(e) => e.stopPropagation()}>Privacy Policy</a>
              </span>
            </label>

            <label className={`lg-check-label ${accepted.waiver ? 'checked' : ''}`}>
              <div className="lg-checkbox-wrap">
                <input
                  type="checkbox"
                  checked={accepted.waiver}
                  onChange={(e) => setAccepted({ ...accepted, waiver: e.target.checked })}
                />
                <div className="lg-checkbox-custom">
                  <svg viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="10" height="10">
                    <polyline points="1.5,6 4.5,9 10.5,3"/>
                  </svg>
                </div>
              </div>
              <span className="lg-check-text">
                I understand the risks of algorithmic trading and accept the Liability Waiver above
              </span>
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="lg-error">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:'1px'}}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p>{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!allAccepted || loading}
            className="lg-submit-btn"
          >
            {loading ? (
              <span className="lg-spinner" />
            ) : (
              <>
                Continue to Broker Setup
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </>
            )}
          </button>

        </div>
      </div>
    </>
  );
}
