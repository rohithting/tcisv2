// Zoho Cliq Message Sync Edge Function
// Runs on cron schedule to fetch messages from mapped channels
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface ZohoChannelMapping {
  id: string;
  client_id: number;
  room_id: string;
  zoho_channel_id: string;
  zoho_chat_id: string;
  zoho_channel_name: string;
  last_sync_at: string | null;
  last_message_time: number | null;
  sync_status: 'active' | 'paused' | 'error';
}

interface ZohoMessage {
  id: string;
  time: number;
  type: string;
  content: string | any;
  sender: {
    name: string;
    id: string;
  };
}

interface SyncJobResult {
  mapping_id: string;
  success: boolean;
  messages_fetched: number;
  messages_processed: number;
  error_message?: string;
  processing_time_ms: number;
}

class ZohoMessageSyncer {
  private supabase: any;
  private zohoAccessToken: string;

  constructor(supabase: any, zohoAccessToken: string) {
    this.supabase = supabase;
    this.zohoAccessToken = zohoAccessToken;
  }

  async syncChannel(mapping: ZohoChannelMapping, isFullSync: boolean = false): Promise<SyncJobResult> {
    const startTime = Date.now();
    let messagesFetched = 0;
    let messagesProcessed = 0;
    
    try {
      console.log(`Starting sync for channel: ${mapping.zoho_channel_name} (${mapping.id})`);

      // Create sync job record
      const { data: syncJob, error: jobError } = await this.supabase
        .from('zoho_sync_jobs')
        .insert({
          mapping_id: mapping.id,
          job_type: 'scheduled',
          status: 'running',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Determine time range for sync
      let fromTime: number | undefined;
      if (!isFullSync && mapping.last_message_time) {
        // Incremental sync: get messages newer than last synced message
        fromTime = mapping.last_message_time + 1; // Add 1ms to avoid duplicates
      } else {
        // Full sync: get messages from last 7 days
        fromTime = Date.now() - (7 * 24 * 60 * 60 * 1000);
      }

      // Fetch messages from Zoho Cliq
      const messages = await this.fetchMessages(mapping.zoho_chat_id, fromTime);
      messagesFetched = messages.length;

      if (messages.length > 0) {
        console.log(`Fetched ${messages.length} messages from ${mapping.zoho_channel_name}`);

        // Format messages for CloudRun processing
        const formattedContent = this.formatMessagesForCloudRun(messages, mapping);
        
        // Send to existing ingest endpoint for processing
        const ingestResult = await this.sendToIngest(mapping, formattedContent);
        messagesProcessed = messages.length;

        // Update mapping with latest sync info
        const latestMessageTime = Math.max(...messages.map(m => m.time));
        await this.supabase
          .from('zoho_channel_mappings')
          .update({
            last_sync_at: new Date().toISOString(),
            last_message_time: latestMessageTime,
            sync_status: 'active',
            sync_error: null,
          })
          .eq('id', mapping.id);

        console.log(`Successfully processed ${messagesProcessed} messages`);
      } else {
        console.log(`No new messages found for ${mapping.zoho_channel_name}`);
      }

      // Update sync job as completed
      const processingTime = Date.now() - startTime;
      await this.supabase
        .from('zoho_sync_jobs')
        .update({
          status: 'completed',
          messages_fetched: messagesFetched,
          messages_processed: messagesProcessed,
          processing_time_ms: processingTime,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncJob.id);

      return {
        mapping_id: mapping.id,
        success: true,
        messages_fetched: messagesFetched,
        messages_processed: messagesProcessed,
        processing_time_ms: processingTime,
      };

    } catch (error) {
      console.error(`Sync failed for ${mapping.zoho_channel_name}:`, error);

      const processingTime = Date.now() - startTime;
      const errorMessage = error.message || 'Unknown error occurred';

      // Update mapping with error status
      await this.supabase
        .from('zoho_channel_mappings')
        .update({
          sync_status: 'error',
          sync_error: errorMessage,
        })
        .eq('id', mapping.id);

      // Update sync job as failed
      await this.supabase
        .from('zoho_sync_jobs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          messages_fetched: messagesFetched,
          processing_time_ms: processingTime,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncJob?.id);

      return {
        mapping_id: mapping.id,
        success: false,
        messages_fetched: messagesFetched,
        messages_processed: messagesProcessed,
        error_message: errorMessage,
        processing_time_ms: processingTime,
      };
    }
  }

  private async fetchMessages(chatId: string, fromTime?: number): Promise<ZohoMessage[]> {
    const params = new URLSearchParams();
    params.append('limit', '100');
    
    if (fromTime) {
      params.append('fromtime', fromTime.toString());
    }

    const response = await fetch(
      `https://cliq.zoho.com/api/v2/chats/${chatId}/messages?${params.toString()}`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${this.zohoAccessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Zoho API error: ${response.status} - ${await response.text()}`);
    }

    const data = await response.json();
    return data.data || [];
  }

  private formatMessagesForCloudRun(messages: ZohoMessage[], mapping: ZohoChannelMapping): string {
    // Format messages similar to WhatsApp export format for consistency
    const formattedMessages = messages.map(msg => {
      const timestamp = new Date(msg.time).toLocaleString();
      const senderName = msg.sender.name || 'Unknown';
      
      let content = '';
      if (typeof msg.content === 'string') {
        content = msg.content;
      } else if (msg.content && typeof msg.content === 'object') {
        // Handle file messages, attachments, etc.
        if (msg.content.comment) {
          content = msg.content.comment;
        } else if (msg.content.file && msg.content.file.name) {
          content = `[File: ${msg.content.file.name}]`;
        } else {
          content = `[${msg.type} message]`;
        }
      }

      return `[${timestamp}] ${senderName}: ${content}`;
    });

    return formattedMessages.join('\n');
  }

  private async sendToIngest(mapping: ZohoChannelMapping, content: string): Promise<any> {
    // Use the existing ingest endpoint to process the chat content
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        clientId: mapping.client_id,
        roomId: mapping.room_id,
        content: content,
        filename: `${mapping.zoho_channel_name}_${new Date().toISOString().split('T')[0]}.txt`,
        source: 'zoho_cliq_sync',
        channel_name: mapping.zoho_channel_name,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ingest failed: ${response.status} - ${await response.text()}`);
    }

    return await response.json();
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get request body for manual sync or use defaults for scheduled sync
    const body = await req.json().catch(() => ({}));
    const isManualSync = body.manual === true;
    const targetMappingId = body.mapping_id;
    const isFullSync = body.full_sync === true;

    console.log(`Starting Zoho sync job - Manual: ${isManualSync}, Full: ${isFullSync}`);

    // Get Zoho auth
    const { data: authRecord, error: authError } = await supabase
      .from('zoho_auth')
      .select('*')
      .single();

    if (authError || !authRecord) {
      throw new Error('Zoho authentication not configured');
    }

    // Check if token is expired
    const expiresAt = new Date(authRecord.expires_at);
    if (new Date() >= expiresAt) {
      throw new Error('Zoho authentication has expired');
    }

    // Get active channel mappings
    let query = supabase
      .from('zoho_channel_mappings')
      .select('*')
      .eq('sync_status', 'active');

    if (targetMappingId) {
      query = query.eq('id', targetMappingId);
    }

    const { data: mappings, error: mappingsError } = await query;

    if (mappingsError) throw mappingsError;

    if (!mappings || mappings.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No active channel mappings found',
          results: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${mappings.length} active channel mappings to sync`);

    // Sync each channel
    const syncer = new ZohoMessageSyncer(supabase, authRecord.access_token);
    const results: SyncJobResult[] = [];

    for (const mapping of mappings) {
      const result = await syncer.syncChannel(mapping, isFullSync);
      results.push(result);
    }

    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalMessages = results.reduce((sum, r) => sum + r.messages_processed, 0);

    console.log(`Sync completed - Successful: ${successful}, Failed: ${failed}, Total Messages: ${totalMessages}`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_mappings: mappings.length,
          successful_syncs: successful,
          failed_syncs: failed,
          total_messages_processed: totalMessages,
        },
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in zoho-sync:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
