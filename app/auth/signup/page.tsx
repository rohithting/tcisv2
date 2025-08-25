'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { validateEmail, validatePassword } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EnvelopeIcon, LockClosedIcon, UserIcon } from '@heroicons/react/24/outline';

export default function SignupPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  });
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    fullName?: string;
    general?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  
  const { signUp, user, loading } = useAuth();
  const router = useRouter();

  // Check if signups are enabled (this would come from admin settings)
  const signupsEnabled = process.env.NEXT_PUBLIC_ENABLE_SIGNUPS === 'true';

  // Redirect if already logged in
  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    // Full name validation
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters';
    }

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else {
      const passwordValidation = validatePassword(formData.password);
      if (!passwordValidation.isValid) {
        newErrors.password = passwordValidation.errors[0];
      }
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    const { error } = await signUp(formData.email, formData.password, formData.fullName);

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

  if (!signupsEnabled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-primary-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl font-bold text-black ting-text">t</span>
          </div>
          
          <h1 className="text-2xl brand-heading text-gray-900 dark:text-white mb-4">
            Signups Disabled
          </h1>
          
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            New account registrations are currently disabled. Please contact your administrator for access to{' '}
            <span className="ting-text font-semibold">ting</span> TCIS.
          </p>
          
          <Link href="/auth/login">
            <Button fullWidth>
              Back to Login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex">
      {/* Left Panel - Signup Form */}
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
              Join the <span className="ting-text">ting</span> party
            </h1>
            
            <p className="text-gray-600 dark:text-gray-400 text-sm lg:text-base">
              Create your account to access TCIS insights
            </p>
          </div>

          {/* Theme Toggle */}
          <div className="flex justify-end">
            <ThemeToggle />
          </div>

          {/* Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.general && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-red-800 dark:text-red-200 text-sm">{errors.general}</p>
              </div>
            )}

            <Input
              label="Full Name"
              type="text"
              value={formData.fullName}
              onChange={(e) => handleInputChange('fullName', e.target.value)}
              error={errors.fullName}
              placeholder="John Doe"
              startIcon={<UserIcon className="h-5 w-5" />}
              fullWidth
              required
            />

            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              error={errors.email}
              placeholder="user@ting.in"
              startIcon={<EnvelopeIcon className="h-5 w-5" />}
              fullWidth
              required
            />

            <Input
              label="Password"
              type="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              error={errors.password}
              placeholder="••••••••••••"
              startIcon={<LockClosedIcon className="h-5 w-5" />}
              helperText="Must be at least 8 characters with uppercase, lowercase, and number"
              fullWidth
              required
            />

            <Input
              label="Confirm Password"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              error={errors.confirmPassword}
              placeholder="••••••••••••"
              startIcon={<LockClosedIcon className="h-5 w-5" />}
              fullWidth
              required
            />

            <Button
              type="submit"
              loading={isLoading}
              fullWidth
              className="mt-8"
            >
              Create Account
            </Button>

            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Already have a <span className="ting-text font-semibold">ting</span> pass?{' '}
                <Link
                  href="/auth/login"
                  className="text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* Right Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-200 items-center justify-center relative overflow-hidden">
        <div className="text-center z-10">
          <h2 className="text-5xl xl:text-6xl brand-heading text-black mb-6">
            Welcome to
          </h2>
          <div className="text-7xl xl:text-8xl brand-heading text-black mb-8 ting-text">
            ting
          </div>
          <p className="text-xl text-black/80 brand-heading">
            Chat Insight System
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
            {/* Building silhouettes */}
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
          </svg>
        </div>
      </div>
    </div>
  );
}
