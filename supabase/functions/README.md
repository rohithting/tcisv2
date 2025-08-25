# TCIS Edge Functions

This directory contains the Supabase Edge Functions for the TCIS (Ting Chat Insight System) platform.

## Overview

The Edge Functions provide the API layer for:
- **Conversation Management**: Creating and managing chat conversations
- **Query Processing**: AI-powered Q&A using Gemini and RAG
- **Evaluation System**: Drivers & Values assessment framework
- **File Management**: Upload URLs and ingestion workflows
- **Job Management**: Processing queue management

## Architecture

### Core Components

1. **API Router** (`api/index.ts`)
   - Main entry point for all API requests
   - Routes requests to appropriate handlers
   - Handles CORS and basic error handling

2. **Query Engine** (`api/routes/query.ts`)
   - SSE streaming for real-time responses
   - Hybrid search (vector + text)
   - MMR reranking for diversity
   - Gemini integration for Q&A and evaluation

3. **Drivers & Values System**
   - `drivers-create/`: Manage evaluation rubrics
   - `drivers-vectorize/`: Embed drivers for semantic search
   - `evaluation-run/`: Run evaluations with Gemini

4. **Utility Modules** (`_shared/`)
   - `gemini.ts`: Vertex AI integration
   - `drivers.ts`: Rubric management
   - `mmr.ts`: Maximal Marginal Relevance
   - `db.ts`: Database operations
   - `sse.ts`: Server-Sent Events
   - `auth.ts`: Authentication & authorization

## Setup

### 1. Environment Variables

Create a `.env` file in the `supabase/functions/` directory:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Cloud Configuration (for Vertex AI)
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1

# Gemini Model Configuration
GEMINI_MODEL_FLASH=gemini-1.5-flash
GEMINI_MODEL_PRO=gemini-1.5-pro

# Embedding Model Configuration
EMBEDDING_MODEL=text-embedding-ada-002
EMBEDDING_DIMENSIONS=1536
```

### 2. Google Cloud Setup

1. **Create Service Account**:
   ```bash
   gcloud iam service-accounts create tcis-edge-function \
     --display-name="TCIS Edge Function Service Account"
   ```

2. **Grant Permissions**:
   ```bash
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="serviceAccount:tcis-edge-function@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/aiplatform.user"
   ```

3. **Generate Service Account Key**:
   ```bash
   gcloud iam service-accounts keys create service-account.json \
     --iam-account=tcis-edge-function@YOUR_PROJECT_ID.iam.gserviceaccount.com
   ```

4. **Store in Supabase Secrets**:
   ```sql
   INSERT INTO secrets (key, value) 
   VALUES ('GOOGLE_SERVICE_ACCOUNT_JSON', '{"type": "service_account", ...}');
   ```

### 3. Database Setup

Run the migration files in order:
1. `002_complete_schema.sql` - Base schema
2. `005_complete_drivers_schema.sql` - Drivers & Values tables

### 4. Deploy Functions

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy api
supabase functions deploy drivers-create
supabase functions deploy drivers-vectorize
supabase functions deploy evaluation-run
```

## API Endpoints

### Main API Router
- **Base URL**: `https://your-project.supabase.co/functions/v1/api`

### Available Routes

#### Query Engine
- `POST /query` - Process conversation queries
- **Request Body**:
  ```json
  {
    "client_id": 1,
    "conversation_id": 1,
    "question": "What are the main escalation themes?",
    "filters": {
      "types": ["internal", "external"],
      "date_from": "2024-01-01T00:00:00Z",
      "date_to": "2024-12-31T23:59:59Z"
    },
    "evaluation_mode": false,
    "subject_user": null
  }
  ```

#### Conversations
- `POST /conversations` - Create new conversation
- **Request Body**:
  ```json
  {
    "client_id": 1,
    "title": "Weekly Review",
    "description": "Weekly team performance review"
  }
  ```

#### Rooms
- `POST /rooms` - Create new chat room
- **Request Body**:
  ```json
  {
    "client_id": 1,
    "name": "Escalations",
    "description": "Customer escalation channel",
    "room_type": "external"
  }
  ```

#### File Management
- `POST /upload-url` - Generate upload URL
- `POST /ingest` - Start file processing

#### Jobs
- `GET /jobs` - List jobs
- `POST /jobs` - Job operations (retry, cancel)

#### Feedback
- `POST /feedback` - Submit query feedback

## Drivers & Values System

### Creating Drivers

```bash
curl -X POST https://your-project.supabase.co/functions/v1/drivers-create \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create_driver",
    "driver": {
      "name": "Empathy",
      "description": "Understanding and sharing feelings of others",
      "key": "empathy",
      "weight": 1.2,
      "negative_indicators": ["dismissive", "unsympathetic"]
    }
  }'
```

### Creating Behaviors

```bash
curl -X POST https://your-project.supabase.co/functions/v1/drivers-create \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create_behaviors",
    "behaviors": {
      "driver_id": 1,
      "positive_examples": ["listened actively", "showed concern"],
      "negative_examples": ["interrupted", "minimized feelings"]
    }
  }'
```

### Creating Instances

```bash
curl -X POST https://your-project.supabase.co/functions/v1/drivers-create \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create_instance",
    "instances": {
      "driver_id": 1,
      "title": "Respecting Grief Over Celebration",
      "narrative": "Team chose to cancel party after colleague passed away",
      "takeaway": "Empathy means people > events",
      "tags": ["culture", "decision"]
    }
  }'
```

## Evaluation Mode

### Running Evaluations

```bash
curl -X POST https://your-project.supabase.co/functions/v1/evaluation-run \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": 1,
    "conversation_id": 1,
    "subject_user": "Alice Johnson",
    "question": "How did Alice demonstrate empathy this week?",
    "filters": {
      "date_from": "2024-01-01T00:00:00Z",
      "date_to": "2024-01-07T23:59:59Z"
    }
  }'
```

## Performance & Monitoring

### Latency Targets
- **TTFB**: < 700ms
- **Q&A Mode**: 1.0-1.8s (flash model)
- **Evaluation Mode**: 1.8-3.0s (pro model)

### Monitoring
- Query latency tracking
- Evidence retrieval counts
- Model usage statistics
- Error rate monitoring

## Security

### Authentication
- JWT-based authentication
- Client access control
- Role-based permissions

### Data Protection
- No raw chat content logging
- PII redaction in previews
- Secure credential storage

## Troubleshooting

### Common Issues

1. **Gemini API Errors**
   - Check service account permissions
   - Verify project ID and location
   - Check quota limits

2. **Database Connection Issues**
   - Verify Supabase credentials
   - Check RLS policies
   - Verify table schemas

3. **Performance Issues**
   - Check embedding generation
   - Monitor chunk sizes
   - Review MMR configuration

### Debug Mode

Enable debug logging by setting:
```bash
SUPABASE_FUNCTIONS_DEBUG=true
```

## Development

### Local Testing

```bash
# Start Supabase locally
supabase start

# Test functions locally
supabase functions serve

# Test specific function
curl -X POST http://localhost:54321/functions/v1/api/query \
  -H "Content-Type: application/json" \
  -d '{"client_id": 1, "conversation_id": 1, "question": "Hello"}'
```

### Code Structure

```
supabase/functions/
├── api/                    # Main API router
│   ├── index.ts           # Router entry point
│   └── routes/            # Route handlers
│       ├── query.ts       # Query processing
│       ├── conversations.ts
│       ├── rooms.ts
│       ├── upload-url.ts
│       ├── ingest.ts
│       ├── jobs.ts
│       └── feedback.ts
├── _shared/               # Shared utilities
│   ├── auth.ts           # Authentication
│   ├── gemini.ts         # Vertex AI integration
│   ├── drivers.ts        # Drivers management
│   ├── mmr.ts            # MMR algorithm
│   ├── db.ts             # Database operations
│   ├── sse.ts            # Server-Sent Events
│   └── cors.ts           # CORS handling
├── drivers-create/        # Drivers management
├── drivers-vectorize/     # Driver embeddings
├── evaluation-run/        # Evaluation processing
└── README.md             # This file
```

## Contributing

1. Follow the existing code structure
2. Add proper error handling
3. Include type definitions
4. Update documentation
5. Test thoroughly before deployment

## License

This project is proprietary to Ting TCIS.
