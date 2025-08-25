'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import { Modal } from '@/components/ui/Modal';
import toast from 'react-hot-toast';
import { validatePassword } from '@/lib/utils';
import { 
  ShieldCheckIcon,
  LockClosedIcon,
  KeyIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
  GlobeAltIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

interface SecuritySession {
  id: string;
  device_type: string;
  browser: string;
  location: string;
  ip_address: string;
  last_active: string;
  is_current: boolean;
}

interface SecuritySettings {
  two_factor_enabled: boolean;
  session_timeout: number;
  login_notifications: boolean;
  password_last_changed: string;
}

export default function SecurityPage() {
  const { supabase, platformUser, updatePassword } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessions, setSessions] = useState<SecuritySession[]>([]);
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    two_factor_enabled: false,
    session_timeout: 30,
    login_notifications: true,
    password_last_changed: ''
  });

  // Password change form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadSecurityData();
  }, []);

  const loadSecurityData = async () => {
    if (!supabase || !platformUser) return;

    try {
      setLoading(true);
      
      // Load user data for password last changed info
      const { data: userData, error: userError } = await supabase
        .from('platform_users')
        .select('created_at')
        .eq('id', platformUser.id)
        .single();

      if (userError) throw userError;

      // Load security settings from localStorage
      const savedSettings = localStorage.getItem('security_settings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSecuritySettings(prev => ({
          ...prev,
          ...parsedSettings,
          password_last_changed: parsedSettings.password_last_changed || userData.created_at
        }));
      } else {
        setSecuritySettings(prev => ({
          ...prev,
          password_last_changed: userData.created_at
        }));
      }

      // Load active sessions (mock data for now - would integrate with real session management)
      setSessions([
        {
          id: '1',
          device_type: 'desktop',
          browser: 'Chrome on macOS',
          location: 'San Francisco, CA',
          ip_address: '192.168.1.100',
          last_active: new Date().toISOString(),
          is_current: true
        },
        {
          id: '2',
          device_type: 'mobile',
          browser: 'Safari on iPhone',
          location: 'San Francisco, CA',
          ip_address: '192.168.1.101',
          last_active: new Date(Date.now() - 3600000).toISOString(),
          is_current: false
        }
      ]);

    } catch (error) {
      console.error('Error loading security data:', error);
      toast.error('Failed to load security settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSecuritySettingChange = (key: keyof SecuritySettings, value: any) => {
    setSecuritySettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSecuritySettings = () => {
    try {
      setSaving(true);

      // Save settings to localStorage
      localStorage.setItem('security_settings', JSON.stringify(securitySettings));

      toast.success('Security settings saved successfully');
    } catch (error) {
      console.error('Error saving security settings:', error);
      toast.error('Failed to save security settings');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordForm(prev => ({ ...prev, [field]: value }));
    if (passwordErrors[field]) {
      setPasswordErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validatePasswordForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!passwordForm.currentPassword) {
      errors.currentPassword = 'Current password is required';
    }

    if (!passwordForm.newPassword) {
      errors.newPassword = 'New password is required';
    } else {
      const validation = validatePassword(passwordForm.newPassword);
      if (!validation.isValid) {
        errors.newPassword = validation.errors[0];
      }
    }

    if (!passwordForm.confirmPassword) {
      errors.confirmPassword = 'Please confirm your new password';
    } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePasswordSubmit = async () => {
    if (!validatePasswordForm()) return;

    try {
      setSaving(true);

      const { error } = await updatePassword(passwordForm.newPassword);

      if (error) throw new Error(error);

      // Update the password changed date in security settings
      const updatedSettings = {
        ...securitySettings,
        password_last_changed: new Date().toISOString()
      };
      setSecuritySettings(updatedSettings);
      localStorage.setItem('security_settings', JSON.stringify(updatedSettings));

      toast.success('Password updated successfully');
      setShowPasswordModal(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      loadSecurityData();
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      // Mock session revocation - would integrate with real session management
      setSessions(prev => prev.filter(session => session.id !== sessionId));
      toast.success('Session revoked successfully');
    } catch (error) {
      console.error('Error revoking session:', error);
      toast.error('Failed to revoke session');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPasswordStrength = () => {
    if (!securitySettings.password_last_changed) return 'unknown';
    
    const daysSinceChange = Math.floor(
      (Date.now() - new Date(securitySettings.password_last_changed).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceChange < 30) return 'strong';
    if (daysSinceChange < 90) return 'medium';
    return 'weak';
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile': return DevicePhoneMobileIcon;
      case 'desktop': return ComputerDesktopIcon;
      default: return GlobeAltIcon;
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Security Settings" allowedRoles={[]}>
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
      title="Security Settings"
      description="Manage your account security and authentication preferences"
      allowedRoles={[]}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Password Security */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <LockClosedIcon className="h-5 w-5 mr-2" />
              Password Security
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage your account password and security
            </p>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className={cn(
                  'p-2 rounded-lg',
                  getPasswordStrength() === 'strong' ? 'bg-green-100 dark:bg-green-900/20' :
                  getPasswordStrength() === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/20' :
                  'bg-red-100 dark:bg-red-900/20'
                )}>
                  {getPasswordStrength() === 'strong' ? (
                    <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                  ) : (
                    <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    Password last changed
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {securitySettings.password_last_changed ? formatDate(securitySettings.password_last_changed) : 'Never'}
                  </p>
                </div>
              </div>
              <Button onClick={() => setShowPasswordModal(true)}>
                Change Password
              </Button>
            </div>
          </div>
        </div>

        {/* Two-Factor Authentication */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <ShieldCheckIcon className="h-5 w-5 mr-2" />
              Two-Factor Authentication
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Add an extra layer of security to your account
            </p>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className={cn(
                  'p-2 rounded-lg',
                  securitySettings.two_factor_enabled 
                    ? 'bg-green-100 dark:bg-green-900/20' 
                    : 'bg-gray-100 dark:bg-gray-700'
                )}>
                  {securitySettings.two_factor_enabled ? (
                    <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircleIcon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    {securitySettings.two_factor_enabled ? 'Enabled' : 'Disabled'}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {securitySettings.two_factor_enabled 
                      ? 'Your account is protected with 2FA'
                      : 'Secure your account with two-factor authentication'
                    }
                  </p>
                </div>
              </div>
              <Button 
                variant={securitySettings.two_factor_enabled ? 'outline' : 'default'}
                onClick={() => handleSecuritySettingChange('two_factor_enabled', !securitySettings.two_factor_enabled)}
              >
                {securitySettings.two_factor_enabled ? 'Disable 2FA' : 'Enable 2FA'}
              </Button>
            </div>
          </div>
        </div>

        {/* Security Preferences */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <KeyIcon className="h-5 w-5 mr-2" />
              Security Preferences
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Configure additional security settings
            </p>
          </div>
          <div className="p-6 space-y-6">
            {/* Session Timeout */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Session Timeout (minutes)
              </label>
              <select
                value={securitySettings.session_timeout}
                onChange={(e) => handleSecuritySettingChange('session_timeout', parseInt(e.target.value))}
                className="w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={240}>4 hours</option>
                <option value={480}>8 hours</option>
                <option value={1440}>24 hours</option>
              </select>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Automatically log out after this period of inactivity
              </p>
            </div>

            {/* Login Notifications */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                  Login Notifications
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Get notified when someone signs into your account
                </p>
              </div>
              <button
                onClick={() => handleSecuritySettingChange('login_notifications', !securitySettings.login_notifications)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  securitySettings.login_notifications ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    securitySettings.login_notifications ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveSecuritySettings} loading={saving}>
                Save Security Settings
              </Button>
            </div>
          </div>
        </div>

        {/* Active Sessions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <CalendarIcon className="h-5 w-5 mr-2" />
                  Active Sessions
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Manage your active login sessions
                </p>
              </div>
              <Button variant="outline" onClick={() => setShowSessionModal(true)}>
                View All Sessions
              </Button>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {sessions.slice(0, 3).map((session) => {
                const Icon = getDeviceIcon(session.device_type);
                
                return (
                  <div key={session.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <Icon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                          {session.browser}
                          {session.is_current && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Current
                            </span>
                          )}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {session.location} • {session.ip_address} • Last active {formatDate(session.last_active)}
                        </p>
                      </div>
                    </div>
                    {!session.is_current && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevokeSession(session.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Change Password"
        description="Enter your current password and choose a new one"
      >
        <div className="space-y-4">
          <Input
            label="Current Password"
            type="password"
            value={passwordForm.currentPassword}
            onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
            error={passwordErrors.currentPassword}
            placeholder="••••••••••••"
            startIcon={<LockClosedIcon className="h-5 w-5" />}
            fullWidth
            required
          />

          <Input
            label="New Password"
            type="password"
            value={passwordForm.newPassword}
            onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
            error={passwordErrors.newPassword}
            placeholder="••••••••••••"
            startIcon={<LockClosedIcon className="h-5 w-5" />}
            helperText="Must be at least 8 characters with uppercase, lowercase, and number"
            fullWidth
            required
          />

          <Input
            label="Confirm New Password"
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
            error={passwordErrors.confirmPassword}
            placeholder="••••••••••••"
            startIcon={<LockClosedIcon className="h-5 w-5" />}
            fullWidth
            required
          />

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowPasswordModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePasswordSubmit}
              loading={saving}
            >
              Update Password
            </Button>
          </div>
        </div>
      </Modal>

      {/* Sessions Modal */}
      <Modal
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
        title="All Active Sessions"
        description="Manage all your active login sessions"
        size="lg"
      >
        <div className="space-y-4">
          {sessions.map((session) => {
            const Icon = getDeviceIcon(session.device_type);
            
            return (
              <div key={session.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center space-x-4">
                  <Icon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {session.browser}
                      {session.is_current && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Current
                        </span>
                      )}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {session.location} • {session.ip_address}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Last active: {formatDate(session.last_active)}
                    </p>
                  </div>
                </div>
                {!session.is_current && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRevokeSession(session.id)}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Modal>
    </DashboardLayout>
  );
}
