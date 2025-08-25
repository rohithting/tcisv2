'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PlatformRole } from '@/types/database';
import { 
  ExclamationTriangleIcon,
  ShieldExclamationIcon 
} from '@heroicons/react/24/outline';

interface RoleGuardProps {
  allowedRoles: PlatformRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireAll?: boolean; // If true, user must have ALL roles, if false, user needs ANY role
  showFallback?: boolean; // Whether to show fallback UI or just hide content
}

export function RoleGuard({
  allowedRoles,
  children,
  fallback,
  requireAll = false,
  showFallback = true
}: RoleGuardProps) {
  const { platformUser, hasRole, hasAnyRole } = useAuth();

  // If no user is loaded yet, show loading state
  if (!platformUser) {
    return showFallback ? (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#ffe600]"></div>
      </div>
    ) : null;
  }

  // Check if user has required roles
  const hasAccess = requireAll
    ? allowedRoles.every(role => hasRole(role))
    : hasAnyRole(allowedRoles);

  if (hasAccess) {
    return <>{children}</>;
  }

  // User doesn't have access
  if (!showFallback) {
    return null;
  }

  // Show custom fallback if provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default fallback UI
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
        <ShieldExclamationIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Access Restricted
      </h3>
      <p className="text-gray-600 dark:text-gray-400 max-w-md">
        You don't have permission to access this content. Contact your administrator if you believe this is an error.
      </p>
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <strong>Your role:</strong> {platformUser.platform_role.replace('_', ' ')}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <strong>Required roles:</strong> {allowedRoles.map(role => role.replace('_', ' ')).join(requireAll ? ' and ' : ' or ')}
        </p>
      </div>
    </div>
  );
}

// Convenience components for common role patterns
export function SuperAdminOnly({ children, ...props }: Omit<RoleGuardProps, 'allowedRoles'>) {
  return (
    <RoleGuard allowedRoles={['super_admin']} {...props}>
      {children}
    </RoleGuard>
  );
}

export function AdminOnly({ children, ...props }: Omit<RoleGuardProps, 'allowedRoles'>) {
  return (
    <RoleGuard allowedRoles={['super_admin', 'admin']} {...props}>
      {children}
    </RoleGuard>
  );
}

export function BackendOnly({ children, ...props }: Omit<RoleGuardProps, 'allowedRoles'>) {
  return (
    <RoleGuard allowedRoles={['super_admin', 'backend']} {...props}>
      {children}
    </RoleGuard>
  );
}

export function ManagerAndAbove({ children, ...props }: Omit<RoleGuardProps, 'allowedRoles'>) {
  return (
    <RoleGuard allowedRoles={['super_admin', 'backend', 'admin', 'manager']} {...props}>
      {children}
    </RoleGuard>
  );
}

// Hook for conditional rendering based on roles
export function useRoleAccess() {
  const { hasRole, hasAnyRole, platformUser } = useAuth();

  return {
    canAccess: (roles: PlatformRole[], requireAll = false) => {
      if (!platformUser) return false;
      return requireAll 
        ? roles.every(role => hasRole(role))
        : hasAnyRole(roles);
    },
    isSuperAdmin: () => hasRole('super_admin'),
    isAdmin: () => hasAnyRole(['super_admin', 'admin']),
    isBackend: () => hasAnyRole(['super_admin', 'backend']),
    isManagerOrAbove: () => hasAnyRole(['super_admin', 'backend', 'admin', 'manager']),
    currentRole: platformUser?.platform_role,
  };
}
