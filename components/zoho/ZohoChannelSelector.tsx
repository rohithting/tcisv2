'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  LinkIcon,
  ListBulletIcon,
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

type TabType = 'browse' | 'permalink';

export function ZohoChannelSelector({
  isOpen,
  onClose,
  onChannelSelect,
  clientId,
  roomId,
  roomName,
}: ZohoChannelSelectorProps) {
  const { supabase } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('browse');
  const [loading, setLoading] = useState(false);
  const [channels, setChannels] = useState<ZohoChannelOption[]>([]);
  const [filteredChannels, setFilteredChannels] = useState<ZohoChannelOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [nextToken, setNextToken] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [mapping, setMapping] = useState(false);
  const [permalink, setPermalink] = useState('');
  const [permalinkLoading, setPermalinkLoading] = useState(false);
  const [permalinkError, setPermalinkError] = useState<string | null>(null);
  const [retrievedChannel, setRetrievedChannel] = useState<ZohoChannelOption | null>(null);
  const channelsLoadedRef = useRef(false);

  useEffect(() => {
    if (isOpen && !channelsLoadedRef.current && activeTab === 'browse') {
      channelsLoadedRef.current = true;
      loadChannels();
    }
  }, [isOpen, activeTab]);

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
    if (loading && !token) return; // Prevent multiple simultaneous calls
    
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await supabase.functions.invoke('zoho-channel-mapper', {
        body: {
          action: 'list_channels',
          params: {
            limit: 50,
            level: 'organization',
            status: 'created',
            next_token: token
          }
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to load channels');
      }

      const data: ZohoChannelListResponse = response.data;

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

      const response = await supabase.functions.invoke('zoho-channels', {
        body: {
          action: 'create_mapping',
          client_id: clientId,
          room_id: roomId,
          zoho_channel_id: channel.channel_id,
          zoho_chat_id: channel.chat_id,
          zoho_channel_name: channel.name,
          zoho_unique_name: channel.unique_name,
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to map channel');
      }

      toast.success(`Successfully mapped "${channel.name}" to "${roomName}"`);
      channelsLoadedRef.current = false;
      onChannelSelect(channel);
      onClose();
    } catch (error) {
      console.error('Error mapping channel:', error);
      toast.error(`Failed to map channel: ${error.message}`);
    } finally {
      setMapping(false);
    }
  };

  const handlePermalinkSubmit = async () => {
    if (!permalink.trim()) {
      setPermalinkError('Please enter a Zoho Cliq channel permalink');
      return;
    }

    try {
      setPermalinkLoading(true);
      setPermalinkError(null);
      setRetrievedChannel(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await supabase.functions.invoke('zoho-channel-mapper', {
        body: {
          action: 'get_channel_by_permalink',
          permalink: permalink.trim()
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to retrieve channel');
      }

      setRetrievedChannel(response.data.channel);
      toast.success('Channel retrieved successfully!');
    } catch (error) {
      console.error('Error retrieving channel:', error);
      setPermalinkError(error.message);
      toast.error(`Failed to retrieve channel: ${error.message}`);
    } finally {
      setPermalinkLoading(false);
    }
  };

  const handlePermalinkChannelSelect = async (channel: ZohoChannelOption) => {
    if (channel.is_mapped) {
      toast.error('This channel is already mapped to another client');
      return;
    }

    try {
      setMapping(true);

      const response = await supabase.functions.invoke('zoho-channels', {
        body: {
          action: 'create_mapping',
          client_id: clientId,
          room_id: roomId,
          zoho_channel_id: channel.channel_id,
          zoho_chat_id: channel.chat_id,
          zoho_channel_name: channel.name,
          zoho_unique_name: channel.unique_name,
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to map channel');
      }

      toast.success(`Successfully mapped "${channel.name}" to "${roomName}"`);
      channelsLoadedRef.current = false;
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

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setError(null);
    setPermalinkError(null);
    setRetrievedChannel(null);
    setPermalink('');
    
    if (tab === 'browse' && !channelsLoadedRef.current) {
      channelsLoadedRef.current = true;
      loadChannels();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Map Zoho Cliq Channel"
      description={`Choose how to map a Zoho Cliq channel to "${roomName}"`}
      size="2xl"
    >
      <div className="space-y-4">
        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => handleTabChange('browse')}
              className={cn(
                'py-2 px-1 border-b-2 font-medium text-sm transition-colors',
                activeTab === 'browse'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              )}
            >
              <div className="flex items-center space-x-2">
                <ListBulletIcon className="h-4 w-4" />
                <span>Browse All Channels</span>
              </div>
            </button>
            <button
              onClick={() => handleTabChange('permalink')}
              className={cn(
                'py-2 px-1 border-b-2 font-medium text-sm transition-colors',
                activeTab === 'permalink'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              )}
            >
              <div className="flex items-center space-x-2">
                <LinkIcon className="h-4 w-4" />
                <span>Enter Channel Link</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Browse Tab Content */}
        {activeTab === 'browse' && (
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
          </div>
        )}

        {/* Permalink Tab Content */}
        {activeTab === 'permalink' && (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start">
                <LinkIcon className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                    Enter Zoho Cliq Channel Permalink
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Paste the permalink of the Zoho Cliq channel you want to map. 
                    The permalink should look like: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">https://cliq.ting.in/company/60021694582/channels/announcements</code>
                  </p>
                </div>
              </div>
            </div>

            {/* Permalink Input */}
            <div className="space-y-2">
              <label htmlFor="permalink" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Channel Permalink
              </label>
              <Input
                id="permalink"
                type="url"
                placeholder="https://cliq.ting.in/company/60021694582/channels/announcements"
                value={permalink}
                onChange={(e) => setPermalink(e.target.value)}
                startIcon={<LinkIcon className="h-5 w-5" />}
                disabled={permalinkLoading}
              />
              <Button
                onClick={handlePermalinkSubmit}
                loading={permalinkLoading}
                disabled={!permalink.trim() || permalinkLoading}
                className="w-full"
              >
                Retrieve Channel
              </Button>
            </div>

            {/* Permalink Error */}
            {permalinkError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
                  <p className="text-sm text-red-700 dark:text-red-300">{permalinkError}</p>
                </div>
              </div>
            )}

            {/* Retrieved Channel */}
            {retrievedChannel && (
              <div className="border border-green-200 dark:border-green-800 rounded-lg p-4 bg-green-50 dark:bg-green-900/20">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      {getLevelIcon(retrievedChannel.level)}
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {retrievedChannel.name}
                      </h4>
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', getLevelColor(retrievedChannel.level))}>
                        {retrievedChannel.level}
                      </span>
                    </div>
                    
                    {retrievedChannel.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                        {retrievedChannel.description}
                      </p>
                    )}
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-500">
                      <div className="flex items-center space-x-1">
                        <UsersIcon className="h-3 w-3" />
                        <span>{retrievedChannel.participant_count} members</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <ClockIcon className="h-3 w-3" />
                        <span>by {retrievedChannel.creator_name}</span>
                      </div>
                    </div>
                    
                    {retrievedChannel.is_mapped && retrievedChannel.mapped_to_client && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                        Already mapped to client #{retrievedChannel.mapped_to_client}
                      </p>
                    )}
                  </div>
                  
                  <div className="ml-4 flex-shrink-0">
                    {getStatusBadge(retrievedChannel)}
                  </div>
                </div>

                {!retrievedChannel.is_mapped && (
                  <Button
                    onClick={() => handlePermalinkChannelSelect(retrievedChannel)}
                    loading={mapping}
                    disabled={mapping}
                    className="w-full mt-3"
                  >
                    Map This Channel
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            onClick={() => {
              channelsLoadedRef.current = false;
              onClose();
            }}
            disabled={mapping}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
