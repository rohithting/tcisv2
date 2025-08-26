'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { 
  UserCircleIcon, 
  Cog6ToothIcon, 
  ExclamationTriangleIcon,
  BuildingOfficeIcon,
  ChatBubbleLeftRightIcon,
  DocumentArrowUpIcon,
  ChartBarIcon,
  ChevronRightIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowTrendingUpIcon,
  DocumentTextIcon,
  UsersIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  BellIcon,
  CogIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const { platformUser, supabase } = useAuth();
  const searchParams = useSearchParams();
  const [dashboardStats, setDashboardStats] = useState<{
    totalClients: number;
    totalConversations: number;
    totalMessages: number;
    totalJobs: number;
    recentActivity: any[];
    systemHealth: 'healthy' | 'warning' | 'error';
    pendingTasks: number;
  }>({
    totalClients: 0,
    totalConversations: 0,
    totalMessages: 0,
    totalJobs: 0,
    recentActivity: [],
    systemHealth: 'healthy',
    pendingTasks: 0
  });
  const [loading, setLoading] = useState(true);

  // Show welcome message if user just verified their email
  useEffect(() => {
    const verified = searchParams.get('verified');
    if (verified === 'true') {
      toast.success('Welcome to ting TCIS! Your email has been verified.');
      // Clean up the URL
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [searchParams]);

  // Fetch dashboard statistics
  useEffect(() => {
    const fetchDashboardStats = async () => {
      if (!supabase) return;
      
      setLoading(true);
      try {
        // Fetch basic counts
        const [clientsCount, conversationsCount, messagesCount, jobsCount] = await Promise.all([
          supabase.from('clients').select('*', { count: 'exact', head: true }),
          supabase.from('conversations').select('*', { count: 'exact', head: true }),
          supabase.from('queries').select('*', { count: 'exact', head: true }),
          supabase.from('jobs').select('*', { count: 'exact', head: true })
        ]);

        // Fetch recent activity
        const { data: recentActivity } = await supabase
          .from('conversations')
          .select(`
            id,
            title,
            created_at,
            clients!inner(name)
          `)
          .order('created_at', { ascending: false })
          .limit(5);

        // Fetch pending jobs using our Edge Function
        let pendingJobs = 0;
        try {
          const { data: pendingJobsData, error: pendingJobsError } = await supabase.functions.invoke('jobs', {
            body: { action: 'list', client_id: 1, status: 'pending,queued,processing' }
          });
          
          pendingJobs = pendingJobsError ? 0 : (pendingJobsData?.jobs?.length || 0);
        } catch (error) {
          console.warn('Could not fetch pending jobs from Edge Function, using fallback');
          pendingJobs = 0;
        }

        setDashboardStats({
          totalClients: clientsCount.count || 0,
          totalConversations: conversationsCount.count || 0,
          totalMessages: messagesCount.count || 0,
          totalJobs: jobsCount.count || 0,
          recentActivity: recentActivity || [],
          systemHealth: 'healthy',
          pendingTasks: pendingJobs || 0
        });

      } catch (error: any) {
        console.error('Error fetching dashboard stats:', error);
        setDashboardStats(prev => ({ ...prev, systemHealth: 'warning' }));
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, [supabase]);

  return (
    <DashboardLayout 
      title={`Welcome back, ${platformUser?.full_name || 'User'}!`}
      description={
        platformUser?.platform_role === 'user' 
          ? "Contact your administrator to get started"
          : "Here's what you can do today"
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-8 sm:py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ffe600]"></div>
        </div>
      ) : (
        <div className="space-y-6 sm:space-y-8">
          {/* Platform Overview Stats */}
          {platformUser?.platform_role !== 'user' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <StatCard
                title="Total Clients"
                value={dashboardStats.totalClients}
                change="+12%"
                changeType="positive"
                icon={<BuildingOfficeIcon className="h-5 w-5 sm:h-6 sm:w-6" />}
                color="blue"
              />
              <StatCard
                title="Conversations"
                value={dashboardStats.totalConversations}
                change="+8%"
                changeType="positive"
                icon={<ChatBubbleLeftRightIcon className="h-5 w-5 sm:h-6 sm:w-6" />}
                color="green"
              />
              <StatCard
                title="Messages Processed"
                value={dashboardStats.totalMessages}
                change="+23%"
                changeType="positive"
                icon={<DocumentTextIcon className="h-5 w-5 sm:h-6 sm:w-6" />}
                color="purple"
              />
              <StatCard
                title="Pending Tasks"
                value={dashboardStats.pendingTasks}
                change="+5%"
                changeType="warning"
                icon={<ClockIcon className="h-5 w-5 sm:h-6 sm:w-6" />}
                color="yellow"
              />
            </div>
          )}

          {/* System Health & Quick Actions */}
          {platformUser?.platform_role !== 'user' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* System Health */}
              <div className="lg:col-span-1">
                <SystemHealthCard health={dashboardStats.systemHealth} />
              </div>
              
              {/* Quick Actions */}
              <div className="lg:col-span-2">
                <QuickActionsCard platformUser={platformUser} />
              </div>
            </div>
          )}

          {/* Role-based Dashboard */}
          <div className="space-y-4 sm:space-y-6">
            {getRoleDashboard(platformUser)}
          </div>

          {/* Recent Activity */}
          {platformUser?.platform_role !== 'user' && dashboardStats.recentActivity.length > 0 && (
            <RecentActivityCard activities={dashboardStats.recentActivity} />
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

function getRoleDashboard(platformUser: any) {
  if (!platformUser) {
    return <div>Loading user data...</div>;
  }

  switch (platformUser.platform_role) {
    case 'user':
      return (
        <div className="text-center py-8 sm:py-12">
          <ExclamationTriangleIcon className="h-12 w-12 sm:h-16 sm:w-16 text-yellow-500 mx-auto mb-4 sm:mb-6" />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
            No Client Access
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6 max-w-md mx-auto px-4">
            You currently don't have access to any clients. Please contact your administrator 
            for assignment to get started with <span className="ting-text font-semibold">ting</span> TCIS.
          </p>
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your current role: <span className="font-semibold capitalize">{platformUser.platform_role}</span>
            </p>
            <Button variant="outline" onClick={() => window.location.href = 'mailto:admin@ting.in'}>
              Contact Administrator
            </Button>
          </div>
        </div>
      );

    case 'super_admin':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <DashboardCard
            title="Platform Users"
            description="Manage all platform users and roles"
            icon={<UserCircleIcon className="h-6 w-6 sm:h-8 sm:w-8" />}
            href="/dashboard/users"
            color="blue"
          />
          <DashboardCard
            title="Clients"
            description="View and manage all clients"
            icon={<BuildingOfficeIcon className="h-6 w-6 sm:h-8 sm:w-8" />}
            href="/clients"
            color="green"
          />
          <DashboardCard
            title="System Settings"
            description="Configure platform settings"
            icon={<Cog6ToothIcon className="h-6 w-6 sm:h-8 sm:w-8" />}
            href="/settings"
            color="purple"
          />
          <DashboardCard
            title="Analytics"
            description="Platform-wide analytics and insights"
            icon={<ChartBarIcon className="h-6 w-6 sm:h-8 sm:w-8" />}
            href="/analytics"
            color="yellow"
          />
        </div>
      );

    case 'backend':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <DashboardCard
            title="All Clients"
            description="View all clients and their data"
            icon={<BuildingOfficeIcon className="h-6 w-6 sm:h-8 sm:w-8" />}
            href="/clients"
            color="blue"
          />
          <DashboardCard
            title="Chat Analysis"
            description="Start chat analysis sessions"
            icon={<ChatBubbleLeftRightIcon className="h-6 w-6 sm:h-8 sm:w-8" />}
            href="/chat"
            color="green"
          />
          <DashboardCard
            title="Upload Monitor"
            description="Monitor upload status and processing"
            icon={<DocumentArrowUpIcon className="h-6 w-6 sm:h-8 sm:w-8" />}
            href="/clients"
            color="purple"
          />
        </div>
      );

    case 'admin':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <DashboardCard
            title="My Clients"
            description="Manage your assigned clients"
            icon={<BuildingOfficeIcon className="h-6 w-6 sm:h-8 sm:w-8" />}
            href="/clients"
            color="blue"
          />
          <DashboardCard
            title="Chat Analysis"
            description="Start chat analysis sessions"
            icon={<ChatBubbleLeftRightIcon className="h-6 w-6 sm:h-8 sm:w-8" />}
            href="/chat"
            color="green"
          />
          <DashboardCard
            title="Upload & Process"
            description="Upload files and monitor jobs"
            icon={<DocumentArrowUpIcon className="h-6 w-6 sm:h-8 sm:w-8" />}
            href="/clients"
            color="purple"
          />
        </div>
      );

    case 'manager':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <DashboardCard
            title="Chat Analysis"
            description="Begin new chat analysis sessions"
            icon={<ChatBubbleLeftRightIcon className="h-6 w-6 sm:h-8 sm:w-8" />}
            href="/chat"
            color="blue"
          />
          <DashboardCard
            title="My Conversations"
            description="View your conversation history"
            icon={<ChartBarIcon className="h-6 w-6 sm:h-8 sm:w-8" />}
            href="/chat"
            color="green"
          />
        </div>
      );

    default:
      return (
        <div className="text-center py-8 sm:py-12">
          <p className="text-gray-600 dark:text-gray-400">
            Unknown role: {platformUser.platform_role}
          </p>
        </div>
      );
  }
}

interface DashboardCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: 'blue' | 'green' | 'purple' | 'yellow';
}

function DashboardCard({ title, description, icon, href, color }: DashboardCardProps) {
  const colorClasses = {
    blue: 'text-blue-600 dark:text-blue-400 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10',
    green: 'text-green-600 dark:text-green-400 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10',
    purple: 'text-purple-600 dark:text-purple-400 bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10',
    yellow: 'text-[#ffe600] dark:text-[#ffe600] bg-gradient-to-br from-[#ffe600]/10 to-[#ffe600]/5 dark:from-[#ffe600]/10 dark:to-[#ffe600]/5',
  };

  const hoverClasses = {
    blue: 'hover:shadow-blue-100 dark:hover:shadow-blue-900/20',
    green: 'hover:shadow-green-100 dark:hover:shadow-green-900/20',
    purple: 'hover:shadow-purple-100 dark:hover:shadow-purple-900/20',
    yellow: 'hover:shadow-[#ffe600]/20 dark:hover:shadow-[#ffe600]/10',
  };

  return (
    <a
      href={href}
      className={`group block p-4 sm:p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-300 hover:-translate-y-1 ${hoverClasses[color]}`}
    >
      <div className={`inline-flex p-3 sm:p-4 rounded-xl ${colorClasses[color]} mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300`}>
        {icon}
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-gray-800 dark:group-hover:text-gray-100">
        {title}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
        {description}
      </p>
      
      {/* Arrow indicator */}
      <div className="mt-3 sm:mt-4 flex items-center text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors duration-300">
        <span className="text-sm font-medium">Learn more</span>
        <ChevronRightIcon className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
      </div>
    </a>
  );
}

// Enhanced Stat Card Component
interface StatCardProps {
  title: string;
  value: number;
  change: string;
  changeType: 'positive' | 'negative' | 'warning';
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'yellow';
}

function StatCard({ title, value, change, changeType, icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20',
    green: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20',
    purple: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/20',
    yellow: 'text-[#ffe600] bg-[#ffe600]/10',
  };

  const changeClasses = {
    positive: 'text-green-600 dark:text-green-400',
    negative: 'text-red-600 dark:text-red-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-lg transition-all duration-300">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className={`p-2 sm:p-3 rounded-xl ${colorClasses[color]}`}>
          {icon}
        </div>
        <div className={cn(
          "text-xs sm:text-sm font-medium px-2 py-1 rounded-full",
          changeType === 'positive'
            ? "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/20"
            : changeType === 'negative'
            ? "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/20"
            : "text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20"
        )}>
          {change}
        </div>
      </div>
      <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">
        {value.toLocaleString()}
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {title}
      </div>
    </div>
  );
}

// System Health Card Component
interface SystemHealthCardProps {
  health: 'healthy' | 'warning' | 'error';
}

function SystemHealthCard({ health }: SystemHealthCardProps) {
  const healthConfig = {
    healthy: {
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-100 dark:bg-green-900/20',
      icon: CheckCircleIcon,
      label: 'All Systems Operational',
      description: 'Platform is running smoothly'
    },
    warning: {
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-100 dark:bg-yellow-900/20',
      icon: ExclamationCircleIcon,
      label: 'Minor Issues Detected',
      description: 'Some systems may have delays'
    },
    error: {
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-100 dark:bg-red-900/20',
      icon: ExclamationCircleIcon,
      label: 'System Issues Detected',
      description: 'Contact support immediately'
    }
  };

  const config = healthConfig[health];
  const Icon = config.icon;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="flex items-center space-x-3 mb-3 sm:mb-4">
        <div className={`p-2 sm:p-3 rounded-xl ${config.bg}`}>
          <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${config.color}`} />
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
            System Health
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {config.label}
          </p>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 sm:mb-4">
        {config.description}
      </p>
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${
          config.color === 'text-green-600 dark:text-green-400' ? 'bg-green-600' :
          config.color === 'text-yellow-600 dark:text-yellow-400' ? 'bg-yellow-600' :
          'bg-red-600'
        }`} />
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Last checked: {new Date().toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

// Quick Actions Card Component
interface QuickActionsCardProps {
  platformUser: any;
}

function QuickActionsCard({ platformUser }: QuickActionsCardProps) {
  const actions = [
    {
      title: 'Create Client',
      description: 'Add a new client to the platform',
      icon: <BuildingOfficeIcon className="h-4 w-5 sm:h-5 sm:w-5" />,
      href: '/clients',
      color: 'blue',
      roles: ['super_admin', 'backend', 'admin']
    },
    {
      title: 'Start Chat',
      description: 'Begin a new conversation analysis',
      icon: <ChatBubbleLeftRightIcon className="h-4 w-5 sm:h-5 sm:w-5" />,
      href: '/chat',
      color: 'green',
      roles: ['super_admin', 'backend', 'admin', 'manager']
    },
    {
      title: 'Upload Files',
      description: 'Process new chat exports',
      icon: <DocumentArrowUpIcon className="h-4 w-5 sm:h-5 sm:w-5" />,
      href: '/clients',
      color: 'purple',
      roles: ['super_admin', 'backend', 'admin']
    },
    {
      title: 'View Analytics',
      description: 'Check platform performance',
      icon: <ChartBarIcon className="h-4 w-5 sm:h-5 sm:w-5" />,
      href: '/analytics',
      color: 'yellow',
      roles: ['super_admin', 'backend', 'admin']
    }
  ];

  const filteredActions = actions.filter(action => 
    action.roles.includes(platformUser?.platform_role)
  );

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
        Quick Actions
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {filteredActions.map((action, index) => (
          <a
            key={index}
            href={action.href}
            className="group p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-800 group-hover:scale-110 transition-transform duration-200`}>
                <div className={cn(
                  'text-gray-600 dark:text-gray-400',
                  action.color === 'blue' && 'text-blue-600 dark:text-blue-400',
                  action.color === 'green' && 'text-green-600 dark:text-green-400',
                  action.color === 'purple' && 'text-purple-600 dark:text-purple-400',
                  action.color === 'yellow' && 'text-[#ffe600]'
                )}>
                  {action.icon}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-300 truncate">
                  {action.title}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                  {action.description}
                </p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// Recent Activity Card Component
interface RecentActivityCardProps {
  activities: any[];
}

function RecentActivityCard({ activities }: RecentActivityCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
          Recent Activity
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Latest conversations and platform activity
        </p>
      </div>
      <div className="p-4 sm:p-6">
        <div className="space-y-3 sm:space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-2 sm:space-y-0">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-[#ffe600]/10 to-[#ffe600]/5 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ChatBubbleLeftRightIcon className="h-4 w-4 sm:h-5 sm:w-5 text-[#ffe600]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {activity.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {activity.clients.name}
                  </p>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(activity.created_at).toLocaleDateString()}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {new Date(activity.created_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" className="w-full">
            View All Activity
          </Button>
        </div>
      </div>
    </div>
  );
}