'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';
import GlassPanel from '@/components/UI/GlassPanel';
import { Mail, Lock, Loader2, AlertCircle, FlaskConical } from 'lucide-react';
import { LogoIcon } from '@/components/UI/LogoIcon';

export default function LoginPage() {
    const { loginWithGoogle, loginWithEmail, loginAsGuest, signUpWithEmail, resetPassword, user, loading, authLoading, authError, clearError } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [resetEmailSent, setResetEmailSent] = useState(false);

    // Redirect if already logged in
    React.useEffect(() => {
        if (user) {
            router.push('/dashboard');
        }
    }, [user, router]);

    const handleGuestAccess = () => {
        loginAsGuest();
        router.push('/dashboard');
    };

    const handleGoogleLogin = async () => {
        await loginWithGoogle();
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isForgotPassword) {
            if (!email) return;
            const success = await resetPassword(email);
            if (success) {
                setResetEmailSent(true);
            }
            return;
        }

        if (!email || !password) {
            return;
        }

        if (isSignUp) {
            await signUpWithEmail(email, password);
        } else {
            await loginWithEmail(email, password);
        }
    };

    const toggleAuthMode = () => {
        setIsSignUp(!isSignUp);
        setIsForgotPassword(false);
        setResetEmailSent(false);
        clearError();
    };

    const handleForgotPassword = () => {
        setIsForgotPassword(true);
        setIsSignUp(false);
        setResetEmailSent(false);
        clearError();
    };

    const handleBackToLogin = () => {
        setIsForgotPassword(false);
        setResetEmailSent(false);
        clearError();
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.particleBg} />
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255,255,255,0.5)',
                    zIndex: 10
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            fontSize: '2rem',
                            marginBottom: '1rem',
                            animation: 'pulse 2s ease-in-out infinite'
                        }}>
                            🔐
                        </div>
                        <div>Verifying authentication...</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.particleBg} />

            <GlassPanel className={styles.loginCard}>
                <div className={styles.logoSlot}>
                    <LogoIcon size={80} />
                </div>

                <h1 className={styles.title}>Enter The Lab</h1>
                <p className={styles.subtitle}>Algo-Knife</p>

                {authError && (
                    <div className={styles.errorMessage}>
                        <AlertCircle size={18} />
                        <span>{authError}</span>
                    </div>
                )}

                {resetEmailSent ? (
                    <div className={styles.successMessage}>
                        <span>✓ Password reset email sent! Check your inbox.</span>
                        <button
                            type="button"
                            className={styles.toggleBtn}
                            onClick={handleBackToLogin}
                        >
                            Back to Sign In
                        </button>
                    </div>
                ) : (
                    <form className={styles.form} onSubmit={handleEmailAuth}>
                        <div className={styles.inputGroup}>
                            <Mail className={styles.inputIcon} size={20} />
                            <input
                                type="email"
                                placeholder="Operator ID (Email)"
                                className={styles.input}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={authLoading}
                                required
                            />
                        </div>

                        {!isForgotPassword && (
                            <div className={styles.inputGroup}>
                                <Lock className={styles.inputIcon} size={20} />
                                <input
                                    type="password"
                                    placeholder="Access Key (Password)"
                                    className={styles.input}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={authLoading}
                                    required
                                    minLength={6}
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={authLoading}
                        >
                            {authLoading ? (
                                <Loader2 className={styles.spinner} size={20} />
                            ) : (
                                isForgotPassword ? 'Send Reset Email' : (isSignUp ? 'Create Account' : 'Sign In')
                            )}
                        </button>

                        {isForgotPassword ? (
                            <button
                                type="button"
                                className={styles.toggleBtn}
                                onClick={handleBackToLogin}
                                disabled={authLoading}
                            >
                                ← Back to Sign In
                            </button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    className={styles.toggleBtn}
                                    onClick={toggleAuthMode}
                                    disabled={authLoading}
                                >
                                    {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
                                </button>
                                {!isSignUp && (
                                    <button
                                        type="button"
                                        className={styles.forgotBtn}
                                        onClick={handleForgotPassword}
                                        disabled={authLoading}
                                    >
                                        Forgot Password?
                                    </button>
                                )}
                            </>
                        )}
                    </form>
                )}

                <div className={styles.divider}>
                    <span>OR CONTINUE WITH</span>
                </div>

                <button
                    onClick={handleGoogleLogin}
                    className={styles.googleBtn}
                    disabled={authLoading}
                >
                    {authLoading ? (
                        <Loader2 className={styles.spinner} size={20} />
                    ) : (
                        <>
                            <svg className={styles.googleIcon} viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Continue with Google
                        </>
                    )}
                </button>

                <button
                    onClick={handleGuestAccess}
                    className={styles.guestBtn}
                    disabled={authLoading}
                >
                    <FlaskConical className={styles.guestBtnIcon} size={20} />
                    Enter as Guest (Lab Access)
                </button>
            </GlassPanel>
        </div>
    );
}
