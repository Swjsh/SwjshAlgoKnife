'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /dashboard → /activity-feed redirect.
 * The dashboard has been merged into the Activity Feed.
 * This page exists solely so bookmarks and old links still work.
 */
export default function DashboardRedirect() {
    const router = useRouter();
    useEffect(() => { router.replace('/activity-feed'); }, [router]);
    return null;
}
