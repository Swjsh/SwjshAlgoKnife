'use client';

import { useState } from 'react';
import Link from 'next/link';
import { sendPasswordResetEmail } from '@/lib/firebase-client';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await sendPasswordResetEmail(email);
      setSent(true);
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email address');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address');
      } else {
        setError(err.message || 'Failed to send reset email');
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(222,47%,11%)] p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-cyan-400 mb-2">SwjshAK</h1>
            <p className="text-gray-400">Algorithmic Trading Platform</p>
          </div>

          {/* Success Message */}
          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-700 rounded-xl p-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/50 flex items-center justify-center mb-6">
                <CheckCircle size={32} className="text-green-500" />
              </div>

              <h2 className="text-2xl font-bold text-white mb-4">Check Your Email</h2>

              <p className="text-gray-400 mb-2">
                We've sent a password reset link to:
              </p>
              <p className="text-cyan-400 font-semibold mb-6">{email}</p>

              <p className="text-gray-400 text-sm mb-8">
                Click the link in the email to reset your password. The link will expire in 1 hour.
              </p>

              <Link
                href="/sign-in"
                className="w-full py-3 px-6 rounded-lg font-semibold transition-all
                  bg-cyan-500 text-black hover:bg-cyan-400 text-center inline-block"
              >
                Back to Sign In
              </Link>

              <button
                onClick={() => {
                  setSent(false);
                  setEmail('');
                }}
                className="mt-4 text-sm text-gray-400 hover:text-cyan-400 transition-colors"
              >
                Send to a different email
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(222,47%,11%)] p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-cyan-400 mb-2">SwjshAK</h1>
          <p className="text-gray-400">Algorithmic Trading Platform</p>
        </div>

        {/* Forgot Password Form */}
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-700 rounded-xl p-8">
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-cyan-400 transition-colors mb-6"
          >
            <ArrowLeft size={16} />
            Back to Sign In
          </Link>

          <h2 className="text-2xl font-bold text-white mb-2">Reset Password</h2>
          <p className="text-gray-400 text-sm mb-6">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm text-gray-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500"
                />
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-12 pr-4 py-3
                    text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
                  placeholder="you@example.com"
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
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              Don't have an account?{' '}
              <Link href="/sign-up" className="text-cyan-400 hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
