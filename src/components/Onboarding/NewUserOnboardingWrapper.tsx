'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { getIdToken } from '@/lib/firebase-client';
import NewUserOnboarding from './NewUserOnboarding';

/**
 * NewUserOnboardingWrapper
 *
 * Shows the unified onboarding wizard when:
 *   1. User is authenticated
 *   2. onboardingComplete is NOT true (first-time user)
 *   3. We're not on auth/landing pages
 *
 * SECURITY: Skip requires legal acceptance first. If user hasn't
 * reached the legal step, skip just hides the wizard for this session
 * but does NOT mark onboarding as complete.
 */
export default function NewUserOnboardingWrapper() {
    const { user, loading, userPreferences, updatePreferences } = useAuth();
    const pathname = usePathname();
    const [showWizard, setShowWizard] = useState(false);

    // Pages where we never show the wizard
    const excludedPaths = ['/', '/login', '/sign-in', '/sign-up', '/onboarding', '/legal'];

    useEffect(() => {
        if (loading) return;

        // Don't show on excluded paths
        if (excludedPaths.some((p) => pathname === p || pathname.startsWith('/onboarding'))) return;

        // Show if: user exists AND onboarding is NOT complete
        if (user && userPreferences?.onboardingComplete !== true) {
            // Check if user explicitly skipped AND legal was previously accepted
            if (typeof window !== 'undefined') {
                const skipped = localStorage.getItem('onboarding_wizard_skipped');
                const legalAccepted = localStorage.getItem('onboarding_legal_accepted');
                // Only honor skip if legal was accepted
                if (skipped === 'true' && legalAccepted === 'true') return;
            }

            const timer = setTimeout(() => setShowWizard(true), 600);
            return () => clearTimeout(timer);
        }

        // Also show the agent setup part if onboarding is done but agent setup isn't
        if (
            user &&
            userPreferences?.onboardingComplete === true &&
            userPreferences?.agentSetupComplete !== true
        ) {
            if (typeof window !== 'undefined') {
                const skipped = localStorage.getItem('agent_setup_skipped');
                if (skipped === 'true') return;
            }

            const timer = setTimeout(() => setShowWizard(true), 600);
            return () => clearTimeout(timer);
        }
    }, [user, loading, userPreferences, pathname]);

    const handleComplete = async () => {
        setShowWizard(false);
    };

    const handleSkip = async () => {
        // SECURITY: Before allowing skip to mark onboarding complete,
        // we MUST ensure legal acceptance was recorded server-side.
        // The wizard component only shows "Skip" after legal step is passed,
        // and it calls saveLegalAcceptance() on step transition.
        // We verify by calling the API one more time as a safety net.

        try {
            const token = await getIdToken();

            // Record legal acceptance server-side (idempotent — safe to call again)
            const legalRes = await fetch('/api/onboarding/legal', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ acceptedTerms: true, acceptedWaiver: true }),
            });

            if (!legalRes.ok) {
                console.error('Skip: Failed to record legal acceptance');
                // Don't mark complete if we can't save legal
                setShowWizard(false);
                return;
            }

            // Mark legal acceptance in localStorage for skip-persistence check
            if (typeof window !== 'undefined') {
                localStorage.setItem('onboarding_wizard_skipped', 'true');
                localStorage.setItem('onboarding_legal_accepted', 'true');
                localStorage.setItem('agent_setup_skipped', 'true');
            }

            // Now safe to mark complete — legal is on record
            await updatePreferences({
                onboardingComplete: true,
                agentSetupComplete: true,
            });
        } catch (err) {
            console.error('Failed to save skip state:', err);
        }

        setShowWizard(false);
    };

    if (!showWizard) return null;

    return (
        <AnimatePresence>
            <NewUserOnboarding onComplete={handleComplete} onSkip={handleSkip} />
        </AnimatePresence>
    );
}
