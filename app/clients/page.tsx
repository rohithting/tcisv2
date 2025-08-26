'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { api } from '@/lib/api-services';
import { getErrorMessage } from '@/lib/api-client';
import { CreateClientRequest } from '@/types/api';
import { 
  BuildingOfficeIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  EllipsisVerticalIcon,
  FunnelIcon,
  ArrowPathIcon,
  CalendarIcon,
  ChatBubbleLeftRightIcon,
  DocumentArrowUpIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  Cog6ToothIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface Client {
  id: string;
  name: string;
  description?: string;
  is_active: boolean; // Changed from status to is_active to match database schema
  room_count: number;
  last_activity: string;
  created_at: string;
  total_messages?: number;
  total_uploads?: number;
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

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<boolean | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const { supabase } = useAuth(); // Use supabase client from context
  const router = useRouter();

  // Fetch clients from database
  const fetchClients = async () => {
    try {
      setLoading(true);
      
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No authenticated session');
        setClients([]);
        return;
      }

      // Fetch clients with related data
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select(`
          id,
          name,
          description,
          is_active,
          created_at,
          rooms (
            id,
            uploads (
              id
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (clientsError) throw clientsError;

      // Transform data to match Client interface
      const transformedClients: Client[] = (clientsData || []).map(client => {
        const roomCount = client.rooms?.length || 0;
        
        // Calculate total uploads (messages count not available in current schema)
        let totalUploads = 0;
        
        client.rooms?.forEach(room => {
          totalUploads += room.uploads?.length || 0;
        });

        return {
          id: client.id,
          name: client.name,
          description: client.description,
          is_active: client.is_active,
          room_count: roomCount,
          last_activity: formatLastActivity(client.created_at),
          created_at: new Date(client.created_at).toLocaleDateString(),
          total_messages: 0, // Not available in current schema
          total_uploads: totalUploads,
        };
      });

      setClients(transformedClients);
    } catch (error: any) {
      console.error('Error fetching clients:', error);
      // Only show error toast for actual API errors, not auth issues
      if (error.message !== 'No authenticated session') {
        toast.error('Failed to load clients');
      }
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch clients on component mount
  useEffect(() => {
    fetchClients();
  }, [supabase]); // Add supabase to dependencies

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || client.is_active === (statusFilter === true);
    return matchesSearch && matchesStatus;
  });

  const handleEditClient = (client: Client) => {
    setSelectedClient(client);
    setShowEditModal(true);
  };

  const handleDeleteClient = (client: Client) => {
    setSelectedClient(client);
    setShowDeleteModal(true);
  };

  const confirmDeleteClient = async () => {
    if (!selectedClient) return;
    
    try {
      // Delete client from database
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', selectedClient.id);

      if (error) throw error;

      // Remove from local state
      setClients(prev => prev.filter(c => c.id !== selectedClient.id));
      setShowDeleteModal(false);
      setSelectedClient(null);
      toast.success('Client deleted successfully');
    } catch (error: any) {
      console.error('Error deleting client:', error);
      toast.error('Failed to delete client');
    }
  };

  return (
    <DashboardLayout 
      title="Clients"
      description="Manage your clients and their chat data analysis"
      allowedRoles={['super_admin', 'backend', 'admin']}
    >
      <div className="space-y-4 sm:space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full lg:w-auto">
            {/* Search */}
            <div className="relative flex-1 lg:w-80">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600] transition-all duration-200"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-2">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <select
                value={statusFilter === 'all' ? 'all' : statusFilter ? 'true' : 'false'}
                onChange={(e) => {
                  if (e.target.value === 'all') {
                    setStatusFilter('all');
                  } else {
                    setStatusFilter(e.target.value === 'true');
                  }
                }}
                className="px-3 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600] transition-all duration-200"
              >
                <option value="all">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <Button variant="outline" onClick={() => window.location.reload()}>
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            
            <RoleGuard allowedRoles={['super_admin', 'backend']} showFallback={false}>
              <Button onClick={() => setShowCreateModal(true)}>
                <PlusIcon className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Add Client</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </RoleGuard>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <StatsCard
            title="Total Clients"
            value={clients.length.toString()}
            subtitle={`${clients.filter(c => c.is_active).length} active`}
            icon={<BuildingOfficeIcon className="h-5 w-5 sm:h-6 sm:w-6" />}
            trend=""
          />
          <StatsCard
            title="Total Rooms"
            value={clients.reduce((acc, client) => acc + client.room_count, 0).toString()}
            subtitle="Across all clients"
            icon={<ChatBubbleLeftRightIcon className="h-5 w-5 sm:h-6 sm:w-6" />}
            trend=""
          />
          <StatsCard
            title="Total Messages"
            value={`${(clients.reduce((acc, client) => acc + (client.total_messages || 0), 0) / 1000).toFixed(1)}K`}
            subtitle="Messages processed"
            icon={<DocumentArrowUpIcon className="h-5 w-5 sm:h-6 sm:w-6" />}
            trend=""
          />
          <StatsCard
            title="Total Uploads"
            value={clients.reduce((acc, client) => acc + (client.total_uploads || 0), 0).toString()}
            subtitle="Files uploaded"
            icon={<DocumentArrowUpIcon className="h-5 w-5 sm:h-6 sm:w-6" />}
            trend=""
          />
        </div>

        {/* Clients Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[...Array(6)].map((_, i) => (
              <ClientCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredClients.length === 0 ? (
          <EmptyState 
            searchQuery={searchQuery}
            onCreateClick={() => setShowCreateModal(true)}
            hasClients={clients.length > 0}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredClients.map((client) => (
              <ClientCard 
                key={client.id} 
                client={client} 
                onEdit={handleEditClient}
                onDelete={handleDeleteClient}
                onNavigate={(path) => router.push(path)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Client Modal */}
      {showCreateModal && (
        <CreateClientModal 
          onClose={() => setShowCreateModal(false)}
          onSuccess={(clientId) => {
            setShowCreateModal(false);
            // Refresh client list by refetching data
            fetchClients();
          }}
        />
      )}

      {/* Edit Client Modal */}
      {showEditModal && selectedClient && (
        <EditClientModal 
          client={selectedClient}
          onClose={() => {
            setShowEditModal(false);
            setSelectedClient(null);
          }}
          onSave={(updatedClient) => {
            setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
            setShowEditModal(false);
            setSelectedClient(null);
            toast.success('Client updated successfully');
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedClient && (
        <DeleteClientModal
          client={selectedClient}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedClient(null);
          }}
          onConfirm={confirmDeleteClient}
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
  const isPositive = trend.startsWith('+');
  
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="p-2 sm:p-3 bg-gradient-to-br from-[#ffe600]/10 to-[#ffe600]/5 rounded-xl">
          <div className="text-[#ffe600]">
            {icon}
          </div>
        </div>
        <div className={cn(
          "text-xs sm:text-sm font-medium px-2 py-1 rounded-full",
          isPositive 
            ? "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/20"
            : "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/20"
        )}>
          {trend}
        </div>
      </div>
      <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1">
        {value}
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {subtitle}
      </div>
    </div>
  );
}

interface ClientCardProps {
  client: Client;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
  onNavigate: (path: string) => void;
}

function ClientCard({ client, onEdit, onDelete, onNavigate }: ClientCardProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const { hasRole } = useAuth();
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setShowContextMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleManageClient = () => {
    setShowContextMenu(false);
    onEdit(client);
  };

  const handleDeleteClient = () => {
    setShowContextMenu(false);
    onDelete(client);
  };

  return (
    <div className="group bg-white dark:bg-gray-900 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-300 hover:-translate-y-1">
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#ffe600]/10 to-[#ffe600]/5 rounded-xl flex items-center justify-center flex-shrink-0">
          <BuildingOfficeIcon className="h-5 w-5 sm:h-6 sm:w-6 text-[#ffe600]" />
        </div>
        <div className="flex items-center space-x-2">
          <div className={cn(
            "flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium",
            client.is_active 
              ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
          )}>
            {client.is_active ? (
              <CheckCircleIcon className="h-3 w-3" />
            ) : (
              <ExclamationCircleIcon className="h-3 w-3" />
            )}
            <span className="capitalize">{client.is_active ? 'Active' : 'Inactive'}</span>
          </div>
          <div className="relative" ref={contextMenuRef}>
            <button 
              onClick={() => setShowContextMenu(!showContextMenu)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200 min-h-[32px] min-w-[32px] touch-target"
            >
              <EllipsisVerticalIcon className="h-4 w-4 text-gray-400" />
            </button>
            
            {showContextMenu && (
              <div className="absolute right-0 top-8 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                <div className="py-1">
                  <button
                    onClick={handleManageClient}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center min-h-[44px] touch-target"
                  >
                    <Cog6ToothIcon className="h-4 w-4 mr-2" />
                    Edit Client
                  </button>
                  <button
                    onClick={() => onNavigate(`/clients/${client.id}/rooms`)}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center min-h-[44px] touch-target"
                  >
                    <ChatBubbleLeftRightIcon className="h-4 w-4 mr-2" />
                    Manage Rooms
                  </button>
                  <button
                    onClick={() => onNavigate(`/clients/${client.id}/jobs`)}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center min-h-[44px] touch-target"
                  >
                    <ClockIcon className="h-4 w-4 mr-2" />
                    View Jobs
                  </button>
                  <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                  <button
                    onClick={() => onNavigate(`/chat/${client.id}/conversations`)}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center min-h-[44px] touch-target"
                  >
                    <ChatBubbleLeftRightIcon className="h-4 w-4 mr-2" />
                    Start Chat Analysis
                  </button>
                  {hasRole('super_admin') && (
                    <>
                      <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                      <button
                        onClick={handleDeleteClient}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center min-h-[44px] touch-target"
                      >
                        <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                        Delete Client
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-gray-800 dark:group-hover:text-gray-100">
        {client.name}
      </h3>
      
      {client.description && (
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 sm:mb-4 line-clamp-2">
          {client.description}
        </p>
      )}

      <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Chat Rooms</span>
          <span className="font-medium text-gray-900 dark:text-white">{client.room_count}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Messages</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {client.total_messages?.toLocaleString() || '0'}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Last Activity</span>
          <span className="font-medium text-gray-900 dark:text-white">{client.last_activity}</span>
        </div>
      </div>

      <div className="pt-3 sm:pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onNavigate(`/clients/${client.id}/rooms`)}
            className="text-xs min-h-[40px] touch-target"
          >
            <DocumentArrowUpIcon className="h-3 w-3 mr-1" />
            Upload
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onNavigate(`/chat/${client.id}/conversations`)}
            className="text-xs min-h-[40px] touch-target"
          >
            <ChatBubbleLeftRightIcon className="h-3 w-3 mr-1" />
            Chat
          </Button>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          fullWidth 
          onClick={handleManageClient}
          className="group-hover:bg-[#ffe600] group-hover:text-black group-hover:border-[#ffe600] min-h-[40px] touch-target"
        >
          <span>Manage Client</span>
          <ChevronRightIcon className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
        </Button>
      </div>
    </div>
  );
}

function ClientCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-gray-800 shadow-sm animate-pulse">
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
        <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
      </div>
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-3 sm:mb-4 w-3/4"></div>
      <div className="space-y-2 mb-3 sm:mb-4">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
    </div>
  );
}

interface EmptyStateProps {
  searchQuery: string;
  onCreateClick: () => void;
  hasClients: boolean;
}

function EmptyState({ searchQuery, onCreateClick, hasClients }: EmptyStateProps) {
  // If there are no clients at all (not just filtered), show a different message
  if (!hasClients && !searchQuery) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 sm:p-12 text-center">
        <BuildingOfficeIcon className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-4 sm:mb-6" />
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Welcome to TCIS!
        </h3>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6 max-w-md mx-auto">
          You haven't added any clients yet. Get started by creating your first client to begin analyzing chat data.
        </p>
        
        <RoleGuard allowedRoles={['super_admin', 'backend']} showFallback={false}>
          <Button onClick={onCreateClick}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Your First Client
          </Button>
        </RoleGuard>
      </div>
    );
  }

  // Show filtered results message
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 sm:p-12 text-center">
      <BuildingOfficeIcon className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-4 sm:mb-6" />
      <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
        {searchQuery ? 'No clients found' : 'No clients yet'}
      </h3>
      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6 max-w-md mx-auto">
        {searchQuery 
          ? `No clients match "${searchQuery}". Try adjusting your search terms.`
          : 'Get started by adding your first client to begin analyzing their chat data with TCIS.'
        }
      </p>
      
      {!searchQuery && (
        <RoleGuard allowedRoles={['super_admin', 'backend']} showFallback={false}>
          <Button onClick={onCreateClick}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Your First Client
          </Button>
        </RoleGuard>
      )}
    </div>
  );
}

function CreateClientModal({ onClose, onSuccess }: { onClose: () => void; onSuccess?: (clientId: string) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { platformUser, supabase } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.length < 3 || name.length > 80) return;

    setLoading(true);
    
    try {
      // DEBUG: Check authentication state
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔍 DEBUG - Session exists:', !!session);
      console.log('🔍 DEBUG - User ID:', session?.user?.id);
      console.log('🔍 DEBUG - Token exists:', !!session?.access_token);
      console.log('🔍 DEBUG - Token preview:', session?.access_token?.substring(0, 20) + '...');
      
      const request: CreateClientRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        user_id: platformUser?.id, // Include user ID for anon key auth
      };

      console.log('🔍 DEBUG - Making API call to create client...');
      const response = await api.clients.create(supabase, request);
      
      console.log('✅ DEBUG - Client created successfully:', response);
      toast.success(`Client "${name}" created successfully!`);
      onSuccess?.(response.client_id);
      onClose();
    } catch (error: any) {
      console.error('❌ DEBUG - Error creating client:', error);
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
          <div className="p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Create New Client
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Client Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter client name"
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
                  placeholder="Brief description of the client"
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
                  {loading ? 'Creating...' : 'Create Client'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

interface EditClientModalProps {
  client: Client;
  onClose: () => void;
  onSave: (client: Client) => void;
}

function EditClientModal({ client, onClose, onSave }: EditClientModalProps) {
  const [name, setName] = useState(client.name);
  const [description, setDescription] = useState(client.description || '');
  const [status, setStatus] = useState(client.is_active);
  const [loading, setLoading] = useState(false);
  const { supabase } = useAuth(); // Get supabase client from context

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.length < 3 || name.length > 80) return;

    setLoading(true);
    
    try {
      // Update client in database
      const { error } = await supabase
        .from('clients')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          is_active: status,
        })
        .eq('id', client.id);

      if (error) throw error;
      
      const updatedClient: Client = {
        ...client,
        name: name.trim(),
        description: description.trim(),
        is_active: status,
      };
      
      onSave(updatedClient);
    } catch (error: any) {
      console.error('Error updating client:', error);
      toast.error('Failed to update client');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose}></div>
        
        <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-md">
          <div className="p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Edit Client
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Client Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter client name"
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
                  placeholder="Brief description of the client"
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600] resize-none"
                  maxLength={240}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {description.length}/240 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status *
                </label>
                <select
                  value={status ? 'true' : 'false'}
                  onChange={(e) => setStatus(e.target.value === 'true')}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600]"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
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
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DeleteClientModalProps {
  client: Client;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteClientModal({ client, onClose, onConfirm }: DeleteClientModalProps) {
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
  };

  const isConfirmValid = confirmText === client.name;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose}></div>
        
        <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-md">
          <div className="p-4 sm:p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Delete Client
              </h3>
            </div>
            
            <div className="mb-6">
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to delete <strong>"{client.name}"</strong>? 
                This action cannot be undone and will permanently delete:
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-4">
                <li>• All client data and settings</li>
                <li>• All associated chat rooms</li>
                <li>• All uploaded files and processing jobs</li>
                <li>• All conversation history</li>
              </ul>
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                This action is permanent and cannot be reversed.
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type <strong>"{client.name}"</strong> to confirm deletion:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={client.name}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>
            
            <div className="flex space-x-3">
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
                onClick={handleConfirm}
                disabled={loading || !isConfirmValid}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700"
              >
                {loading ? 'Deleting...' : 'Delete Client'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}