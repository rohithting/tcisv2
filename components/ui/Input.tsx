'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export function Input({ 
  label, 
  error, 
  startIcon, 
  endIcon, 
  fullWidth = false,
  className, 
  ...props 
}: InputProps) {
  const inputClasses = cn(
    'w-full px-3 sm:px-4 py-3 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600] transition-all duration-200 text-sm sm:text-base min-h-[44px] touch-target',
    startIcon && 'pl-10 sm:pl-12',
    endIcon && 'pr-10 sm:pr-12',
    error && 'border-red-500 focus:ring-red-500/20 focus:border-red-500',
    fullWidth && 'w-full',
    className
  );

  return (
    <div className={cn('space-y-1', fullWidth && 'w-full')}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      
      <div className="relative">
        {startIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <div className="h-5 w-5 text-gray-400">
              {startIcon}
            </div>
          </div>
        )}
        
        <input 
          className={inputClasses}
          {...props}
        />
        
        {endIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <div className="h-5 w-5 text-gray-400">
              {endIcon}
            </div>
          </div>
        )}
      </div>
      
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
