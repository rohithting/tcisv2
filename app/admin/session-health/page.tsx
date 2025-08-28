'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SessionHealthDashboard } from '@/components/admin/SessionHealthDashboard';
import { Button } from '@/components/ui/Button';
import { 
  PlayIcon, 
  StopIcon, 
  ArrowPathIcon,
  ChartBarIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';

export default function SessionHealthPage() {
  const { 
    user, 
    platformUser, 
    session,
    startSessionManagement,
    stopSessionManagement,
    getSessionHealth,
    forceRefreshSession,
    getCacheManager
  } = useAuth();
  
  const [sessionHealth, setSessionHealth] = useState<any>(null);
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [isSessionManagementActive, setIsSessionManagementActive] = useState(false);

  // Update session health every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const health = getSessionHealth();
      if (health) {
        setSessionHealth(health);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [getSessionHealth]);

  // Update cache stats every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const cacheManager = getCacheManager();
      if (cacheManager) {
        const stats = cacheManager.getStats();
        setCacheStats(stats);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [getCacheManager]);

  const handleStartSessionManagement = () => {
    startSessionManagement();
    setIsSessionManagementActive(true);
  };

  const handleStopSessionManagement = () => {
    stopSessionManagement();
    setIsSessionManagementActive(false);
  };

  const handleForceRefresh = async () => {
    const success = await forceRefreshSession();
    if (success) {
      console.log('✅ Session force refreshed successfully');
    } else {
      console.log('❌ Session force refresh failed');
    }
  };

  const handleRefreshHealth = () => {
    const health = getSessionHealth();
    if (health) {
      setSessionHealth(health);
    }
  };

  if (!user || !platformUser) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            You must be logged in to view this page.
          </p>
        </div>
      </div>
    );
  }

  // Mock health metrics for testing
  const mockHealthMetrics = {
    activeSessions: 1,
    averageSessionDuration: Math.floor((Date.now() - (session?.created_at ? new Date(session.created_at).getTime() : Date.now())) / 1000),
    tokenRefreshSuccessRate: 95,
    failedAuthAttempts: 0,
    sessionExpiryEvents: 0,
    userExperienceScore: 85,
    lastHealthCheck: Date.now()
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Session Health Management
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Monitor and manage professional session management services
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isSessionManagementActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {isSessionManagementActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Control Panel
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Button
              onClick={handleStartSessionManagement}
              disabled={isSessionManagementActive}
              className="flex items-center space-x-2"
            >
              <PlayIcon className="h-4 w-4" />
              <span>Start Services</span>
            </Button>
            
            <Button
              onClick={handleStopSessionManagement}
              disabled={!isSessionManagementActive}
              variant="secondary"
              className="flex items-center space-x-2"
            >
              <StopIcon className="h-4 w-4" />
              <span>Stop Services</span>
            </Button>
            
            <Button
              onClick={handleForceRefresh}
              className="flex items-center space-x-2"
            >
              <ArrowPathIcon className="h-4 w-4" />
              <span>Force Refresh</span>
            </Button>
            
            <Button
              onClick={handleRefreshHealth}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <ChartBarIcon className="h-4 w-4" />
              <span>Refresh Health</span>
            </Button>
          </div>
        </div>

        {/* Session Health Dashboard */}
        <div className="mb-8">
          <SessionHealthDashboard
            metrics={mockHealthMetrics}
            sessionState={sessionHealth?.state || 'active'}
            healthScore={sessionHealth?.healthScore || 85}
            onRefresh={handleRefreshHealth}
          />
        </div>

        {/* Session Health Details */}
        {sessionHealth && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Session Health Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Health Score</h3>
                <p className="text-2xl font-bold text-blue-600">{sessionHealth.healthScore}/100</p>
              </div>
              
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Status</h3>
                <p className="text-lg font-semibold text-green-600">{sessionHealth.isHealthy ? 'Healthy' : 'Unhealthy'}</p>
              </div>
              
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Needs Refresh</h3>
                <p className="text-lg font-semibold text-orange-600">{sessionHealth.needsRefresh ? 'Yes' : 'No'}</p>
              </div>
              
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Time Until Expiry</h3>
                <p className="text-lg font-semibold text-blue-600">
                  {Math.floor(sessionHealth.timeUntilExpiry / 1000)}s
                </p>
              </div>
              
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Time Until Refresh</h3>
                <p className="text-lg font-semibold text-yellow-600">
                  {Math.floor(sessionHealth.timeUntilRefresh / 1000)}s
                </p>
              </div>
              
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Expires At</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {sessionHealth.expiresAt?.toLocaleString() || 'Unknown'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Cache Statistics */}
        {cacheStats && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Cache Statistics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Total Entries</h3>
                <p className="text-2xl font-bold text-blue-600">{cacheStats.totalEntries}</p>
              </div>
              
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Fresh Entries</h3>
                <p className="text-2xl font-bold text-green-600">{cacheStats.freshEntries}</p>
              </div>
              
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Stale Entries</h3>
                <p className="text-2xl font-bold text-yellow-600">{cacheStats.staleEntries}</p>
              </div>
              
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Memory Usage</h3>
                <p className="text-lg font-semibold text-purple-600">
                  {Math.round(cacheStats.memoryUsage / 1024)} KB
                </p>
              </div>
            </div>
          </div>
        )}

        {/* User Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            User Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">User ID</h3>
              <p className="text-gray-600 dark:text-gray-400 font-mono text-sm">{user.id}</p>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Email</h3>
              <p className="text-gray-600 dark:text-gray-400">{user.email}</p>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Platform Role</h3>
              <p className="text-gray-600 dark:text-gray-400">{platformUser.platform_role}</p>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Session Created</h3>
              <p className="text-gray-600 dark:text-gray-400">
                {session?.created_at ? new Date(session.created_at).toLocaleString() : 'Unknown'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
