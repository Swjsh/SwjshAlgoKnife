'use client';

import React, { useRef, useEffect } from 'react';
import styles from './HeroParticle.module.css';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function HeroParticle() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { user } = useAuth();
    const router = useRouter();

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
            ctx.clearRect(0, 0, canvas.width, canvas.height);
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
            router.push('/strategies');
        } else {
            router.push('/login');
        }
    };

    return (
        <div className={styles.heroContainer}>
            <canvas ref={canvasRef} className={styles.canvas} />

            <div className={styles.content}>
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className={styles.titleWrapper}
                >
                    <div className={styles.brandRow}>
                        <Image
                            src="/images/swjsh_ak_final_v6.png"
                            alt="Swjsh AK"
                            width={700}
                            height={250}
                            className={styles.glassLogo}
                            priority
                        />
                    </div>
                    <h2 className={styles.glassSubtitle}>ALGO-KNIFE</h2>
                    <div className={styles.terminalSubtitle}>QUANTUM EXECUTION TERMINAL</div>
                </motion.div>

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleEnter}
                    className={styles.ctaButton}
                >
                    {user ? 'ACCESS DASHBOARD' : 'Connect'}
                </motion.button>


            </div >
        </div >
    );
}
