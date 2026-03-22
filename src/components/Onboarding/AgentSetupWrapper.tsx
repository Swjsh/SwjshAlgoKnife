'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import AgentSetupWizard from './AgentSetupWizard';

interface AgentConfig {
    agentType: string;
    market: string;
    strategy: string;
    capital: number;
    riskReward: number;
    agentName: string;
}

export default function AgentSetupWrapper() {
    const { user, userPreferences, updatePreferences } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const [showWizard, setShowWizard] = useState(false);

    useEffect(() => {
        // Only show on authenticated pages
        if (pathname === '/login' || pathname === '/') return;

        // Check if we should show the agent setup
        // Show if: user exists, onboarding is complete, but agent setup is not
        if (
            user &&
            userPreferences?.onboardingComplete === true &&
            userPreferences?.agentSetupComplete !== true
        ) {
            // Check localStorage for skipped state
            if (typeof window !== 'undefined') {
                const skipped = localStorage.getItem('agent_setup_skipped');
                if (skipped === 'true') return;
            }

            // Small delay after onboarding completes
            const timer = setTimeout(() => setShowWizard(true), 800);
            return () => clearTimeout(timer);
        }
    }, [user, userPreferences, pathname]);

    const handleComplete = async (config: AgentConfig) => {
        try {
            // Save the agent config to preferences for now
            // TODO: Connect to actual agent creation API
            console.log('[AgentSetupWrapper] Agent config:', config);

            // Mark setup as complete
            await updatePreferences({
                agentSetupComplete: true,
            });

            setShowWizard(false);
            router.push('/agents/break-room');
        } catch (error) {
            console.error('Failed to save agent config:', error);
            await updatePreferences({ agentSetupComplete: true });
            setShowWizard(false);
            router.push('/agents/break-room');
        }
    };

    const handleSkip = async () => {
        // Save to localStorage so it doesn't show again this session
        if (typeof window !== 'undefined') {
            localStorage.setItem('agent_setup_skipped', 'true');
        }
        await updatePreferences({ agentSetupComplete: true });
        setShowWizard(false);
    };

    if (!showWizard) return null;

    return (
        <AnimatePresence>
            <AgentSetupWizard onComplete={handleComplete} onSkip={handleSkip} />
        </AnimatePresence>
    );
}
