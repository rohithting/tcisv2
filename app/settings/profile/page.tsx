'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { 
  UserIcon,
  EnvelopeIcon,
  CalendarIcon,
  IdentificationIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

interface ProfileData {
  id: string;
  email: string;
  full_name: string;
  platform_role: string;
  created_at: string;
  last_sign_in?: string;
  // Basic profile fields available in current schema
  last_login_at?: string;
}

export default function ProfilePage() {
  const { supabase, platformUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [formData, setFormData] = useState({
    full_name: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load profile data
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    if (!supabase || !platformUser) return;

    try {
      setLoading(true);
      
      // Get user profile data
      const { data: profile, error } = await supabase
        .from('platform_users')
        .select('*')
        .eq('id', platformUser.id)
        .single();

      if (error) throw error;

      setProfileData(profile);
      setFormData({
        full_name: profile.full_name || ''
      });
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Full name is required';
    }



    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !supabase || !platformUser) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('platform_users')
        .update({
          full_name: formData.full_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', platformUser.id);

      if (error) throw error;

      toast.success('Profile updated successfully');
      loadProfile(); // Refresh the data
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
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

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'admin': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'backend': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'manager': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Profile Settings" allowedRoles={[]}>
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

  if (!profileData) {
    return (
      <DashboardLayout title="Profile Settings" allowedRoles={[]}>
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Failed to load profile data</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Profile Settings"
      description="Manage your personal information and account preferences"
      allowedRoles={[]}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Account Information Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Account Information
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Basic account details and role information
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address
                </label>
                <div className="flex items-center">
                  <EnvelopeIcon className="h-5 w-5 text-gray-400 mr-2" />
                  <span className="text-gray-900 dark:text-gray-100">{profileData.email}</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Platform Role
                </label>
                <div className="flex items-center">
                  <IdentificationIcon className="h-5 w-5 text-gray-400 mr-2" />
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(profileData.platform_role)}`}>
                    {profileData.platform_role.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Account Created
                </label>
                <div className="flex items-center">
                  <CalendarIcon className="h-5 w-5 text-gray-400 mr-2" />
                  <span className="text-gray-900 dark:text-gray-100">{formatDate(profileData.created_at)}</span>
                </div>
              </div>

              {profileData.last_login_at && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Last Sign In
                  </label>
                  <div className="flex items-center">
                    <CalendarIcon className="h-5 w-5 text-gray-400 mr-2" />
                    <span className="text-gray-900 dark:text-gray-100">{formatDate(profileData.last_login_at)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Profile Information Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Profile Information
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Update your personal information and preferences
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-6">
              <Input
                label="Full Name"
                type="text"
                value={formData.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                error={errors.full_name}
                placeholder="Enter your full name"
                startIcon={<UserIcon className="h-5 w-5" />}
                required
              />
              
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-start">
                  <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Extended Profile Fields Coming Soon
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Additional profile fields like job title, department, and contact information will be available in a future update.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={loadProfile}
                disabled={saving}
              >
                Reset
              </Button>
              <Button
                onClick={handleSave}
                loading={saving}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
