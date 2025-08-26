// Zoho Cliq Message Sync Edge Function
// Runs on cron schedule to fetch messages from mapped channels
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { assertAuth, assertRoleIn, generateCorrelationId, createErrorResponse, createSuccessResponse } from '../_shared/auth.ts';
class ZohoMessageSyncer {
  supabase;
  authRecord;
  constructor(supabase, authRecord){
    this.supabase = supabase;
    this.authRecord = authRecord;
  }
  async refreshZohoToken() {
    try {
      console.log('Attempting to refresh Zoho token...');
      // Check if we have the required data for refresh
      if (!this.authRecord.refresh_token || !this.authRecord.client_id || !this.authRecord.client_secret) {
        console.error('Missing refresh token or client credentials');
        return null;
      }
      const tokenData = {
        refresh_token: this.authRecord.refresh_token.trim(),
        client_id: this.authRecord.client_id.trim(),
        client_secret: this.authRecord.client_secret.trim(),
        grant_type: 'refresh_token'
      };
      console.log('Token refresh request:', {
        client_id: tokenData.client_id,
        has_refresh_token: !!tokenData.refresh_token,
        refresh_token_length: tokenData.refresh_token.length
      });
      const response = await fetch('https://accounts.zoho.in/oauth/v2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(tokenData)
      });
      const data = await response.json();
      console.log('Token refresh response:', {
        status: response.status,
        has_access_token: !!data.access_token,
        access_token_length: data.access_token?.length,
        expires_in: data.expires_in,
        error: data.error,
        error_description: data.error_description
      });
      if (!response.ok || data.error) {
        console.error(`Token refresh failed: ${response.status}`, data);
        // Increment error count
        await this.supabase.from('zoho_auth').update({
          refresh_error_count: (this.authRecord.refresh_error_count || 0) + 1,
          last_refresh_attempt: new Date().toISOString()
        }).eq('id', this.authRecord.id);
        return null;
      }
      if (!data.access_token) {
        console.error('No access token in refresh response');
        return null;
      }
      // Validate expires_in before using it
      const expiresIn = parseInt(data.expires_in) || 3600; // Default to 1 hour if invalid
      const expiresAt = new Date(Date.now() + expiresIn * 1000);
      const { error: updateError } = await this.supabase.from('zoho_auth').update({
        access_token: data.access_token.trim(),
        refresh_token: data.refresh_token?.trim() || this.authRecord.refresh_token,
        expires_at: expiresAt.toISOString(),
        refresh_error_count: 0,
        last_refresh_attempt: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', this.authRecord.id);
      if (updateError) {
        console.error('Failed to update auth record:', updateError);
        return null;
      }
      console.log('Token refreshed successfully');
      return data.access_token.trim();
    } catch (error) {
      console.error('Token refresh error:', error);
      // Increment error count
      try {
        await this.supabase.from('zoho_auth').update({
          refresh_error_count: (this.authRecord.refresh_error_count || 0) + 1,
          last_refresh_attempt: new Date().toISOString()
        }).eq('id', this.authRecord.id);
      } catch (dbError) {
        console.error('Failed to update error count:', dbError);
      }
      return null;
    }
  }
  async getAccessToken() {
    let accessToken = this.authRecord.access_token?.trim();
    // Check if token is expired or will expire soon (within 5 minutes)
    const expiresAt = new Date(this.authRecord.expires_at);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    console.log('Token expiry check:', {
      expires_at: expiresAt.toISOString(),
      current_time: now.toISOString(),
      is_expired: now >= expiresAt,
      expires_soon: fiveMinutesFromNow >= expiresAt
    });
    // If token is expired or expires soon, try to refresh
    if (now >= expiresAt || fiveMinutesFromNow >= expiresAt) {
      console.log('Token expired or expires soon, attempting refresh...');
      const newToken = await this.refreshZohoToken();
      if (newToken) {
        accessToken = newToken;
        console.log('Using refreshed token');
      } else {
        console.log('Token refresh failed, will try with existing token');
      }
    }
    return accessToken;
  }
  async syncChannel(mapping, isFullSync = false) {
    const startTime = Date.now();
    let messagesFetched = 0;
    let messagesProcessed = 0;
    let uploadId;
    let jobId;
    let syncJob = null;
    try {
      console.log(`Starting sync for channel: ${mapping.zoho_channel_name} (${mapping.id})`);
      // Debug: Check if zoho_sync_jobs table exists and has correct schema
      try {
        const { data: tableInfo, error: tableError } = await this.supabase.from('zoho_sync_jobs').select('id').limit(1);
        if (tableError) {
          console.error('Table schema error:', tableError);
          throw tableError;
        }
        console.log('zoho_sync_jobs table accessible');
      } catch (schemaError) {
        console.error('Schema check failed:', schemaError);
        throw schemaError;
      }
      // Create sync job record
      try {
        const { data: jobData, error: jobError } = await this.supabase.from('zoho_sync_jobs').insert({
          mapping_id: mapping.id,
          job_type: 'scheduled',
          status: 'running',
          started_at: new Date().toISOString()
        }).select().single();
        if (jobError) {
          console.error('Failed to create sync job:', jobError);
          throw jobError;
        }
        syncJob = jobData;
        console.log(`Created sync job: ${syncJob.id}`);
      } catch (jobCreateError) {
        console.error('Error creating sync job:', jobCreateError);
        // Continue without sync job tracking if creation fails
        syncJob = null;
      }
      // Determine time range for sync
      let fromTime;
      if (!isFullSync && mapping.last_message_time) {
        // Incremental sync: get messages newer than last synced message
        fromTime = mapping.last_message_time + 1; // Add 1ms to avoid duplicates
        console.log(`Incremental sync: from ${new Date(fromTime).toISOString()} (last_message_time: ${mapping.last_message_time})`);
      } else {
        // Full sync: get ALL messages (no time limit)
        fromTime = undefined;
        console.log(`Full sync: fetching ALL messages (no time limit)`);
      }
      // Fetch messages from Zoho Cliq
      const messages = await this.fetchMessages(mapping.zoho_chat_id, fromTime);
      messagesFetched = messages.length;
      if (messages.length > 0) {
        console.log(`Fetched ${messages.length} messages from ${mapping.zoho_channel_name}`);
        // Format messages for CloudRun processing
        const formattedContent = this.formatMessagesForCloudRun(messages, mapping);
        // Create proper upload and job records for CloudRun processing
        const { upload_id, job_id } = await this.createCloudRunJob(mapping, formattedContent, messages.length);
        uploadId = upload_id;
        jobId = job_id;
        messagesProcessed = messages.length;
        // Update mapping with latest sync info
        const latestMessageTime = Math.max(...messages.map((m)=>m.time));
        await this.supabase.from('zoho_channel_mappings').update({
          last_sync_at: new Date().toISOString(),
          last_message_time: latestMessageTime,
          sync_status: 'active',
          sync_error: null
        }).eq('id', mapping.id);
        console.log(`Successfully processed ${messagesProcessed} messages. Created upload_id: ${upload_id}, job_id: ${job_id}`);
      } else {
        console.log(`No new messages found for ${mapping.zoho_channel_name}`);
      }
      // Update sync job as completed
      const processingTime = Date.now() - startTime;
      if (syncJob) {
        await this.supabase.from('zoho_sync_jobs').update({
          status: 'completed',
          messages_fetched: messagesFetched,
          messages_processed: messagesProcessed,
          processing_time_ms: processingTime,
          completed_at: new Date().toISOString()
        }).eq('id', syncJob.id);
      }
      return {
        mapping_id: mapping.id,
        success: true,
        messages_fetched: messagesFetched,
        messages_processed: messagesProcessed,
        upload_id: uploadId,
        job_id: jobId,
        processing_time_ms: processingTime
      };
    } catch (error) {
      console.error(`Sync failed for ${mapping.zoho_channel_name}:`, error);
      const processingTime = Date.now() - startTime;
      const errorMessage = error.message || 'Unknown error occurred';
      // Update mapping with error status
      await this.supabase.from('zoho_channel_mappings').update({
        sync_status: 'error',
        sync_error: errorMessage
      }).eq('id', mapping.id);
      // Update sync job as failed
      await this.supabase.from('zoho_sync_jobs').update({
        status: 'failed',
        error_message: errorMessage,
        messages_fetched: messagesFetched,
        processing_time_ms: processingTime,
        completed_at: new Date().toISOString()
      }).eq('id', syncJob?.id);
      return {
        mapping_id: mapping.id,
        success: false,
        messages_fetched: messagesFetched,
        messages_processed: messagesProcessed,
        upload_id: uploadId,
        job_id: jobId,
        error_message: errorMessage,
        processing_time_ms: processingTime
      };
    }
  }
  async fetchMessages(chatId, fromTime) {
    const params = new URLSearchParams();
    params.append('limit', '1000'); // Fixed limit of 1000 messages per request
    if (fromTime) {
      params.append('fromtime', fromTime.toString());
    }
    // Get access token with automatic refresh
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error('Failed to get valid Zoho access token');
    }
    let allMessages = [];
    let hasMore = true;
    let requestCount = 0;
    let previousFirstMessage = null;
    console.log(`Starting message fetch for chat ${chatId}${fromTime ? ` from ${new Date(fromTime).toISOString()}` : ' (all messages)'}`);
    while(hasMore){
      requestCount++;
      console.log(`Fetching batch ${requestCount}`);
      const response = await fetch(`https://cliq.zoho.in/api/v2/chats/${chatId}/messages?${params.toString()}`, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Zoho API error: ${response.status} - ${errorText}`);
        // If we get a 401 error, try refreshing the token once
        if (response.status === 401) {
          console.log('Got 401 error, attempting token refresh...');
          const newToken = await this.refreshZohoToken();
          if (newToken) {
            console.log('Retry with refreshed token');
            const retryResponse = await fetch(`https://cliq.zoho.in/api/v2/chats/${chatId}/messages?${params.toString()}`, {
              headers: {
                'Authorization': `Zoho-oauthtoken ${newToken}`,
                'Content-Type': 'application/json'
              }
            });
            if (!retryResponse.ok) {
              throw new Error(`Zoho API error after token refresh: ${retryResponse.status} - ${await retryResponse.text()}`);
            }
            const retryData = await retryResponse.json();
            allMessages = retryData.data || [];
            break;
          }
        }
        throw new Error(`Zoho API error: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      const batchSize = data.data?.length || 0;
      console.log(`Batch ${requestCount} response:`, {
        batch_size: batchSize,
        total_fetched_so_far: allMessages.length + batchSize,
        response_keys: Object.keys(data)
      });
      if (data.data && data.data.length > 0) {
        // Check for duplicate first message (same timestamp and content)
        const currentFirstMessage = data.data[0];
        if (previousFirstMessage && currentFirstMessage.time === previousFirstMessage.time && currentFirstMessage.content?.text === previousFirstMessage.content?.text) {
          console.log(`Duplicate first message detected, stopping pagination`);
          hasMore = false;
          break;
        }
        allMessages = allMessages.concat(data.data);
        console.log(`Added ${batchSize} messages from batch ${requestCount}`);
        // Store current first message for next comparison
        previousFirstMessage = currentFirstMessage;
      }
      // Use totime parameter for pagination to get older messages
      if (batchSize > 0 && data.data && data.data.length > 0) {
        // Get the timestamp of the FIRST message (oldest) in this batch
        const firstMessageTime = data.data[0]?.time;
        if (firstMessageTime) {
          // Set totime to the first message's timestamp to get older messages
          params.set('totime', firstMessageTime.toString());
          hasMore = true;
          console.log(`Pagination: Next batch will fetch messages until ${new Date(firstMessageTime).toISOString()} (older messages)`);
        } else {
          hasMore = false;
          console.log(`No timestamp found in first message, stopping pagination`);
        }
      } else if (batchSize === 0) {
        // API returned 0 messages, we've truly reached the end
        hasMore = false;
        console.log(`API returned 0 messages, stopping pagination - reached actual end`);
      } else {
        // Unexpected case, stop to be safe
        hasMore = false;
        console.log(`Unexpected batch size ${batchSize}, stopping pagination for safety`);
      }
      console.log(`Pagination check:`, {
        batch_size: batchSize,
        first_message_time: data.data?.[0]?.time ? new Date(data.data[0].time).toISOString() : 'N/A',
        next_totime: params.get('totime') || 'N/A',
        will_continue: hasMore,
        reason: batchSize > 0 ? 'time_based_pagination' : batchSize === 0 ? 'reached_actual_end' : 'unexpected_batch_size'
      });
      // Safety check to prevent infinite loops
      if (allMessages.length > 100000) {
        console.warn('Reached maximum message limit (100,000), stopping pagination');
        break;
      }
      // Add a small delay between requests to be respectful to the API
      if (hasMore) {
        await new Promise((resolve)=>setTimeout(resolve, 100));
      }
    }
    console.log(`Message fetch completed: ${allMessages.length} total messages in ${requestCount} batches`);
    // Sort messages by timestamp (oldest first) to ensure chronological order
    allMessages.sort((a, b)=>a.time - b.time);
    console.log(`Messages sorted chronologically: ${new Date(allMessages[0]?.time).toISOString()} (oldest) → ${new Date(allMessages[allMessages.length - 1]?.time).toISOString()} (newest)`);
    return allMessages;
  }
  formatMessagesForCloudRun(messages, mapping) {
    // Format messages similar to WhatsApp export format for consistency
    const formattedMessages = messages.map((msg)=>{
      const timestamp = new Date(msg.time).toLocaleString();
      const senderName = msg.sender.name || 'Unknown';
      let content = '';
      if (typeof msg.content === 'string') {
        content = msg.content;
      } else if (msg.content && typeof msg.content === 'object') {
        // Handle Zoho message content structure
        if (msg.content.text) {
          // Text messages: content.text contains the actual message
          content = msg.content.text;
        } else if (msg.content.file && msg.content.file.name) {
          // File messages
          content = `[File: ${msg.content.file.name}]`;
        } else if (msg.content.comment) {
          // Comment field (fallback)
          content = msg.content.comment;
        } else if (msg.type === 'info') {
          // Info messages (user added/removed, etc.)
          content = `[${msg.type} message]`;
        } else {
          // Unknown content type, show the type
          content = `[${msg.type} message]`;
        }
      }
      return `[${timestamp}] ${senderName}: ${content}`;
    });
    return formattedMessages.join('\n');
  }
  async createCloudRunJob(mapping, content, messageCount) {
    try {
      // Step 1: Calculate SHA-256 digest of the content
      const contentBuffer = new TextEncoder().encode(content);
      const digestBuffer = await crypto.subtle.digest('SHA-256', contentBuffer);
      const digestArray = Array.from(new Uint8Array(digestBuffer));
      const fileDigest = digestArray.map((b)=>b.toString(16).padStart(2, '0')).join('');
      // Step 1.5: Generate consistent file name and storage path
      const timestamp = Date.now();
      // Sanitize channel name for storage (remove/replace invalid characters)
      const sanitizedChannelName = mapping.zoho_channel_name.replace(/[#@$%^&*()+=\[\]{};':"\\|,.<>?]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .toLowerCase(); // Make lowercase for consistency
      const consistentFileName = `${sanitizedChannelName}_${timestamp}.txt`;
      const consistentStoragePath = `zoho-sync/${mapping.client_id}/${mapping.room_id}/${consistentFileName}`;
      // Step 2: Create upload record
      const { data: upload, error: uploadError } = await this.supabase.from('uploads').insert({
        client_id: mapping.client_id,
        room_id: mapping.room_id,
        filename: consistentFileName,
        original_filename: `${sanitizedChannelName}_sync.txt`,
        file_size: content.length,
        file_type: 'text/plain',
        storage_path: consistentStoragePath,
        status: 'processed',
        uploaded_by: mapping.created_by || 'bcddd0fc-7ab7-4550-887e-29e007237d8d',
        metadata: {
          zoho_mapping_id: mapping.id,
          zoho_channel_id: mapping.zoho_channel_id,
          zoho_channel_name: mapping.zoho_channel_name,
          message_count: messageCount,
          sync_type: 'incremental',
          sync_timestamp: new Date().toISOString(),
          file_digest: fileDigest,
          source: 'zoho_cliq_sync'
        }
      }).select('id').single();
      if (uploadError) {
        throw new Error(`Failed to create upload record: ${uploadError.message}`);
      }
      // Step 3: Create job record for CloudRun processing
      const { data: job, error: jobError } = await this.supabase.from('jobs').insert({
        upload_id: upload.id,
        client_id: mapping.client_id,
        room_id: mapping.room_id,
        status: 'queued',
        job_type: 'chat_processing',
        progress: 0,
        total_items: messageCount,
        processed_items: 0
      }).select('id').single();
      if (jobError) {
        throw new Error(`Failed to create job record: ${jobError.message}`);
      }
      // Step 4: Store the formatted content in Supabase Storage using the same consistent path
      console.log(`Attempting to upload file to storage path: ${consistentStoragePath}`);
      const { error: storageError } = await this.supabase.storage.from('chats-raw').upload(consistentStoragePath, content, {
        contentType: 'text/plain',
        upsert: false,
        metadata: {
          upload_id: upload.id.toString(),
          job_id: job.id.toString(),
          zoho_mapping_id: mapping.id.toString(),
          client_id: mapping.client_id.toString(),
          room_id: mapping.room_id.toString(),
          message_count: messageCount.toString(),
          sync_timestamp: new Date().toISOString()
        }
      });
      if (storageError) {
        console.error(`Failed to store content in Supabase Storage: ${storageError.message}`, storageError);
      // Continue without storage - CloudRun can access content via database if needed
      } else {
        console.log(`Content successfully stored in Supabase Storage: ${consistentStoragePath}`);
      }
      return {
        upload_id: upload.id,
        job_id: job.id
      };
    } catch (error) {
      console.error('Error creating CloudRun job:', error);
      throw error;
    }
  }
}
serve(async (req)=>{
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  const correlationId = generateCorrelationId();
  try {
    // Only allow POST method
    if (req.method !== 'POST') {
      return createErrorResponse('E_METHOD_NOT_ALLOWED', 'Method not allowed', 405, undefined, correlationId);
    }
    // Authenticate user and check permissions
    const { user, supabase } = await assertAuth(req);
    // Only platform admins, super admins, and backend users can trigger Zoho sync
    await assertRoleIn(supabase, user.id, [
      'admin',
      'super_admin',
      'backend'
    ]);
    // Get request body for manual sync or use defaults for scheduled sync
    const body = await req.json().catch(()=>({}));
    const isManualSync = body.manual === true;
    const targetMappingId = body.mapping_id;
    const isFullSync = body.full_sync === true;
    console.log(`Starting Zoho sync job - Manual: ${isManualSync}, Full: ${isFullSync}, User: ${user.email}`);
    // Get Zoho auth
    const { data: authRecord, error: authError } = await supabase.from('zoho_auth').select('*').single();
    if (authError || !authRecord) {
      return createErrorResponse('E_ZOHO_AUTH_NOT_CONFIGURED', 'Zoho authentication not configured', 500, undefined, correlationId);
    }
    // Check for too many refresh errors
    if ((authRecord.refresh_error_count || 0) >= 5) {
      return createErrorResponse('E_ZOHO_AUTH_ERROR', 'Too many token refresh failures. Please re-authenticate in Settings > Integrations > Zoho Cliq.', 500, undefined, correlationId);
    }
    // Get active channel mappings
    let query = supabase.from('zoho_channel_mappings').select('*').eq('sync_status', 'active');
    if (targetMappingId) {
      query = query.eq('id', targetMappingId);
    }
    const { data: mappings, error: mappingsError } = await query;
    if (mappingsError) {
      return createErrorResponse('E_DATABASE_ERROR', 'Failed to fetch channel mappings', 500, mappingsError.message, correlationId);
    }
    if (!mappings || mappings.length === 0) {
      return createSuccessResponse({
        message: 'No active channel mappings found',
        results: []
      }, correlationId);
    }
    console.log(`Found ${mappings.length} active channel mappings to sync`);
    // Sync each channel
    const syncer = new ZohoMessageSyncer(supabase, authRecord);
    const results = [];
    for (const mapping of mappings){
      const result = await syncer.syncChannel(mapping, isFullSync);
      results.push(result);
    }
    // Summary
    const successful = results.filter((r)=>r.success).length;
    const failed = results.filter((r)=>!r.success).length;
    const totalMessages = results.reduce((sum, r)=>sum + r.messages_processed, 0);
    const totalJobsCreated = results.filter((r)=>r.job_id).length;
    console.log(`Sync completed - Successful: ${successful}, Failed: ${failed}, Total Messages: ${totalMessages}, Jobs Created: ${totalJobsCreated}`);
    return createSuccessResponse({
      success: true,
      summary: {
        total_mappings: mappings.length,
        successful_syncs: successful,
        failed_syncs: failed,
        total_messages_processed: totalMessages,
        total_jobs_created: totalJobsCreated
      },
      results
    }, correlationId);
  } catch (error) {
    console.error('Error in zoho-sync:', error);
    if (error instanceof Response) {
      return error; // Already a proper response with CORS
    }
    return createErrorResponse('E_INTERNAL_ERROR', 'Internal server error', 500, error.message, correlationId);
  }
});
