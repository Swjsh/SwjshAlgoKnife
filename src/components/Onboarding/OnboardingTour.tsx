'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './OnboardingTour.module.css';
import { X, ArrowRight, ArrowLeft, Bot, TrendingUp, BookOpen, Settings, Sparkles, Rocket, CheckCircle } from 'lucide-react';
import { LogoIcon } from '@/components/UI/LogoIcon';
import AgentSetupWizard from '../Agents/AgentSetupWizard';

interface TourStep {
    title: string;
    description: string;
    icon: React.ReactNode;
    path: string;
    color: string;
    gradient: string;
}

const TOUR_STEPS: TourStep[] = [
    {
        title: "Meet Your Trading Squad",
        description: "Your autonomous AI agents work 24/7 to find opportunities. Each specializes in FX, Crypto, Futures, or Options. Chat with them, review their decisions, and watch them trade!",
        icon: <Bot size={40} />,
        path: "/agents",
        color: "#a855f7",
        gradient: "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)"
    },
    {
        title: "Strategy Command Center",
        description: "Your trading arsenal. View pending orders, active trades, and performance analytics. Every strategy at your fingertips, with real-time updates.",
        icon: <TrendingUp size={40} />,
        path: "/strategies",
        color: "#22c55e",
        gradient: "linear-gradient(135deg, #22c55e 0%, #10b981 100%)"
    },
    {
        title: "Trading Journal",
        description: "Track your journey. Log daily P&L, mood, and insights. Build a record that helps you learn from wins and losses alike.",
        icon: <BookOpen size={40} />,
        path: "/journal",
        color: "#3b82f6",
        gradient: "linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)"
    },
    {
        title: "Mission Control",
        description: "Fine-tune your experience. Set risk parameters, configure API keys, and personalize every aspect of your trading command center.",
        icon: <Settings size={40} />,
        path: "/settings",
        color: "#f59e0b",
        gradient: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)"
    }
];

// Animation variants - using explicit types for TypeScript compatibility
const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.4 } },
    exit: { opacity: 0, transition: { duration: 0.3 } }
};

const modalVariants = {
    hidden: { opacity: 0, scale: 0.8, y: 50 },
    visible: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: { duration: 0.4, delay: 0.1 }
    },
    exit: {
        opacity: 0,
        scale: 0.9,
        y: -30,
        transition: { duration: 0.2 }
    }
};

const contentVariants = {
    hidden: { opacity: 0, x: 50 },
    visible: {
        opacity: 1,
        x: 0,
        transition: { duration: 0.3 }
    },
    exit: {
        opacity: 0,
        x: -50,
        transition: { duration: 0.2 }
    }
};

const iconVariants = {
    hidden: { scale: 0, rotate: -180 },
    visible: {
        scale: 1,
        rotate: 0,
        transition: { duration: 0.4, delay: 0.2 }
    }
};

const buttonVariants = {
    hover: { scale: 1.05 },
    tap: { scale: 0.95 }
};

const floatingVariants = {
    animate: {
        y: [0, -10, 0],
        transition: {
            duration: 3,
            repeat: Infinity
        }
    }
};

const pulseVariants = {
    animate: {
        scale: [1, 1.1, 1],
        opacity: [0.5, 0.8, 0.5],
        transition: {
            duration: 2,
            repeat: Infinity
        }
    }
};

export default function OnboardingTour() {
    const { userPreferences, updatePreferences, user } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isVisible, setIsVisible] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [isCompleting, setIsCompleting] = useState(false);
    const [hasDismissed, setHasDismissed] = useState(() => {
        // Check localStorage on initial mount for instant persistence
        if (typeof window !== 'undefined') {
            return localStorage.getItem('onboarding_dismissed') === 'true';
        }
        return false;
    });
    const [isAutoPlaying, setIsAutoPlaying] = useState(true);
    const [showWizard, setShowWizard] = useState(false);

    const handleDeployAgent = async (agentData: any) => {
        const response = await fetch('/api/agents', {
            method: 'POST',
            body: JSON.stringify(agentData)
        });
        if (!response.ok) throw new Error('Failed to deploy');
        router.push('/agents');
    };

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isVisible && isAutoPlaying && !isCompleting) {
            timer = setTimeout(() => {
                handleNext();
            }, 5000); // 5 seconds per step
        }
        return () => clearTimeout(timer);
    }, [isVisible, isAutoPlaying, currentStep, isCompleting]);

    useEffect(() => {
        // Only show on authenticated pages, not login or home
        if (pathname === '/login' || pathname === '/') return;

        // If we've already dismissed it (localStorage or state), never show again
        if (hasDismissed) return;

        // Double-check localStorage in case state didn't initialize correctly
        if (typeof window !== 'undefined' && localStorage.getItem('onboarding_dismissed') === 'true') {
            setHasDismissed(true);
            return;
        }

        // Show tour only if user is logged in and hasn't completed it
        if (user && userPreferences && userPreferences.onboardingComplete === false) {
            // Small delay for dramatic effect
            const timer = setTimeout(() => setIsVisible(true), 500);
            return () => clearTimeout(timer);
        } else if (userPreferences?.onboardingComplete === true) {
            // Ensure it's hidden if preferences update to completed
            setIsVisible(false);
            // Also set localStorage as backup
            if (typeof window !== 'undefined') {
                localStorage.setItem('onboarding_dismissed', 'true');
            }
        }
    }, [userPreferences, user, pathname, hasDismissed]);

    const handleSkip = async () => {
        // Immediately persist to localStorage for bulletproof persistence
        if (typeof window !== 'undefined') {
            localStorage.setItem('onboarding_dismissed', 'true');
        }
        setHasDismissed(true);
        setIsVisible(false);
        await updatePreferences({ onboardingComplete: true });
    };

    const handleNext = () => {
        if (currentStep < TOUR_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleComplete();
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleGoTo = async (path: string) => {
        // Immediately persist to localStorage for bulletproof persistence
        if (typeof window !== 'undefined') {
            localStorage.setItem('onboarding_dismissed', 'true');
        }
        setHasDismissed(true);
        setIsVisible(false);
        await updatePreferences({ onboardingComplete: true });
        router.push(path);
    };

    const handleComplete = async () => {
        // Immediately persist to localStorage for bulletproof persistence
        if (typeof window !== 'undefined') {
            localStorage.setItem('onboarding_dismissed', 'true');
        }
        setIsCompleting(true);
        setHasDismissed(true);
        await updatePreferences({ onboardingComplete: true });

        // Show completion animation
        setTimeout(() => {
            setIsVisible(false);
            router.push('/strategies');
        }, 1500);
    };

    if (!isVisible) return null;

    const step = TOUR_STEPS[currentStep];
    const isLastStep = currentStep === TOUR_STEPS.length - 1;

    return (
        <AnimatePresence mode="wait">
            <motion.div
                className={styles.overlay}
                variants={overlayVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
            >
                {/* Animated background particles */}
                <div className={styles.particles}>
                    {[...Array(20)].map((_, i) => (
                        <motion.div
                            key={i}
                            className={styles.particle}
                            animate={{
                                y: [0, -1000],
                                opacity: [0, 1, 0],
                                scale: [0, 1, 0]
                            }}
                            transition={{
                                duration: Math.random() * 10 + 10,
                                repeat: Infinity,
                                delay: Math.random() * 5,
                                ease: "linear"
                            }}
                            style={{
                                left: `${Math.random() * 100}%`,
                                bottom: `-50px`
                            }}
                        />
                    ))}
                </div>

                <motion.div
                    className={styles.modal}
                    variants={modalVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                >
                    {isCompleting ? (
                        <motion.div
                            className={styles.completeContainer}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: "spring", damping: 15 }}
                        >
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 0.5 }}
                            >
                                <CheckCircle size={80} color="#22c55e" />
                            </motion.div>
                            <motion.h2
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                You're All Set!
                            </motion.h2>
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                            >
                                Let's start trading...
                            </motion.p>
                            <motion.button
                                className={styles.setupBtn}
                                onClick={() => setShowWizard(true)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.7 }}
                            >
                                <Rocket size={20} />
                                Configure Your First Agent
                            </motion.button>
                        </motion.div>
                    ) : (
                        <>
                            <motion.button
                                className={styles.closeBtn}
                                onClick={handleSkip}
                                whileHover={{ scale: 1.1, rotate: 90 }}
                                whileTap={{ scale: 0.9 }}
                            >
                                <X size={20} />
                            </motion.button>

                            {/* Header with floating animation */}
                            <motion.div
                                className={styles.header}
                                variants={floatingVariants}
                                animate="animate"
                            >
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", delay: 0.3 }}
                                >
                                    <LogoIcon size={64} />
                                </motion.div>
                                <h2>Welcome to Swjsh Algo-Knife!</h2>
                                <p>Your AI-powered trading command center</p>
                            </motion.div>

                            {/* Progress bar */}
                            <div className={styles.progressContainer}>
                                <motion.div
                                    className={styles.progressBar}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${((currentStep + 1) / TOUR_STEPS.length) * 100}%` }}
                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                    style={{ background: step.gradient }}
                                />
                            </div>

                            {/* Animated step content */}
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentStep}
                                    className={styles.stepContainer}
                                    variants={contentVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                >
                                    {/* Glowing background */}
                                    <motion.div
                                        className={styles.iconGlow}
                                        style={{ background: step.gradient }}
                                        variants={pulseVariants}
                                        animate="animate"
                                    />

                                    <motion.div
                                        className={styles.iconCircle}
                                        style={{ background: step.gradient }}
                                        variants={iconVariants}
                                        initial="hidden"
                                        animate="visible"
                                    >
                                        {step.icon}
                                    </motion.div>

                                    <motion.h3
                                        className={styles.stepTitle}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.3 }}
                                    >
                                        {step.title}
                                    </motion.h3>

                                    <motion.p
                                        className={styles.stepDescription}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.4 }}
                                    >
                                        {step.description}
                                    </motion.p>

                                    <motion.button
                                        className={styles.goBtn}
                                        onClick={() => handleGoTo(step.path)}
                                        style={{ background: step.gradient }}
                                        variants={buttonVariants}
                                        whileHover="hover"
                                        whileTap="tap"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.5 }}
                                    >
                                        <Rocket size={18} />
                                        Take Me There
                                        <ArrowRight size={18} />
                                    </motion.button>
                                </motion.div>
                            </AnimatePresence>

                            {/* Footer with navigation */}
                            <motion.div
                                className={styles.footer}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6 }}
                            >
                                <div className={styles.dots}>
                                    {TOUR_STEPS.map((_, idx) => (
                                        <motion.button
                                            key={idx}
                                            className={`${styles.dot} ${idx === currentStep ? styles.dotActive : ''}`}
                                            onClick={() => setCurrentStep(idx)}
                                            whileHover={{ scale: 1.3 }}
                                            whileTap={{ scale: 0.9 }}
                                            animate={idx === currentStep ? { scale: [1, 1.2, 1] } : {}}
                                            transition={{ duration: 0.5, repeat: idx === currentStep ? Infinity : 0, repeatDelay: 1 }}
                                            style={idx === currentStep ? { background: step.color } : {}}
                                        />
                                    ))}
                                </div>

                                <div className={styles.actions}>
                                    {currentStep > 0 && (
                                        <motion.button
                                            className={styles.prevBtn}
                                            onClick={handlePrev}
                                            variants={buttonVariants}
                                            whileHover="hover"
                                            whileTap="tap"
                                        >
                                            <ArrowLeft size={16} />
                                            Back
                                        </motion.button>
                                    )}
                                    <motion.button
                                        className={styles.skipBtn}
                                        onClick={handleSkip}
                                        variants={buttonVariants}
                                        whileHover="hover"
                                        whileTap="tap"
                                    >
                                        Skip Tour
                                    </motion.button>
                                    <motion.button
                                        className={styles.nextBtn}
                                        onClick={handleNext}
                                        style={{ background: isLastStep ? 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)' : undefined }}
                                        variants={buttonVariants}
                                        whileHover="hover"
                                        whileTap="tap"
                                    >
                                        {isLastStep ? 'Get Started' : 'Next'}
                                        <ArrowRight size={16} />
                                    </motion.button>
                                </div>
                            </motion.div>
                        </>
                    )}
                </motion.div>
            </motion.div>
            <AgentSetupWizard
                isOpen={showWizard}
                onClose={() => setShowWizard(false)}
                onDeploy={handleDeployAgent}
            />
        </AnimatePresence>
    );
}
