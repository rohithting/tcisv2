// Zoho Cliq Integration Types

export interface ZohoAuth {
  id: number;
  access_token: string;
  refresh_token?: string; // Made optional since Zoho doesn't always return it
  expires_at: string;
  scope: string;
  authenticated_by: string;
  organization_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ZohoChannelMapping {
  id: string;
  client_id: number;
  room_id: number;
  
  // Zoho channel details
  zoho_channel_id: string;
  zoho_chat_id: string;
  zoho_channel_name: string;
  zoho_unique_name?: string;
  zoho_organization_id?: string;
  
  // Sync tracking
  last_sync_at?: string;
  last_message_time?: number;
  sync_status: 'active' | 'paused' | 'error';
  sync_error?: string;
  
  // Metadata
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ZohoSyncJob {
  id: string;
  mapping_id: string;
  
  // Job details
  job_type: 'manual' | 'scheduled' | 'retry';
  status: 'pending' | 'running' | 'completed' | 'failed';
  
  // Progress tracking
  messages_fetched: number;
  messages_processed: number;
  from_time?: number;
  to_time?: number;
  
  // Results
  error_message?: string;
  processing_time_ms?: number;
  
  // Timestamps
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface ZohoChannelMappingWithDetails extends ZohoChannelMapping {
  // Related data
  client?: {
    id: number;
    name: string;
  };
  room?: {
    id: string;
    name: string;
    type: string;
  };
  created_by_user?: {
    id: string;
    full_name: string;
    email: string;
  };
  latest_sync_job?: ZohoSyncJob;
}

// UI Types for channel selection
export interface ZohoChannelOption {
  channel_id: string;
  chat_id: string;
  name: string;
  description?: string;
  level: 'organization' | 'team' | 'private' | 'external';
  participant_count: number;
  unique_name?: string;
  creator_name: string;
  creation_time: string;
  last_modified_time: string;
  is_mapped: boolean;
  mapped_to_client?: string;
}

// Sync status for UI
export interface ZohoSyncStatus {
  mapping_id: string;
  channel_name: string;
  status: 'active' | 'paused' | 'error' | 'syncing';
  last_sync_at?: string;
  next_sync_at?: string;
  error_message?: string;
  messages_synced_today: number;
  total_messages_synced: number;
}

// API request/response types
export interface CreateZohoMappingRequest {
  client_id: number;
  room_id: number;
  zoho_channel_id: string;
  zoho_chat_id: string;
  zoho_channel_name: string;
  zoho_unique_name?: string;
  zoho_organization_id?: string;
}

export interface ZohoAuthSetupRequest {
  access_token: string;
  refresh_token?: string; // Made optional since Zoho doesn't always return it
  expires_in: number;
  scope: string;
  organization_id?: string;
}

export interface ZohoSyncRequest {
  mapping_id: string;
  job_type: 'manual' | 'scheduled' | 'retry';
  force_full_sync?: boolean;
}

export interface ZohoChannelListResponse {
  channels: ZohoChannelOption[];
  has_more: boolean;
  next_token?: string;
}
