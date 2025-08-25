'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { api } from '@/lib/api-services';
import { getErrorMessage } from '@/lib/api-client';
import { CreateRoomRequest, RoomType } from '@/types/api';
import { 
  ChatBubbleLeftRightIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  DocumentArrowUpIcon,
  EyeIcon,
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  LinkIcon,
  WifiIcon,
  ArrowPathIcon as RefreshIcon,
  ExclamationTriangleIcon as AlertIcon,
  GlobeAltIcon,
  BuildingOfficeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import { ZohoChannelSelector } from '@/components/zoho/ZohoChannelSelector';
import { ZohoChannelOption } from '@/types/zoho';

interface Room {
  id: number;
  name: string;
  type: 'internal' | 'external';
  description?: string;
  upload_count: number;
  last_indexed: string | null;
  created_at: string;
  status: 'active' | 'inactive';
  total_messages?: number;
  latest_upload?: string;
  zoho_mapping_id?: string | null;
  zoho_channel_name?: string | null;
  zoho_sync_status?: 'active' | 'paused' | 'error' | null;
}

interface Client {
  id: number;
  name: string;
  is_active: boolean; // Changed from status to is_active to match database schema
}

// Helper function to format last activity
function formatLastActivity(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) {
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    if (diffInHours === 0) {
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes} minutes ago`;
    }
    return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`;
  } else if (diffInDays === 1) {
    return '1 day ago';
  } else if (diffInDays < 30) {
    return `${diffInDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

export default function ClientRoomsPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = parseInt(params.clientId as string);
  const { supabase } = useAuth(); // Get supabase client from context
  
  const [client, setClient] = useState<Client | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'internal' | 'external'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showZohoSelector, setShowZohoSelector] = useState(false);
  const [selectedRoomForZoho, setSelectedRoomForZoho] = useState<Room | null>(null);
  const [syncingRooms, setSyncingRooms] = useState<Set<number>>(new Set());
  const [zohoIntegrationAvailable, setZohoIntegrationAvailable] = useState(false);

  // Fetch data from database
  const fetchData = async () => {
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
        .select('id, name, is_active') // Changed from status to is_active
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
        is_active: clientData.is_active as boolean, // Changed from status to is_active
      });

      // Check if Zoho integration is available
      let zohoIntegrationAvailable = false;
      try {
        // Test if zoho_channel_mappings table exists and has relationship with rooms
        const testQuery = await supabase
          .from('rooms')
          .select('id, zoho_mapping_id')
          .limit(1);
        
        // If the query succeeds, Zoho integration is available
        if (!testQuery.error) {
          zohoIntegrationAvailable = true;
        }
      } catch (error) {
        console.log('Zoho integration not available, using basic query');
        zohoIntegrationAvailable = false;
      }

      setZohoIntegrationAvailable(zohoIntegrationAvailable);

      // Fetch rooms with appropriate query based on Zoho availability
      let roomsData, roomsError;
      
      if (zohoIntegrationAvailable) {
        // Fetch with Zoho mapping info
        const result = await supabase
          .from('rooms')
          .select(`
            id,
            name,
            room_type,
            description,
            is_active,
            created_at,
            zoho_mapping_id,
            uploads (
              id,
              created_at
            ),
            zoho_channel_mappings (
              id,
              zoho_channel_name,
              sync_status,
              last_sync_at
            )
          `)
          .eq('client_id', clientId)
          .order('created_at', { ascending: false });
          
        roomsData = result.data;
        roomsError = result.error;
      } else {
        // Fetch basic room data without Zoho columns
        const result = await supabase
          .from('rooms')
          .select(`
            id,
            name,
            room_type,
            description,
            is_active,
            created_at,
            uploads (
              id,
              created_at
            )
          `)
          .eq('client_id', clientId)
          .order('created_at', { ascending: false });
          
        roomsData = result.data;
        roomsError = result.error;
      }

      if (roomsError) throw roomsError;

      // Transform data to match Room interface
      const transformedRooms: Room[] = (roomsData || []).map((room: any) => {
        const uploadCount = room.uploads?.length || 0;
        
        // Calculate total messages (not available in current schema)
        let totalMessages = 0;
        
        // Get latest upload date
        const latestUpload = room.uploads?.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];

        // Get Zoho mapping info (if available)
        const zohoMapping = room.zoho_channel_mappings?.[0];

        return {
          id: room.id,
          name: room.name,
          type: room.room_type,
          description: room.description,
          upload_count: uploadCount,
          last_indexed: latestUpload?.created_at || null,
          created_at: room.created_at,
          status: room.is_active ? 'active' : 'inactive',
          total_messages: totalMessages, // Not available in current schema
          latest_upload: latestUpload?.created_at || null,
          zoho_mapping_id: room.zoho_mapping_id || null,
          zoho_channel_name: zohoMapping?.zoho_channel_name || null,
          zoho_sync_status: zohoMapping?.sync_status || null,
        };
      });

      setRooms(transformedRooms);
    } catch (error: any) {
      console.error('Error fetching rooms:', error);
      toast.error('Failed to load rooms data');
      setClient(null);
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clientId, supabase]); // Add supabase to dependencies

  const handleZohoMapRequest = (room: Room) => {
    if (!zohoIntegrationAvailable) {
      toast.error('Zoho Cliq integration is not available. Please apply the database migrations.');
      return;
    }
    if (room.type !== 'internal') {
      toast.error('Only internal rooms can be mapped to Zoho Cliq channels');
      return;
    }
    if (room.zoho_mapping_id) {
      toast.error('This room is already mapped to a Zoho Cliq channel');
      return;
    }
    setSelectedRoomForZoho(room);
    setShowZohoSelector(true);
  };

  const handleZohoChannelSelected = async (channel: ZohoChannelOption) => {
    try {
      toast.success(`Successfully mapped "${channel.name}" to "${selectedRoomForZoho?.name}"`);
      // Refresh the rooms list to show the new mapping
      await fetchData();
    } catch (error) {
      console.error('Error after channel mapping:', error);
    } finally {
      setSelectedRoomForZoho(null);
    }
  };

  const handleRetrySync = async (room: Room) => {
    if (!zohoIntegrationAvailable || !room.zoho_mapping_id) return;

    try {
      setSyncingRooms(prev => new Set(prev).add(room.id));

      const response = await fetch('/api/functions/zoho-sync-trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          mapping_id: room.zoho_mapping_id,
          full_sync: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Sync failed');
      }

      toast.success(`Sync initiated for "${room.name}"`);
      
      // Refresh rooms data after a short delay to show updated status
      setTimeout(() => {
        fetchData();
      }, 2000);

    } catch (error) {
      console.error('Error retrying sync:', error);
      toast.error(`Failed to retry sync: ${error.message}`);
    } finally {
      setSyncingRooms(prev => {
        const newSet = new Set(prev);
        newSet.delete(room.id);
        return newSet;
      });
    }
  };

  const filteredRooms = rooms.filter(room => {
    const matchesSearch = room.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || room.type === typeFilter;
    return matchesSearch && matchesType;
  });

  if (!client && !loading) {
    return (
      <DashboardLayout title="Client Not Found">
        <div className="text-center py-12">
          <BuildingOfficeIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
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
      title="Chat Rooms"
      description="Manage chat rooms and upload files for analysis"
      allowedRoles={['super_admin', 'backend', 'admin']}
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
            {/* Search */}
            <div className="relative flex-1 lg:w-80">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search rooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600] transition-all duration-200"
              />
            </div>

            {/* Type Filter */}
            <div className="flex items-center space-x-2">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="px-3 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600] transition-all duration-200"
              >
                <option value="all">All Types</option>
                <option value="internal">Internal</option>
                <option value="external">External</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button variant="outline" onClick={() => window.location.reload()}>
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            
            <RoleGuard allowedRoles={['super_admin', 'backend', 'admin']} showFallback={false}>
              <Button onClick={() => setShowCreateModal(true)}>
                <PlusIcon className="h-4 w-4 mr-2" />
                New Room
              </Button>
            </RoleGuard>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Total Rooms"
            value={rooms.length.toString()}
            subtitle={`${rooms.filter(r => r.status === 'active').length} active`}
            icon={<ChatBubbleLeftRightIcon className="h-6 w-6" />}
            trend="+3"
          />
          <StatsCard
            title="Internal Rooms"
            value={rooms.filter(r => r.type === 'internal').length.toString()}
            subtitle="Zoho Cliq channels"
            icon={<BuildingOfficeIcon className="h-6 w-6" />}
            trend="+1"
          />
          <StatsCard
            title="External Rooms"
            value={rooms.filter(r => r.type === 'external').length.toString()}
            subtitle="WhatsApp channels"
            icon={<GlobeAltIcon className="h-6 w-6" />}
            trend="+2"
          />
          <StatsCard
            title="Total Uploads"
            value={rooms.reduce((acc, room) => acc + room.upload_count, 0).toString()}
            subtitle="Files uploaded"
            icon={<DocumentArrowUpIcon className="h-6 w-6" />}
            trend="+12"
          />
        </div>

        {/* Rooms Table */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <RoomCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredRooms.length === 0 ? (
          <EmptyState 
            searchQuery={searchQuery}
            typeFilter={typeFilter}
            onCreateClick={() => setShowCreateModal(true)}
          />
        ) : (
          <div className="space-y-4">
            {filteredRooms.map((room) => (
              <RoomCard 
                key={room.id} 
                room={room} 
                clientId={clientId} 
                router={router}
                onZohoMapRequest={handleZohoMapRequest}
                onRetrySync={handleRetrySync}
                isSyncing={syncingRooms.has(room.id)}
                zohoIntegrationAvailable={zohoIntegrationAvailable}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <CreateRoomModal 
          clientId={clientId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(roomId: number) => {
            setShowCreateModal(false);
            // Refresh the rooms list
            fetchData();
          }}
        />
      )}

      {/* Zoho Channel Selector Modal */}
      {showZohoSelector && selectedRoomForZoho && zohoIntegrationAvailable && (
        <ZohoChannelSelector
          isOpen={showZohoSelector}
          onClose={() => {
            setShowZohoSelector(false);
            setSelectedRoomForZoho(null);
          }}
          onChannelSelect={handleZohoChannelSelected}
          clientId={clientId}
          roomId={selectedRoomForZoho.id}
          roomName={selectedRoomForZoho.name}
        />
      )}
    </DashboardLayout>
  );
}

interface StatsCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  trend: string;
}

function StatsCard({ title, value, subtitle, icon, trend }: StatsCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-gradient-to-br from-[#ffe600]/10 to-[#ffe600]/5 rounded-xl">
          <div className="text-[#ffe600]">
            {icon}
          </div>
        </div>
        <div className="text-sm font-medium px-2 py-1 rounded-full text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/20">
          {trend}
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
        {value}
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {subtitle}
      </div>
    </div>
  );
}

interface RoomCardProps {
  room: Room;
  clientId: number;
  router: any;
  onZohoMapRequest: (room: Room) => void;
  onRetrySync: (room: Room) => void;
  isSyncing: boolean;
  zohoIntegrationAvailable: boolean;
}

function RoomCard({ room, clientId, router, onZohoMapRequest, onRetrySync, isSyncing, zohoIntegrationAvailable }: RoomCardProps) {
  const typeColors = {
    internal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    external: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  };

  const typeIcons = {
    internal: <BuildingOfficeIcon className="h-4 w-4" />,
    external: <GlobeAltIcon className="h-4 w-4" />,
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-[#ffe600]/10 to-[#ffe600]/5 rounded-lg">
              <ChatBubbleLeftRightIcon className="h-5 w-5 text-[#ffe600]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  {room.name}
                </h3>
                <div className={cn(
                  "flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium",
                  typeColors[room.type]
                )}>
                  {typeIcons[room.type]}
                  <span className="capitalize">{room.type}</span>
                </div>
                <div className={cn(
                  "flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium",
                  room.status === 'active' 
                    ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                    : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                )}>
                  {room.status === 'active' ? (
                    <CheckCircleIcon className="h-3 w-3" />
                  ) : (
                    <ExclamationCircleIcon className="h-3 w-3" />
                  )}
                  <span className="capitalize">{room.status}</span>
                </div>
              </div>
              {room.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                  {room.description}
                </p>
              )}
              
              {/* Zoho Mapping Status */}
              {room.type === 'internal' && zohoIntegrationAvailable && (
                <div className="mt-2">
                  {room.zoho_mapping_id ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={cn(
                          "flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium",
                          isSyncing
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                            : room.zoho_sync_status === 'active' 
                            ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                            : room.zoho_sync_status === 'error'
                            ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                        )}>
                          {isSyncing ? (
                            <RefreshIcon className="h-3 w-3 animate-spin" />
                          ) : (
                            <WifiIcon className="h-3 w-3" />
                          )}
                          <span>
                            {isSyncing ? 'Syncing...' :
                             room.zoho_sync_status === 'active' ? 'Active' : 
                             room.zoho_sync_status === 'error' ? 'Error' : 'Paused'}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          → {room.zoho_channel_name}
                        </span>
                      </div>
                      
                      {room.zoho_sync_status === 'error' && !isSyncing && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRetrySync(room);
                          }}
                          className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium flex items-center space-x-1"
                        >
                          <RefreshIcon className="h-3 w-3" />
                          <span>Retry</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                      <LinkIcon className="h-3 w-3" />
                      <span>Not mapped to Zoho Cliq</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-start sm:items-center lg:items-end xl:items-center gap-4 lg:gap-2 xl:gap-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="font-semibold text-gray-900 dark:text-white">
                {room.upload_count}
              </div>
              <div className="text-gray-500 dark:text-gray-400">Uploads</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-900 dark:text-white">
                {room.total_messages?.toLocaleString() || '0'}
              </div>
              <div className="text-gray-500 dark:text-gray-400">Messages</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-900 dark:text-white text-xs">
                {room.last_indexed || 'Never'}
              </div>
              <div className="text-gray-500 dark:text-gray-400">Last Indexed</div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Zoho Map Button for Internal Rooms */}
            {room.type === 'internal' && !room.zoho_mapping_id && zohoIntegrationAvailable && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onZohoMapRequest(room)}
                className="text-blue-600 hover:text-blue-700 border-blue-200 hover:border-blue-300"
              >
                <LinkIcon className="h-4 w-4 mr-1" />
                Map to Zoho
              </Button>
            )}
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push(`/clients/${clientId}/jobs?room=${room.id}`)}
            >
              <EyeIcon className="h-4 w-4 mr-1" />
              View Jobs
            </Button>
            <Button 
              size="sm"
              onClick={() => router.push(`/clients/${clientId}/rooms/${room.id}/upload`)}
            >
              <DocumentArrowUpIcon className="h-4 w-4 mr-1" />
              Upload
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoomCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm animate-pulse">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="text-center space-y-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8 mx-auto"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12 mx-auto"></div>
              </div>
            ))}
          </div>
          <div className="flex space-x-2">
            <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  searchQuery: string;
  typeFilter: string;
  onCreateClick: () => void;
}

function EmptyState({ searchQuery, typeFilter, onCreateClick }: EmptyStateProps) {
  const hasFilters = searchQuery || typeFilter !== 'all';
  
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-12 text-center">
      <ChatBubbleLeftRightIcon className="h-16 w-16 text-gray-400 mx-auto mb-6" />
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        {hasFilters ? 'No rooms found' : 'No chat rooms yet'}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
        {hasFilters 
          ? 'No rooms match your current filters. Try adjusting your search or filter settings.'
          : 'Create your first chat room to start uploading and analyzing chat data.'
        }
      </p>
      
      {!hasFilters && (
        <RoleGuard allowedRoles={['super_admin', 'backend', 'admin']} showFallback={false}>
          <Button onClick={onCreateClick}>
            <PlusIcon className="h-5 w-5 mr-2" />
            Create Your First Room
          </Button>
        </RoleGuard>
      )}
    </div>
  );
}

function CreateRoomModal({ clientId, onClose, onSuccess }: { clientId: number; onClose: () => void; onSuccess?: (roomId: number) => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<RoomType>('internal');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { platformUser, supabase } = useAuth(); // Get supabase client from context

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.length < 3 || name.length > 80) return;

    setLoading(true);
    
    try {
      const request: CreateRoomRequest = {
        client_id: clientId,
        room_type: type, // Changed from 'type' to 'room_type' to match API schema
        name: name.trim(),
        description: description.trim() || undefined,
        user_id: platformUser?.id, // Include user ID for anon key auth
      };

      const response = await api.rooms.create(supabase, request);
      
      toast.success(`Room "${name}" created successfully!`);
      onSuccess?.(response.room_id);
      onClose();
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose}></div>
        
        <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-md">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Create New Room
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Room Type *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setType('internal')}
                    className={cn(
                      "flex items-center justify-center px-4 py-3 rounded-xl border transition-all duration-200",
                      type === 'internal'
                        ? "border-[#ffe600] bg-[#ffe600]/10 text-[#ffe600]"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    )}
                  >
                    <BuildingOfficeIcon className="h-5 w-5 mr-2" />
                    Internal
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('external')}
                    className={cn(
                      "flex items-center justify-center px-4 py-3 rounded-xl border transition-all duration-200",
                      type === 'external'
                        ? "border-[#ffe600] bg-[#ffe600]/10 text-[#ffe600]"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    )}
                  >
                    <GlobeAltIcon className="h-5 w-5 mr-2" />
                    External
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Internal: Zoho Cliq • External: WhatsApp
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Room Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter room name"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600]"
                  minLength={3}
                  maxLength={80}
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  3-80 characters required
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the room"
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600] resize-none"
                  maxLength={240}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {description.length}/240 characters
                </p>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || name.length < 3 || name.length > 80}
                  className="flex-1"
                >
                  {loading ? 'Creating...' : 'Create Room'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
