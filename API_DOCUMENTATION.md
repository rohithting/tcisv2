# TCIS API Documentation

This document provides comprehensive documentation for all Supabase Edge Functions APIs in the Ting Chat Insight System (TCIS).

## Base URL
```
https://<project-ref>.supabase.co/functions/v1
```

## Authentication
All endpoints require a valid Supabase JWT token in the Authorization header:
```
Authorization: Bearer <jwt-token>
```

## Common Headers
- `Content-Type: application/json` (for POST requests)
- `Authorization: Bearer <token>` (required for all endpoints)
- `x-corr-id: <uuid>` (returned in responses for request tracking)

## Error Response Format
All endpoints return errors in this standardized format:
```json
{
  "error_code": "E_ERROR_TYPE",
  "message": "Human readable error message",
  "details": "Additional error details (optional)"
}
```

## Common Error Codes
- `E_UNAUTHORIZED` (401) - Missing or invalid JWT token
- `E_FORBIDDEN_CLIENT` (403) - No access to specified client
- `E_FORBIDDEN_ROLE` (403) - Insufficient role for operation
- `E_BAD_INPUT` (400) - Invalid request parameters
- `E_DATABASE_ERROR` (500) - Database operation failed
- `E_INTERNAL_ERROR` (500) - Unexpected server error

---

## Client Management

### Create Client
Creates a new client in the system.

**Endpoint:** `POST /clients-create`

**Required Role:** Platform admin OR senior_manager

**Request Body:**
```json
{
  "name": "Acme Corporation",
  "description": "Leading provider of innovative solutions" // optional
}
```

**Response (201):**
```json
{
  "client_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Curl Example:**
```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/clients-create" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "description": "Leading provider of innovative solutions"
  }'
```

**Possible Errors:**
- `E_DUPLICATE_NAME` (409) - Client name already exists
- `E_FORBIDDEN_ROLE` (403) - User cannot create clients

---

### Create Room
Creates a new chat room within a client.

**Endpoint:** `POST /rooms-create`

**Required Role:** senior_manager, admin, OR backend (for the client)

**Request Body:**
```json
{
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "internal", // "internal" or "external"
  "name": "Customer Support Team",
  "description": "Main customer support communication channel" // optional
}
```

**Response (201):**
```json
{
  "room_id": "660f9500-f39c-52e5-b827-557766551111"
}
```

**Curl Example:**
```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/rooms-create" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "internal",
    "name": "Customer Support Team",
    "description": "Main customer support communication channel"
  }'
```

**Possible Errors:**
- `E_CLIENT_NOT_FOUND` (404) - Client does not exist
- `E_DUPLICATE_NAME` (409) - Room name already exists in client
- `E_FORBIDDEN_CLIENT` (403) - No access to client

---

## Upload & Ingestion

### Request Upload URL
Generates a signed URL for file upload and creates associated job record.

**Endpoint:** `POST /upload-url`

**Required Role:** backend, senior_manager, OR admin (for the client)

**Request Body:**
```json
{
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "room_id": "660f9500-f39c-52e5-b827-557766551111",
  "file_name": "whatsapp_export_2024.txt",
  "file_digest": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"
}
```

**Response (200):**
```json
{
  "signed_url": "https://storage.supabase.co/...",
  "upload_id": "770fa600-049d-63f6-c938-668877662222",
  "job_id": "880fb700-159e-74g7-d049-779988773333",
  "storage_path": "client/550e8400-e29b-41d4-a716-446655440000/room/660f9500-f39c-52e5-b827-557766551111/upload/770fa600-049d-63f6-c938-668877662222/whatsapp_export_2024.txt"
}
```

**Curl Example:**
```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/upload-url" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "550e8400-e29b-41d4-a716-446655440000",
    "room_id": "660f9500-f39c-52e5-b827-557766551111",
    "file_name": "whatsapp_export_2024.txt",
    "file_digest": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"
  }'
```

**File Upload (using returned signed URL):**
```bash
curl -X PUT "<signed_url>" \
  -H "Content-Type: text/plain" \
  --data-binary @whatsapp_export_2024.txt
```

**Possible Errors:**
- `E_ROOM_NOT_FOUND` (404) - Room not found or doesn't belong to client
- `E_DUPLICATE_JOB` (409) - File already processed (same digest)
- `E_UPLOAD_SIGNING_FAILED` (500) - Storage service error

---

### Confirm Ingestion
Confirms file upload and queues the job for processing.

**Endpoint:** `POST /ingest`

**Required Role:** backend, senior_manager, OR admin (for the client)

**Request Body:**
```json
{
  "job_id": "880fb700-159e-74g7-d049-779988773333"
}
```

**Response (200):**
```json
{
  "accepted": true
}
```

**Curl Example:**
```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/ingest" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "880fb700-159e-74g7-d049-779988773333"
  }'
```

**Possible Errors:**
- `E_JOB_NOT_FOUND` (404) - Job does not exist
- `E_INVALID_JOB_STATUS` (400) - Job not in pending status
- `E_FILE_NOT_UPLOADED` (400) - File not found in storage

---

## Job Monitoring

### List Jobs
Retrieves jobs for a client with optional filtering.

**Endpoint:** `GET /jobs`

**Required Role:** Any role with client access

**Query Parameters:**
- `client_id` (required) - Client UUID
- `room_id` (optional) - Filter by specific room
- `status` (optional) - Filter by job status
- `limit` (optional, default: 50, max: 200) - Number of results
- `offset` (optional, default: 0) - Pagination offset

**Response (200):**
```json
{
  "jobs": [
    {
      "id": "880fb700-159e-74g7-d049-779988773333",
      "room_id": "660f9500-f39c-52e5-b827-557766551111",
      "room_name": "Customer Support Team",
      "room_type": "internal",
      "upload_id": "770fa600-049d-63f6-c938-668877662222",
      "file_name": "whatsapp_export_2024.txt",
      "status": "complete",
      "counts_json": {
        "messages_parsed": 1234,
        "chunks_created": 456,
        "embeddings_generated": 456
      },
      "timings_json": {
        "parse_ms": 3210,
        "embed_ms": 1200,
        "total_ms": 6000
      },
      "cost_estimate": 0.25,
      "error_code": null,
      "error_message": null,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:36:00Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1,
    "has_more": false
  },
  "filters": {
    "client_id": "550e8400-e29b-41d4-a716-446655440000",
    "room_id": null,
    "status": null
  }
}
```

**Curl Example:**
```bash
curl -X GET "https://<project-ref>.supabase.co/functions/v1/jobs?client_id=550e8400-e29b-41d4-a716-446655440000&status=complete&limit=10" \
  -H "Authorization: Bearer <jwt-token>"
```

---

## Conversations

### Create Conversation
Creates a new conversation for chat analysis.

**Endpoint:** `POST /conversations-create`

**Required Role:** project_member, senior_manager, OR admin (for the client)

**Request Body:**
```json
{
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Q1 Customer Insights Analysis" // optional
}
```

**Response (201):**
```json
{
  "conversation_id": "990fc800-269f-85h8-e15a-88aa99884444",
  "title": "Q1 Customer Insights Analysis",
  "created_at": "2024-01-15T11:00:00Z",
  "client": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Acme Corporation"
  }
}
```

**Curl Example:**
```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/conversations-create" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Q1 Customer Insights Analysis"
  }'
```

**Possible Errors:**
- `E_CLIENT_NOT_FOUND` (404) - Client does not exist
- `E_CLIENT_INACTIVE` (400) - Client is not active

---

## Query & Analysis (Server-Sent Events)

### Stream Query Response
Performs RAG-based analysis with optional evaluation mode. Returns streaming response via Server-Sent Events.

**Endpoint:** `POST /query`

**Required Role:** project_member, senior_manager, OR admin (for the client)

**Request Body:**
```json
{
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "conversation_id": "990fc800-269f-85h8-e15a-88aa99884444",
  "question": "What were the main customer complaints in the last month?",
  "filters": {
    "types": ["internal", "external"], // optional
    "room_ids": ["660f9500-f39c-52e5-b827-557766551111"], // optional
    "date_from": "2024-01-01T00:00:00Z", // optional
    "date_to": "2024-01-31T23:59:59Z", // optional
    "participants": ["john.doe", "jane.smith"] // optional
  },
  "evaluation_mode": false,
  "subject_user": null // required if evaluation_mode is true
}
```

**Response (200 - Server-Sent Events):**

**Connection Headers:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
x-corr-id: <correlation-id>
```

**SSE Events:**

1. **Connected Event:**
```
event: connected
data: {"corr_id":"abc-123","timestamp":"2024-01-15T11:05:00Z"}
```

2. **Meta Event:**
```
event: meta
data: {"retrieved":78,"mmr_kept":12,"rooms":["Customer Support","Sales Team"]}
```

3. **Citations Event:**
```
event: citations
data: [{"chunk_id":"chunk-123","room_id":"room-456","room_name":"Customer Support","first_ts":"2024-01-15T09:00:00Z","last_ts":"2024-01-15T09:30:00Z","preview":"Customer complained about slow response times..."}]
```

4. **Token Events (streaming text):**
```
event: token
data: "Based on the chat analysis, "

event: token
data: "the main customer complaints "

event: token
data: "in the last month were:\n\n1. Slow response times\n2. Product delivery delays"
```

5. **Done Event:**
```
event: done
data: {"query_id":"query-789","latency_ms":1280,"timestamp":"2024-01-15T11:05:30Z"}
```

**Curl Example (Normal Mode):**
```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/query" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -N \
  -d '{
    "client_id": "550e8400-e29b-41d4-a716-446655440000",
    "conversation_id": "990fc800-269f-85h8-e15a-88aa99884444",
    "question": "What were the main customer complaints in the last month?",
    "filters": {
      "types": ["internal", "external"],
      "date_from": "2024-01-01T00:00:00Z",
      "date_to": "2024-01-31T23:59:59Z"
    },
    "evaluation_mode": false
  }'
```

**Evaluation Mode Request:**
```json
{
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "conversation_id": "990fc800-269f-85h8-e15a-88aa99884444",
  "question": "Evaluate John Smith's communication effectiveness",
  "filters": {
    "participants": ["john.smith"],
    "date_from": "2024-01-01T00:00:00Z",
    "date_to": "2024-01-31T23:59:59Z"
  },
  "evaluation_mode": true,
  "subject_user": "john.smith"
}
```

**Additional SSE Event for Evaluation Mode:**
```
event: evaluation_payload
data: {
  "summary": {
    "weighted_total": 4.2,
    "confidence": "high",
    "evidence_count": 15,
    "rooms_analyzed": 3
  },
  "drivers": [
    {
      "key": "communication_clarity",
      "name": "Communication Clarity",
      "score": 4.5,
      "weight": 0.3,
      "rationale": "Consistently clear and concise in explanations",
      "citations": ["chunk-123", "chunk-456"],
      "strengths": ["Clear explanations", "Good structure"],
      "risks": ["Occasional technical jargon"]
    }
  ],
  "recommendations": [
    "Continue using clear, structured communication",
    "Consider simplifying technical terms for broader audience"
  ]
}
```

**Possible Errors:**
- `E_BAD_FILTERS` (400) - Invalid filter parameters
- `E_EVAL_NEEDS_SUBJECT` (422) - Evaluation mode requires subject_user
- `E_RETRIEVAL_FAILED` (500) - Database query failed
- `E_LLM_FAILED` (502) - AI model error
- `E_STREAM_ABORTED` (499) - Client disconnected

---

## Feedback

### Submit Feedback
Records user feedback on query results.

**Endpoint:** `POST /feedback`

**Required Role:** Any role with access to the query's client

**Request Body:**
```json
{
  "query_id": "query-789",
  "chunk_id": "chunk-123",
  "useful_flag": true
}
```

**Response (200):**
```json
{
  "ok": true
}
```

**Curl Example:**
```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/feedback" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "query_id": "query-789",
    "chunk_id": "chunk-123",
    "useful_flag": true
  }'
```

---

## Admin Utilities

### Retry Failed Job
Resets a failed job to queued status for reprocessing.

**Endpoint:** `POST /job-retry`

**Required Role:** Platform admin OR client admin

**Request Body:**
```json
{
  "job_id": "880fb700-159e-74g7-d049-779988773333"
}
```

**Response (200):**
```json
{
  "queued": true
}
```

**Curl Example:**
```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/job-retry" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "880fb700-159e-74g7-d049-779988773333"
  }'
```

**Possible Errors:**
- `E_JOB_NOT_FOUND` (404) - Job does not exist
- `E_INVALID_JOB_STATUS` (400) - Job not in failed/dead_letter status

---

### Reindex Client Data
Creates a reindexing job to regenerate embeddings for client data.

**Endpoint:** `POST /reindex`

**Required Role:** Platform admin OR client admin

**Request Body:**
```json
{
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "room_ids": ["660f9500-f39c-52e5-b827-557766551111"], // optional
  "date_from": "2024-01-01T00:00:00Z", // optional
  "date_to": "2024-01-31T23:59:59Z" // optional
}
```

**Response (200):**
```json
{
  "job_id": "reindex-job-999"
}
```

**Curl Example:**
```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/reindex" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "550e8400-e29b-41d4-a716-446655440000",
    "room_ids": ["660f9500-f39c-52e5-b827-557766551111"],
    "date_from": "2024-01-01T00:00:00Z",
    "date_to": "2024-01-31T23:59:59Z"
  }'
```

---

## Rate Limits

- **Upload URL**: 12 requests/minute per user
- **Query**: 30 requests/minute per user
- **Other endpoints**: 60 requests/minute per user

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit per window
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when window resets

---

## Complete Upload Flow Example

Here's a complete example of uploading and processing a file:

```bash
# Step 1: Create a client (if needed)
CLIENT_RESPONSE=$(curl -s -X POST "https://<project-ref>.supabase.co/functions/v1/clients-create" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Client"}')

CLIENT_ID=$(echo $CLIENT_RESPONSE | jq -r '.client_id')

# Step 2: Create a room
ROOM_RESPONSE=$(curl -s -X POST "https://<project-ref>.supabase.co/functions/v1/rooms-create" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"client_id\": \"$CLIENT_ID\", \"type\": \"internal\", \"name\": \"Test Room\"}")

ROOM_ID=$(echo $ROOM_RESPONSE | jq -r '.room_id')

# Step 3: Calculate file digest
FILE_DIGEST=$(sha256sum chat_export.txt | cut -d' ' -f1)

# Step 4: Request upload URL
UPLOAD_RESPONSE=$(curl -s -X POST "https://<project-ref>.supabase.co/functions/v1/upload-url" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"client_id\": \"$CLIENT_ID\", \"room_id\": \"$ROOM_ID\", \"file_name\": \"chat_export.txt\", \"file_digest\": \"$FILE_DIGEST\"}")

SIGNED_URL=$(echo $UPLOAD_RESPONSE | jq -r '.signed_url')
JOB_ID=$(echo $UPLOAD_RESPONSE | jq -r '.job_id')

# Step 5: Upload file
curl -X PUT "$SIGNED_URL" \
  -H "Content-Type: text/plain" \
  --data-binary @chat_export.txt

# Step 6: Confirm ingestion
curl -X POST "https://<project-ref>.supabase.co/functions/v1/ingest" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"job_id\": \"$JOB_ID\"}"

# Step 7: Monitor job status
curl -X GET "https://<project-ref>.supabase.co/functions/v1/jobs?client_id=$CLIENT_ID" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

This completes the comprehensive API documentation for all TCIS Edge Functions!
