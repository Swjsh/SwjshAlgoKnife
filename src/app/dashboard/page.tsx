'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function DashboardPage() {
    const router = useRouter();
    const { user, loading } = useAuth();

    useEffect(() => {
        if (!loading && !user) {
            // Not authenticated, redirect to login
            router.replace('/login');
        } else if (!loading && user) {
            // Authenticated, redirect to Squad Terminal (Agents)
            router.replace('/agents');
        }
    }, [router, user, loading]);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0a12',
            color: 'rgba(255,255,255,0.5)'
        }}>
            Redirecting to dashboard...
        </div>
    );
}
