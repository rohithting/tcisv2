'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { api } from '@/lib/api-services';
import { getErrorMessage } from '@/lib/api-client';
import { JobDto, JobsResponse, JobStatus } from '@/types/api';
import { 
  ClockIcon,
  ChevronLeftIcon,
  FunnelIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PauseCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';

// Use the imported JobDto type instead of local interface
type Job = JobDto & {
  room_name: string;
  file_name: string;
  messages_parsed: number;
  chunks_created: number;
  parse_ms: number | null;
  embed_ms: number | null;
  total_ms: number | null;
  cost_estimate: number | undefined; // Changed from null to undefined to match JobDto
  error_message?: string;
};

interface Client {
  id: string;
  name: string;
  is_active: boolean; // Changed from status to is_active to match database schema
}

export default function JobsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasRole, supabase } = useAuth(); // Get supabase client from context
  const clientId = params?.clientId as string;
  
  const [client, setClient] = useState<Client | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7d');

  // Job retry function
  const handleRetryJob = async (jobId: string) => {
    try {
      await api.jobs.retry(supabase, { job_id: jobId });
      toast.success('Job queued for retry');
      
      // Update job status optimistically
      setJobs(prev => prev.map(job => 
        String(job.id) === jobId 
          ? { ...job, status: 'queued' as JobStatus }
          : job
      ));
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage);
    }
  };

  // Initialize filters from URL parameters
  useEffect(() => {
    const roomFromUrl = searchParams.get('room');
    if (roomFromUrl) {
      setRoomFilter(roomFromUrl);
    }
  }, [searchParams]);

  // Fetch jobs data from API with real-time subscriptions
  useEffect(() => {
    const fetchData = async () => {
      if (!clientId) return;
      
      setLoading(true);
      
      try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('No authenticated session');
        }

        // Fetch client data
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('id, name, is_active')
          .eq('id', parseInt(clientId))
          .single();

        if (clientError) throw clientError;
        if (!clientData) {
          setClient(null);
          setLoading(false);
          return;
        }

        setClient({
          id: String(clientData.id),
          name: clientData.name,
          is_active: clientData.is_active,
        });

        // Fetch jobs from Edge Function API
        const response = await api.jobs.list(supabase, clientId, {
          status: statusFilter !== 'all' ? statusFilter as JobStatus : undefined,
          roomId: roomFilter !== 'all' ? roomFilter : undefined,
          limit: 50,
          offset: 0,
        });

        // Transform API response to include additional fields
        const transformedJobs: Job[] = response.jobs.map(job => {
          return {
            ...job,
            room_name: 'Unknown Room', // This should come from the API response
            file_name: `upload_${job.upload_id}.txt`, // This should come from the API response
            messages_parsed: 0, // Not available in current schema
            chunks_created: 0, // Not available in current schema
            parse_ms: null, // Not available in current schema
            embed_ms: null, // Not available in current schema
            total_ms: null, // Not available in current schema
            cost_estimate: undefined, // Changed from null to undefined to match JobDto
            error_message: job.error_code || undefined,
          };
        });

        setJobs(transformedJobs);
        
      } catch (error: any) {
        console.error('Error fetching jobs:', error);
        const errorMessage = getErrorMessage(error);
        toast.error(errorMessage);
        setClient(null);
        setJobs([]);
      }
    };

    fetchData();

    // Cleanup is handled by the component unmount
  }, [clientId]);

  // Real-time job updates
  useEffect(() => {
    if (!clientId) return;

    const channel = supabase
      .channel(`realtime:jobs:${clientId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'jobs',
        filter: `client_id=eq.${clientId}`,
      }, (payload: any) => {
        console.log('Job update received:', payload);
        
        if (payload.eventType === 'UPDATE') {
          setJobs(prev => prev.map(job => 
            String(job.id) === String(payload.new.id)
              ? { ...job, ...payload.new }
              : job
          ));
        } else if (payload.eventType === 'INSERT') {
          setJobs(prev => [payload.new as Job, ...prev]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.room_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    const matchesRoom = roomFilter === 'all' || String(job.room_id) === roomFilter;
    
    // Date filtering logic would go here
    const matchesDate = true; // Simplified for demo
    
    return matchesSearch && matchesStatus && matchesRoom && matchesDate;
  });

  // Use the real handleRetryJob function instead of this simulation

  const uniqueRooms = Array.from(new Set(jobs.map(job => ({ id: job.room_id, name: job.room_name }))));

  if (loading) {
    return (
      <DashboardLayout title="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ffe600]"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!client) {
    return (
      <DashboardLayout title="Client Not Found">
        <div className="text-center py-12">
          <ExclamationTriangleIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Client Not Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The client you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button onClick={() => router.push('/clients')}>
            <ChevronLeftIcon className="h-4 w-4 mr-2" />
            Back to Clients
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Processing Jobs"
      description="Monitor file processing status and manage job queue"
      allowedRoles={['super_admin', 'backend', 'admin']}
    >
      <div className="space-y-6">
        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <JobStatCard
            title="Total Jobs"
            value={jobs.length.toString()}
            icon={<DocumentTextIcon className="h-6 w-6" />}
            color="blue"
          />
          <JobStatCard
            title="Processing"
            value={jobs.filter(j => j.status === 'processing').length.toString()}
            icon={<PlayIcon className="h-6 w-6" />}
            color="yellow"
          />
          <JobStatCard
            title="Completed"
            value={jobs.filter(j => j.status === 'complete').length.toString()}
            icon={<CheckCircleIcon className="h-6 w-6" />}
            color="green"
          />
          <JobStatCard
            title="Failed"
            value={jobs.filter(j => j.status === 'failed' || j.status === 'dead_letter').length.toString()}
            icon={<ExclamationCircleIcon className="h-6 w-6" />}
            color="red"
          />
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search jobs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600]"
                />
              </div>
            </div>
            
            <div className="flex gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as JobStatus | 'all')}
                className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600]"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="queued">Queued</option>
                <option value="processing">Processing</option>
                <option value="complete">Complete</option>
                <option value="failed">Failed</option>
                <option value="dead_letter">Dead Letter</option>
              </select>
              
              <select
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600]"
              >
                <option value="all">All Rooms</option>
                {uniqueRooms.map(room => (
                  <option key={room.id} value={room.id}>{room.name}</option>
                ))}
              </select>
              
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600]"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="all">All time</option>
              </select>
            </div>
          </div>
        </div>

        {/* Jobs List */}
        <div className="space-y-4">
          {filteredJobs.length === 0 ? (
            <div className="text-center py-12">
              <DocumentTextIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No jobs found
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {searchQuery || statusFilter !== 'all' || roomFilter !== 'all'
                  ? 'Try adjusting your filters or search terms.'
                  : 'No jobs have been created yet for this client.'}
              </p>
              <Button onClick={() => router.push(`/clients/${clientId}/rooms`)}>
                <DocumentTextIcon className="h-4 w-4 mr-2" />
                Upload Files
              </Button>
            </div>
          ) : (
            filteredJobs.map(job => (
              <JobCard key={job.id} job={job} onRetry={handleRetryJob} />
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

interface JobStatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: 'blue' | 'yellow' | 'green' | 'red' | 'purple';
}

function JobStatCard({ title, value, icon, color }: JobStatCardProps) {
  const colorConfig = {
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20',
    yellow: 'text-[#ffe600] bg-[#ffe600]/10',
    green: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20',
    red: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20',
    purple: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/20',
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="flex items-center space-x-3">
        <div className={cn("p-2 rounded-lg", colorConfig[color])}>
          {icon}
        </div>
        <div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {value}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {title}
          </div>
        </div>
      </div>
    </div>
  );
}

interface JobCardProps {
  job: Job;
  onRetry: (jobId: string) => void;
}

function JobCard({ job, onRetry }: JobCardProps) {
  const statusConfig = {
    pending: { color: 'text-gray-600', bg: 'bg-gray-100', icon: PauseCircleIcon },
    queued: { color: 'text-blue-600', bg: 'bg-blue-100', icon: ClockIcon },
    processing: { color: 'text-[#ffe600]', bg: 'bg-[#ffe600]/10', icon: PlayIcon },
    complete: { color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircleIcon },
    failed: { color: 'text-red-600', bg: 'bg-red-100', icon: ExclamationCircleIcon },
    dead_letter: { color: 'text-red-700', bg: 'bg-red-200', icon: XCircleIcon },
  };

  const config = statusConfig[job.status];
  const Icon = config.icon;

  const formatTime = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3 mb-3">
            <div className={cn("p-2 rounded-lg", config.bg)}>
              <Icon className={cn("h-5 w-5", config.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  {job.file_name}
                </h3>
                <span className={cn("px-2 py-1 text-xs font-medium rounded-full", config.bg, config.color)}>
                  {job.status.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                <span>{job.room_name}</span>
                <span>•</span>
                <span>Job ID: {job.id}</span>
                <span>•</span>
                <span>{new Date(job.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {job.error_message && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">
                <strong>Error:</strong> {job.error_message}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center">
              <div className="text-gray-500 dark:text-gray-400">Messages</div>
              <div className="font-semibold text-gray-900 dark:text-white">{job.messages_parsed}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 dark:text-gray-400">Chunks</div>
              <div className="font-semibold text-gray-900 dark:text-white">{job.chunks_created}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-gray-500 dark:text-gray-400">Parse</div>
              <div className="font-semibold text-gray-900 dark:text-white">{formatTime(job.parse_ms)}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 dark:text-gray-400">Embed</div>
              <div className="font-semibold text-gray-900 dark:text-white">{formatTime(job.embed_ms)}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 dark:text-gray-400">Total</div>
              <div className="font-semibold text-gray-900 dark:text-white">{formatTime(job.total_ms)}</div>
            </div>
          </div>

          <div className="flex flex-col items-end space-y-2">
            {job.cost_estimate && (
              <div className="text-right">
                <div className="text-xs text-gray-500 dark:text-gray-400">Cost</div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  ${job.cost_estimate.toFixed(4)}
                </div>
              </div>
            )}
            
            {(job.status === 'failed' || job.status === 'dead_letter') && (
              <Button
                onClick={() => onRetry(String(job.id))}
                variant="outline"
                size="sm"
                className="text-[#ffe600] border-[#ffe600] hover:bg-[#ffe600] hover:text-black"
              >
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                Retry
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
