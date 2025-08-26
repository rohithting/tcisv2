'use client';

import React, { useState, useEffect } from 'react';
import { SessionHealthMetrics, SessionState } from '@/types/auth';
import { 
  ChartBarIcon, 
  ClockIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  RefreshIcon
} from '@heroicons/react/24/outline';

interface SessionHealthDashboardProps {
  metrics: SessionHealthMetrics;
  sessionState: SessionState;
  healthScore: number;
  onRefresh: () => void;
  className?: string;
}

export const SessionHealthDashboard: React.FC<SessionHealthDashboardProps> = ({
  metrics,
  sessionState,
  healthScore,
  onRefresh,
  className = ''
}) => {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    setLastUpdate(new Date());
  }, [metrics]);

  const getHealthStatus = () => {
    if (healthScore >= 80) return { status: 'Excellent', color: 'text-green-600', bgColor: 'bg-green-100' };
    if (healthScore >= 60) return { status: 'Good', color: 'text-blue-600', bgColor: 'bg-blue-100' };
    if (healthScore >= 40) return { status: 'Fair', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
    if (healthScore >= 20) return { status: 'Poor', color: 'text-orange-600', bgColor: 'bg-orange-100' };
    return { status: 'Critical', color: 'text-red-600', bgColor: 'bg-red-100' };
  };

  const getSessionStateInfo = () => {
    const stateInfo = {
      [SessionState.ACTIVE]: { label: 'Active', color: 'text-green-600', bgColor: 'bg-green-100' },
      [SessionState.REFRESHING]: { label: 'Refreshing', color: 'text-blue-600', bgColor: 'bg-blue-100' },
      [SessionState.EXPIRED]: { label: 'Expired', color: 'text-red-600', bgColor: 'bg-red-100' },
      [SessionState.ERROR]: { label: 'Error', color: 'text-red-600', bgColor: 'bg-red-100' },
      [SessionState.AUTHENTICATING]: { label: 'Authenticating', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
      [SessionState.INITIALIZING]: { label: 'Initializing', color: 'text-gray-600', bgColor: 'bg-gray-100' }
    };

    return stateInfo[sessionState] || { label: 'Unknown', color: 'text-gray-600', bgColor: 'bg-gray-100' };
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatPercentage = (value: number): string => {
    return `${Math.round(value)}%`;
  };

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />;
    if (current < previous) return <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />;
    return <ArrowTrendingUpIcon className="h-4 w-4 text-gray-400" />;
  };

  const healthStatus = getHealthStatus();
  const sessionStateInfo = getSessionStateInfo();

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <ChartBarIcon className="h-8 w-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Session Health Dashboard</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshIcon className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Health Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Overall Health Score */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Overall Health</p>
              <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{healthScore}/100</p>
            </div>
            <div className={`p-3 rounded-full ${healthStatus.bgColor}`}>
              <CheckCircleIcon className={`h-8 w-8 ${healthStatus.color}`} />
            </div>
          </div>
          <p className={`text-sm font-medium ${healthStatus.color} mt-2`}>
            {healthStatus.status}
          </p>
        </div>

        {/* Session State */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">Session State</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                {sessionStateInfo.label}
              </p>
            </div>
            <div className={`p-3 rounded-full ${sessionStateInfo.bgColor}`}>
              <CheckCircleIcon className={`h-6 w-6 ${sessionStateInfo.color}`} />
            </div>
          </div>
        </div>

        {/* Active Sessions */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Active Sessions</p>
              <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                {metrics.activeSessions}
              </p>
            </div>
            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-800">
              <ClockIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Token Refresh Success Rate */}
        <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Refresh Success</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatPercentage(metrics.tokenRefreshSuccessRate)}
              </p>
            </div>
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        {/* Average Session Duration */}
        <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Duration</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatDuration(metrics.averageSessionDuration)}
              </p>
            </div>
            <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
              <ClockIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        {/* Failed Auth Attempts */}
        <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Auth Failures</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {metrics.failedAuthAttempts}
              </p>
            </div>
            <div className="p-2 rounded-full bg-red-100 dark:bg-red-900">
              <ExclamationCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        {/* Session Expiry Events */}
        <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Expiry Events</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {metrics.sessionExpiryEvents}
              </p>
            </div>
            <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900">
              <ExclamationTriangleIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      {/* User Experience Score */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900 dark:to-blue-900 p-6 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">User Experience Score</h3>
          <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {metrics.userExperienceScore}/100
          </span>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div 
            className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${metrics.userExperienceScore}%` }}
          ></div>
        </div>
        
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mt-2">
          <span>Poor</span>
          <span>Fair</span>
          <span>Good</span>
          <span>Excellent</span>
        </div>
      </div>

      {/* Last Health Check */}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Last health check: {new Date(metrics.lastHealthCheck).toLocaleString()}
        </p>
      </div>
    </div>
  );
};
