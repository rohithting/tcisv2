'use client';

import React, { useState } from 'react';

// Disable static generation for this page due to theme context
export const dynamic = 'force-dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { validateEmail } from '@/lib/utils';
import Link from 'next/link';
import { EnvelopeIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import dynamicImport from 'next/dynamic';

// Dynamically import ThemeToggle to avoid SSR issues
const ThemeToggle = dynamicImport(() => import('@/components/ui/ThemeToggle').then(mod => ({ default: mod.ThemeToggle })), {
  ssr: false,
});

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ email?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const { resetPassword } = useAuth();

  const validateForm = (): boolean => {
    const newErrors: { email?: string } = {};

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    const { error } = await resetPassword(email);

    if (error) {
      setErrors({ general: error });
    } else {
      setIsSuccess(true);
    }

    setIsLoading(false);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h1 className="text-2xl brand-heading text-gray-900 dark:text-white mb-4">
            Check your email
          </h1>
          
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            We've sent a password reset link to <strong>{email}</strong>. 
            Please check your inbox and follow the instructions to reset your password.
          </p>
          
          <div className="space-y-3">
            <Link href="/auth/login">
              <Button fullWidth>
                Back to Login
              </Button>
            </Link>
            
            <button
              onClick={() => {
                setIsSuccess(false);
                setEmail('');
                setErrors({});
              }}
              className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Try a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex">
      {/* Left Panel - Forgot Password Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-primary-200 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold text-black ting-text">t</span>
              </div>
            </div>
            
            <h1 className="text-3xl lg:text-4xl brand-heading text-gray-900 dark:text-white mb-2">
              Forgot your password?
            </h1>
            
            <p className="text-gray-600 dark:text-gray-400 text-sm lg:text-base">
              No worries! Enter your email and we'll send you a reset link.
            </p>
          </div>

          {/* Theme Toggle */}
          <div className="flex justify-end">
            <ThemeToggle />
          </div>

          {/* Forgot Password Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.general && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-red-800 dark:text-red-200 text-sm">{errors.general}</p>
              </div>
            )}

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              placeholder="user@ting.in"
              startIcon={<EnvelopeIcon className="h-5 w-5" />}
              helperText="Enter the email address associated with your account"
              fullWidth
              required
            />

            <Button
              type="submit"
              loading={isLoading}
              fullWidth
              className="mt-8"
            >
              Send Reset Link
            </Button>

            <div className="text-center">
              <Link
                href="/auth/login"
                className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Back to login
              </Link>
            </div>
          </form>
        </div>
      </div>

      {/* Right Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-200 items-center justify-center relative overflow-hidden">
        <div className="text-center z-10">
          <h2 className="text-5xl xl:text-6xl brand-heading text-black mb-6">
            Don't worry
          </h2>
          <div className="text-6xl xl:text-7xl brand-heading text-black mb-8">
            we've got you!
          </div>
          <p className="text-xl text-black/80 brand-heading">
            <span className="ting-text">ting</span> is here to help
          </p>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg
            className="w-full h-48 xl:h-64"
            viewBox="0 0 1200 300"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Cloud shapes */}
            <ellipse cx="200" cy="100" rx="80" ry="40" fill="currentColor" opacity="0.3" />
            <ellipse cx="180" cy="90" rx="60" ry="30" fill="currentColor" opacity="0.4" />
            <ellipse cx="220" cy="85" rx="50" ry="25" fill="currentColor" opacity="0.5" />
            
            <ellipse cx="500" cy="80" rx="100" ry="50" fill="currentColor" opacity="0.3" />
            <ellipse cx="480" cy="70" rx="70" ry="35" fill="currentColor" opacity="0.4" />
            <ellipse cx="520" cy="65" rx="60" ry="30" fill="currentColor" opacity="0.5" />
            
            <ellipse cx="900" cy="120" rx="90" ry="45" fill="currentColor" opacity="0.3" />
            <ellipse cx="880" cy="110" rx="65" ry="32" fill="currentColor" opacity="0.4" />
            <ellipse cx="920" cy="105" rx="55" ry="28" fill="currentColor" opacity="0.5" />
            
            {/* Building silhouettes */}
            <rect x="50" y="200" width="60" height="100" fill="currentColor" opacity="0.6" />
            <rect x="130" y="180" width="80" height="120" fill="currentColor" opacity="0.7" />
            <rect x="230" y="220" width="50" height="80" fill="currentColor" opacity="0.6" />
            <rect x="300" y="190" width="70" height="110" fill="currentColor" opacity="0.8" />
            <rect x="390" y="210" width="60" height="90" fill="currentColor" opacity="0.6" />
            <rect x="470" y="170" width="90" height="130" fill="currentColor" opacity="0.7" />
            <rect x="580" y="200" width="55" height="100" fill="currentColor" opacity="0.6" />
            <rect x="660" y="160" width="75" height="140" fill="currentColor" opacity="0.8" />
            <rect x="760" y="190" width="65" height="110" fill="currentColor" opacity="0.7" />
            <rect x="850" y="180" width="80" height="120" fill="currentColor" opacity="0.6" />
            <rect x="950" y="210" width="50" height="90" fill="currentColor" opacity="0.7" />
            <rect x="1020" y="170" width="70" height="130" fill="currentColor" opacity="0.8" />
            <rect x="1110" y="200" width="60" height="100" fill="currentColor" opacity="0.6" />
          </svg>
        </div>
      </div>
    </div>
  );
}
