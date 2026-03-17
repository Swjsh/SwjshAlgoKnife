'use client';

import React from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { StrategyProvider } from '@/context/StrategyContext';
import { AgentProvider } from '@/context/AgentContext';
import NewUserOnboardingWrapper from '@/components/Onboarding/NewUserOnboardingWrapper';
import { LogoWatermark } from '@/components/UI/LogoIcon';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <StrategyProvider>
                <AgentProvider>
                    {children}
                    <NewUserOnboardingWrapper />
                    <LogoWatermark position="bottom-right" />
                </AgentProvider>
            </StrategyProvider>
        </AuthProvider>
    );
}
