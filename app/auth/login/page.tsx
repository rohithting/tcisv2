'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { validateEmail } from '@/lib/utils';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { EnvelopeIcon, LockClosedIcon } from '@heroicons/react/24/outline';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  
  const { signIn, user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Redirect if already logged in
  useEffect(() => {
    if (user && !loading) {
      const redirectTo = searchParams.get('redirectTo') || '/dashboard';
      router.push(redirectTo);
    }
  }, [user, loading, router, searchParams]);

  // Show error messages from URL params (e.g., from middleware)
  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      switch (error) {
        case 'session_invalid':
          setErrors({ general: 'Your session was invalid and has been cleared. Please sign in again.' });
          break;
        case 'validation_failed':
          setErrors({ general: 'Session validation failed. Please sign in again.' });
          break;
        default:
          setErrors({ general: decodeURIComponent(error) });
      }
      
      // Clean up the URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('error');
      window.history.replaceState({}, '', newUrl.pathname + newUrl.search);
    }
  }, [searchParams]);

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    const { error } = await signIn(email, password);

    if (error) {
      setErrors({ general: error });
    }

    setIsLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-200"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex">
      {/* Left Panel - Login Form */}
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
              Login to your account
            </h1>
            
            <p className="text-gray-600 dark:text-gray-400 text-sm lg:text-base">
              This is a <span className="ting-text font-semibold">ting</span>.in only party.
            </p>
          </div>

          {/* Theme Toggle */}
          <div className="flex justify-end">
            <ThemeToggle />
          </div>

          {/* Login Form */}
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
              fullWidth
              required
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</span>
                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
                >
                  Forgot your password?
                </Link>
              </div>
              
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                placeholder="••••••••••••"
                startIcon={<LockClosedIcon className="h-5 w-5" />}
                fullWidth
                required
              />
            </div>

            <Button
              type="submit"
              loading={isLoading}
              fullWidth
              className="mt-8"
            >
              Login
            </Button>

            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Don't have the <span className="ting-text font-semibold">ting</span> pass yet?{' '}
                <Link
                  href="/auth/signup"
                  className="text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* Right Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-200 items-center justify-center relative overflow-hidden">
        <div className="text-center z-10">
          <h2 className="text-6xl xl:text-7xl brand-heading text-black mb-8">
            Ready to
          </h2>
          <div className="text-8xl xl:text-9xl brand-heading text-black mb-12 ting-text">
            ting?
          </div>
        </div>
        
        {/* Decorative cityscape */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg
            className="w-full h-48 xl:h-64"
            viewBox="0 0 1200 300"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Simple building silhouettes */}
            <rect x="50" y="150" width="80" height="150" fill="currentColor" opacity="0.8" />
            <rect x="150" y="100" width="60" height="200" fill="currentColor" opacity="0.9" />
            <rect x="230" y="120" width="90" height="180" fill="currentColor" opacity="0.7" />
            <rect x="340" y="80" width="70" height="220" fill="currentColor" opacity="0.8" />
            <rect x="430" y="140" width="100" height="160" fill="currentColor" opacity="0.9" />
            <rect x="550" y="90" width="80" height="210" fill="currentColor" opacity="0.8" />
            <rect x="650" y="110" width="60" height="190" fill="currentColor" opacity="0.7" />
            <rect x="730" y="70" width="90" height="230" fill="currentColor" opacity="0.9" />
            <rect x="840" y="130" width="70" height="170" fill="currentColor" opacity="0.8" />
            <rect x="930" y="100" width="80" height="200" fill="currentColor" opacity="0.7" />
            <rect x="1030" y="140" width="60" height="160" fill="currentColor" opacity="0.9" />
            <rect x="1110" y="120" width="90" height="180" fill="currentColor" opacity="0.8" />
            
            {/* Windows */}
            {[...Array(12)].map((_, i) => (
              <g key={i}>
                <rect x={70 + i * 90} y={170 + Math.random() * 50} width="8" height="12" fill="rgba(0,0,0,0.3)" />
                <rect x={85 + i * 90} y={160 + Math.random() * 60} width="8" height="12" fill="rgba(0,0,0,0.3)" />
                <rect x={70 + i * 90} y={200 + Math.random() * 40} width="8" height="12" fill="rgba(0,0,0,0.3)" />
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
