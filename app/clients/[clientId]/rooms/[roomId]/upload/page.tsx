'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { UploadWidget } from '@/components/ui/UploadWidget';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';

import { 
  DocumentArrowUpIcon,
  ChevronLeftIcon,
  BuildingOfficeIcon,
  ChatBubbleLeftRightIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

interface Room {
  id: number;
  name: string;
  room_type: 'internal' | 'external';
  description?: string;
  is_active: boolean;
}

interface Client {
  id: number;
  name: string;
  is_active: boolean;
}

interface UploadResult {
  jobId: string;
  fileName: string;
  timestamp: string;
  status: 'success' | 'processing';
}

export default function UploadPage() {
  const params = useParams();
  const router = useRouter();
  const { supabase } = useAuth();
  const clientId = parseInt(params.clientId as string);
  const roomId = parseInt(params.roomId as string);
  
  const [client, setClient] = useState<Client | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);

  // Fetch real data from database
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      try {
        // Debug: Check authentication status first
        console.log('🔍 DEBUG - Starting fetchData');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('🔍 DEBUG - Session check result:', { session: !!session, error: sessionError });
        
        if (sessionError) {
          console.error('🔍 DEBUG - Session error:', sessionError);
          throw new Error('Authentication error: ' + sessionError.message);
        }
        
        if (!session) {
          console.error('🔍 DEBUG - No session found');
          throw new Error('No active session found. Please log in again.');
        }
        
        console.log('🔍 DEBUG - Session valid, expires at:', new Date(session.expires_at! * 1000));
        console.log('🔍 DEBUG - Current time:', new Date());
        console.log('🔍 DEBUG - Token valid for:', Math.floor((session.expires_at! - Date.now() / 1000) / 60), 'minutes');
        
        // Fetch client data
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('id, name, is_active')
          .eq('id', clientId)
          .single();

        if (clientError) throw clientError;
        if (!clientData) {
          setClient(null);
          setLoading(false);
          return;
        }

        setClient({
          id: clientData.id,
          name: clientData.name,
          is_active: clientData.is_active,
        });

        // Fetch room data
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('id, name, room_type, description, is_active')
          .eq('id', roomId)
          .eq('client_id', clientId)
          .single();

        if (roomError) throw roomError;
        if (!roomData) {
          setRoom(null);
          setLoading(false);
          return;
        }

        setRoom({
          id: roomData.id,
          name: roomData.name,
          room_type: roomData.room_type,
          description: roomData.description,
          is_active: roomData.is_active,
        });

      } catch (error: any) {
        console.error('🔍 DEBUG - Error in fetchData:', error);
        console.error('🔍 DEBUG - Error type:', typeof error);
        console.error('🔍 DEBUG - Error message:', error.message);
        console.error('🔍 DEBUG - Error stack:', error.stack);
        
        if (error.message?.includes('Authentication error') || error.message?.includes('No active session')) {
          console.log('🔍 DEBUG - Redirecting to login due to auth error');
          toast.error(error.message);
          router.push('/auth/login');
          return;
        }
        
        toast.error('Failed to load room data');
        setClient(null);
        setRoom(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [clientId, roomId, supabase]);

  const handleUploadComplete = (jobId: string, fileName: string) => {
    const result: UploadResult = {
      jobId,
      fileName,
      timestamp: new Date().toISOString(),
      status: 'processing',
    };
    
    setUploadResults(prev => [result, ...prev]);
    toast.success(`${fileName} uploaded successfully!`);
  };

  const handleUploadError = (error: string, fileName: string) => {
    toast.error(`Failed to upload ${fileName}: ${error}`);
  };

  const goToJobs = () => {
    router.push(`/clients/${clientId}/jobs`);
  };

  const goToRooms = () => {
    router.push(`/clients/${clientId}/rooms`);
  };

  if (loading) {
    return (
      <DashboardLayout title="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ffe600]"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!client || !room) {
    return (
      <DashboardLayout title="Not Found">
        <div className="text-center py-12">
          <ExclamationTriangleIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Room Not Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The room you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button onClick={() => router.push('/clients')}>
            <ChevronLeftIcon className="h-4 w-4 mr-2" />
            Back to Clients
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const typeConfig = {
    internal: {
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-100 dark:bg-blue-900/20',
      icon: BuildingOfficeIcon,
      label: 'Internal (Zoho Cliq)',
    },
    external: {
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-100 dark:bg-green-900/20',
      icon: ChatBubbleLeftRightIcon,
      label: 'External (WhatsApp)',
    },
  };

  const config = typeConfig[room.room_type];
  const TypeIcon = config.icon;

  return (
    <DashboardLayout 
      title="Upload Files"
      description="Upload chat files for processing and analysis"
      allowedRoles={['super_admin', 'backend', 'admin']}
    >
      <div className="space-y-8">
        {/* Room Info */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-start space-x-4">
            <div className={cn("p-3 rounded-xl", config.bg)}>
              <TypeIcon className={cn("h-6 w-6", config.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                {room.name}
              </h3>
              {room.description && (
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                  {room.description}
                </p>
              )}
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-1">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    room.is_active ? 'bg-green-500' : 'bg-gray-400'
                  )} />
                  <span className="text-gray-600 dark:text-gray-400 capitalize">
                    {room.is_active ? 'active' : 'inactive'}
                  </span>
                </div>
                <span className="text-gray-300 dark:text-gray-700">•</span>
                <span className="text-gray-600 dark:text-gray-400">
                  Room ID: {room.id}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start space-x-3">
            <InformationCircleIcon className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Upload Guidelines
              </h4>
              <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                <li className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                  <span>
                    <strong>File Types:</strong> TXT files are supported by default. Enable advanced mode for CSV and JSON files.
                  </span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                  <span>
                    <strong>File Size:</strong> Maximum 25MB per file. Larger files will be rejected.
                  </span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                  <span>
                    <strong>Processing:</strong> Files are automatically processed for deduplication, chunking, and embedding generation.
                  </span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                  <span>
                    <strong>Security:</strong> All files are validated with SHA-256 checksums for integrity and deduplication.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Auth Test Button */}
        <div className="mb-6">
          <Button 
            onClick={async () => {
              try {
                const { data: { session } } = await supabase.auth.getSession();
                console.log('🔍 AUTH TEST - Session exists:', !!session);
                if (session) {
                  console.log('🔍 AUTH TEST - Token expires at:', new Date(session.expires_at! * 1000));
                  console.log('🔍 AUTH TEST - Current time:', new Date());
                  console.log('🔍 AUTH TEST - Token valid:', session.expires_at! > Date.now() / 1000);
                }
                
                // Test direct API call to see if token works
                try {
                  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/upload-url`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${session?.access_token}`
                    },
                    body: JSON.stringify({
                      client_id: clientId,
                      room_id: roomId,
                      file_name: 'test.txt',
                      file_digest: 'test-digest'
                    })
                  });
                  console.log('🔍 AUTH TEST - Direct API response status:', response.status);
                  if (!response.ok) {
                    const errorData = await response.json();
                    console.log('🔍 AUTH TEST - Error response:', errorData);
                  }
                } catch (apiError) {
                  console.error('🔍 AUTH TEST - API call failed:', apiError);
                }
              } catch (error) {
                console.error('🔍 AUTH TEST - Error:', error);
              }
            }}
            variant="outline"
            className="mb-4"
          >
            Test Authentication Status
          </Button>
        </div>

        {/* Upload Widget */}
        <UploadWidget
          clientId={String(clientId)}
          roomId={String(roomId)}
          supabase={supabase}
          onUploadComplete={handleUploadComplete}
          onUploadError={handleUploadError}
          maxFileSize={25}
          allowedTypes={['.txt']}
        />

        {/* Upload Results */}
        {uploadResults.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Recent Uploads
              </h3>
              <Button variant="outline" onClick={goToJobs}>
                <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-2" />
                View All Jobs
              </Button>
            </div>
            
            <div className="space-y-3">
              {uploadResults.map((result, index) => (
                <UploadResultCard key={`${result.jobId}-${index}`} result={result} />
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-6">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            What's Next?
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button variant="outline" onClick={goToJobs} className="justify-start">
              <ClockIcon className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">Monitor Jobs</div>
                <div className="text-xs text-gray-500">Track processing status</div>
              </div>
            </Button>
            <Button variant="outline" onClick={() => router.push(`/chat/${clientId}/conversations`)} className="justify-start">
              <ChatBubbleLeftRightIcon className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">Start Conversations</div>
                <div className="text-xs text-gray-500">Begin chat analysis</div>
              </div>
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

interface UploadResultCardProps {
  result: UploadResult;
}

function UploadResultCard({ result }: UploadResultCardProps) {
  const statusConfig = {
    success: {
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-100 dark:bg-green-900/20',
      icon: CheckCircleIcon,
    },
    processing: {
      color: 'text-[#ffe600]',
      bg: 'bg-[#ffe600]/10',
      icon: ClockIcon,
    },
  };

  const config = statusConfig[result.status];
  const Icon = config.icon;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className={cn("p-2 rounded-lg", config.bg)}>
            <Icon className={cn("h-5 w-5", config.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {result.fileName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Job ID: {result.jobId} • {new Date(result.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={cn("text-xs font-medium px-2 py-1 rounded-full", config.bg, config.color)}>
            {result.status === 'success' ? 'Completed' : 'Processing'}
          </span>
          <Button variant="ghost" size="sm">
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
