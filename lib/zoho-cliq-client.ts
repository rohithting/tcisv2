// Zoho Cliq API Client
// Handles all API interactions with Zoho Cliq

export interface ZohoAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  scope: string;
}

export interface ZohoChannel {
  name: string;
  chat_id: string;
  description?: string;
  level: 'organization' | 'team' | 'private' | 'external';
  channel_id: string;
  organization_id: string;
  creator_id: string;
  creator_name: string;
  creation_time: string;
  last_modified_time: string;
  current_user_role: string;
  participant_count: number;
  joined: boolean;
  status: 'created' | 'pending' | 'archived';
  unique_name?: string;
  total_message_count: string;
  unread_message_count: number;
}

export interface ZohoMessage {
  id: string;
  time: number;
  type: string;
  content: string | ZohoFileContent;
  sender: {
    name: string;
    id: string;
  };
}

export interface ZohoFileContent {
  thumbnail?: {
    height: number;
    width: number;
    blur_data: string;
  };
  file: {
    name: string;
    type: string;
    id: string;
    dimensions?: {
      height: number;
      width: number;
      size: number;
    };
  };
  comment?: string;
}

export interface ZohoChannelMember {
  user_id: string;
  email_id: string;
  name: string;
  user_role: 'member' | 'admin' | 'super_admin';
}

export interface ZohoApiResponse<T> {
  data?: T;
  channels?: T;
  members?: T;
  has_more?: boolean;
  next_token?: string;
  sync_token?: string;
  error?: string;
}

export class ZohoCliqClient {
  private baseUrl = 'https://cliq.zoho.com/api/v2';
  private tokens: ZohoAuthTokens | null = null;

  constructor(tokens?: ZohoAuthTokens) {
    this.tokens = tokens || null;
  }

  // Set authentication tokens
  setTokens(tokens: ZohoAuthTokens) {
    this.tokens = tokens;
  }

  // Check if tokens are valid and refresh if needed
  private async ensureValidTokens(): Promise<boolean> {
    if (!this.tokens) {
      throw new Error('No authentication tokens available');
    }

    // Check if token is expired (with 5 minute buffer)
    const now = Date.now();
    const expiresAt = this.tokens.expires_at;
    
    if (now >= expiresAt - 300000) { // 5 minutes buffer
      try {
        await this.refreshTokens();
      } catch (error) {
        console.error('Failed to refresh Zoho tokens:', error);
        return false;
      }
    }

    return true;
  }

  // Refresh access tokens using refresh token
  private async refreshTokens(): Promise<void> {
    if (!this.tokens?.refresh_token) {
      throw new Error('No refresh token available');
    }

    const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.tokens.refresh_token,
        client_id: process.env.ZOHO_CLIENT_ID || '',
        client_secret: process.env.ZOHO_CLIENT_SECRET || '',
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    
    this.tokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || this.tokens.refresh_token,
      expires_in: data.expires_in,
      expires_at: Date.now() + (data.expires_in * 1000),
      scope: data.scope || this.tokens.scope,
    };
  }

  // Make authenticated API request
  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ZohoApiResponse<T>> {
    await this.ensureValidTokens();

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Zoho-oauthtoken ${this.tokens?.access_token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Zoho API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  // Get all channels in the organization
  async getChannels(params: {
    limit?: number;
    level?: 'organization' | 'team' | 'private' | 'external';
    status?: 'created' | 'pending' | 'archived';
    joined?: boolean;
    next_token?: string;
  } = {}): Promise<ZohoApiResponse<ZohoChannel[]>> {
    const searchParams = new URLSearchParams();
    
    // Default to organization level channels that user has joined
    searchParams.append('level', params.level || 'organization');
    searchParams.append('joined', 'true');
    searchParams.append('status', params.status || 'created');
    
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.next_token) searchParams.append('next_token', params.next_token);

    return this.makeRequest<ZohoChannel[]>(`/channels?${searchParams.toString()}`);
  }

  // Get specific channel details
  async getChannel(channelId: string): Promise<ZohoApiResponse<ZohoChannel>> {
    return this.makeRequest<ZohoChannel>(`/channels/${channelId}`);
  }

  // Get channel members
  async getChannelMembers(channelId: string): Promise<ZohoApiResponse<ZohoChannelMember[]>> {
    return this.makeRequest<ZohoChannelMember[]>(`/channels/${channelId}/members`);
  }

  // Get messages from a channel (for sync)
  async getChannelMessages(
    chatId: string,
    params: {
      fromtime?: number; // milliseconds timestamp
      totime?: number;   // milliseconds timestamp
      limit?: number;
    } = {}
  ): Promise<ZohoApiResponse<ZohoMessage[]>> {
    const searchParams = new URLSearchParams();
    
    if (params.fromtime) searchParams.append('fromtime', params.fromtime.toString());
    if (params.totime) searchParams.append('totime', params.totime.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());

    return this.makeRequest<ZohoMessage[]>(`/chats/${chatId}/messages?${searchParams.toString()}`);
  }

  // Get current tokens for persistence
  getTokens(): ZohoAuthTokens | null {
    return this.tokens;
  }

  // Check if client is authenticated
  isAuthenticated(): boolean {
    return this.tokens !== null;
  }
}
