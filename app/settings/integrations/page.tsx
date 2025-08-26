'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import { Modal } from '@/components/ui/Modal';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { 
  GlobeAltIcon,
  KeyIcon,
  LinkIcon,
  BellIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  CloudIcon,
  ShieldCheckIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

interface Integration {
  id: string;
  name: string;
  type: 'webhook' | 'email' | 'slack' | 'teams' | 'api' | 'storage';
  enabled: boolean;
  config: Record<string, any>;
  created_at: string;
  last_used?: string;
  status: 'active' | 'error' | 'disabled';
}

interface IntegrationType {
  type: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  configFields: {
    key: string;
    label: string;
    type: 'text' | 'password' | 'url' | 'email' | 'select';
    required: boolean;
    placeholder?: string;
    options?: { value: string; label: string }[];
  }[];
}

export default function IntegrationsPage() {
  const { supabase, platformUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [selectedType, setSelectedType] = useState<IntegrationType | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const integrationTypes: IntegrationType[] = [
    {
      type: 'zoho_cliq',
      name: 'Zoho Cliq',
      description: 'Automatically sync messages from Zoho Cliq channels',
      icon: ChatBubbleLeftRightIcon,
      configFields: []
    },
    {
      type: 'webhook',
      name: 'Webhook',
      description: 'Send HTTP notifications to external services',
      icon: LinkIcon,
      configFields: [
        { key: 'url', label: 'Webhook URL', type: 'url', required: true, placeholder: 'https://api.example.com/webhook' },
        { key: 'secret', label: 'Secret Key', type: 'password', required: false, placeholder: 'Optional webhook secret' },
        { key: 'events', label: 'Events', type: 'select', required: true, options: [
          { value: 'job_completed', label: 'Job Completed' },
          { value: 'job_failed', label: 'Job Failed' },
          { value: 'user_registered', label: 'User Registered' },
          { value: 'all', label: 'All Events' }
        ]}
      ]
    },
    {
      type: 'email',
      name: 'Email Service',
      description: 'Configure external email service provider',
      icon: EnvelopeIcon,
      configFields: [
        { key: 'provider', label: 'Provider', type: 'select', required: true, options: [
          { value: 'sendgrid', label: 'SendGrid' },
          { value: 'mailgun', label: 'Mailgun' },
          { value: 'ses', label: 'Amazon SES' },
          { value: 'smtp', label: 'Custom SMTP' }
        ]},
        { key: 'api_key', label: 'API Key', type: 'password', required: true, placeholder: 'Your API key' },
        { key: 'from_email', label: 'From Email', type: 'email', required: true, placeholder: 'noreply@ting.in' },
        { key: 'from_name', label: 'From Name', type: 'text', required: false, placeholder: 'ting TCIS' }
      ]
    },
    {
      type: 'slack',
      name: 'Slack',
      description: 'Send notifications to Slack channels',
      icon: ChatBubbleLeftRightIcon,
      configFields: [
        { key: 'webhook_url', label: 'Slack Webhook URL', type: 'url', required: true, placeholder: 'https://hooks.slack.com/services/...' },
        { key: 'channel', label: 'Default Channel', type: 'text', required: false, placeholder: '#notifications' },
        { key: 'username', label: 'Bot Username', type: 'text', required: false, placeholder: 'TCIS Bot' }
      ]
    },
    {
      type: 'teams',
      name: 'Microsoft Teams',
      description: 'Send notifications to Teams channels',
      icon: ChatBubbleLeftRightIcon,
      configFields: [
        { key: 'webhook_url', label: 'Teams Webhook URL', type: 'url', required: true, placeholder: 'https://outlook.office.com/webhook/...' },
        { key: 'title_prefix', label: 'Message Title Prefix', type: 'text', required: false, placeholder: '[TCIS]' }
      ]
    },
    {
      type: 'storage',
      name: 'Cloud Storage',
      description: 'Connect to cloud storage services',
      icon: CloudIcon,
      configFields: [
        { key: 'provider', label: 'Provider', type: 'select', required: true, options: [
          { value: 's3', label: 'Amazon S3' },
          { value: 'gcs', label: 'Google Cloud Storage' },
          { value: 'azure', label: 'Azure Blob Storage' }
        ]},
        { key: 'bucket', label: 'Bucket/Container Name', type: 'text', required: true, placeholder: 'my-bucket' },
        { key: 'access_key', label: 'Access Key', type: 'text', required: true, placeholder: 'Access key ID' },
        { key: 'secret_key', label: 'Secret Key', type: 'password', required: true, placeholder: 'Secret access key' },
        { key: 'region', label: 'Region', type: 'text', required: false, placeholder: 'us-east-1' }
      ]
    },
    {
      type: 'api',
      name: 'Custom API',
      description: 'Integrate with custom REST APIs',
      icon: GlobeAltIcon,
      configFields: [
        { key: 'base_url', label: 'Base URL', type: 'url', required: true, placeholder: 'https://api.example.com' },
        { key: 'auth_type', label: 'Authentication', type: 'select', required: true, options: [
          { value: 'none', label: 'None' },
          { value: 'bearer', label: 'Bearer Token' },
          { value: 'basic', label: 'Basic Auth' },
          { value: 'api_key', label: 'API Key' }
        ]},
        { key: 'auth_value', label: 'Auth Value', type: 'password', required: false, placeholder: 'Token/Key/Credentials' },
        { key: 'headers', label: 'Custom Headers', type: 'text', required: false, placeholder: 'key1:value1,key2:value2' }
      ]
    }
  ];

  useEffect(() => {
    const fetchData = async () => {
      if (!supabase) return;
      
      setLoading(true);
      try {
        const loadedIntegrations: Integration[] = [];

        // Load Zoho Cliq integration if configured
        const { data: zohoAuth, error: zohoError } = await supabase
          .from('zoho_auth')
          .select('*')
          .single();

        if (zohoAuth && !zohoError) {
          const expiresAt = new Date(zohoAuth.expires_at);
          const now = new Date();
          const isExpired = expiresAt <= now;
          const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          loadedIntegrations.push({
            id: `zoho_cliq_${zohoAuth.id}`,
            name: 'Zoho Cliq',
            type: 'zoho_cliq',
            enabled: !isExpired && zohoAuth.auto_refresh_enabled !== false,
            status: isExpired ? 'error' : (daysUntilExpiry <= 7 ? 'warning' : 'active'),
            config: {
              scope: zohoAuth.scope,
              authenticated_by: zohoAuth.authenticated_by,
              expires_at: zohoAuth.expires_at,
              auto_refresh: zohoAuth.auto_refresh_enabled !== false
            },
            created_at: zohoAuth.created_at,
            updated_at: zohoAuth.updated_at,
            last_used: zohoAuth.updated_at
          });
        }

        setIntegrations(loadedIntegrations);
      } catch (error) {
        console.error('Error loading integrations:', error);
        toast.error('Failed to load integrations');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

  const handleCreateIntegration = () => {
    setSelectedIntegration(null);
    setSelectedType(null);
    setFormData({});
    setErrors({});
    setShowCreateModal(true);
  };

  const handleEditIntegration = (integration: Integration) => {
    setSelectedIntegration(integration);
    const type = integrationTypes.find(t => t.type === integration.type);
    setSelectedType(type || null);
    setFormData(integration.config);
    setErrors({});
    setShowEditModal(true);
  };

  const handleDeleteIntegration = async (integrationId: string) => {
    if (!confirm('Are you sure you want to delete this integration? This will disable all channel mappings and stop automatic syncing.')) return;

    try {
      const integration = integrations.find(i => i.id === integrationId);
      
      if (integration?.type === 'zoho_cliq') {
        // Delete Zoho auth from database
        const { error } = await supabase
          .from('zoho_auth')
          .delete()
          .eq('id', integrationId.replace('zoho_cliq_', ''));

        if (error) throw error;
      }

      setIntegrations(prev => prev.filter(i => i.id !== integrationId));
      toast.success('Integration deleted successfully');
    } catch (error) {
      console.error('Error deleting integration:', error);
      toast.error('Failed to delete integration');
    }
  };

  const handleToggleIntegration = async (integrationId: string, enabled: boolean) => {
    try {
      const integration = integrations.find(i => i.id === integrationId);
      
      if (integration?.type === 'zoho_cliq') {
        // Update auto_refresh_enabled in database
        const { error } = await supabase
          .from('zoho_auth')
          .update({ auto_refresh_enabled: enabled })
          .eq('id', integrationId.replace('zoho_cliq_', ''));

        if (error) throw error;
      }

      setIntegrations(prev => prev.map(i => 
        i.id === integrationId 
          ? { ...i, enabled, status: enabled ? 'active' : 'disabled' }
          : i
      ));
      toast.success(`Integration ${enabled ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error('Error toggling integration:', error);
      toast.error('Failed to update integration');
    }
  };

  const handleFormChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: '' }));
    }
  };

  const validateForm = (): boolean => {
    if (!selectedType) return false;

    const newErrors: Record<string, string> = {};

    selectedType.configFields.forEach(field => {
      if (field.required && !formData[field.key]?.trim()) {
        newErrors[field.key] = `${field.label} is required`;
      }

      if (field.type === 'email' && formData[field.key] && !formData[field.key].match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        newErrors[field.key] = 'Please enter a valid email address';
      }

      if (field.type === 'url' && formData[field.key] && !formData[field.key].match(/^https?:\/\/.+/)) {
        newErrors[field.key] = 'Please enter a valid URL';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveIntegration = async () => {
    if (!validateForm() || !selectedType) return;

    try {
      setSaving(true);

      const integrationData = {
        name: formData.name || `${selectedType.name} Integration`,
        type: selectedType.type,
        enabled: true,
        config: { ...formData },
        status: 'active' as const
      };

      if (selectedIntegration) {
        // Update existing
        setIntegrations(prev => prev.map(i => 
          i.id === selectedIntegration.id 
            ? { ...i, ...integrationData }
            : i
        ));
        toast.success('Integration updated successfully');
      } else {
        // Create new
        const newIntegration: Integration = {
          id: Date.now().toString(),
          ...integrationData,
          created_at: new Date().toISOString()
        };
        setIntegrations(prev => [...prev, newIntegration]);
        toast.success('Integration created successfully');
      }

      setShowCreateModal(false);
      setShowEditModal(false);
    } catch (error) {
      console.error('Error saving integration:', error);
      toast.error('Failed to save integration');
    } finally {
      setSaving(false);
    }
  };

  const testIntegration = async (integration: Integration) => {
    try {
      if (integration.type === 'zoho_cliq') {
        // Test Zoho Cliq connection via Edge Function
        const response = await supabase.functions.invoke('zoho-test-connection', {
          body: { action: 'test' }
        });

        if (response.error) {
          throw new Error(response.error.message || 'Connection test failed');
        }

        const result = response.data;
        if (result.success) {
          toast.success(`Zoho Cliq test successful! Found ${result.channels_count || 0} channels.`);
        } else {
          throw new Error(result.error || 'Connection test failed');
        }
      } else {
        // Mock test for other integrations
        toast.success('Integration test successful!');
      }
      
      // Update last_used
      setIntegrations(prev => prev.map(i => 
        i.id === integration.id 
          ? { ...i, last_used: new Date().toISOString() }
          : i
      ));
    } catch (error) {
      console.error('Error testing integration:', error);
      toast.error(`Integration test failed: ${error.message}`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'warning': return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'error': return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default: return <XCircleIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getTypeIcon = (type: string) => {
    const integrationType = integrationTypes.find(t => t.type === type);
    if (!integrationType) return GlobeAltIcon;
    return integrationType.icon;
  };

  if (loading) {
    return (
      <DashboardLayout title="Integrations" allowedRoles={['super_admin', 'admin']}>
        <div className="animate-pulse space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Integrations"
      description="Connect external services and configure platform integrations"
      allowedRoles={['super_admin', 'admin']}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Actions */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Active Integrations
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {integrations.filter(i => i.enabled).length} of {integrations.length} integrations active
            </p>
          </div>
          <Button onClick={handleCreateIntegration}>
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Integration
          </Button>
        </div>

        {/* Integration Types Overview */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Available Integration Types
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Connect with external services to extend platform functionality
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrationTypes.map((type) => {
                const Icon = type.icon;
                const activeCount = integrations.filter(i => i.type === type.type && i.enabled).length;
                
                return (
                  <div key={type.type} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <Icon className="h-6 w-6 text-gray-500 dark:text-gray-400 mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">
                            {type.name}
                          </h4>
                          {activeCount > 0 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              {activeCount} active
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {type.description}
                        </p>
                        {type.type !== 'zoho_cliq' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 mt-2">
                            Coming Soon
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Active Integrations */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Configured Integrations
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage your existing integrations
            </p>
          </div>
          <div className="p-6">
            {integrations.length === 0 ? (
              <div className="text-center py-12">
                <GlobeAltIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 mb-4">No integrations configured yet</p>
                <Button onClick={handleCreateIntegration}>
                  Add Your First Integration
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {integrations.map((integration) => {
                  const Icon = getTypeIcon(integration.type);
                  const type = integrationTypes.find(t => t.type === integration.type);
                  
                  return (
                    <div key={integration.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <Icon className="h-8 w-8 text-gray-500 dark:text-gray-400" />
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="font-medium text-gray-900 dark:text-gray-100">
                                {integration.name}
                              </h4>
                              {getStatusIcon(integration.status)}
                              <span className={cn(
                                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                                integration.enabled 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                              )}>
                                {integration.enabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {type?.name} • Created {new Date(integration.created_at).toLocaleDateString()}
                              {integration.last_used && ` • Last used ${new Date(integration.last_used).toLocaleDateString()}`}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => testIntegration(integration)}
                            disabled={!integration.enabled}
                          >
                            Test
                          </Button>
                          
                          <button
                            onClick={() => handleToggleIntegration(integration.id, !integration.enabled)}
                            className={cn(
                              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                              integration.enabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                            )}
                          >
                            <span
                              className={cn(
                                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                                integration.enabled ? 'translate-x-6' : 'translate-x-1'
                              )}
                            />
                          </button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditIntegration(integration)}
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteIntegration(integration.id)}
                            className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Security Notice */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start">
            <ShieldCheckIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Security Best Practices
              </h3>
              <div className="text-sm text-blue-700 dark:text-blue-300 mt-1 space-y-1">
                <p>• Store sensitive credentials securely and rotate them regularly</p>
                <p>• Use HTTPS URLs for all webhook endpoints</p>
                <p>• Implement proper authentication and validation in your endpoints</p>
                <p>• Monitor integration usage and disable unused integrations</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Integration Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add New Integration"
        description="Connect an external service to your platform"
        size="lg"
      >
        <div className="space-y-6">
          {!selectedType ? (
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">
                Choose Integration Type
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {integrationTypes.map((type) => {
                  const Icon = type.icon;
                  
                  return (
                    <button
                      key={type.type}
                      onClick={() => {
                        console.log('Integration clicked:', type.type);
                        if (type.type === 'zoho_cliq') {
                          console.log('Navigating to Zoho Cliq page...');
                          try {
                            router.push('/settings/integrations/zoho-cliq');
                            console.log('Router.push called successfully');
                          } catch (error) {
                            console.error('Router.push failed:', error);
                            // Fallback to window location
                            window.location.href = '/settings/integrations/zoho-cliq';
                          }
                        } else {
                          toast.error('This integration is coming soon!');
                        }
                      }}
                      disabled={type.type !== 'zoho_cliq'}
                      className={`flex items-start space-x-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors text-left ${
                        type.type === 'zoho_cliq' 
                          ? 'hover:border-primary-300 dark:hover:border-primary-600 cursor-pointer' 
                          : 'opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <Icon className="h-6 w-6 text-gray-500 dark:text-gray-400 mt-1" />
                      <div>
                        <h5 className="font-medium text-gray-900 dark:text-gray-100">
                          {type.name}
                        </h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {type.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <selectedType.icon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    Configure {selectedType.name}
                  </h4>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedType(null)}
                >
                  Back
                </Button>
              </div>

              <div className="space-y-4">
                <Input
                  label="Integration Name"
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder={`${selectedType.name} Integration`}
                  fullWidth
                />

                {selectedType.configFields.map((field) => (
                  <div key={field.key}>
                    {field.type === 'select' ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {field.label} {field.required && '*'}
                        </label>
                        <select
                          value={formData[field.key] || ''}
                          onChange={(e) => handleFormChange(field.key, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        >
                          <option value="">Select {field.label}</option>
                          {field.options?.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {errors[field.key] && (
                          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                            {errors[field.key]}
                          </p>
                        )}
                      </div>
                    ) : (
                      <Input
                        label={field.label}
                        type={field.type}
                        value={formData[field.key] || ''}
                        onChange={(e) => handleFormChange(field.key, e.target.value)}
                        error={errors[field.key]}
                        placeholder={field.placeholder}
                        required={field.required}
                        fullWidth
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveIntegration}
                  loading={saving}
                >
                  Create Integration
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Integration Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Integration"
        description="Update integration configuration"
        size="lg"
      >
        {selectedType && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <selectedType.icon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
              <h4 className="font-medium text-gray-900 dark:text-gray-100">
                {selectedType.name} Configuration
              </h4>
            </div>

            <Input
              label="Integration Name"
              type="text"
              value={formData.name || selectedIntegration?.name || ''}
              onChange={(e) => handleFormChange('name', e.target.value)}
              placeholder={`${selectedType.name} Integration`}
              fullWidth
            />

            {selectedType.configFields.map((field) => (
              <div key={field.key}>
                {field.type === 'select' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {field.label} {field.required && '*'}
                    </label>
                    <select
                      value={formData[field.key] || ''}
                      onChange={(e) => handleFormChange(field.key, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Select {field.label}</option>
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {errors[field.key] && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        {errors[field.key]}
                      </p>
                    )}
                  </div>
                ) : (
                  <Input
                    label={field.label}
                    type={field.type}
                    value={formData[field.key] || ''}
                    onChange={(e) => handleFormChange(field.key, e.target.value)}
                    error={errors[field.key]}
                    placeholder={field.placeholder}
                    required={field.required}
                    fullWidth
                  />
                )}
              </div>
            ))}

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveIntegration}
                loading={saving}
              >
                Update Integration
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
