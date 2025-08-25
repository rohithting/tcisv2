'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PlatformRole } from '@/types/database';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: PlatformRole[];
  requireAuth?: boolean;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({ 
  children, 
  allowedRoles = [], 
  requireAuth = true,
  fallback 
}: ProtectedRouteProps) {
  const { user, platformUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If loading is false and no user, redirect immediately
    if (!loading && requireAuth && !user) {
      console.log('ProtectedRoute: No user, redirecting to login immediately');
      router.push('/auth/login');
      return;
    }

    if (!loading) {
      // If auth is required but user is not logged in
      if (requireAuth && !user) {
        console.log('ProtectedRoute: No user, redirecting to login');
        router.push('/auth/login');
        return;
      }

      // If specific roles are required
      if (allowedRoles.length > 0 && platformUser) {
        if (!allowedRoles.includes(platformUser.platform_role)) {
          console.log('ProtectedRoute: Insufficient permissions, redirecting to unauthorized');
          router.push('/unauthorized');
          return;
        }
      }

      // If user exists but no platform user (database issue)
      if (requireAuth && user && !platformUser) {
        console.log('ProtectedRoute: User exists but no platform user record');
        // Don't redirect immediately, give it time to load
        const timeout = setTimeout(() => {
          if (!platformUser) {
            console.log('ProtectedRoute: Platform user still not loaded, redirecting to login');
            router.push('/auth/login');
          }
        }, 5000); // Wait 5 seconds

        return () => clearTimeout(timeout);
      }
    }
  }, [user, platformUser, loading, requireAuth, allowedRoles, router]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-200 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // If auth required but no user, redirect immediately
  if (requireAuth && !user) {
    console.log('ProtectedRoute: No user after loading, redirecting to login');
    router.push('/auth/login');
    return fallback || null;
  }

  // If roles specified but user doesn't have required role
  if (allowedRoles.length > 0 && platformUser) {
    if (!allowedRoles.includes(platformUser.platform_role)) {
      return fallback || (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Access Denied
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You don't have permission to access this page. 
              Your current role is <span className="font-semibold">{platformUser.platform_role}</span>.
            </p>
            <button
              onClick={() => router.back()}
              className="btn-primary"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}

// HOC version for easier use
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<ProtectedRouteProps, 'children'> = {}
) {
  return function AuthenticatedComponent(props: P) {
    return (
      <ProtectedRoute {...options}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}
