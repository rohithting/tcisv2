'use client';

import React from 'react';

// Disable static generation for this page due to theme context
export const dynamic = 'force-dynamic';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { ExclamationTriangleIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import dynamicImport from 'next/dynamic';

// Dynamically import ThemeToggle to avoid SSR issues
const ThemeToggle = dynamicImport(() => import('@/components/ui/ThemeToggle').then(mod => ({ default: mod.ThemeToggle })), {
  ssr: false,
});

export default function UnauthorizedPage() {
  const { platformUser, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <ThemeToggle />
        </div>

        <h1 className="text-2xl brand-heading text-gray-900 dark:text-white mb-4">
          Access Denied
        </h1>

        <p className="text-gray-600 dark:text-gray-400 mb-6">
          You don't have permission to access the requested page.
          {platformUser && (
            <>
              <br />
              <span className="text-sm mt-2 block">
                Your current role: <span className="font-semibold capitalize">
                  {platformUser.platform_role.replace('_', ' ')}
                </span>
              </span>
            </>
          )}
        </p>

        {platformUser?.platform_role === 'user' && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 dark:text-yellow-200 text-sm">
              <strong>Need access?</strong> Contact your administrator to be assigned to a client 
              and gain access to <span className="ting-text font-semibold">ting</span> TCIS features.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <Link href="/dashboard">
            <Button fullWidth variant="outline">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>

          {platformUser?.platform_role === 'user' && (
            <Button 
              fullWidth 
              variant="secondary"
              onClick={() => window.location.href = 'mailto:admin@ting.in?subject=TCIS Access Request'}
            >
              Contact Administrator
            </Button>
          )}

          <button
            onClick={signOut}
            className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 py-2"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
