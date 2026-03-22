'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';

export default function OnboardingCompletePage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(6);

  useEffect(() => {
    const completeOnboarding = async () => {
      try {
        await fetch('/api/onboarding/complete', { method: 'POST' });
      } catch (error) {
        console.error('Failed to mark onboarding complete:', error);
      }
    };
    completeOnboarding();

    // Purple/pink confetti burst
    const duration = 3500;
    const animationEnd = Date.now() + duration;

    const burst = () => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
      confetti({
        particleCount: 45 * (timeLeft / duration),
        spread: 80,
        origin: { x: Math.random() * 0.4 + 0.3, y: 0.55 },
        colors: ['#a855f7', '#ec4899', '#7c3aed', '#c084fc', '#f9a8d4'],
        startVelocity: 32,
        gravity: 0.9,
        ticks: 220,
        shapes: ['circle', 'square'],
      });
    };

    burst();
    const interval = setInterval(burst, 300);

    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          router.push('/activity-feed');
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, [router]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        .cp-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #07070a;
          background-image:
            radial-gradient(ellipse 80% 50% at 50% -5%, rgba(168, 85, 247, 0.22) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 20% 110%, rgba(236, 72, 153, 0.12) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 80% 110%, rgba(168, 85, 247, 0.1) 0%, transparent 60%);
          font-family: 'Inter', -apple-system, system-ui, sans-serif;
          padding: 32px 24px;
          position: relative;
        }

        .cp-root::before {
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

        .cp-container {
          max-width: 480px;
          width: 100%;
          text-align: center;
          position: relative;
          z-index: 1;
        }

        /* ── Success icon ── */
        .cp-icon-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 28px;
        }

        .cp-icon-glow {
          position: absolute;
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(168,85,247,0.3) 0%, transparent 70%);
          animation: cp-glow-pulse 2.5s ease-in-out infinite;
        }

        @keyframes cp-glow-pulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.15); opacity: 1; }
        }

        .cp-icon-ring {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(168,85,247,0.18) 0%, rgba(236,72,153,0.18) 100%);
          border: 2px solid rgba(168,85,247,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 32px rgba(168,85,247,0.35), inset 0 1px 0 rgba(255,255,255,0.08);
          animation: cp-ring-spin 6s linear infinite;
          position: relative;
          z-index: 1;
        }

        @keyframes cp-ring-spin {
          0% { border-color: rgba(168,85,247,0.4); }
          50% { border-color: rgba(236,72,153,0.5); }
          100% { border-color: rgba(168,85,247,0.4); }
        }

        .cp-icon-ring svg {
          width: 36px;
          height: 36px;
        }

        /* ── Text ── */
        .cp-headline {
          font-size: 34px;
          font-weight: 800;
          letter-spacing: -0.8px;
          background: linear-gradient(135deg, #f1f5f9 0%, #e2d9f3 40%, #a855f7 80%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0 0 12px;
          line-height: 1.1;
        }

        .cp-sub {
          font-size: 15px;
          color: #64748b;
          line-height: 1.6;
          margin: 0 0 32px;
          max-width: 360px;
          margin-left: auto;
          margin-right: auto;
        }

        /* ── Buttons ── */
        .cp-buttons {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 24px;
          max-width: 320px;
          margin-left: auto;
          margin-right: auto;
        }

        .cp-primary-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 13px 24px;
          border-radius: 13px;
          border: none;
          background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
          box-shadow: 0 4px 20px rgba(168,85,247,0.4);
          position: relative;
          overflow: hidden;
        }

        .cp-primary-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%);
          pointer-events: none;
        }

        .cp-primary-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(168,85,247,0.55);
          filter: brightness(1.07);
        }

        .cp-secondary-btn {
          padding: 12px 24px;
          border-radius: 13px;
          border: 1.5px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          color: #94a3b8;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }

        .cp-secondary-btn:hover {
          border-color: rgba(168,85,247,0.25);
          background: rgba(168,85,247,0.05);
          color: #c084fc;
        }

        /* ── Countdown ── */
        .cp-countdown {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #374151;
          margin-bottom: 28px;
        }

        .cp-countdown-ring {
          width: 20px;
          height: 20px;
          position: relative;
        }

        .cp-countdown-ring svg {
          width: 20px;
          height: 20px;
          transform: rotate(-90deg);
        }

        .cp-countdown-ring circle {
          stroke-dasharray: 56.5;
          stroke-dashoffset: 0;
          transition: stroke-dashoffset 0.9s linear;
        }

        .cp-countdown-num {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 700;
          color: #a855f7;
        }

        /* ── Tips card ── */
        .cp-tips {
          background: rgba(17, 17, 22, 0.7);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          padding: 20px;
          text-align: left;
          box-shadow: 0 0 0 1px rgba(168,85,247,0.04), 0 16px 32px rgba(0,0,0,0.35);
          max-width: 380px;
          margin: 0 auto;
        }

        .cp-tips-title {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #374151;
          margin: 0 0 14px;
        }

        .cp-tips-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .cp-tips-list li {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 12.5px;
          color: #475569;
          line-height: 1.5;
        }

        .cp-tip-dot {
          width: 18px;
          height: 18px;
          border-radius: 5px;
          background: rgba(168,85,247,0.1);
          border: 1px solid rgba(168,85,247,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .cp-tip-dot svg {
          width: 9px;
          height: 9px;
          color: #a855f7;
        }
      `}</style>

      <div className="cp-root">
        <div className="cp-container">

          {/* Icon */}
          <div className="cp-icon-wrap">
            <div className="cp-icon-glow" />
            <div className="cp-icon-ring">
              <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="18" cy="18" r="17" stroke="url(#cpg)" strokeWidth="1.5" opacity="0.4"/>
                <polyline points="10,19 15,24 26,13" stroke="url(#cpg)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <defs>
                  <linearGradient id="cpg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#a855f7"/>
                    <stop offset="100%" stopColor="#ec4899"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          {/* Text */}
          <h1 className="cp-headline">You're All Set!</h1>
          <p className="cp-sub">
            Your account is configured and ready. Start by deploying your first trading bot or explore the strategy arsenal.
          </p>

          {/* Buttons */}
          <div className="cp-buttons">
            <button onClick={() => router.push('/activity-feed')} className="cp-primary-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                <rect x="14" y="14" width="7" height="7" rx="1.5"/>
              </svg>
              Go to Dashboard
            </button>
            <button onClick={() => router.push('/strategies')} className="cp-secondary-btn">
              Browse Strategy Arsenal
            </button>
          </div>

          {/* Countdown */}
          <div className="cp-countdown">
            <div className="cp-countdown-ring">
              <svg viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="9" fill="none" stroke="rgba(168,85,247,0.15)" strokeWidth="2"/>
                <circle
                  cx="10" cy="10" r="9"
                  fill="none"
                  stroke="url(#cd-grad)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  style={{ strokeDashoffset: 56.5 * (1 - countdown / 6) }}
                />
                <defs>
                  <linearGradient id="cd-grad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#a855f7"/>
                    <stop offset="100%" stopColor="#ec4899"/>
                  </linearGradient>
                </defs>
              </svg>
              <div className="cp-countdown-num">{countdown}</div>
            </div>
            Redirecting to dashboard in {countdown}s…
          </div>

          {/* Tips */}
          <div className="cp-tips">
            <p className="cp-tips-title">Quick Tips</p>
            <ul className="cp-tips-list">
              {[
                'Always test strategies in Paper Trading before going live',
                'Set stop losses and position size limits to manage risk',
                'Monitor your bots regularly and adjust based on performance',
              ].map((tip) => (
                <li key={tip}>
                  <div className="cp-tip-dot">
                    <svg viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1,5 3.5,7.5 8,2"/>
                    </svg>
                  </div>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </>
  );
}
