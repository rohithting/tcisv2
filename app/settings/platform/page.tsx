'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { 
  Cog6ToothIcon,
  ServerIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  XMarkIcon,
  GlobeAltIcon,
  SwatchIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

interface PlatformSettings {
  // Registration & Access
  allow_signups: boolean;
  require_email_verification: boolean;
  default_user_role: 'user' | 'manager';
  
  // System Settings
  session_timeout_minutes: number;
  max_file_size_mb: number;
  max_concurrent_jobs: number;
  
  // Security
  password_min_length: number;
  password_require_uppercase: boolean;
  password_require_lowercase: boolean;
  password_require_numbers: boolean;
  password_require_symbols: boolean;
  max_login_attempts: number;
  lockout_duration_minutes: number;
  
  // Features
  enable_chat_export: boolean;
  enable_job_scheduling: boolean;
  enable_api_access: boolean;
  enable_webhooks: boolean;
  
  // Branding
  platform_name: string;
  platform_description: string;
  support_email: string;
  terms_url: string;
  privacy_url: string;
  
  // Maintenance
  maintenance_mode: boolean;
  maintenance_message: string;
}

export default function PlatformPage() {
  const { supabase, platformUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PlatformSettings>({
    allow_signups: false,
    require_email_verification: true,
    default_user_role: 'user',
    
    session_timeout_minutes: 30,
    max_file_size_mb: 50,
    max_concurrent_jobs: 10,
    
    password_min_length: 8,
    password_require_uppercase: true,
    password_require_lowercase: true,
    password_require_numbers: true,
    password_require_symbols: false,
    max_login_attempts: 5,
    lockout_duration_minutes: 15,
    
    enable_chat_export: true,
    enable_job_scheduling: true,
    enable_api_access: true,
    enable_webhooks: false,
    
    platform_name: process.env.NEXT_PUBLIC_PLATFORM_NAME || 'TCIS',
    platform_description: 'Ting Chat Insight System - Derive actionable insights from chat exports',
    support_email: 'support@ting.in',
    terms_url: '',
    privacy_url: '',
    
    maintenance_mode: false,
    maintenance_message: 'We are performing scheduled maintenance. Please check back soon.'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadPlatformSettings();
  }, []);

  const loadPlatformSettings = () => {
    try {
      setLoading(true);
      
      // Load platform settings from localStorage
      const savedSettings = localStorage.getItem('platform_settings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(prev => ({
          ...prev,
          ...parsedSettings
        }));
      }
    } catch (error) {
      console.error('Error loading platform settings:', error);
      toast.error('Failed to load platform settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key: keyof PlatformSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    // Clear any validation errors
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: '' }));
    }
  };

  const validateSettings = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!settings.platform_name.trim()) {
      newErrors.platform_name = 'Platform name is required';
    }

    if (!settings.support_email.trim()) {
      newErrors.support_email = 'Support email is required';
    } else if (!settings.support_email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      newErrors.support_email = 'Please enter a valid email address';
    }

    if (settings.password_min_length < 4 || settings.password_min_length > 128) {
      newErrors.password_min_length = 'Password length must be between 4 and 128 characters';
    }

    if (settings.session_timeout_minutes < 5 || settings.session_timeout_minutes > 1440) {
      newErrors.session_timeout_minutes = 'Session timeout must be between 5 and 1440 minutes';
    }

    if (settings.max_file_size_mb < 1 || settings.max_file_size_mb > 1000) {
      newErrors.max_file_size_mb = 'File size limit must be between 1 and 1000 MB';
    }

    if (settings.max_concurrent_jobs < 1 || settings.max_concurrent_jobs > 100) {
      newErrors.max_concurrent_jobs = 'Concurrent jobs must be between 1 and 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateSettings()) return;

    try {
      setSaving(true);

      // Save settings to localStorage
      localStorage.setItem('platform_settings', JSON.stringify(settings));

      toast.success('Platform settings saved successfully');
    } catch (error) {
      console.error('Error saving platform settings:', error);
      toast.error('Failed to save platform settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Platform Settings" allowedRoles={['super_admin']}>
        <div className="animate-pulse space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Platform Settings"
      description="Configure system-wide platform settings and preferences"
      allowedRoles={['super_admin']}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Maintenance Mode Warning */}
        {settings.maintenance_mode && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" />
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Maintenance Mode Active
              </h3>
            </div>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              The platform is currently in maintenance mode. Regular users cannot access the system.
            </p>
          </div>
        )}

        {/* Registration & Access */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <UserPlusIcon className="h-5 w-5 mr-2" />
              Registration & Access
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Control user registration and access to the platform
            </p>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                  Allow New Signups
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Let new users create accounts on the platform
                </p>
              </div>
              <button
                onClick={() => handleSettingChange('allow_signups', !settings.allow_signups)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  settings.allow_signups ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    settings.allow_signups ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                  Require Email Verification
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  New users must verify their email before accessing the platform
                </p>
              </div>
              <button
                onClick={() => handleSettingChange('require_email_verification', !settings.require_email_verification)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  settings.require_email_verification ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    settings.require_email_verification ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default User Role
              </label>
              <select
                value={settings.default_user_role}
                onChange={(e) => handleSettingChange('default_user_role', e.target.value)}
                className="w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="user">User</option>
                <option value="manager">Manager</option>
              </select>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Role assigned to new users upon registration
              </p>
            </div>
          </div>
        </div>

        {/* System Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <ServerIcon className="h-5 w-5 mr-2" />
              System Settings
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Configure system limits and performance settings
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Session Timeout (minutes)"
                type="number"
                value={settings.session_timeout_minutes.toString()}
                onChange={(e) => handleSettingChange('session_timeout_minutes', parseInt(e.target.value) || 0)}
                error={errors.session_timeout_minutes}
                placeholder="30"
                startIcon={<ClockIcon className="h-5 w-5" />}
                helperText="Automatically log out users after this period of inactivity"
                min={5}
                max={1440}
              />

              <Input
                label="Max File Size (MB)"
                type="number"
                value={settings.max_file_size_mb.toString()}
                onChange={(e) => handleSettingChange('max_file_size_mb', parseInt(e.target.value) || 0)}
                error={errors.max_file_size_mb}
                placeholder="50"
                startIcon={<DocumentTextIcon className="h-5 w-5" />}
                helperText="Maximum file size for uploads"
                min={1}
                max={1000}
              />

              <Input
                label="Max Concurrent Jobs"
                type="number"
                value={settings.max_concurrent_jobs.toString()}
                onChange={(e) => handleSettingChange('max_concurrent_jobs', parseInt(e.target.value) || 0)}
                error={errors.max_concurrent_jobs}
                placeholder="10"
                startIcon={<Cog6ToothIcon className="h-5 w-5" />}
                helperText="Maximum number of jobs that can run simultaneously"
                min={1}
                max={100}
              />
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <ShieldCheckIcon className="h-5 w-5 mr-2" />
              Security Settings
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Configure password requirements and security policies
            </p>
          </div>
          <div className="p-6 space-y-6">
            <Input
              label="Password Minimum Length"
              type="number"
              value={settings.password_min_length.toString()}
              onChange={(e) => handleSettingChange('password_min_length', parseInt(e.target.value) || 0)}
              error={errors.password_min_length}
              placeholder="8"
              min={4}
              max={128}
              helperText="Minimum number of characters required for passwords"
            />

            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">
                Password Requirements
              </h4>
              <div className="space-y-3">
                {[
                  { key: 'password_require_uppercase', label: 'Require uppercase letters (A-Z)' },
                  { key: 'password_require_lowercase', label: 'Require lowercase letters (a-z)' },
                  { key: 'password_require_numbers', label: 'Require numbers (0-9)' },
                  { key: 'password_require_symbols', label: 'Require symbols (!@#$%^&*)' }
                ].map((requirement) => (
                  <div key={requirement.key} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {requirement.label}
                    </span>
                    <button
                      onClick={() => handleSettingChange(requirement.key as keyof PlatformSettings, !settings[requirement.key as keyof PlatformSettings])}
                      className={cn(
                        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                        settings[requirement.key as keyof PlatformSettings] ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
                          settings[requirement.key as keyof PlatformSettings] ? 'translate-x-5' : 'translate-x-1'
                        )}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Max Login Attempts"
                type="number"
                value={settings.max_login_attempts.toString()}
                onChange={(e) => handleSettingChange('max_login_attempts', parseInt(e.target.value) || 0)}
                placeholder="5"
                min={1}
                max={20}
                helperText="Lock account after this many failed attempts"
              />

              <Input
                label="Lockout Duration (minutes)"
                type="number"
                value={settings.lockout_duration_minutes.toString()}
                onChange={(e) => handleSettingChange('lockout_duration_minutes', parseInt(e.target.value) || 0)}
                placeholder="15"
                min={1}
                max={1440}
                helperText="How long to lock account after max attempts"
              />
            </div>
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Cog6ToothIcon className="h-5 w-5 mr-2" />
              Feature Toggles
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Enable or disable platform features
            </p>
          </div>
          <div className="p-6 space-y-4">
            {[
              { key: 'enable_chat_export', label: 'Chat Export', description: 'Allow users to upload and analyze chat exports' },
              { key: 'enable_job_scheduling', label: 'Job Scheduling', description: 'Enable background job processing system' },
              { key: 'enable_api_access', label: 'API Access', description: 'Allow programmatic access via REST API' },
              { key: 'enable_webhooks', label: 'Webhooks', description: 'Send notifications to external services' }
            ].map((feature) => (
              <div key={feature.key} className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    {feature.label}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {feature.description}
                  </p>
                </div>
                <button
                  onClick={() => handleSettingChange(feature.key as keyof PlatformSettings, !settings[feature.key as keyof PlatformSettings])}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    settings[feature.key as keyof PlatformSettings] ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      settings[feature.key as keyof PlatformSettings] ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Branding */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <SwatchIcon className="h-5 w-5 mr-2" />
              Branding
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Customize platform branding and information
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Platform Name"
                type="text"
                value={settings.platform_name}
                onChange={(e) => handleSettingChange('platform_name', e.target.value)}
                error={errors.platform_name}
                placeholder="TCIS"
                required
              />

              <Input
                label="Support Email"
                type="email"
                value={settings.support_email}
                onChange={(e) => handleSettingChange('support_email', e.target.value)}
                error={errors.support_email}
                placeholder="support@ting.in"
                required
              />

              <Input
                label="Terms of Service URL"
                type="url"
                value={settings.terms_url}
                onChange={(e) => handleSettingChange('terms_url', e.target.value)}
                placeholder="https://ting.in/terms"
                startIcon={<GlobeAltIcon className="h-5 w-5" />}
              />

              <Input
                label="Privacy Policy URL"
                type="url"
                value={settings.privacy_url}
                onChange={(e) => handleSettingChange('privacy_url', e.target.value)}
                placeholder="https://ting.in/privacy"
                startIcon={<GlobeAltIcon className="h-5 w-5" />}
              />

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Platform Description
                </label>
                <textarea
                  value={settings.platform_description}
                  onChange={(e) => handleSettingChange('platform_description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="Describe your platform..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Maintenance Mode */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
              Maintenance Mode
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Temporarily disable platform access for maintenance
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                  Enable Maintenance Mode
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Prevent regular users from accessing the platform
                </p>
              </div>
              <button
                onClick={() => handleSettingChange('maintenance_mode', !settings.maintenance_mode)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  settings.maintenance_mode ? 'bg-red-600' : 'bg-gray-200 dark:bg-gray-700'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    settings.maintenance_mode ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            {settings.maintenance_mode && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Maintenance Message
                </label>
                <textarea
                  value={settings.maintenance_message}
                  onChange={(e) => handleSettingChange('maintenance_message', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="Message to display to users during maintenance..."
                />
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  This message will be shown to users when they try to access the platform
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            loading={saving}
            className="px-6"
          >
            Save Platform Settings
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
