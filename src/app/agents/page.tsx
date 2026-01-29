'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect to the consolidated dashboard
export default function AgentsRedirect() {
    const router = useRouter();
    
    useEffect(() => {
        router.replace('/dashboard');
    }, [router]);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0a12',
            color: 'rgba(255,255,255,0.5)'
        }}>
            Redirecting...
        </div>
    );
}
