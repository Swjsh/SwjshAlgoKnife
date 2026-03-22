'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ADMIN_EMAILS } from '@/lib/adminEmails';
import Link from 'next/link';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user || !ADMIN_EMAILS.includes(user.email || '')) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h1>Not Authorized</h1>
        <p>You do not have permission to access this area.</p>
        <p>Admin access is restricted to: {ADMIN_EMAILS.join(', ')}</p>
        <p>Your email: {user?.email || 'Not logged in'}</p>
        <Link href="/" style={{ marginTop: '20px', display: 'inline-block', color: '#06b6d4' }}>
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
