'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading, userPreferences } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/sign-up');
    }
    if (!loading && userPreferences?.onboardingComplete) {
      router.replace('/command-center');
    }
  }, [user, loading, userPreferences, router]);

  const handleStart = () => {
    router.push('/onboarding/legal');
  };

  if (loading) {
    return (
      <>
        <style>{`
          .ob-loading {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #07070a;
          }
          .ob-loading-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #a855f7;
            animation: ob-pulse 1.4s ease-in-out infinite;
          }
          @keyframes ob-pulse {
            0%, 100% { opacity: 0.3; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1); }
          }
        `}</style>
        <div className="ob-loading">
          <div className="ob-loading-dot" />
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        .ob-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #07070a;
          background-image:
            radial-gradient(ellipse 80% 50% at 15% -5%, rgba(168, 85, 247, 0.2) 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 85% 105%, rgba(236, 72, 153, 0.14) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 50% 50%, rgba(168, 85, 247, 0.04) 0%, transparent 70%);
          font-family: 'Inter', -apple-system, system-ui, sans-serif;
          padding: 32px 24px;
          position: relative;
          overflow: hidden;
        }

        .ob-root::before {
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

        .ob-container {
          width: 100%;
          max-width: 580px;
          position: relative;
          z-index: 1;
        }

        /* ── Header ── */
        .ob-header {
          text-align: center;
          margin-bottom: 40px;
        }

        .ob-emblem {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 72px;
          height: 72px;
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.22) 0%, rgba(236, 72, 153, 0.22) 100%);
          border: 1px solid rgba(168, 85, 247, 0.4);
          margin-bottom: 20px;
          box-shadow: 0 0 32px rgba(168, 85, 247, 0.25), inset 0 1px 0 rgba(255,255,255,0.07);
          animation: ob-float 4s ease-in-out infinite;
        }

        @keyframes ob-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }

        .ob-emblem svg { width: 36px; height: 36px; }

        .ob-headline {
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -0.8px;
          background: linear-gradient(135deg, #f1f5f9 0%, #e2d9f3 40%, #a855f7 80%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0 0 10px;
          line-height: 1.1;
        }

        .ob-subhead {
          font-size: 15px;
          color: #64748b;
          margin: 0;
          line-height: 1.5;
        }

        /* ── Steps card ── */
        .ob-steps-card {
          background: rgba(17, 17, 22, 0.8);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 20px;
          padding: 28px;
          margin-bottom: 20px;
          box-shadow:
            0 0 0 1px rgba(168, 85, 247, 0.06),
            0 24px 48px rgba(0, 0, 0, 0.5),
            0 0 60px rgba(168, 85, 247, 0.05);
        }

        .ob-steps-title {
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #4b5563;
          margin: 0 0 20px;
        }

        .ob-step {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.05);
          background: rgba(255,255,255,0.02);
          margin-bottom: 10px;
          transition: border-color 0.2s, background 0.2s;
        }

        .ob-step:last-child { margin-bottom: 0; }

        .ob-step:hover {
          border-color: rgba(168, 85, 247, 0.15);
          background: rgba(168, 85, 247, 0.03);
        }

        .ob-step-num {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .ob-step-num-1 {
          background: rgba(168, 85, 247, 0.15);
          border: 1px solid rgba(168, 85, 247, 0.3);
          color: #a855f7;
        }

        .ob-step-num-2 {
          background: rgba(236, 72, 153, 0.12);
          border: 1px solid rgba(236, 72, 153, 0.25);
          color: #ec4899;
        }

        .ob-step-num-3 {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.2);
          color: #22c55e;
        }

        .ob-step-body { flex: 1; }

        .ob-step-label {
          font-size: 14px;
          font-weight: 600;
          color: #e2e8f0;
          margin: 0 0 3px;
        }

        .ob-step-desc {
          font-size: 12px;
          color: #475569;
          margin: 0;
        }

        .ob-step-time {
          font-size: 11px;
          color: #374151;
          font-weight: 500;
          white-space: nowrap;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 6px;
          padding: 3px 8px;
        }

        /* ── Feature grid ── */
        .ob-features {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 28px;
        }

        .ob-feat {
          background: rgba(17, 17, 22, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 14px;
          padding: 16px 12px;
          text-align: center;
          transition: border-color 0.2s, background 0.2s;
        }

        .ob-feat:hover {
          border-color: rgba(168, 85, 247, 0.2);
          background: rgba(168, 85, 247, 0.04);
        }

        .ob-feat-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 10px;
          font-size: 18px;
        }

        .ob-feat-label {
          font-size: 12px;
          font-weight: 600;
          color: #cbd5e1;
          margin: 0 0 4px;
        }

        .ob-feat-desc {
          font-size: 11px;
          color: #475569;
          margin: 0;
          line-height: 1.4;
        }

        /* ── CTA ── */
        .ob-cta-wrap {
          text-align: center;
        }

        .ob-cta-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 14px 36px;
          border-radius: 14px;
          border: none;
          background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
          letter-spacing: 0.1px;
          box-shadow: 0 6px 28px rgba(168, 85, 247, 0.4), 0 0 0 1px rgba(168,85,247,0.2);
          position: relative;
          overflow: hidden;
        }

        .ob-cta-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 60%);
          pointer-events: none;
        }

        .ob-cta-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 36px rgba(168, 85, 247, 0.55), 0 0 0 1px rgba(168,85,247,0.3);
          filter: brightness(1.06);
        }

        .ob-cta-btn:active {
          transform: translateY(0);
        }

        .ob-cta-btn svg {
          width: 18px;
          height: 18px;
          transition: transform 0.2s;
        }

        .ob-cta-btn:hover svg {
          transform: translateX(3px);
        }

        .ob-cta-sub {
          margin-top: 12px;
          font-size: 12px;
          color: #374151;
        }

        /* ── Paper trading badge ── */
        .ob-paper-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-top: 20px;
          padding: 8px 16px;
          border-radius: 100px;
          background: rgba(34, 197, 94, 0.07);
          border: 1px solid rgba(34, 197, 94, 0.18);
        }

        .ob-paper-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22c55e;
          animation: ob-glow 2s ease-in-out infinite;
        }

        @keyframes ob-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
          50% { box-shadow: 0 0 0 4px rgba(34,197,94,0); }
        }

        .ob-paper-text {
          font-size: 12px;
          font-weight: 500;
          color: #4ade80;
        }
      `}</style>

      <div className="ob-root">
        <div className="ob-container">

          {/* Header */}
          <div className="ob-header">
            <div className="ob-emblem">
              <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="10" width="5" height="15" rx="2" fill="url(#obg1)" opacity="0.9"/>
                <rect x="8" y="5" width="1.5" height="5" rx="0.75" fill="url(#obg1)" opacity="0.7"/>
                <rect x="8" y="25" width="1.5" height="5" rx="0.75" fill="url(#obg1)" opacity="0.7"/>
                <rect x="15.5" y="7" width="5" height="12" rx="2" fill="url(#obg2)" opacity="0.9"/>
                <rect x="17.5" y="3" width="1.5" height="4" rx="0.75" fill="url(#obg2)" opacity="0.7"/>
                <rect x="17.5" y="19" width="1.5" height="4" rx="0.75" fill="url(#obg2)" opacity="0.7"/>
                <rect x="25" y="14" width="5" height="11" rx="2" fill="url(#obg1)" opacity="0.9"/>
                <rect x="27" y="9" width="1.5" height="5" rx="0.75" fill="url(#obg1)" opacity="0.7"/>
                <rect x="27" y="25" width="1.5" height="4" rx="0.75" fill="url(#obg1)" opacity="0.7"/>
                <defs>
                  <linearGradient id="obg1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7"/>
                    <stop offset="100%" stopColor="#7c3aed"/>
                  </linearGradient>
                  <linearGradient id="obg2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ec4899"/>
                    <stop offset="100%" stopColor="#a855f7"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 className="ob-headline">Welcome to SwjshAK</h1>
            <p className="ob-subhead">Let's get your trading platform set up in just a few steps.</p>
          </div>

          {/* Steps */}
          <div className="ob-steps-card">
            <p className="ob-steps-title">Setup Overview</p>

            <div className="ob-step">
              <div className="ob-step-num ob-step-num-1">1</div>
              <div className="ob-step-body">
                <p className="ob-step-label">Legal & Risk Acknowledgment</p>
                <p className="ob-step-desc">Review important information about algorithmic trading risks</p>
              </div>
              <span className="ob-step-time">~30 sec</span>
            </div>

            <div className="ob-step">
              <div className="ob-step-num ob-step-num-2">2</div>
              <div className="ob-step-body">
                <p className="ob-step-label">Connect Your Broker</p>
                <p className="ob-step-desc">Link your Alpaca account for paper or live trading</p>
              </div>
              <span className="ob-step-time">~2 min</span>
            </div>

            <div className="ob-step">
              <div className="ob-step-num ob-step-num-3">✓</div>
              <div className="ob-step-body">
                <p className="ob-step-label">Ready to Trade</p>
                <p className="ob-step-desc">Deploy bots and start autonomous trading</p>
              </div>
              <span className="ob-step-time">done!</span>
            </div>
          </div>

          {/* Feature grid */}
          <div className="ob-features">
            {[
              { icon: '🤖', bg: 'rgba(168,85,247,0.12)', label: 'Deploy Bots', desc: 'Autonomous trading agents' },
              { icon: '📊', bg: 'rgba(6,182,212,0.1)',   label: 'Strategies',  desc: 'ORB, VWAP, Grid & more'  },
              { icon: '📈', bg: 'rgba(34,197,94,0.1)',   label: 'Track P&L',   desc: 'Real-time analytics'    },
            ].map((f) => (
              <div key={f.label} className="ob-feat">
                <div className="ob-feat-icon" style={{ background: f.bg }}>{f.icon}</div>
                <p className="ob-feat-label">{f.label}</p>
                <p className="ob-feat-desc">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="ob-cta-wrap">
            <button onClick={handleStart} className="ob-cta-btn">
              Let's Get Started
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
            <p className="ob-cta-sub">Takes about 3 minutes to complete</p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div className="ob-paper-badge">
                <div className="ob-paper-dot" />
                <span className="ob-paper-text">Start with Paper Trading — 100% risk-free</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
