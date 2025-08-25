# TCIS Supabase Edge Functions

This directory contains all Supabase Edge Functions for the Ting Chat Insight System (TCIS).

## 🚀 Quick Start

### 1. Prerequisites
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login
```

### 2. Deploy All Functions
```bash
# Make deployment script executable
chmod +x deploy-functions.sh

# Deploy interactively
./deploy-functions.sh

# Or deploy with project ID
./deploy-functions.sh --project-id your-project-id
```

### 3. Test Deployment
```bash
# Make test script executable
chmod +x test-functions.sh

# Run tests
./test-functions.sh --project-id your-project-id --token your-jwt-token
```

## 📁 Function Structure

```
supabase/functions/
├── _shared/                 # Shared utilities
│   ├── auth.ts             # Authentication helpers
│   ├── validate.ts         # Zod validation schemas
│   ├── sse.ts              # Server-Sent Events utilities
│   └── retrieval.ts        # RAG retrieval helpers
├── clients-create/         # Create clients
├── rooms-create/           # Create chat rooms
├── upload-url/             # Generate signed upload URLs
├── ingest/                 # Confirm file ingestion
├── jobs/                   # List processing jobs
├── conversations-create/   # Create conversations
├── query/                  # Streaming AI analysis (SSE)
├── feedback/              # Submit user feedback
├── job-retry/             # Retry failed jobs
└── reindex/               # Reindex client data
```

## 🔧 Available Functions

### Client Management
- **`clients-create`** - Create new clients (Platform Admin/Senior Manager)
- **`rooms-create`** - Create chat rooms (Senior Manager/Admin/Backend)

### Upload Pipeline
- **`upload-url`** - Generate signed URLs for file uploads
- **`ingest`** - Confirm upload and queue processing

### Data Processing
- **`jobs`** - List and monitor processing jobs
- **`job-retry`** - Retry failed jobs (Admin only)
- **`reindex`** - Reindex client data (Admin only)

### AI Analysis
- **`conversations-create`** - Create conversation shells
- **`query`** - Stream AI analysis with RAG (Server-Sent Events)
- **`feedback`** - Collect user feedback on results

## 🔐 Authentication & Authorization

All functions require:
- Valid Supabase JWT token in `Authorization: Bearer <token>` header
- Appropriate role-based permissions
- Client-level access control where applicable

### Role Matrix
| Function | Super Admin | Backend | Admin | Manager | User |
|----------|-------------|---------|-------|---------|------|
| clients-create | ✅ | ✅ | ❌ | ✅* | ❌ |
| rooms-create | ✅ | ✅ | ✅ | ✅ | ❌ |
| upload-url | ✅ | ✅ | ✅ | ❌ | ❌ |
| ingest | ✅ | ✅ | ✅ | ❌ | ❌ |
| jobs | ✅ | ✅ | ✅ | ✅ | ❌ |
| conversations-create | ✅ | ❌ | ✅ | ✅ | ❌ |
| query | ✅ | ❌ | ✅ | ✅ | ❌ |
| feedback | ✅ | ❌ | ✅ | ✅ | ❌ |
| job-retry | ✅ | ❌ | ✅ | ❌ | ❌ |
| reindex | ✅ | ❌ | ✅ | ❌ | ❌ |

*_Requires senior_manager role_

## 🌐 API Endpoints

Base URL: `https://your-project-id.supabase.co/functions/v1`

### Standard HTTP Endpoints
```
POST /clients-create          - Create client
POST /rooms-create           - Create room
POST /upload-url             - Request upload URL
POST /ingest                 - Confirm ingestion
GET  /jobs                   - List jobs
POST /conversations-create   - Create conversation
POST /feedback              - Submit feedback
POST /job-retry             - Retry job
POST /reindex               - Reindex data
```

### Streaming Endpoint
```
POST /query                 - Stream AI analysis (Server-Sent Events)
```

## 📖 Documentation

- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** - Complete API reference with curl examples
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Detailed deployment guide
- **Function-specific docs** - See individual function directories

## 🧪 Testing

### Automated Testing
```bash
# Run all tests
./test-functions.sh

# Test with streaming
./test-functions.sh --streaming

# Load testing
./test-functions.sh --load-test
```

### Manual Testing
```bash
# Test client creation
curl -X POST "https://your-project-id.supabase.co/functions/v1/clients-create" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Client"}'
```

## 🚨 Error Handling

All functions return standardized error responses:
```json
{
  "error_code": "E_ERROR_TYPE",
  "message": "Human readable message",
  "details": "Additional context (optional)"
}
```

Common error codes:
- `E_UNAUTHORIZED` (401) - Invalid/missing JWT
- `E_FORBIDDEN_CLIENT` (403) - No client access
- `E_FORBIDDEN_ROLE` (403) - Insufficient role
- `E_BAD_INPUT` (400) - Validation failed
- `E_DATABASE_ERROR` (500) - Database operation failed

## 🔍 Monitoring

### Function Logs
```bash
# View all function logs
supabase functions logs --project-ref your-project-id

# View specific function logs
supabase functions logs query --project-ref your-project-id
```

### Health Checks
Each response includes:
- `x-corr-id` header for request tracking
- Proper HTTP status codes
- Detailed error messages

## 🎯 Key Features

### Advanced RAG System
- **Hybrid Search**: Vector + text search with MMR reranking
- **Smart Filtering**: Date, room, participant-based filters
- **Citation Tracking**: Full source attribution

### Server-Sent Events (SSE)
- **Real-time Streaming**: Progressive AI response delivery
- **Event Types**: meta, citations, tokens, evaluation_payload, done
- **Connection Management**: Timeout handling, graceful disconnection

### Evaluation Mode
- **Driver-based Assessment**: Configurable evaluation criteria
- **Evidence Validation**: Minimum evidence requirements
- **Audit Trail**: Complete evaluation history

### Enterprise Security
- **JWT Authentication**: Supabase auth integration
- **Row-Level Security**: Database-level access control
- **Rate Limiting**: API protection
- **Correlation IDs**: Request tracking

## 🛠 Development

### Local Development
```bash
# Start local Supabase
supabase start

# Serve functions locally
supabase functions serve

# Test locally
curl -X POST "http://localhost:54321/functions/v1/clients.create" \
  -H "Authorization: Bearer your-local-token" \
  -H "Content-Type: application/json" \
  -d '{"name": "Local Test"}'
```

### Adding New Functions
```bash
# Create new function
supabase functions new function-name

# Add to deployment script
# Edit deploy-functions.sh and add to FUNCTIONS array
```

## 📦 Dependencies

Functions use the following key dependencies:
- **Deno Runtime**: JavaScript/TypeScript runtime
- **Zod**: Runtime type validation
- **Supabase JS**: Database and auth client
- **Custom Utilities**: Shared authentication, validation, SSE helpers

## 🔧 Configuration

### Environment Variables
Set in Supabase Dashboard or via CLI:
```bash
supabase secrets set SUPABASE_URL=your-url --project-ref your-project-id
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key --project-ref your-project-id
```

### Function Configuration
Each function can be configured in `supabase/config.toml`:
```toml
[functions.function-name]
verify_jwt = true
```

## 🚀 Production Checklist

Before deploying to production:
- [ ] All functions deployed successfully
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] RLS policies active
- [ ] Storage buckets created
- [ ] Rate limiting configured
- [ ] Monitoring set up
- [ ] Error handling tested
- [ ] Authentication flows verified
- [ ] Role-based access tested

## 📞 Support

For issues with Edge Functions:
1. Check function logs: `supabase functions logs`
2. Review API documentation
3. Test with curl examples
4. Check Supabase Dashboard for metrics
5. Verify database permissions and RLS policies

---

**🎉 Ready to deploy your TCIS Edge Functions!**

Use the deployment script for a smooth, automated deployment experience.
