'use client';

import React from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { StrategyProvider } from '@/context/StrategyContext';
import { AgentProvider } from '@/context/AgentContext';
import OnboardingTour from '@/components/Onboarding/OnboardingTour';
import AgentSetupWrapper from '@/components/Onboarding/AgentSetupWrapper';
import { LogoWatermark } from '@/components/UI/LogoIcon';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <StrategyProvider>
                <AgentProvider>
                    {children}
                    <OnboardingTour />
                    <AgentSetupWrapper />
                    <LogoWatermark position="bottom-right" />
                </AgentProvider>
            </StrategyProvider>
        </AuthProvider>
    );
}
