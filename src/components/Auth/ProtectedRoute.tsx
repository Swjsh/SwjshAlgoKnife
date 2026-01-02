'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

/**
 * ProtectedRoute component that enforces authentication.
 * Redirects to /login if user is not authenticated.
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            // User is not authenticated, redirect to login
            router.push('/login');
        }
    }, [user, loading, router]);

    // Show loading state while checking authentication
    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0a0a12',
                color: 'rgba(255,255,255,0.5)'
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
        );
    }

    // If not authenticated, don't render children (will redirect)
    if (!user) {
        return null;
    }

    // User is authenticated, render the protected content
    return <>{children}</>;
}
