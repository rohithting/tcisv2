'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { EnvelopeIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function VerifyEmailPage() {
  const [isResending, setIsResending] = useState(false);
  const [email, setEmail] = useState('');
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam));
    }
  }, [searchParams]);

  const handleResendVerification = async () => {
    if (!email) {
      toast.error('No email address found');
      return;
    }

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Verification email sent! Please check your inbox.');
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      toast.error('Failed to resend verification email');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
            <EnvelopeIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <ThemeToggle />
        </div>

        <h1 className="text-2xl brand-heading text-gray-900 dark:text-white mb-4">
          Check your email
        </h1>

        <p className="text-gray-600 dark:text-gray-400 mb-6">
          We've sent a verification link to{' '}
          {email && (
            <>
              <br />
              <strong className="text-gray-900 dark:text-white">{email}</strong>
            </>
          )}
        </p>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <p className="text-blue-800 dark:text-blue-200 text-sm">
            <strong>Next steps:</strong>
            <br />
            1. Check your email inbox (and spam folder)
            <br />
            2. Click the verification link
            <br />
            3. You'll be redirected back to <span className="ting-text font-semibold">ting</span> TCIS
          </p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleResendVerification}
            loading={isResending}
            fullWidth
            variant="outline"
          >
            Resend verification email
          </Button>

          <Link href="/auth/login">
            <Button fullWidth variant="ghost">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to login
            </Button>
          </Link>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Didn't receive the email? Check your spam folder or try resending.
            <br />
            For support, contact{' '}
            <a 
              href="mailto:admin@ting.in" 
              className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
            >
              admin@ting.in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
