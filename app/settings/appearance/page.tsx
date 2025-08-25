'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { 
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  PaintBrushIcon,
  EyeIcon,
  SwatchIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system';
  compact_mode: boolean;
  reduced_motion: boolean;
  high_contrast: boolean;
  font_size: 'small' | 'medium' | 'large';
  sidebar_collapsed: boolean;
}

export default function AppearancePage() {
  const [mounted, setMounted] = useState(false);
  const { supabase, platformUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AppearanceSettings>({
    theme: 'system',
    compact_mode: false,
    reduced_motion: false,
    high_contrast: false,
    font_size: 'medium',
    sidebar_collapsed: false
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load user appearance preferences
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    try {
      setLoading(true);
      
      // Load settings from localStorage
      const savedSettings = localStorage.getItem('appearance_settings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(prev => ({
          ...prev,
          ...parsedSettings
        }));
      }
    } catch (error) {
      console.error('Error loading appearance settings:', error);
      toast.error('Failed to load appearance settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key: keyof AppearanceSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    
    // Apply theme change immediately to localStorage and document
    if (key === 'theme' && mounted) {
      localStorage.setItem('theme', value);
      
      if (typeof window !== 'undefined') {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        
        if (value === 'system') {
          const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          root.classList.add(systemIsDark ? 'dark' : 'light');
        } else {
          root.classList.add(value);
        }
      }
    }
  };

  const handleSave = () => {
    try {
      setSaving(true);

      // Save settings to localStorage
      localStorage.setItem('appearance_settings', JSON.stringify(settings));

      toast.success('Appearance settings saved successfully');
    } catch (error) {
      console.error('Error saving appearance settings:', error);
      toast.error('Failed to save appearance settings');
    } finally {
      setSaving(false);
    }
  };

  const themeOptions = [
    {
      value: 'light',
      label: 'Light',
      description: 'Clean and bright interface',
      icon: SunIcon
    },
    {
      value: 'dark',
      label: 'Dark',
      description: 'Easy on the eyes in low light',
      icon: MoonIcon
    },
    {
      value: 'system',
      label: 'System',
      description: 'Follow your system preference',
      icon: ComputerDesktopIcon
    }
  ];

  const fontSizeOptions = [
    { value: 'small', label: 'Small', description: 'Compact text size' },
    { value: 'medium', label: 'Medium', description: 'Standard text size' },
    { value: 'large', label: 'Large', description: 'Larger text for better readability' }
  ];

  if (!mounted || loading) {
    return (
      <DashboardLayout title="Appearance Settings" allowedRoles={[]}>
        <div className="animate-pulse space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Appearance Settings"
      description="Customize the look and feel of your workspace"
      allowedRoles={[]}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Theme Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <PaintBrushIcon className="h-5 w-5 mr-2" />
              Theme
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Choose your preferred color scheme
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = settings.theme === option.value;
                
                return (
                  <button
                    key={option.value}
                    onClick={() => handleSettingChange('theme', option.value)}
                    className={cn(
                      'flex flex-col items-center p-4 rounded-lg border-2 transition-all',
                      isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    )}
                  >
                    <Icon className={cn(
                      'h-8 w-8 mb-2',
                      isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'
                    )} />
                    <h4 className={cn(
                      'font-medium',
                      isSelected ? 'text-primary-900 dark:text-primary-100' : 'text-gray-900 dark:text-gray-100'
                    )}>
                      {option.label}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center mt-1">
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Display Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <EyeIcon className="h-5 w-5 mr-2" />
              Display
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Adjust display preferences for better readability
            </p>
          </div>
          <div className="p-6 space-y-6">
            {/* Font Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Font Size
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {fontSizeOptions.map((option) => {
                  const isSelected = settings.font_size === option.value;
                  
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleSettingChange('font_size', option.value)}
                      className={cn(
                        'p-3 rounded-lg border text-left transition-all',
                        isSelected
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      )}
                    >
                      <div className={cn(
                        'font-medium',
                        isSelected ? 'text-primary-900 dark:text-primary-100' : 'text-gray-900 dark:text-gray-100'
                      )}>
                        {option.label}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {option.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toggle Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    Compact Mode
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Reduce spacing and padding for a more compact interface
                  </p>
                </div>
                <button
                  onClick={() => handleSettingChange('compact_mode', !settings.compact_mode)}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    settings.compact_mode ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      settings.compact_mode ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    High Contrast
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Increase contrast for better visibility
                  </p>
                </div>
                <button
                  onClick={() => handleSettingChange('high_contrast', !settings.high_contrast)}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    settings.high_contrast ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      settings.high_contrast ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    Reduced Motion
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Minimize animations and transitions
                  </p>
                </div>
                <button
                  onClick={() => handleSettingChange('reduced_motion', !settings.reduced_motion)}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    settings.reduced_motion ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      settings.reduced_motion ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    Collapsed Sidebar
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Keep sidebar collapsed by default
                  </p>
                </div>
                <button
                  onClick={() => handleSettingChange('sidebar_collapsed', !settings.sidebar_collapsed)}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    settings.sidebar_collapsed ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      settings.sidebar_collapsed ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Custom Colors */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <SwatchIcon className="h-5 w-5 mr-2" />
              Brand Colors
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Current brand colors are set via environment variables
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div 
                  className="w-16 h-16 rounded-lg mx-auto mb-2 border border-gray-200 dark:border-gray-700"
                  style={{ backgroundColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR || '#ffe600' }}
                ></div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Primary</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {process.env.NEXT_PUBLIC_PRIMARY_COLOR || '#ffe600'}
                </p>
              </div>
              <div className="text-center">
                <div 
                  className="w-16 h-16 rounded-lg mx-auto mb-2 border border-gray-200 dark:border-gray-700"
                  style={{ backgroundColor: process.env.NEXT_PUBLIC_SECONDARY_COLOR || '#000000' }}
                ></div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Secondary</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {process.env.NEXT_PUBLIC_SECONDARY_COLOR || '#000000'}
                </p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <Cog6ToothIcon className="h-4 w-4 inline mr-1" />
                Brand colors are configured via environment variables and require a deployment to change.
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            loading={saving}
            className="px-6"
          >
            Save Appearance Settings
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
