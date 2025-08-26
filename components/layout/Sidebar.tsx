'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/utils';
import {
  HomeIcon,
  ChatBubbleLeftRightIcon,
  BuildingOfficeIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  UserCircleIcon,
  ChevronRightIcon,
  BellIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  ChatBubbleLeftRightIcon as ChatIconSolid,
  BuildingOfficeIcon as BuildingIconSolid,
  Cog6ToothIcon as CogIconSolid,
  ChartBarIcon as ChartIconSolid,
} from '@heroicons/react/24/solid';

interface SidebarProps {
  children: React.ReactNode | ((props: { onSidebarToggle: () => void }) => React.ReactNode);
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconSolid: React.ComponentType<{ className?: string }>;
  roles?: string[];
  badge?: string;
}

const navigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: HomeIcon,
    iconSolid: HomeIconSolid,
  },
  {
    name: 'Chat',
    href: '/chat',
    icon: ChatBubbleLeftRightIcon,
    iconSolid: ChatIconSolid,
    roles: ['super_admin', 'backend', 'admin', 'manager'],
  },
  {
    name: 'Clients',
    href: '/clients',
    icon: BuildingOfficeIcon,
    iconSolid: BuildingIconSolid,
    roles: ['super_admin', 'backend', 'admin'],
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: ChartBarIcon,
    iconSolid: ChartIconSolid,
    roles: ['super_admin', 'backend', 'admin'],
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Cog6ToothIcon,
    iconSolid: CogIconSolid,
    roles: ['super_admin', 'admin'],
  },
];

export function Sidebar({ children }: SidebarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { platformUser, signOut } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [sidebarOpen]);

  // Filter navigation items based on user role
  const filteredNavigation = navigation.filter(item => {
    if (!item.roles || !platformUser) return true;
    return item.roles.includes(platformUser.platform_role);
  });

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div 
            className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
          
          {/* Mobile sidebar */}
          <div className="fixed inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col">
            <div className="flex flex-col h-full bg-white dark:bg-gray-900 shadow-2xl">
              <SidebarContent 
                navigation={filteredNavigation}
                pathname={pathname}
                platformUser={platformUser}
                signOut={signOut}
                isActive={isActive}
                onItemClick={() => setSidebarOpen(false)}
                isMobile={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 shadow-sm">
          <SidebarContent 
            navigation={filteredNavigation}
            pathname={pathname}
            platformUser={platformUser}
            signOut={signOut}
            isActive={isActive}
            isMobile={false}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72 flex flex-col flex-1">
        {/* Page content */}
        <main className="flex-1 min-h-0">
          {typeof children === 'function' ? children({ onSidebarToggle: () => setSidebarOpen(true) }) : children}
        </main>
      </div>
    </div>
  );
}

interface SidebarContentProps {
  navigation: NavItem[];
  pathname: string;
  platformUser: any;
  signOut: () => void;
  isActive: (href: string) => boolean;
  onItemClick?: () => void;
  isMobile: boolean;
}

function SidebarContent({ 
  navigation, 
  pathname, 
  platformUser, 
  signOut, 
  isActive, 
  onItemClick,
  isMobile
}: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center px-4 sm:px-6 py-4 sm:py-6 border-b border-gray-100 dark:border-gray-800">
        <div className="w-10 h-10 bg-gradient-to-br from-[#ffe600] to-[#ffd700] rounded-xl flex items-center justify-center shadow-sm overflow-hidden flex-shrink-0">
          {process.env.NEXT_PUBLIC_PLATFORM_LOGO_URL ? (
            <img 
              src={process.env.NEXT_PUBLIC_PLATFORM_LOGO_URL} 
              alt={process.env.NEXT_PUBLIC_PLATFORM_NAME || 'TCIS'} 
              className="w-full h-full object-contain"
            />
          ) : (
            <span className="text-xl font-bold text-black ting-text">t</span>
          )}
        </div>
        <div className="ml-3 sm:ml-4 min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-bold brand-heading text-gray-900 dark:text-white truncate">
            <span className="ting-text">ting</span> {process.env.NEXT_PUBLIC_PLATFORM_NAME || 'TCIS'}
          </h1>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate">
            Chat Insight System
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 sm:px-4 py-4 sm:py-6 space-y-2 overflow-y-auto min-h-0">
        <div className="space-y-2">
          {navigation.map((item) => {
            const active = isActive(item.href);
            const Icon = active ? item.iconSolid : item.icon;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onItemClick}
                className={cn(
                  'group flex items-center justify-between px-3 sm:px-4 py-3 sm:py-3 text-sm font-medium rounded-xl transition-all duration-200 relative min-h-[44px] touch-target',
                  active
                    ? 'bg-gradient-to-r from-[#ffe600]/10 to-[#ffe600]/5 text-gray-900 dark:text-white shadow-sm border border-[#ffe600]/20'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'
                )}
              >
                <div className="flex items-center min-w-0 flex-1">
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-[#ffe600] to-[#ffd700] rounded-r-full" />
                  )}
                  <Icon className={cn(
                    'mr-3 h-5 w-5 flex-shrink-0 transition-colors duration-200',
                    active 
                      ? 'text-[#ffe600]' 
                      : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'
                  )} />
                  <span className="truncate">{item.name}</span>
                </div>
                
                {item.badge && (
                  <span className="ml-2 px-2 py-1 text-xs font-medium bg-[#ffe600]/20 text-[#ffe600] rounded-full flex-shrink-0">
                    {item.badge}
                  </span>
                )}
                
                {!active && (
                  <ChevronRightIcon className="ml-2 h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors duration-200 flex-shrink-0" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User section */}
      <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-800 p-3 sm:p-4">
        {/* User info */}
        {platformUser && (
          <div className="mb-3 sm:mb-4">
            <div className="flex items-center p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
              <div className="w-10 h-10 bg-gradient-to-br from-[#ffe600] to-[#ffd700] rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                <span className="text-sm font-bold text-black">
                  {(platformUser.full_name || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {platformUser.full_name || 'User'}
                </p>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 capitalize truncate">
                  {platformUser.platform_role.replace('_', ' ')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sign out button */}
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200 border border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700 min-h-[44px] touch-target"
        >
          <ArrowRightOnRectangleIcon className="mr-2 h-5 w-5" />
          <span className="hidden sm:inline">Sign out</span>
          <span className="sm:hidden">Sign out</span>
        </button>
      </div>
    </div>
  );
}