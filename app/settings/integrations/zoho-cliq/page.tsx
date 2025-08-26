'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import { Modal } from '@/components/ui/Modal';
import toast from 'react-hot-toast';
import { 
  LinkIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ClockIcon,
  KeyIcon,
  GlobeAltIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { ZohoAuth, ZohoAuthSetupRequest } from '@/types/zoho';

interface ZohoAuthStatus {
  isAuthenticated: boolean;
  auth?: ZohoAuth;
  isExpired: boolean;
  daysUntilExpiry?: number;
}

export default function ZohoCliqIntegrationPage() {
  const { supabase, platformUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState<ZohoAuthStatus>({
    isAuthenticated: false,
    isExpired: false
  });
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  // Setup form state
  const [setupForm, setSetupForm] = useState({
    client_id: '',
    client_secret: '',
    redirect_uri: '',
  });

  // Set default redirect URI on component mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !setupForm.redirect_uri) {
      // Force production URL for now since you're testing on production
      const baseUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3000' 
        : 'https://tcisv2.vercel.app';
      setSetupForm(prev => ({
        ...prev,
        redirect_uri: `${baseUrl}/auth/zoho/callback`
      }));
    }
  }, [setupForm.redirect_uri]);

  // OAuth callback handling
  const [oauthForm, setOauthForm] = useState({
    authorization_code: '',
  });

  useEffect(() => {
    // Check URL params for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    
    if (code) {
      console.log('Received authorization code from callback:', code);
      setOauthForm({ authorization_code: code });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    if (error) {
      console.error('OAuth error from callback:', error);
      toast.error(`Authorization failed: ${error}`);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const fetchData = async () => {
      if (!supabase) return;

      try {
        setLoading(true);
        
        const { data: authData, error } = await supabase
          .from('zoho_auth')
          .select('*')
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (authData) {
          const expiresAt = new Date(authData.expires_at);
          const now = new Date();
          const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          setAuthStatus({
            isAuthenticated: true,
            auth: authData,
            isExpired: expiresAt <= now,
            daysUntilExpiry: daysUntilExpiry > 0 ? daysUntilExpiry : 0
          });
        } else {
          setAuthStatus({
            isAuthenticated: false,
            isExpired: false
          });
        }
      } catch (error) {
        console.error('Error loading Zoho auth status:', error);
        toast.error('Failed to load authentication status');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

  const handleFormChange = (field: string, value: string) => {
    setSetupForm(prev => ({ ...prev, [field]: value }));
  };

  const getAuthUrl = () => {
    const params = new URLSearchParams({
      client_id: setupForm.client_id,
      response_type: 'code',
              scope: 'ZohoCliq.Channels.READ,ZohoCliq.Messages.READ,ZohoCliq.OrganizationChats.READ,ZohoCliq.OrganizationChannels.READ,ZohoCliq.Channels.ALL',
      redirect_uri: setupForm.redirect_uri,
      access_type: 'offline',
      prompt: 'consent', // This ensures refresh token is generated
      state: 'zoho_oauth_' + Date.now(), // Add state for security
    });

    // Use the correct data center domain - change this to match your Zoho domain
    // For India: https://accounts.zoho.in/oauth/v2/auth
    // For EU: https://accounts.zoho.eu/oauth/v2/auth  
    // For US: https://accounts.zoho.com/oauth/v2/auth
    return `https://accounts.zoho.in/oauth/v2/auth?${params.toString()}`;
  };

  const handleOAuthPopup = () => {
    if (!setupForm.client_id || !setupForm.client_secret || !setupForm.redirect_uri) {
      toast.error('Please fill in all OAuth credentials first');
      return;
    }

    const authUrl = getAuthUrl();
    const popup = window.open(
      authUrl,
      'zoho_oauth',
      'width=500,height=600,scrollbars=yes,resizable=yes'
    );

    if (!popup) {
      toast.error('Popup blocked! Please allow popups for this site and try again.');
      return;
    }

    // Listen for messages from the popup
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return; // Ignore messages from other origins
      }

      if (event.data.type === 'ZOHO_OAUTH_SUCCESS' && event.data.code) {
        console.log('Received authorization code from popup:', event.data.code);
        setOauthForm({ authorization_code: event.data.code });
        popup.close();
        window.removeEventListener('message', handleMessage);
        toast.success('Authorization code received! You can now complete the setup.');
      } else if (event.data.type === 'ZOHO_OAUTH_ERROR') {
        console.error('OAuth error from popup:', event.data.error);
        toast.error(`Authorization failed: ${event.data.error}`);
        popup.close();
        window.removeEventListener('message', handleMessage);
      }
    };

    window.addEventListener('message', handleMessage);

    // Check if popup was closed manually
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);
        console.log('OAuth popup was closed');
      }
    }, 1000);
  };

  const handleOAuthComplete = async () => {
    if (!oauthForm.authorization_code.trim()) {
      toast.error('Please enter the authorization code');
      return;
    }

    try {
      setSetupLoading(true);
      console.log('Starting OAuth completion process...');

      // Exchange authorization code for tokens via Supabase Edge Function
      console.log('Making token exchange request...');
      const tokenResponse = await supabase.functions.invoke('zoho-refresh-tokens', {
        body: {
          action: 'exchange_code',
          grant_type: 'authorization_code',
          client_id: setupForm.client_id,
          client_secret: setupForm.client_secret,
          redirect_uri: setupForm.redirect_uri,
          code: oauthForm.authorization_code,
        }
      });

      console.log('Token response:', tokenResponse);

      if (tokenResponse.error) {
        console.error('Token exchange failed:', tokenResponse.error);
        throw new Error(tokenResponse.error.message || 'Failed to exchange authorization code for tokens');
      }

      const tokenData = tokenResponse.data;
      console.log('Token data received:', {
        has_access_token: !!tokenData.access_token,
        has_refresh_token: !!tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        scope: tokenData.scope
      });

      if (tokenData.error) {
        throw new Error(tokenData.error_description || tokenData.error);
      }

      // Warn user if no refresh token (common with reused authorization codes)
      if (!tokenData.refresh_token) {
        console.warn('No refresh token received from Zoho. This is normal if the authorization code was already used.');
        toast.success('Authentication successful! Note: You may need to re-authorize when the access token expires.');
      }

      // Store tokens in database
      const authRequest: ZohoAuthSetupRequest = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null, // Handle case where no refresh token
        expires_in: tokenData.expires_in,
        scope: tokenData.scope,
      };

      // Save to database with client credentials for auto-refresh
      console.log('Saving tokens to database...');
      
      // First, check if there's an existing record
      const { data: existingAuth } = await supabase
        .from('zoho_auth')
        .select('id')
        .single();
      
      let dbError;
      if (existingAuth) {
        // Update existing record
        console.log('Updating existing Zoho auth record:', existingAuth.id);
        const { error } = await supabase
          .from('zoho_auth')
          .update({
            access_token: authRequest.access_token,
            refresh_token: authRequest.refresh_token, // Will be null if not provided
            expires_at: new Date(Date.now() + (authRequest.expires_in * 1000)).toISOString(),
            scope: authRequest.scope,
            authenticated_by: platformUser.id,
            client_id: setupForm.client_id, // Store for auto-refresh
            client_secret: setupForm.client_secret, // Store for auto-refresh
            auto_refresh_enabled: true,
            refresh_error_count: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingAuth.id);
        dbError = error;
      } else {
        // Insert new record
        console.log('Inserting new Zoho auth record');
        const { error } = await supabase
          .from('zoho_auth')
          .insert({
            access_token: authRequest.access_token,
            refresh_token: authRequest.refresh_token, // Will be null if not provided
            expires_at: new Date(Date.now() + (authRequest.expires_in * 1000)).toISOString(),
            scope: authRequest.scope,
            authenticated_by: platformUser.id,
            client_id: setupForm.client_id, // Store for auto-refresh
            client_secret: setupForm.client_secret, // Store for auto-refresh
            auto_refresh_enabled: true,
            refresh_error_count: 0,
            updated_at: new Date().toISOString(),
          });
        dbError = error;
      }

      if (dbError) {
        console.error('Database error:', dbError);
        throw dbError;
      }
      
      console.log('Tokens saved successfully!');

      toast.success('Zoho Cliq authentication configured successfully!');
      setShowSetupModal(false);
      setSetupForm({ client_id: '', client_secret: '', redirect_uri: '' });
      setOauthForm({ authorization_code: '' });
      
      // Reload auth status
      window.location.reload();
    } catch (error) {
      console.error('Error setting up Zoho auth:', error);
      toast.error(`Authentication failed: ${error.message}`);
    } finally {
      setSetupLoading(false);
    }
  };

  const testConnection = async () => {
    if (!authStatus.auth) return;

    try {
      setTestingConnection(true);

      // Get the current user's session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Test the connection via Supabase Edge Function
      const response = await supabase.functions.invoke('zoho-test-connection', {
        body: { action: 'test' }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Connection test failed');
      }

      const result = response.data;
      
      if (result.success) {
        toast.success('Connection test successful!');
      } else {
        throw new Error(result.error || 'Connection test failed');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      toast.error(`Connection test failed: ${error.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const refreshTokens = async () => {
    try {
      setSetupLoading(true);

      // Get the current user's session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await supabase.functions.invoke('zoho-refresh-tokens', {
        body: { action: 'refresh' }
      });

      if (response.error) {
        const errorData = response.error;
        if (errorData.needs_reauth) {
          toast.error('Please re-authorize with Zoho Cliq to refresh your access token.');
          // Could optionally trigger the setup modal here
        } else {
          throw new Error(errorData.message || 'Failed to refresh tokens');
        }
        return;
      }

      const result = response.data;
      if (result.success) {
        toast.success('Tokens refreshed successfully!');
        window.location.reload();
      } else {
        throw new Error(result.error || 'Failed to refresh tokens');
      }
    } catch (error) {
      console.error('Error refreshing tokens:', error);
      toast.error(`Failed to refresh tokens: ${error.message}`);
    } finally {
      setSetupLoading(false);
    }
  };

  const revokeAccess = async () => {
    if (!confirm('Are you sure you want to revoke Zoho Cliq access? This will disable all channel syncing.')) {
      return;
    }

    try {
      setSetupLoading(true);

      // Call the proper Zoho revoke Edge Function
      const { data, error } = await supabase.functions.invoke('zoho-revoke');

      if (error) throw error;

      toast.success('Zoho Cliq access revoked successfully');
      setAuthStatus({
        isAuthenticated: false,
        isExpired: false
      });
    } catch (error) {
      console.error('Error revoking access:', error);
      toast.error('Failed to revoke access');
    } finally {
      setSetupLoading(false);
    }
  };

  const getStatusIcon = () => {
    if (!authStatus.isAuthenticated) {
      return <XCircleIcon className="h-8 w-8 text-gray-400" />;
    }
    if (authStatus.isExpired) {
      return <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />;
    }
    if (authStatus.daysUntilExpiry && authStatus.daysUntilExpiry <= 7) {
      return <ClockIcon className="h-8 w-8 text-yellow-500" />;
    }
    return <CheckCircleIcon className="h-8 w-8 text-green-500" />;
  };

  const getStatusMessage = () => {
    if (!authStatus.isAuthenticated) {
      return 'Not connected to Zoho Cliq';
    }
    if (authStatus.isExpired) {
      return 'Authentication expired - auto-refresh failed, please reconnect';
    }
    if (authStatus.daysUntilExpiry && authStatus.daysUntilExpiry <= 7) {
      return `Authentication expires in ${authStatus.daysUntilExpiry} day(s) - will auto-refresh`;
    }
    return 'Successfully connected to Zoho Cliq - auto-refresh enabled';
  };

  if (loading) {
    return (
      <DashboardLayout title="Zoho Cliq Integration" allowedRoles={['super_admin']}>
        <div className="animate-pulse space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Zoho Cliq Integration"
      description="Configure Zoho Cliq authentication and channel synchronization"
      allowedRoles={['super_admin']}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Connection Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <LinkIcon className="h-5 w-5 mr-2" />
              Connection Status
            </h3>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {getStatusIcon()}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    Zoho Cliq API
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {getStatusMessage()}
                  </p>
                  {authStatus.auth && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Authenticated by: {authStatus.auth.authenticated_by} • 
                      Last updated: {new Date(authStatus.auth.updated_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex space-x-2">
                {authStatus.isAuthenticated ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={testConnection}
                      loading={testingConnection}
                      disabled={authStatus.isExpired}
                    >
                      Test Connection
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={refreshTokens}
                      loading={setupLoading}
                    >
                      <ArrowPathIcon className="h-4 w-4 mr-1" />
                      {authStatus.isExpired ? 'Refresh Now' : 'Manual Refresh'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={revokeAccess}
                      loading={setupLoading}
                      className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                    >
                      Revoke Access
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setShowSetupModal(true)}>
                    Connect to Zoho Cliq
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Setup Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <div className="flex items-start">
            <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Zoho Cliq Integration Setup
              </h3>
              <div className="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-2">
                <p>This integration allows TCIS to automatically fetch messages from Zoho Cliq channels and process them for insights.</p>
                <div>
                  <p className="font-medium">Required permissions:</p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li><code>ZohoCliq.Channels.READ</code> - Read channel information and list organization channels</li>
                    <li><code>ZohoCliq.Messages.READ</code> - Fetch messages from mapped channels for processing</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Channel Mapping Overview */}
        {authStatus.isAuthenticated && !authStatus.isExpired && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <GlobeAltIcon className="h-5 w-5 mr-2" />
                Channel Mapping
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Map Zoho Cliq channels to client rooms in the client management interface
              </p>
            </div>
            <div className="p-6">
              <div className="text-center py-8">
                <GlobeAltIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Ready for Channel Mapping
                </h4>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Go to any client's room management page to map Zoho Cliq channels
                </p>
                <Button
                  variant="outline"
                  onClick={() => window.location.href = '/clients'}
                >
                  Go to Client Management
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Setup Modal */}
      <Modal
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        title="Connect Zoho Cliq"
        description="Set up OAuth authentication with Zoho Cliq"
        size="lg"
      >
        <div className="space-y-6">
          {/* Step 1: OAuth Application Setup */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
              Step 1: Zoho OAuth Application
            </h4>
            <div className="space-y-4">
              <Input
                label="Client ID"
                type="text"
                value={setupForm.client_id}
                onChange={(e) => handleFormChange('client_id', e.target.value)}
                placeholder="Enter your Zoho OAuth Client ID"
                startIcon={<KeyIcon className="h-5 w-5" />}
                required
              />
              <Input
                label="Client Secret"
                type="password"
                value={setupForm.client_secret}
                onChange={(e) => handleFormChange('client_secret', e.target.value)}
                placeholder="Enter your Zoho OAuth Client Secret"
                startIcon={<KeyIcon className="h-5 w-5" />}
                required
              />
              <Input
                label="Redirect URI"
                type="url"
                value={setupForm.redirect_uri}
                onChange={(e) => handleFormChange('redirect_uri', e.target.value)}
                placeholder={`${typeof window !== 'undefined' ? window.location.origin : 'https://tcisv2.vercel.app'}/auth/zoho/callback`}
                startIcon={<GlobeAltIcon className="h-5 w-5" />}
                helperText="This should match the redirect URI configured in your Zoho OAuth app"
                required
              />
            </div>
          </div>

          {/* Step 2: Authorization */}
          {setupForm.client_id && setupForm.client_secret && setupForm.redirect_uri && (
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                Step 2: Authorization
              </h4>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Click the button below to authorize TCIS to access your Zoho Cliq:
                  </p>
                                      <Button
                      onClick={handleOAuthPopup}
                      className="w-full"
                    >
                      Authorize with Zoho Cliq
                    </Button>
                </div>
                
                <Input
                  label="Authorization Code"
                  type="text"
                  value={oauthForm.authorization_code}
                  onChange={(e) => setOauthForm({ authorization_code: e.target.value })}
                  placeholder="Paste the authorization code here"
                  helperText="Copy the authorization code from the redirect URL after authorizing"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowSetupModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleOAuthComplete}
              loading={setupLoading}
              disabled={!oauthForm.authorization_code.trim()}
            >
              Complete Setup
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
