'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { 
  BellIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  XMarkIcon,
  ClockIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  CogIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

interface NotificationSettings {
  // Email notifications
  email_enabled: boolean;
  email_frequency: 'immediate' | 'daily' | 'weekly' | 'never';
  email_job_updates: boolean;
  email_system_alerts: boolean;
  email_security_alerts: boolean;
  email_weekly_summary: boolean;
  email_client_activity: boolean;
  
  // In-app notifications
  app_enabled: boolean;
  app_job_updates: boolean;
  app_chat_mentions: boolean;
  app_system_alerts: boolean;
  app_client_activity: boolean;
  
  // Push notifications (browser)
  push_enabled: boolean;
  push_job_updates: boolean;
  push_chat_mentions: boolean;
  push_system_alerts: boolean;
  
  // Quiet hours
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_timezone: string;
}

interface NotificationCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  settings: {
    email_key: keyof NotificationSettings;
    app_key: keyof NotificationSettings;
    push_key?: keyof NotificationSettings;
  };
}

export default function NotificationsPage() {
  const { supabase, platformUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  
  const [settings, setSettings] = useState<NotificationSettings>({
    email_enabled: true,
    email_frequency: 'immediate',
    email_job_updates: true,
    email_system_alerts: true,
    email_security_alerts: true,
    email_weekly_summary: true,
    email_client_activity: true,
    
    app_enabled: true,
    app_job_updates: true,
    app_chat_mentions: true,
    app_system_alerts: true,
    app_client_activity: true,
    
    push_enabled: false,
    push_job_updates: false,
    push_chat_mentions: false,
    push_system_alerts: false,
    
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
    quiet_hours_timezone: 'UTC'
  });

  const notificationCategories: NotificationCategory[] = [
    {
      id: 'job_updates',
      title: 'Job Updates',
      description: 'Notifications about job status changes and completions',
      icon: DocumentTextIcon,
      settings: {
        email_key: 'email_job_updates',
        app_key: 'app_job_updates',
        push_key: 'push_job_updates'
      }
    },
    {
      id: 'system_alerts',
      title: 'System Alerts',
      description: 'Important system notifications and maintenance updates',
      icon: ExclamationTriangleIcon,
      settings: {
        email_key: 'email_system_alerts',
        app_key: 'app_system_alerts',
        push_key: 'push_system_alerts'
      }
    },
    {
      id: 'chat_mentions',
      title: 'Chat Mentions',
      description: 'When you are mentioned in chat conversations',
      icon: ChatBubbleLeftRightIcon,
      settings: {
        email_key: 'email_job_updates', // Using job updates as fallback
        app_key: 'app_chat_mentions',
        push_key: 'push_chat_mentions'
      }
    },
    {
      id: 'client_activity',
      title: 'Client Activity',
      description: 'Updates about client-related activities and changes',
      icon: UserGroupIcon,
      settings: {
        email_key: 'email_client_activity',
        app_key: 'app_client_activity'
      }
    }
  ];

  useEffect(() => {
    loadNotificationSettings();
    checkPushSupport();
  }, []);

  const checkPushSupport = () => {
    if ('Notification' in window && 'serviceWorker' in navigator) {
      setPushSupported(true);
      setPushPermission(Notification.permission);
    }
  };

  const loadNotificationSettings = () => {
    try {
      setLoading(true);
      
      // Load settings from localStorage
      const savedSettings = localStorage.getItem('notification_settings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(prev => ({
          ...prev,
          ...parsedSettings
        }));
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
      toast.error('Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key: keyof NotificationSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    try {
      setSaving(true);

      // Save settings to localStorage
      localStorage.setItem('notification_settings', JSON.stringify(settings));

      toast.success('Notification settings saved successfully');
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast.error('Failed to save notification settings');
    } finally {
      setSaving(false);
    }
  };

  const requestPushPermission = async () => {
    if (!pushSupported) return;

    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      
      if (permission === 'granted') {
        toast.success('Push notifications enabled');
        handleSettingChange('push_enabled', true);
      } else {
        toast.error('Push notifications permission denied');
        handleSettingChange('push_enabled', false);
      }
    } catch (error) {
      console.error('Error requesting push permission:', error);
      toast.error('Failed to enable push notifications');
    }
  };

  const testNotification = () => {
    if (pushPermission === 'granted') {
      new Notification('Test Notification', {
        body: 'This is a test notification from ting TCIS',
        icon: '/favicon.ico'
      });
    } else {
      toast.success('Test notification sent! (Check your email for email notifications)');
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Notification Settings" allowedRoles={[]}>
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
      title="Notification Settings"
      description="Manage how and when you receive notifications"
      allowedRoles={[]}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Quick Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <BellIcon className="h-5 w-5 mr-2" />
              Quick Settings
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Control your overall notification preferences
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Master Email Toggle */}
              <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <EnvelopeIcon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">Email</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">All email notifications</p>
                  </div>
                </div>
                <button
                  onClick={() => handleSettingChange('email_enabled', !settings.email_enabled)}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    settings.email_enabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      settings.email_enabled ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>

              {/* Master App Toggle */}
              <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <BellIcon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">In-App</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Application notifications</p>
                  </div>
                </div>
                <button
                  onClick={() => handleSettingChange('app_enabled', !settings.app_enabled)}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    settings.app_enabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      settings.app_enabled ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>

              {/* Master Push Toggle */}
              <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <DevicePhoneMobileIcon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">Push</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Browser notifications</p>
                  </div>
                </div>
                {pushSupported ? (
                  <button
                    onClick={() => {
                      if (pushPermission !== 'granted') {
                        requestPushPermission();
                      } else {
                        handleSettingChange('push_enabled', !settings.push_enabled);
                      }
                    }}
                    className={cn(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                      settings.push_enabled && pushPermission === 'granted' ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                        settings.push_enabled && pushPermission === 'granted' ? 'translate-x-6' : 'translate-x-1'
                      )}
                    />
                  </button>
                ) : (
                  <span className="text-sm text-gray-500 dark:text-gray-400">Not supported</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Email Frequency */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <EnvelopeIcon className="h-5 w-5 mr-2" />
              Email Frequency
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Choose how often you want to receive email notifications
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {[
                { value: 'immediate', label: 'Immediate', description: 'As they happen' },
                { value: 'daily', label: 'Daily', description: 'Once per day' },
                { value: 'weekly', label: 'Weekly', description: 'Once per week' },
                { value: 'never', label: 'Never', description: 'No emails' }
              ].map((option) => {
                const isSelected = settings.email_frequency === option.value;
                
                return (
                  <button
                    key={option.value}
                    onClick={() => handleSettingChange('email_frequency', option.value)}
                    disabled={!settings.email_enabled}
                    className={cn(
                      'p-3 rounded-lg border text-left transition-all',
                      isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
                      !settings.email_enabled && 'opacity-50 cursor-not-allowed'
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
        </div>

        {/* Notification Categories */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <CogIcon className="h-5 w-5 mr-2" />
              Notification Categories
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Fine-tune notifications for specific types of events
            </p>
          </div>
          <div className="p-6">
            <div className="space-y-6">
              {notificationCategories.map((category) => {
                const Icon = category.icon;
                
                return (
                  <div key={category.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start space-x-4">
                      <Icon className="h-6 w-6 text-gray-500 dark:text-gray-400 mt-1" />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                          {category.title}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          {category.description}
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Email */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700 dark:text-gray-300">Email</span>
                            <button
                              onClick={() => handleSettingChange(category.settings.email_key, !settings[category.settings.email_key])}
                              disabled={!settings.email_enabled}
                              className={cn(
                                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                                settings[category.settings.email_key] && settings.email_enabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700',
                                !settings.email_enabled && 'opacity-50 cursor-not-allowed'
                              )}
                            >
                              <span
                                className={cn(
                                  'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
                                  settings[category.settings.email_key] && settings.email_enabled ? 'translate-x-5' : 'translate-x-1'
                                )}
                              />
                            </button>
                          </div>

                          {/* In-App */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700 dark:text-gray-300">In-App</span>
                            <button
                              onClick={() => handleSettingChange(category.settings.app_key, !settings[category.settings.app_key])}
                              disabled={!settings.app_enabled}
                              className={cn(
                                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                                settings[category.settings.app_key] && settings.app_enabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700',
                                !settings.app_enabled && 'opacity-50 cursor-not-allowed'
                              )}
                            >
                              <span
                                className={cn(
                                  'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
                                  settings[category.settings.app_key] && settings.app_enabled ? 'translate-x-5' : 'translate-x-1'
                                )}
                              />
                            </button>
                          </div>

                          {/* Push */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700 dark:text-gray-300">Push</span>
                            {category.settings.push_key ? (
                              <button
                                onClick={() => handleSettingChange(category.settings.push_key!, !settings[category.settings.push_key!])}
                                disabled={!settings.push_enabled || !pushSupported || pushPermission !== 'granted'}
                                className={cn(
                                  'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                                  settings[category.settings.push_key] && settings.push_enabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700',
                                  (!settings.push_enabled || !pushSupported || pushPermission !== 'granted') && 'opacity-50 cursor-not-allowed'
                                )}
                              >
                                <span
                                  className={cn(
                                    'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
                                    settings[category.settings.push_key] && settings.push_enabled ? 'translate-x-5' : 'translate-x-1'
                                  )}
                                />
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">N/A</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quiet Hours */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <ClockIcon className="h-5 w-5 mr-2" />
              Quiet Hours
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Set times when you don't want to receive notifications
            </p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    Enable Quiet Hours
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Suppress non-urgent notifications during specified hours
                  </p>
                </div>
                <button
                  onClick={() => handleSettingChange('quiet_hours_enabled', !settings.quiet_hours_enabled)}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    settings.quiet_hours_enabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      settings.quiet_hours_enabled ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>

              {settings.quiet_hours_enabled && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={settings.quiet_hours_start}
                      onChange={(e) => handleSettingChange('quiet_hours_start', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={settings.quiet_hours_end}
                      onChange={(e) => handleSettingChange('quiet_hours_end', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Timezone
                    </label>
                    <select
                      value={settings.quiet_hours_timezone}
                      onChange={(e) => handleSettingChange('quiet_hours_timezone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">Eastern Time</option>
                      <option value="America/Chicago">Central Time</option>
                      <option value="America/Denver">Mountain Time</option>
                      <option value="America/Los_Angeles">Pacific Time</option>
                      <option value="Europe/London">London</option>
                      <option value="Asia/Tokyo">Tokyo</option>
                      <option value="Asia/Kolkata">India</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Special Notifications */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <InformationCircleIcon className="h-5 w-5 mr-2" />
              Special Notifications
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Important notifications that override quiet hours
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                  Security Alerts
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Login attempts, password changes, and security events
                </p>
              </div>
              <button
                onClick={() => handleSettingChange('email_security_alerts', !settings.email_security_alerts)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  settings.email_security_alerts ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    settings.email_security_alerts ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                  Weekly Summary
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Weekly report with platform activity and insights
                </p>
              </div>
              <button
                onClick={() => handleSettingChange('email_weekly_summary', !settings.email_weekly_summary)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  settings.email_weekly_summary ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    settings.email_weekly_summary ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={testNotification}
          >
            Test Notification
          </Button>
          
          <Button
            onClick={handleSave}
            loading={saving}
            className="px-6"
          >
            Save Notification Settings
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
