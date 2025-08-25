'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/utils';
import {
  BellIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
  XMarkIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';

interface TopNavigationProps {
  className?: string;
  onSidebarToggle?: () => void;
}

export function TopNavigation({ className, onSidebarToggle }: TopNavigationProps) {
  const { platformUser, signOut } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications] = useState([
    {
      id: 1,
      title: 'Upload Complete',
      message: 'File processing completed successfully',
      time: '2 minutes ago',
      type: 'success' as const,
      read: false,
    },
    {
      id: 2,
      title: 'New Client Added',
      message: 'Acme Corporation has been added to the platform',
      time: '1 hour ago',
      type: 'info' as const,
      read: false,
    },
    {
      id: 3,
      title: 'Processing Started',
      message: 'Chat analysis job has started processing',
      time: '3 hours ago',
      type: 'warning' as const,
      read: true,
    },
  ]);

  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: 'success' | 'info' | 'warning' | 'error') => {
    const baseClasses = 'h-4 w-4';
    switch (type) {
      case 'success':
        return <div className={cn(baseClasses, 'bg-green-500 rounded-full')} />;
      case 'info':
        return <div className={cn(baseClasses, 'bg-blue-500 rounded-full')} />;
      case 'warning':
        return <div className={cn(baseClasses, 'bg-yellow-500 rounded-full')} />;
      case 'error':
        return <div className={cn(baseClasses, 'bg-red-500 rounded-full')} />;
      default:
        return <div className={cn(baseClasses, 'bg-gray-500 rounded-full')} />;
    }
  };

  return (
    <div className={cn(
      'bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 backdrop-blur-sm bg-white/95 dark:bg-gray-900/95',
      className
    )}>
      <div className="px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Logo and hamburger for mobile */}
          <div className="lg:hidden flex items-center">
            {/* Hamburger icon */}
            {onSidebarToggle && (
              <button
                type="button"
                className="p-2 rounded-xl text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 mr-3"
                onClick={onSidebarToggle}
                aria-label="Toggle sidebar"
              >
                <Bars3Icon className="h-5 w-5" />
              </button>
            )}
            
            <div className="w-8 h-8 bg-gradient-to-br from-[#ffe600] to-[#ffd700] rounded-xl flex items-center justify-center shadow-sm overflow-hidden">
              {process.env.NEXT_PUBLIC_PLATFORM_LOGO_URL ? (
                <img 
                  src={process.env.NEXT_PUBLIC_PLATFORM_LOGO_URL} 
                  alt={process.env.NEXT_PUBLIC_PLATFORM_NAME || 'TCIS'} 
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-lg font-bold text-black ting-text">t</span>
              )}
            </div>
            <div className="ml-3">
              <h1 className="text-lg font-bold brand-heading text-gray-900 dark:text-white">
                <span className="ting-text">ting</span> {process.env.NEXT_PUBLIC_PLATFORM_NAME || 'TCIS'}
              </h1>
            </div>
          </div>

          {/* Right side - Actions - positioned to the right on desktop */}
          <div className="flex items-center space-x-2 sm:space-x-4 lg:ml-auto">
            {/* Notifications */}
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-xl text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
                aria-label="Notifications"
              >
                <BellIcon className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications dropdown */}
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Notifications
                      </h3>
                      <button
                        onClick={() => setNotificationsOpen(false)}
                        className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        No notifications
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={cn(
                            'px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-200 cursor-pointer',
                            !notification.read && 'bg-blue-50 dark:bg-blue-900/20'
                          )}
                        >
                          <div className="flex items-start space-x-3">
                            {getNotificationIcon(notification.type)}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {notification.title}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                {notification.time}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {notifications.length > 0 && (
                    <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
                      <button className="w-full text-sm text-center text-[#ffe600] hover:text-[#ffd700] font-medium">
                        View all notifications
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Profile */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center space-x-2 p-2 rounded-xl text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
                aria-label="User menu"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-[#ffe600] to-[#ffd700] rounded-xl flex items-center justify-center shadow-sm">
                  <span className="text-sm font-bold text-black">
                    {(platformUser?.full_name || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {platformUser?.full_name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                    {platformUser?.platform_role?.replace('_', ' ') || 'user'}
                  </p>
                </div>
                <ChevronDownIcon className="hidden sm:block h-4 w-4 text-gray-400" />
              </button>

              {/* Profile dropdown */}
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#ffe600] to-[#ffd700] rounded-xl flex items-center justify-center shadow-sm">
                        <span className="text-sm font-bold text-black">
                          {(platformUser?.full_name || 'U').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {platformUser?.full_name || 'User'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize truncate">
                          {platformUser?.platform_role?.replace('_', ' ') || 'user'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="py-1">
                    <button className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200">
                      <UserCircleIcon className="mr-3 h-4 w-4" />
                      Profile
                    </button>
                    <button className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200">
                      <Cog6ToothIcon className="mr-3 h-4 w-4" />
                      Settings
                    </button>
                  </div>
                  
                  <div className="border-t border-gray-200 dark:border-gray-800 py-1">
                    <button
                      onClick={signOut}
                      className="w-full flex items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200"
                    >
                      <ArrowRightOnRectangleIcon className="mr-3 h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
