'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /dashboard → /command-center redirect.
 * The dashboard has been merged into the Command Center.
 * This page exists solely so bookmarks and old links still work.
 */
export default function DashboardRedirect() {
    const router = useRouter();
    useEffect(() => { router.replace('/command-center'); }, [router]);
    return null;
}
