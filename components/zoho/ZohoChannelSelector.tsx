'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  UsersIcon,
  GlobeAltIcon,
  LockClosedIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { ZohoChannelOption, ZohoChannelListResponse } from '@/types/zoho';
import { cn } from '@/lib/utils';

interface ZohoChannelSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onChannelSelect: (channel: ZohoChannelOption) => void;
  clientId: number;
  roomId: number;
  roomName: string;
}

export function ZohoChannelSelector({
  isOpen,
  onClose,
  onChannelSelect,
  clientId,
  roomId,
  roomName,
}: ZohoChannelSelectorProps) {
  const { supabase } = useAuth();
  const [loading, setLoading] = useState(false);
  const [channels, setChannels] = useState<ZohoChannelOption[]>([]);
  const [filteredChannels, setFilteredChannels] = useState<ZohoChannelOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [nextToken, setNextToken] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [mapping, setMapping] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadChannels();
    }
  }, [isOpen]);

  useEffect(() => {
    // Filter channels based on search term
    const filtered = channels.filter(channel =>
      channel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      channel.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      channel.creator_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredChannels(filtered);
  }, [channels, searchTerm]);

  const loadChannels = async (token?: string) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        limit: '50',
        level: 'organization',
        status: 'created',
      });

      if (token) {
        params.append('next_token', token);
      }

      const response = await fetch(`/api/functions/zoho-channels?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load channels');
      }

      const data: ZohoChannelListResponse = await response.json();

      if (token) {
        // Append to existing channels
        setChannels(prev => [...prev, ...data.channels]);
      } else {
        // Replace channels
        setChannels(data.channels);
      }

      setHasMore(data.has_more);
      setNextToken(data.next_token);
    } catch (error) {
      console.error('Error loading channels:', error);
      setError(error.message);
      toast.error(`Failed to load channels: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreChannels = () => {
    if (nextToken && !loading) {
      loadChannels(nextToken);
    }
  };

  const handleChannelSelect = async (channel: ZohoChannelOption) => {
    if (channel.is_mapped) {
      toast.error('This channel is already mapped to another client');
      return;
    }

    try {
      setMapping(true);

      const response = await fetch('/api/functions/zoho-channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          client_id: clientId,
          room_id: roomId,
          zoho_channel_id: channel.channel_id,
          zoho_chat_id: channel.chat_id,
          zoho_channel_name: channel.name,
          zoho_unique_name: channel.unique_name,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to map channel');
      }

      toast.success(`Successfully mapped "${channel.name}" to "${roomName}"`);
      onChannelSelect(channel);
      onClose();
    } catch (error) {
      console.error('Error mapping channel:', error);
      toast.error(`Failed to map channel: ${error.message}`);
    } finally {
      setMapping(false);
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'organization':
        return <BuildingOfficeIcon className="h-4 w-4 text-blue-500" />;
      case 'team':
        return <UsersIcon className="h-4 w-4 text-green-500" />;
      case 'private':
        return <LockClosedIcon className="h-4 w-4 text-yellow-500" />;
      case 'external':
        return <GlobeAltIcon className="h-4 w-4 text-purple-500" />;
      default:
        return <GlobeAltIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'organization':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'team':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'private':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'external':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusBadge = (channel: ZohoChannelOption) => {
    if (channel.is_mapped) {
      return (
        <div className="flex items-center space-x-1 text-yellow-600 dark:text-yellow-400">
          <ExclamationTriangleIcon className="h-3 w-3" />
          <span className="text-xs">Mapped</span>
        </div>
      );
    }
    return (
      <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
        <CheckCircleIcon className="h-3 w-3" />
        <span className="text-xs">Available</span>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Zoho Cliq Channel"
      description={`Choose a Zoho Cliq channel to map to "${roomName}"`}
      size="2xl"
    >
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Input
            type="text"
            placeholder="Search channels..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            startIcon={<MagnifyingGlassIcon className="h-5 w-5" />}
          />
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadChannels()}
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Loading state */}
        {loading && channels.length === 0 && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-200 dark:bg-gray-700 rounded-lg h-20"></div>
              </div>
            ))}
          </div>
        )}

        {/* Channels list */}
        {!loading && filteredChannels.length === 0 && channels.length > 0 && (
          <div className="text-center py-8">
            <MagnifyingGlassIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No channels match your search</p>
          </div>
        )}

        {!loading && channels.length === 0 && !error && (
          <div className="text-center py-8">
            <BuildingOfficeIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No channels available</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Make sure you have access to organization channels in Zoho Cliq
            </p>
          </div>
        )}

        <div className="max-h-96 overflow-y-auto space-y-2">
          {filteredChannels.map((channel) => (
            <div
              key={channel.channel_id}
              className={cn(
                'border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
                channel.is_mapped 
                  ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'
                  : 'border-gray-200 dark:border-gray-700 cursor-pointer',
                mapping && 'opacity-50 pointer-events-none'
              )}
              onClick={() => !channel.is_mapped && handleChannelSelect(channel)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    {getLevelIcon(channel.level)}
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {channel.name}
                    </h4>
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', getLevelColor(channel.level))}>
                      {channel.level}
                    </span>
                  </div>
                  
                  {channel.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                      {channel.description}
                    </p>
                  )}
                  
                  <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-500">
                    <div className="flex items-center space-x-1">
                      <UsersIcon className="h-3 w-3" />
                      <span>{channel.participant_count} members</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <ClockIcon className="h-3 w-3" />
                      <span>by {channel.creator_name}</span>
                    </div>
                  </div>
                  
                  {channel.is_mapped && channel.mapped_to_client && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                      Already mapped to client #{channel.mapped_to_client}
                    </p>
                  )}
                </div>
                
                <div className="ml-4 flex-shrink-0">
                  {getStatusBadge(channel)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Load more */}
        {hasMore && (
          <div className="text-center">
            <Button
              variant="outline"
              onClick={loadMoreChannels}
              loading={loading}
              disabled={mapping}
            >
              Load More Channels
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={mapping}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
