'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

/**
 * /onboarding — redirect page
 *
 * The unified onboarding wizard now lives as an in-dashboard overlay
 * (NewUserOnboardingWrapper in Providers). This page simply redirects:
 *   - Not signed in → /sign-up
 *   - Already onboarded → /command-center
 *   - Needs onboarding → /command-center (wizard auto-appears there)
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading, userPreferences } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/sign-up');
      return;
    }

    // Always send to command-center — the wizard overlay handles the rest
    router.replace('/command-center');
  }, [user, loading, userPreferences, router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#07070a',
    }}>
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: '#a855f7',
        animation: 'ob-pulse 1.4s ease-in-out infinite',
      }} />
      <style>{`
        @keyframes ob-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
