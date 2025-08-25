# TCIS Deployment Guide

This guide covers deploying the Ting Chat Insight System (TCIS) Edge Functions to Supabase.

## Prerequisites

### 1. Install Supabase CLI
```bash
# Using npm
npm install -g supabase

# Using Homebrew (macOS)
brew install supabase/tap/supabase

# Using Scoop (Windows)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### 2. Login to Supabase
```bash
supabase login
```

### 3. Project Setup
Ensure you have:
- A Supabase project created
- Database migrations applied (`002_complete_schema.sql`)
- Required environment variables set

## Quick Deployment

### Option 1: Using the Deployment Script (Recommended)
```bash
# Make script executable (first time only)
chmod +x deploy-functions.sh

# Deploy all functions interactively
./deploy-functions.sh

# Deploy with specific project ID
./deploy-functions.sh --project-id your-project-id

# Deploy with tests
./deploy-functions.sh --project-id your-project-id --test
```

### Option 2: Using npm Scripts
```bash
# Deploy all functions
npm run deploy:functions

# Deploy with tests
npm run deploy:functions:test
```

### Option 3: Manual Deployment
```bash
# Link your project
supabase link --project-ref your-project-id

# Deploy individual functions
supabase functions deploy clients.create --project-ref your-project-id
supabase functions deploy rooms.create --project-ref your-project-id
supabase functions deploy upload-url --project-ref your-project-id
supabase functions deploy ingest --project-ref your-project-id
supabase functions deploy jobs --project-ref your-project-id
supabase functions deploy conversations.create --project-ref your-project-id
supabase functions deploy query --project-ref your-project-id
supabase functions deploy feedback --project-ref your-project-id
supabase functions deploy job-retry --project-ref your-project-id
supabase functions deploy reindex --project-ref your-project-id
```

## Environment Variables

Set the following environment variables in your Supabase project:

```bash
# Required for all functions
supabase secrets set SUPABASE_URL=https://your-project-id.supabase.co --project-ref your-project-id
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key --project-ref your-project-id

# Optional: Custom configuration
supabase secrets set PLATFORM_NAME="Ting Chat Insight System" --project-ref your-project-id
supabase secrets set PLATFORM_LOGO_URL=https://your-domain.com/logo.png --project-ref your-project-id
```

## Function Endpoints

Once deployed, your functions will be available at:
```
https://your-project-id.supabase.co/functions/v1/
```

### Available Endpoints:
- `POST /clients.create` - Create new clients
- `POST /rooms.create` - Create chat rooms
- `POST /upload-url` - Request upload URLs
- `POST /ingest` - Confirm file ingestion
- `GET /jobs` - List processing jobs
- `POST /conversations.create` - Create conversations
- `POST /query` - Stream AI analysis (SSE)
- `POST /feedback` - Submit feedback
- `POST /job-retry` - Retry failed jobs
- `POST /reindex` - Reindex client data

## Testing Deployment

### 1. Health Check
```bash
# Test a simple endpoint
curl -X POST "https://your-project-id.supabase.co/functions/v1/clients.create" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Client"}'
```

### 2. Function Logs
```bash
# View function logs
supabase functions logs --project-ref your-project-id

# View logs for specific function
supabase functions logs clients.create --project-ref your-project-id
```

### 3. List Deployed Functions
```bash
supabase functions list --project-ref your-project-id
```

## Troubleshooting

### Common Issues

#### 1. Authentication Errors
```
Error: Invalid JWT token
```
**Solution:** Ensure you're using a valid JWT token from your Supabase auth.

#### 2. Permission Errors
```
Error: Insufficient permissions
```
**Solution:** Check your RLS policies and user roles in the database.

#### 3. Function Not Found
```
Error: Function not found
```
**Solution:** Verify the function was deployed successfully:
```bash
supabase functions list --project-ref your-project-id
```

#### 4. Environment Variables Missing
```
Error: SUPABASE_URL is not defined
```
**Solution:** Set required environment variables:
```bash
supabase secrets set SUPABASE_URL=your-url --project-ref your-project-id
```

### Debug Mode
Enable debug logging for detailed error information:
```bash
export SUPABASE_DEBUG=true
supabase functions deploy function-name --project-ref your-project-id
```

### Function Development
For local development:
```bash
# Start local Supabase
supabase start

# Serve functions locally
supabase functions serve

# Test locally
curl -X POST "http://localhost:54321/functions/v1/clients.create" \
  -H "Authorization: Bearer your-local-token" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Client"}'
```

## Production Checklist

Before deploying to production:

- [ ] Database migrations applied
- [ ] All environment variables set
- [ ] RLS policies configured
- [ ] Storage buckets created (`chats-raw`)
- [ ] Function permissions verified
- [ ] Rate limiting configured
- [ ] Monitoring/logging set up
- [ ] Error handling tested
- [ ] Authentication flows tested
- [ ] Role-based access tested

## Monitoring

### Function Metrics
Monitor your functions in the Supabase Dashboard:
1. Go to Edge Functions section
2. Select individual functions to view metrics
3. Monitor invocation count, errors, and latency

### Database Monitoring
Keep an eye on:
- Connection pool usage
- Query performance
- Storage usage
- RLS policy performance

## Rollback Strategy

If you need to rollback a deployment:

### 1. Redeploy Previous Version
```bash
# Checkout previous version
git checkout previous-tag

# Redeploy
./deploy-functions.sh --project-id your-project-id
```

### 2. Disable Problematic Function
```bash
# This will require manual intervention in Supabase Dashboard
# or contact Supabase support
```

## Support

For deployment issues:
1. Check the [Supabase Documentation](https://supabase.com/docs/guides/functions)
2. Review function logs for error details
3. Consult the API documentation in `API_DOCUMENTATION.md`
4. Check the project's issue tracker

## Security Notes

- Never commit secrets to version control
- Use environment variables for all sensitive data
- Regularly rotate service role keys
- Monitor function logs for security issues
- Implement proper rate limiting
- Use HTTPS only for all endpoints

## Performance Optimization

- Monitor function cold starts
- Optimize bundle sizes
- Use connection pooling for database
- Implement proper caching strategies
- Monitor memory usage
- Set appropriate timeouts

---

**Note:** This deployment guide assumes you have the necessary permissions and your Supabase project is properly configured with the required database schema and storage buckets.
