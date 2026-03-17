'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { verifyResetCode, confirmPasswordReset } from '@/lib/firebase-client';
import { Lock, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [invalidCode, setInvalidCode] = useState(false);

  useEffect(() => {
    const code = searchParams.get('oobCode');

    if (!code) {
      setInvalidCode(true);
      setVerifying(false);
      return;
    }

    setOobCode(code);

    // Verify the reset code
    const verify = async () => {
      try {
        const emailFromCode = await verifyResetCode(code);
        setEmail(emailFromCode);
        setVerifying(false);
      } catch (err: any) {
        console.error('Code verification error:', err);
        setInvalidCode(true);
        setVerifying(false);
      }
    };

    verify();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!oobCode) {
      setError('Invalid or missing reset code');
      return;
    }

    setLoading(true);

    try {
      await confirmPasswordReset(oobCode, newPassword);
      setSuccess(true);

      // Redirect to sign-in after 3 seconds
      setTimeout(() => {
        router.push('/sign-in');
      }, 3000);
    } catch (err: any) {
      console.error('Password reset error:', err);

      if (err.code === 'auth/expired-action-code') {
        setError('This reset link has expired. Please request a new one.');
      } else if (err.code === 'auth/invalid-action-code') {
        setError('This reset link is invalid or has already been used.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please choose a stronger password.');
      } else {
        setError(err.message || 'Failed to reset password');
      }
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(222,47%,11%)] p-4">
        <div className="w-full max-w-md">
          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-700 rounded-xl p-8">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-400">Verifying reset link...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (invalidCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(222,47%,11%)] p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-cyan-400 mb-2">SwjshAK</h1>
            <p className="text-gray-400">Algorithmic Trading Platform</p>
          </div>

          <div className="bg-gray-900/50 backdrop-blur-xl border border-red-500/50 rounded-xl p-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/50 flex items-center justify-center mb-6">
                <AlertCircle size={32} className="text-red-500" />
              </div>

              <h2 className="text-2xl font-bold text-white mb-4">Invalid Reset Link</h2>

              <p className="text-gray-400 mb-8">
                This password reset link is invalid or has expired. Please request a new password reset.
              </p>

              <Link
                href="/forgot-password"
                className="w-full py-3 px-6 rounded-lg font-semibold transition-all
                  bg-cyan-500 text-black hover:bg-cyan-400 text-center inline-block mb-4"
              >
                Request New Reset Link
              </Link>

              <Link
                href="/sign-in"
                className="text-sm text-gray-400 hover:text-cyan-400 transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(222,47%,11%)] p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-cyan-400 mb-2">SwjshAK</h1>
            <p className="text-gray-400">Algorithmic Trading Platform</p>
          </div>

          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-700 rounded-xl p-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/50 flex items-center justify-center mb-6">
                <CheckCircle size={32} className="text-green-500" />
              </div>

              <h2 className="text-2xl font-bold text-white mb-4">Password Reset Successful</h2>

              <p className="text-gray-400 mb-8">
                Your password has been reset successfully. You can now sign in with your new password.
              </p>

              <p className="text-sm text-gray-500">
                Redirecting to sign in...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(222,47%,11%)] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-cyan-400 mb-2">SwjshAK</h1>
          <p className="text-gray-400">Algorithmic Trading Platform</p>
        </div>

        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-700 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-2">Create New Password</h2>
          <p className="text-gray-400 text-sm mb-6">
            Resetting password for: <span className="text-cyan-400 font-semibold">{email}</span>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="block text-sm text-gray-300 mb-2">
                New Password
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-12 pr-12 py-3
                    text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">At least 6 characters</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm text-gray-300 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-12 pr-4 py-3
                    text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
                  placeholder="Confirm new password"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 rounded-lg font-semibold transition-all
                bg-cyan-500 text-black hover:bg-cyan-400
                disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/sign-in" className="text-sm text-gray-400 hover:text-cyan-400 transition-colors">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[hsl(222,47%,11%)] p-4">
        <div className="w-full max-w-md">
          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-700 rounded-xl p-8">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-400">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
