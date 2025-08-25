'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ChartBarIcon,
  ArrowTrendingUpIcon,
  UsersIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function AnalyticsPage() {
  const { supabase } = useAuth();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [metrics, setMetrics] = useState({
    totalClients: 0,
    activeConversations: 0,
    messagesProcessed: 0,
    insightsGenerated: 0,
    clientGrowth: 0,
    conversationGrowth: 0,
    messageGrowth: 0,
    insightGrowth: 0
  });
  const [conversationTrends, setConversationTrends] = useState<any[]>([]);
  const [clientActivity, setClientActivity] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  // Fetch analytics data
  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!supabase) return;
      
      setLoading(true);
      try {
        // Get date range
        const now = new Date();
        const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
        const startDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));

        // Fetch total clients
        const { count: totalClients } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true });

        // Fetch active clients (clients with recent activity)
        const { count: activeClients } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .gte('updated_at', startDate.toISOString());

        // Fetch conversations
        const { count: totalConversations } = await supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true });

        const { count: activeConversations } = await supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startDate.toISOString());

        // Fetch messages/queries
        const { count: totalMessages } = await supabase
          .from('queries')
          .select('*', { count: 'exact', head: true });

        const { count: recentMessages } = await supabase
          .from('queries')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startDate.toISOString());

        // Fetch jobs for insights
        const { count: totalJobs } = await supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true });

        const { count: recentJobs } = await supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startDate.toISOString());

        // Calculate growth percentages
        const clientGrowth = totalClients > 0 ? Math.round(((activeClients - (totalClients - activeClients)) / totalClients) * 100) : 0;
        const conversationGrowth = totalConversations > 0 ? Math.round(((activeConversations - (totalConversations - activeConversations)) / totalConversations) * 100) : 0;
        const messageGrowth = totalMessages > 0 ? Math.round(((recentMessages - (totalMessages - recentMessages)) / totalMessages) * 100) : 0;
        const insightGrowth = totalJobs > 0 ? Math.round(((recentJobs - (totalJobs - recentJobs)) / totalJobs) * 100) : 0;

        setMetrics({
          totalClients: totalClients || 0,
          activeConversations: activeConversations || 0,
          messagesProcessed: totalMessages || 0,
          insightsGenerated: totalJobs || 0,
          clientGrowth,
          conversationGrowth,
          messageGrowth,
          insightGrowth
        });

        // Fetch conversation trends (daily counts for the selected period)
        const { data: trendsData } = await supabase
          .from('conversations')
          .select('created_at')
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: true });

        if (trendsData) {
          const dailyTrends = groupByDate(trendsData, 'created_at', daysAgo);
          setConversationTrends(dailyTrends);
        }

        // Fetch client activity (top clients by conversation count)
        const { data: clientData } = await supabase
          .from('conversations')
          .select(`
            id,
            client_id,
            clients!inner(name)
          `)
          .gte('created_at', startDate.toISOString());

        if (clientData) {
          const clientCounts = clientData.reduce((acc: any, conv: any) => {
            const clientId = conv.client_id;
            if (!acc[clientId]) {
              acc[clientId] = { id: clientId, name: conv.clients.name, count: 0 };
            }
            acc[clientId].count++;
            return acc;
          }, {});
          
          const topClients = Object.values(clientCounts)
            .sort((a: any, b: any) => b.count - a.count)
            .slice(0, 5);
          
          setClientActivity(topClients);
        }

        // Fetch recent activity
        const { data: activityData } = await supabase
          .from('conversations')
          .select(`
            id,
            title,
            created_at,
            clients!inner(name)
          `)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false })
          .limit(10);

        if (activityData) {
          setRecentActivity(activityData);
        }

      } catch (error: any) {
        console.error('Error fetching analytics:', error);
        toast.error('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [supabase, timeRange]);

  // Helper function to group data by date
  const groupByDate = (data: any[], dateField: string, days: number) => {
    const result = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
      const dateStr = date.toISOString().split('T')[0];
      const count = data.filter(item => 
        item[dateField].split('T')[0] === dateStr
      ).length;
      
      result.push({
        date: dateStr,
        count,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      });
    }
    
    return result;
  };

  if (loading) {
    return (
      <DashboardLayout 
        title="Analytics"
        description="Platform-wide insights and performance metrics"
        allowedRoles={['super_admin', 'backend', 'admin']}
      >
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ffe600]"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Analytics"
      description="Platform-wide insights and performance metrics"
      allowedRoles={['super_admin', 'backend', 'admin']}
    >
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Clients"
            value={metrics.totalClients.toString()}
            change={`${metrics.clientGrowth >= 0 ? '+' : ''}${metrics.clientGrowth}%`}
            changeType={metrics.clientGrowth >= 0 ? 'positive' : 'negative'}
            icon={<UsersIcon className="h-6 w-6" />}
          />
          <MetricCard
            title="Active Conversations"
            value={metrics.activeConversations.toString()}
            change={`${metrics.conversationGrowth >= 0 ? '+' : ''}${metrics.conversationGrowth}%`}
            changeType={metrics.conversationGrowth >= 0 ? 'positive' : 'negative'}
            icon={<ChatBubbleLeftRightIcon className="h-6 w-6" />}
          />
          <MetricCard
            title="Messages Processed"
            value={metrics.messagesProcessed.toLocaleString()}
            change={`${metrics.messageGrowth >= 0 ? '+' : ''}${metrics.messageGrowth}%`}
            changeType={metrics.messageGrowth >= 0 ? 'positive' : 'negative'}
            icon={<DocumentTextIcon className="h-6 w-6" />}
          />
          <MetricCard
            title="Insights Generated"
            value={metrics.insightsGenerated.toString()}
            change={`${metrics.insightGrowth >= 0 ? '+' : ''}${metrics.insightGrowth}%`}
            changeType={metrics.insightGrowth >= 0 ? 'positive' : 'negative'}
            icon={<ChartBarIcon className="h-6 w-6" />}
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="Conversation Trends"
            description={`Daily conversation volume over the past ${timeRange === '7d' ? '7' : timeRange === '30d' ? '30' : '90'} days`}
            data={conversationTrends}
            type="trend"
          />
          <ChartCard
            title="Client Activity"
            description="Most active clients by conversation volume"
            data={clientActivity}
            type="client"
          />
        </div>

        {/* Detailed Analytics */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Recent Activity
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Latest platform activity and insights
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <CalendarIcon className="h-5 w-5 text-gray-400" />
                <select 
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                </select>
              </div>
            </div>
          </div>
          <div className="p-6">
            {recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <ChatBubbleLeftRightIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  No recent activity found for the selected time period
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#ffe600]/10 to-[#ffe600]/5 rounded-lg flex items-center justify-center">
                        <ChatBubbleLeftRightIcon className="h-5 w-5 text-[#ffe600]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {activity.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {activity.clients.name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
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
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative';
  icon: React.ReactNode;
}

function MetricCard({ title, value, change, changeType, icon }: MetricCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
          <div className="text-primary-600 dark:text-primary-400">
            {icon}
          </div>
        </div>
        <div className={`flex items-center text-sm font-medium ${
          changeType === 'positive' ? 'text-green-600' : 'text-red-600'
        }`}>
          <ArrowTrendingUpIcon className={`h-4 w-4 mr-1 ${
            changeType === 'negative' ? 'rotate-180' : ''
          }`} />
          {change}
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
        {value}
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {title}
      </div>
    </div>
  );
}

interface ChartCardProps {
  title: string;
  description: string;
  data: any[];
  type: 'trend' | 'client';
}

function ChartCard({ title, description, data, type }: ChartCardProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {description}
          </p>
        </div>
        
        <div className="h-64 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No data available for the selected time period
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'trend') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {description}
          </p>
        </div>
        
        {/* Trend Chart */}
        <div className="h-64 flex items-end justify-between space-x-1">
          {data.map((item, index) => {
            const maxCount = Math.max(...data.map(d => d.count));
            const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
            
            return (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-t-sm relative group">
                  <div 
                    className="bg-gradient-to-t from-[#ffe600] to-[#ffd700] rounded-t-sm transition-all duration-300 hover:opacity-80"
                    style={{ height: `${height}%` }}
                  />
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                    {item.count} conversations
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (type === 'client') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {description}
          </p>
        </div>
        
        {/* Client Activity Chart */}
        <div className="space-y-4">
          {data.map((client, index) => {
            const maxCount = Math.max(...data.map(c => c.count));
            const width = maxCount > 0 ? (client.count / maxCount) * 100 : 0;
            
            return (
              <div key={client.id} className="flex items-center space-x-3">
                <div className="w-24 text-sm font-medium text-gray-900 dark:text-white truncate">
                  {client.name}
                </div>
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3 relative">
                  <div 
                    className="bg-gradient-to-r from-[#ffe600] to-[#ffd700] h-3 rounded-full transition-all duration-500"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <div className="w-12 text-right text-sm font-medium text-gray-900 dark:text-white">
                  {client.count}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
