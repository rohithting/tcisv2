'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { validatePassword } from '@/lib/utils';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LockClosedIcon } from '@heroicons/react/24/outline';

export default function ResetPasswordPage() {
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<{
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  
  const { updatePassword } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check if we have the required tokens from the URL
  useEffect(() => {
    const handlePasswordReset = async () => {
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');
      const type = searchParams.get('type');
      
      if (type !== 'recovery') {
        router.push('/auth/forgot-password');
        return;
      }

      if (!accessToken || !refreshToken) {
        router.push('/auth/forgot-password');
        return;
      }

      // Set the session with the tokens from the URL
      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        console.error('Error setting session:', error);
        router.push('/auth/forgot-password');
      }
    };

    handlePasswordReset();
  }, [searchParams, router]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

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

    const { error } = await updatePassword(formData.password);

    if (error) {
      setErrors({ general: error });
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex">
      {/* Left Panel - Reset Password Form */}
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
              Set new password
            </h1>
            
            <p className="text-gray-600 dark:text-gray-400 text-sm lg:text-base">
              Choose a strong password to secure your <span className="ting-text font-semibold">ting</span> account.
            </p>
          </div>

          {/* Theme Toggle */}
          <div className="flex justify-end">
            <ThemeToggle />
          </div>

          {/* Reset Password Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.general && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-red-800 dark:text-red-200 text-sm">{errors.general}</p>
              </div>
            )}

            <Input
              label="New Password"
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
              label="Confirm New Password"
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
              Update Password
            </Button>

            <div className="text-center">
              <Link
                href="/auth/login"
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
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
            Almost there!
          </h2>
          <div className="text-6xl xl:text-7xl brand-heading text-black mb-8">
            🔐
          </div>
          <p className="text-xl text-black/80 brand-heading">
            Secure your <span className="ting-text">ting</span> account
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
            {/* Shield/security themed decorations */}
            <path 
              d="M200 150 L200 250 L280 220 L280 180 Z" 
              fill="currentColor" 
              opacity="0.6"
            />
            <path 
              d="M500 140 L500 260 L600 230 L600 170 Z" 
              fill="currentColor" 
              opacity="0.7"
            />
            <path 
              d="M800 160 L800 240 L880 210 L880 190 Z" 
              fill="currentColor" 
              opacity="0.6"
            />
            
            {/* Building silhouettes */}
            <rect x="50" y="200" width="60" height="100" fill="currentColor" opacity="0.5" />
            <rect x="130" y="180" width="80" height="120" fill="currentColor" opacity="0.6" />
            <rect x="330" y="190" width="70" height="110" fill="currentColor" opacity="0.7" />
            <rect x="420" y="210" width="60" height="90" fill="currentColor" opacity="0.5" />
            <rect x="660" y="160" width="75" height="140" fill="currentColor" opacity="0.8" />
            <rect x="760" y="190" width="65" height="110" fill="currentColor" opacity="0.6" />
            <rect x="950" y="170" width="80" height="130" fill="currentColor" opacity="0.7" />
            <rect x="1050" y="200" width="60" height="100" fill="currentColor" opacity="0.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}
