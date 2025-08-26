'use client';

import React from 'react';
import { Sidebar } from './Sidebar';
import { TopNavigation } from './TopNavigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PlatformRole } from '@/types/database';

interface DashboardLayoutProps {
  children: React.ReactNode;
  allowedRoles?: PlatformRole[];
  title?: string;
  description?: string;
}

export function DashboardLayout({ 
  children, 
  allowedRoles = [], 
  title,
  description 
}: DashboardLayoutProps) {
  return (
    <ProtectedRoute requireAuth={true} allowedRoles={allowedRoles}>
      <Sidebar>
        {({ onSidebarToggle }) => (
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Top Navigation */}
            <TopNavigation onSidebarToggle={onSidebarToggle} />
            
            {/* Page header */}
            {(title || description) && (
              <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-30 backdrop-blur-sm bg-white/95 dark:bg-gray-900/95">
                <div className="px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
                  <div className="max-w-7xl mx-auto">
                    {title && (
                      <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white brand-heading">
                        {title}
                      </h1>
                    )}
                    {description && (
                      <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-3xl">
                        {description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Page content */}
            <div className="px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
              <div className="max-w-7xl mx-auto">
                {children}
              </div>
            </div>
          </div>
        )}
      </Sidebar>
    </ProtectedRoute>
  );
}

// Convenience wrapper for common page types
export function DashboardPage({ children, ...props }: DashboardLayoutProps) {
  return (
    <DashboardLayout {...props}>
      {children}
    </DashboardLayout>
  );
}

export function AdminPage({ children, ...props }: Omit<DashboardLayoutProps, 'allowedRoles'>) {
  return (
    <DashboardLayout allowedRoles={['super_admin', 'admin']} {...props}>
      {children}
    </DashboardLayout>
  );
}

export function SuperAdminPage({ children, ...props }: Omit<DashboardLayoutProps, 'allowedRoles'>) {
  return (
    <DashboardLayout allowedRoles={['super_admin']} {...props}>
      {children}
    </DashboardLayout>
  );
}

export function BackendPage({ children, ...props }: Omit<DashboardLayoutProps, 'allowedRoles'>) {
  return (
    <DashboardLayout allowedRoles={['super_admin', 'backend']} {...props}>
      {children}
    </DashboardLayout>
  );
}
