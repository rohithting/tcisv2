'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  ChevronDownIcon,
  BuildingOfficeIcon,
  CheckIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

interface Client {
  id: string;
  name: string;
  is_active: boolean; // Changed from status to is_active to match database schema
  room_count: number;
}

interface ClientPickerProps {
  selectedClientId?: string;
  onClientSelect: (clientId: string, client: Client) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function ClientPicker({
  selectedClientId,
  onClientSelect,
  placeholder = "Select a client...",
  className,
  disabled = false
}: ClientPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { platformUser, supabase } = useAuth(); // Get supabase client from context

  // FIXED: Add refetch guard to prevent unnecessary API calls
  const shouldRefetch = () => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime;
    // Only refetch if it's been more than 30 seconds since last fetch
    return timeSinceLastFetch > 30000;
  };

  // FIXED: Add manual refresh function for when users actually need fresh data
  const refreshClients = async () => {
    setLastFetchTime(0); // Reset fetch time to force refresh
    setLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setClients([]);
        setLoading(false);
        return;
      }

      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select(`
          id,
          name,
          is_active,
          rooms (
            id
          )
        `)
        .order('name', { ascending: true });

      if (clientsError) throw clientsError;

      const transformedClients: Client[] = (clientsData || []).map((client: any) => ({
        id: client.id,
        name: client.name,
        is_active: client.is_active as boolean,
        room_count: client.rooms?.length || 0,
      }));

      setClients(transformedClients);
      setLastFetchTime(Date.now());
      
    } catch (error: any) {
      console.error('Error refreshing clients:', error);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch real clients from database
  useEffect(() => {
    // FIXED: Prevent infinite loops by adding proper state management
    let isMounted = true;
    let hasFetched = false;
    
    const fetchClients = async () => {
      // Prevent multiple simultaneous fetches
      if (hasFetched || !isMounted) return;
      
      // FIXED: Add refetch guard to prevent unnecessary API calls
      if (!shouldRefetch()) {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }
      
      if (!platformUser) {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      // Mark as fetched to prevent re-runs
      hasFetched = true;
      
      if (isMounted) {
        setLoading(true);
      }
      
      try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (isMounted) {
            setClients([]);
            setLoading(false);
          }
          return;
        }

        if (!isMounted) return;

        // Fetch clients with room counts
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select(`
            id,
            name,
            is_active,
            rooms (
              id
            )
          `)
          .order('name', { ascending: true });

        if (clientsError) throw clientsError;

        if (!isMounted) return;

        // Transform data to match Client interface
        const transformedClients: Client[] = (clientsData || []).map((client: any) => ({
          id: client.id,
          name: client.name,
          is_active: client.is_active as boolean,
          room_count: client.rooms?.length || 0,
        }));

        setClients(transformedClients);
        setLastFetchTime(Date.now());
        
      } catch (error: any) {
        console.error('Error fetching clients:', error);
        if (isMounted) {
          setClients([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchClients();
    
    return () => {
      isMounted = false;
    };
  }, [platformUser?.id]); // FIXED: Only depend on platformUser.id, not the entire object

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedClient = clients.find(client => String(client.id) === String(selectedClientId));
  
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleClientSelect = (client: Client) => {
    onClientSelect(client.id, client);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 text-left bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm transition-all duration-200",
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600]",
          isOpen && "border-[#ffe600] ring-2 ring-[#ffe600]/20"
        )}
      >
        <div className="flex items-center min-w-0 flex-1">
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg mr-3">
            <BuildingOfficeIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </div>
          <div className="min-w-0 flex-1">
            {selectedClient ? (
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {selectedClient.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedClient.room_count} room{selectedClient.room_count !== 1 ? 's' : ''} • {selectedClient.is_active ? 'Active' : 'Inactive'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {loading ? 'Loading clients...' : placeholder}
              </p>
            )}
          </div>
        </div>
        <ChevronDownIcon 
          className={cn(
            "h-5 w-5 text-gray-400 transition-transform duration-200",
            isOpen && "rotate-180"
          )} 
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600]"
                />
              </div>
              {/* FIXED: Add refresh button for manual refresh */}
              <button
                type="button"
                onClick={refreshClients}
                disabled={loading}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Refresh clients"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Client List */}
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center">
                <div className="animate-spin h-5 w-5 border-2 border-[#ffe600] border-t-transparent rounded-full mx-auto"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading clients...</p>
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="p-4 text-center">
                <BuildingOfficeIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {searchQuery ? 'No clients found' : 'No clients available'}
                </p>
              </div>
            ) : (
              <div className="py-2">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => handleClientSelect(client)}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150",
                      String(selectedClientId) === String(client.id) && "bg-[#ffe600]/10 dark:bg-[#ffe600]/10"
                    )}
                  >
                    <div className="flex items-center min-w-0 flex-1">
                      <div className={cn(
                        "w-2 h-2 rounded-full mr-3",
                        client.is_active ? 'bg-green-500' : 'bg-gray-400'
                      )} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {client.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {client.room_count} room{client.room_count !== 1 ? 's' : ''} • {client.is_active ? 'Active' : 'Inactive'}
                        </p>
                      </div>
                    </div>
                    {String(selectedClientId) === String(client.id) && (
                      <CheckIcon className="h-4 w-4 text-[#ffe600]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
