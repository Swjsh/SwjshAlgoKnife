'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn, signInWithGoogle, handleRedirectResult } from '@/lib/firebase-client';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const checkRedirect = async () => {
      try {
        const user = await handleRedirectResult();
        if (user) {
          router.push('/command-center');
        }
      } catch (err: any) {
        console.error('Redirect error:', err);
        setError(err.message || 'Google sign-in failed');
      }
    };
    checkRedirect();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      router.push('/command-center');
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      if (user) {
        router.push('/command-center');
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setError(err.message || 'Failed to sign in with Google');
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        .signin-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #07070a;
          background-image:
            radial-gradient(ellipse 80% 50% at 20% -10%, rgba(168, 85, 247, 0.18) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 80% 110%, rgba(236, 72, 153, 0.12) 0%, transparent 60%),
            radial-gradient(ellipse 40% 30% at 50% 50%, rgba(168, 85, 247, 0.05) 0%, transparent 70%);
          font-family: 'Inter', -apple-system, system-ui, sans-serif;
          padding: 24px;
          position: relative;
          overflow: hidden;
        }

        /* Subtle grid overlay */
        .signin-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(168, 85, 247, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(168, 85, 247, 0.03) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
          z-index: 0;
        }

        .signin-container {
          width: 100%;
          max-width: 420px;
          position: relative;
          z-index: 1;
        }

        /* ── Logo ── */
        .signin-logo {
          text-align: center;
          margin-bottom: 32px;
        }

        .signin-logo-emblem {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%);
          border: 1px solid rgba(168, 85, 247, 0.35);
          margin-bottom: 14px;
          box-shadow: 0 0 24px rgba(168, 85, 247, 0.2), inset 0 1px 0 rgba(255,255,255,0.06);
        }

        .signin-logo-emblem svg {
          width: 28px;
          height: 28px;
        }

        .signin-logo-title {
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -0.5px;
          background: linear-gradient(135deg, #e2d9f3 0%, #a855f7 50%, #ec4899 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0 0 4px;
        }

        .signin-logo-subtitle {
          font-size: 13px;
          color: #64748b;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          font-weight: 500;
          margin: 0;
        }

        /* ── Card ── */
        .signin-card {
          background: rgba(17, 17, 22, 0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 20px;
          padding: 32px;
          box-shadow:
            0 0 0 1px rgba(168, 85, 247, 0.08),
            0 32px 64px rgba(0, 0, 0, 0.6),
            0 0 80px rgba(168, 85, 247, 0.06);
        }

        .signin-card-title {
          font-size: 20px;
          font-weight: 600;
          color: #f1f5f9;
          margin: 0 0 24px;
          letter-spacing: -0.3px;
        }

        /* ── Google button ── */
        .signin-google-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 11px 20px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
          color: #e2e8f0;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-bottom: 24px;
          font-family: inherit;
        }

        .signin-google-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.09);
          border-color: rgba(255, 255, 255, 0.16);
          color: #fff;
        }

        .signin-google-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        /* ── Divider ── */
        .signin-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .signin-divider-line {
          flex: 1;
          height: 1px;
          background: rgba(255, 255, 255, 0.07);
        }

        .signin-divider-text {
          font-size: 12px;
          color: #475569;
          white-space: nowrap;
          letter-spacing: 0.3px;
        }

        /* ── Form ── */
        .signin-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .signin-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .signin-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .signin-label {
          font-size: 13px;
          font-weight: 500;
          color: #94a3b8;
          letter-spacing: 0.2px;
        }

        .signin-forgot {
          font-size: 12px;
          color: #a855f7;
          text-decoration: none;
          transition: color 0.15s;
        }

        .signin-forgot:hover {
          color: #c084fc;
        }

        .signin-input-wrap {
          position: relative;
        }

        .signin-input {
          width: 100%;
          padding: 11px 14px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          color: #f1f5f9;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          box-sizing: border-box;
        }

        .signin-input::placeholder {
          color: #334155;
        }

        .signin-input:focus {
          border-color: rgba(168, 85, 247, 0.5);
          background: rgba(168, 85, 247, 0.05);
          box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.12);
        }

        .signin-input-pw {
          padding-right: 44px;
        }

        .signin-pw-toggle {
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

        .signin-pw-toggle:hover {
          color: #94a3b8;
        }

        /* ── Error ── */
        .signin-error {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 11px 14px;
          border-radius: 10px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.25);
        }

        .signin-error p {
          margin: 0;
          font-size: 13px;
          color: #fca5a5;
          line-height: 1.4;
        }

        /* ── Submit button ── */
        .signin-submit-btn {
          width: 100%;
          padding: 12px 20px;
          border-radius: 12px;
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
          box-shadow: 0 4px 20px rgba(168, 85, 247, 0.3);
        }

        .signin-submit-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%);
          pointer-events: none;
        }

        .signin-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 28px rgba(168, 85, 247, 0.45);
          filter: brightness(1.08);
        }

        .signin-submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .signin-submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        /* Loading spinner */
        .signin-spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          vertical-align: middle;
          margin-right: 8px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* ── Footer links ── */
        .signin-signup-text {
          margin-top: 22px;
          text-align: center;
          font-size: 13px;
          color: #475569;
        }

        .signin-signup-text a {
          color: #a855f7;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.15s;
        }

        .signin-signup-text a:hover {
          color: #c084fc;
        }

        .signin-legal {
          margin-top: 20px;
          text-align: center;
          font-size: 11px;
          color: #334155;
          line-height: 1.6;
        }

        .signin-legal a {
          color: #4b3d6e;
          text-decoration: none;
          transition: color 0.15s;
        }

        .signin-legal a:hover {
          color: #7c5cbf;
        }
      `}</style>

      <div className="signin-root">
        <div className="signin-container">

          {/* Logo */}
          <div className="signin-logo">
            <div className="signin-logo-emblem">
              {/* Candlestick / trading icon */}
              <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="8" width="4" height="12" rx="1.5" fill="url(#g1)" opacity="0.9"/>
                <rect x="6.5" y="4" width="1" height="4" rx="0.5" fill="url(#g1)" opacity="0.7"/>
                <rect x="6.5" y="20" width="1" height="4" rx="0.5" fill="url(#g1)" opacity="0.7"/>
                <rect x="12" y="5" width="4" height="10" rx="1.5" fill="url(#g2)" opacity="0.9"/>
                <rect x="13.5" y="2" width="1" height="3" rx="0.5" fill="url(#g2)" opacity="0.7"/>
                <rect x="13.5" y="15" width="1" height="3" rx="0.5" fill="url(#g2)" opacity="0.7"/>
                <rect x="19" y="11" width="4" height="9" rx="1.5" fill="url(#g1)" opacity="0.9"/>
                <rect x="20.5" y="7" width="1" height="4" rx="0.5" fill="url(#g1)" opacity="0.7"/>
                <rect x="20.5" y="20" width="1" height="3" rx="0.5" fill="url(#g1)" opacity="0.7"/>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7"/>
                    <stop offset="100%" stopColor="#7c3aed"/>
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ec4899"/>
                    <stop offset="100%" stopColor="#a855f7"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 className="signin-logo-title">SwjshAK</h1>
            <p className="signin-logo-subtitle">Algorithmic Trading Platform</p>
          </div>

          {/* Card */}
          <div className="signin-card">
            <h2 className="signin-card-title">Sign In</h2>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="signin-google-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="signin-divider">
              <div className="signin-divider-line" />
              <span className="signin-divider-text">or continue with email</span>
              <div className="signin-divider-line" />
            </div>

            <form onSubmit={handleSubmit} className="signin-form">
              {/* Email */}
              <div className="signin-field">
                <label htmlFor="email" className="signin-label">Email</label>
                <div className="signin-input-wrap">
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="signin-input"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="signin-field">
                <div className="signin-label-row">
                  <label htmlFor="password" className="signin-label">Password</label>
                  <Link href="/forgot-password" className="signin-forgot">Forgot password?</Link>
                </div>
                <div className="signin-input-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="signin-input signin-input-pw"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="signin-pw-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="signin-error">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0, marginTop:'1px'}}>
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="signin-submit-btn"
                style={{marginTop: '4px'}}
              >
                {loading && <span className="signin-spinner" />}
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <div className="signin-signup-text">
              Don't have an account?{' '}
              <Link href="/sign-up">Sign up</Link>
            </div>
          </div>

          <div className="signin-legal">
            By signing in, you agree to our{' '}
            <Link href="/legal/terms">Terms of Service</Link>
            {' '}and{' '}
            <Link href="/legal/privacy">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </>
  );
}
