'use client';

import React, { useRef, useEffect, useState } from 'react';
import styles from './HeroParticle.module.css';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function HeroParticle() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { user, loginWithGoogle, loading: authLoading } = useAuth();
    const router = useRouter();
    const [signingIn, setSigningIn] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let particles: Particle[] = [];

        class Particle {
            x: number;
            y: number;
            size: number;
            speedX: number;
            speedY: number;
            color: string;

            constructor(w: number, h: number) {
                this.x = Math.random() * w;
                this.y = Math.random() * h;
                this.size = Math.random() * 2 + 0.5;
                this.speedX = (Math.random() - 0.5) * 0.5;
                this.speedY = (Math.random() - 0.5) * 0.5;
                this.color = 'rgba(168, 85, 247, 0.5)';
            }

            update(w: number, h: number) {
                this.x += this.speedX;
                this.y += this.speedY;

                if (this.x > w) this.x = 0;
                if (this.x < 0) this.x = w;
                if (this.y > h) this.y = 0;
                if (this.y < 0) this.y = h;
            }

            draw() {
                if (!ctx) return;
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        const init = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            particles = [];
            for (let i = 0; i < 150; i++) {
                particles.push(new Particle(canvas.width, canvas.height));
            }
        };

        const animate = () => {
            // Paint background solid so mix-blend-mode:screen on the logo overlay
            // blends against opaque dark pixels (clearRect → transparent would
            // make screen(black, transparent) = black, causing a dark box).
            ctx.fillStyle = '#0a0a12';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            particles.forEach((p) => {
                p.update(canvas.width, canvas.height);
                p.draw();
            });
            animationFrameId = requestAnimationFrame(animate);
        };

        init();
        animate();

        const handleResize = () => init();
        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const handleEnter = () => {
        if (user) {
            router.push('/activity-feed');
        } else {
            router.push('/sign-up');
        }
    };

    const handleGoogleSignIn = async () => {
        setSigningIn(true);
        try {
            await loginWithGoogle();
            // After successful login, redirect to dashboard
            // The auth state change will handle the redirect
        } catch (error) {
            console.error('Google sign-in error:', error);
        } finally {
            setSigningIn(false);
        }
    };

    return (
        <div className={styles.heroContainer}>
            <canvas ref={canvasRef} className={styles.canvas} />

            {/* Logo lives outside the z-index:10 content div so mix-blend-mode:screen
                blends against the canvas backdrop (heroContainer has no z-index →
                no isolated stacking context). */}
            <motion.div
                className={styles.logoOverlay}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
            >
                <Image
                    src="/images/swjsh_ak_logo_transparent.png"
                    alt="Swjsh AK"
                    width={700}
                    height={262}
                    className={styles.glassLogo}
                    priority
                    unoptimized
                />
            </motion.div>

            <div className={styles.content}>
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className={styles.titleWrapper}
                >
                    <h2 className={styles.glassSubtitle}>ALGO-KNIFE</h2>
                    <div className={styles.terminalSubtitle}>QUANTUM EXECUTION TERMINAL</div>
                </motion.div>


                {/* CTA Buttons - Centered */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7, duration: 0.6 }}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 16,
                    }}
                >
                    {user ? (
                        /* Authenticated User - Single Dashboard Button */
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => router.push('/activity-feed')}
                            className={styles.ctaButton}
                        >
                            ENTER DASHBOARD
                        </motion.button>
                    ) : (
                        /* New/Unauthenticated User */
                        <>
                            {/* Primary: Get Started */}
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleEnter}
                                className={styles.ctaButton}
                            >
                                GET STARTED FREE
                            </motion.button>

                        </>
                    )}
                </motion.div>

                {/* Features Preview */}
            </div>

            {/* Google sign-in — small G badge, bottom-right corner */}
            {!user && (
                <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1, duration: 0.6 }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={handleGoogleSignIn}
                    disabled={signingIn || authLoading}
                    title={signingIn ? 'Signing in…' : 'Sign in with Google'}
                    style={{
                        position: 'absolute',
                        bottom: 28,
                        right: 28,
                        zIndex: 20,
                        width: 42,
                        height: 42,
                        borderRadius: '50%',
                        background: signingIn ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.92)',
                        border: '1.5px solid rgba(255,255,255,0.25)',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: signingIn ? 'wait' : 'pointer',
                        padding: 0,
                        opacity: signingIn ? 0.6 : 1,
                    }}
                >
                    {signingIn ? (
                        <span style={{ fontSize: 16, color: '#888' }}>…</span>
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                    )}
                </motion.button>
            )}
        </div>
    );
}
