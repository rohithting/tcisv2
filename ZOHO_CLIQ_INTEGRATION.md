# Zoho Cliq Integration Documentation

## Overview

This integration enables TCIS to automatically sync messages from Zoho Cliq channels and process them through the existing chat analysis pipeline. The system provides real-time channel mapping, automated message fetching, and seamless integration with CloudRun processing.

## Features

### 🔐 **Authentication & Authorization**
- **OAuth 2.0 Integration**: Secure authentication with Zoho Cliq using standard OAuth flow
- **System-wide Authentication**: One super admin authentication serves the entire organization
- **Auto-renewal**: Automatic token refresh prevents authentication expiration
- **Role-based Access**: Super admins and backend users can manage integrations

### 📡 **Channel Management**
- **Real-time Channel Listing**: Fetch and display organization channels from Zoho Cliq
- **Selective Mapping**: Map specific channels to TCIS client rooms
- **Conflict Prevention**: Ensure channels aren't mapped to multiple clients
- **Status Monitoring**: Real-time sync status and error reporting

### ⚡ **Automated Synchronization**
- **24-Hour Cron Jobs**: Automated message fetching every 24 hours
- **Incremental Sync**: Only fetch new messages since last sync for efficiency
- **Manual Sync**: On-demand sync triggers with retry functionality
- **CloudRun Integration**: Seamless processing through existing infrastructure

### 🎛️ **Error Handling & Monitoring**
- **Graceful Error Handling**: Comprehensive error logging and user feedback
- **Retry Functionality**: Manual retry for failed sync operations
- **Status Indicators**: Visual sync status in rooms interface
- **Job Tracking**: Detailed sync job history and metrics

## Architecture

### Database Schema

```sql
-- Zoho authentication (system-wide)
zoho_auth
├── access_token (encrypted)
├── refresh_token (encrypted)
├── expires_at
├── authenticated_by (user_id)
└── organization_id

-- Channel mappings
zoho_channel_mappings
├── client_id → clients(id)
├── room_id → rooms(id)
├── zoho_channel_id (unique)
├── zoho_chat_id
├── zoho_channel_name
├── sync_status (active|paused|error)
├── last_sync_at
└── last_message_time

-- Sync job tracking
zoho_sync_jobs
├── mapping_id → zoho_channel_mappings(id)
├── job_type (manual|scheduled|retry)
├── status (pending|running|completed|failed)
├── messages_fetched
├── messages_processed
└── processing_time_ms
```

### API Endpoints

#### Edge Functions
- `zoho-test-connection` - Test Zoho API connectivity
- `zoho-refresh-tokens` - Refresh OAuth tokens
- `zoho-channels` - List channels and create mappings
- `zoho-sync` - Main sync function (cron scheduled)
- `zoho-sync-trigger` - Manual sync trigger

#### Frontend Routes
- `/settings/integrations/zoho-cliq` - Admin configuration
- `/clients/{id}/rooms` - Channel mapping interface

## Setup Instructions

### 1. Zoho OAuth Application Setup

1. **Create Zoho OAuth App**:
   - Go to [Zoho Developer Console](https://api-console.zoho.com/)
   - Create a new "Server-based Application"
   - Note down Client ID and Client Secret

2. **Configure Scopes**:
   - `ZohoCliq.Channels.READ` - Read channel information
   - `ZohoCliq.Messages.READ` - Read channel messages

3. **Set Redirect URI**:
   - `https://yourdomain.com/auth/zoho/callback`

### 2. Environment Configuration

Add to your `.env` file:
```bash
ZOHO_CLIENT_ID=your_zoho_oauth_client_id
ZOHO_CLIENT_SECRET=your_zoho_oauth_client_secret
```

### 3. Database Migration

Run the migration to create required tables:
```sql
-- Execute: supabase/migrations/008_zoho_cliq_integration.sql
```

### 4. Cron Job Setup

Configure a cron job to run the sync function every 24 hours:
```bash
# Example: Daily at 2 AM
0 2 * * * curl -X POST https://your-project.functions.supabase.co/zoho-sync \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

## Usage Workflow

### Initial Setup (Super Admin)

1. **Navigate to Integrations**:
   - Go to `Settings > Integrations > Zoho Cliq`

2. **Configure OAuth**:
   - Enter Client ID, Client Secret, and Redirect URI
   - Click "Authorize with Zoho Cliq"
   - Complete OAuth flow and paste authorization code

3. **Test Connection**:
   - Use "Test Connection" to verify setup

### Channel Mapping (Backend/Super Admin)

1. **Access Client Rooms**:
   - Navigate to `Clients > [Client Name] > Rooms`

2. **Map Internal Rooms**:
   - For internal rooms, click "Map to Zoho"
   - Select desired Zoho Cliq channel from organization list
   - Confirm mapping

3. **Monitor Sync Status**:
   - View real-time sync status in rooms interface
   - Use retry functionality for failed syncs

### Automated Operations

- **Daily Sync**: Automatically runs every 24 hours
- **Incremental Updates**: Only fetches new messages
- **Error Recovery**: Failed syncs can be manually retried
- **CloudRun Processing**: Messages automatically processed for insights

## API Integration Details

### Message Format Conversion

Zoho Cliq messages are converted to WhatsApp-like format for consistency:
```
[timestamp] Sender Name: Message content
[2024-01-15 14:30:25] John Doe: Hello team, here's the update...
```

### CloudRun Integration

The sync function integrates with existing CloudRun infrastructure:
- Uses existing `/ingest` endpoint
- Maintains consistent data format
- Preserves existing processing pipeline
- Supports existing query and analysis features

### Rate Limiting & Performance

- **Zoho API Limits**: Respects Zoho's rate limits (15 req/min for messages)
- **Batch Processing**: Processes up to 100 messages per sync
- **Incremental Sync**: Only fetches new messages for efficiency
- **Error Resilience**: Graceful handling of API timeouts and errors

## Monitoring & Troubleshooting

### Sync Status Indicators

- 🟢 **Active**: Channel syncing successfully
- 🟡 **Paused**: Sync temporarily disabled
- 🔴 **Error**: Sync failed, retry available
- 🔵 **Syncing**: Manual sync in progress

### Common Issues

1. **Authentication Expired**:
   - Solution: Use "Refresh Tokens" in admin settings

2. **Channel Access Denied**:
   - Solution: Ensure authenticated user has channel access

3. **Rate Limit Exceeded**:
   - Solution: Sync automatically retries with backoff

4. **Mapping Conflicts**:
   - Solution: System prevents duplicate mappings

### Logs & Debugging

- Edge function logs available in Supabase dashboard
- Sync job history stored in `zoho_sync_jobs` table
- Error messages displayed in UI with retry options

## Security Considerations

- **Token Encryption**: OAuth tokens stored securely in database
- **RLS Policies**: Row-level security prevents unauthorized access
- **Role-based Access**: Only authorized users can manage integrations
- **Audit Trail**: All sync operations logged with timestamps

## Future Enhancements

- **Webhook Support**: Real-time message notifications
- **Advanced Filtering**: Channel message filtering options
- **Bulk Operations**: Multi-channel sync management
- **Analytics Dashboard**: Sync performance metrics
- **Custom Schedules**: Configurable sync frequencies

## Support

For technical support or questions about the Zoho Cliq integration:
1. Check the sync job logs in the database
2. Verify Zoho OAuth application configuration
3. Test API connectivity using the built-in test function
4. Review error messages in the UI for specific guidance

---

*This integration was designed to seamlessly extend TCIS's chat analysis capabilities to include Zoho Cliq channels while maintaining the existing user experience and data processing pipeline.*
