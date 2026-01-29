'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect to the consolidated dashboard
export default function BreakRoomRedirect() {
    const router = useRouter();
    
    useEffect(() => {
        router.replace('/dashboard');
    }, [router]);

    return null;
}
