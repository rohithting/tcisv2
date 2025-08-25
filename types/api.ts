/**
 * TypeScript types for TCIS API
 */

// Common types
export type JobStatus = 'pending' | 'queued' | 'processing' | 'complete' | 'failed' | 'dead_letter';
export type RoomType = 'internal' | 'external';
export type ClientStatus = 'active' | 'inactive';

// Client Management
export interface CreateClientRequest {
  name: string;
  description?: string;
  user_id?: string; // Optional user ID for anon key auth
}

export interface CreateClientResponse {
  client_id: number;
}

export interface CreateRoomRequest {
  client_id: number;
  room_type: RoomType; // Changed from 'type' to 'room_type' to match database schema
  name: string;
  description?: string;
  user_id?: string; // Optional user ID for anon key auth
}

export interface CreateRoomResponse {
  room_id: number;
}

// Upload & Ingestion
export interface UploadUrlRequest {
  client_id: number;
  room_id: number;
  file_name: string;
  file_digest: string;
}

export interface UploadUrlResponse {
  signed_url: string;
  upload_id: number;
  job_id: number;
  storage_path: string;
}

export interface IngestRequest {
  job_id: number;
}

export interface IngestResponse {
  accepted: boolean;
}

// Jobs
export interface JobDto {
  id: number;
  room_id: number;
  room_name?: string;
  room_type?: RoomType;
  upload_id: number;
  file_name?: string;
  file_digest?: string;
  status: JobStatus;
  counts_json?: {
    messages_parsed?: number;
    chunks_created?: number;
    embeddings_generated?: number;
  };
  timings_json?: {
    parse_ms?: number;
    embed_ms?: number;
    total_ms?: number;
  };
  cost_estimate?: number;
  error_code?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface JobsResponse {
  jobs: JobDto[];
  pagination: {
    limit: number;
    offset: number;
    total?: number;
    has_more: boolean;
  };
  filters: {
    client_id: number;
    room_id?: number;
    status?: JobStatus;
  };
}

export interface JobRetryRequest {
  job_id: number;
}

export interface JobRetryResponse {
  queued: boolean;
  job: {
    id: number;
    client_id: number;
    previous_status: JobStatus;
    new_status: JobStatus;
    retried_at: string;
  };
}

// Conversations
export interface CreateConversationRequest {
  client_id: number;
  title?: string;
  user_id?: string; // Optional user ID for anon key auth
}

export interface CreateConversationResponse {
  conversation_id: number;
  title: string;
  created_at: string;
  client: {
    id: number;
    name: string;
  };
}

// Query & Analysis
export interface QueryFilters {
  types?: RoomType[];
  room_ids?: number[];
  date_from?: string;
  date_to?: string;
  participants?: string[];
}

export interface QueryRequest {
  client_id: number;
  conversation_id: number;
  question: string;
  filters?: QueryFilters;
  evaluation_mode?: boolean;
  subject_user?: string;
}

export interface CitationDto {
  chunk_id: number;
  room_id: number;
  room_name: string;
  room_type: RoomType;
  first_ts: string;
  last_ts: string;
  preview: string;
  score?: number;
}

export interface EvaluationDriver {
  key: string;
  name: string;
  score: number;
  weight: number;
  rationale: string;
  citations: number[];
  strengths: string[];
  risks: string[];
}

export interface EvaluationPayload {
  summary: {
    weighted_total: number;
    confidence: 'low' | 'medium' | 'high';
    evidence_count: number;
    rooms_analyzed: number;
    subject_user: string;
  };
  drivers: EvaluationDriver[];
  recommendations: string[];
}

// SSE Events
export interface SSEMetaEvent {
  corr_id: string;
  client_id: number;
  conversation_id: number;
  evaluation_mode: boolean;
  subject_user?: string;
  timestamp: string;
  retrieved?: number;
  mmr_kept?: number;
  rooms?: number[];
  date_range?: {
    earliest: number;
    latest: number;
  };
}

export interface SSEDoneEvent {
  query_id: number | null;
  latency_ms: number;
  timestamp: string;
  results_found?: boolean;
  evaluation_completed?: boolean;
  evaluation_skipped?: boolean;
  reason?: string;
  mode?: string;
}

// Feedback
export interface FeedbackRequest {
  query_id: number;
  chunk_id: number;
  useful_flag: boolean;
}

export interface FeedbackResponse {
  ok: boolean;
  operation: 'created' | 'updated';
  feedback: {
    query_id: number;
    chunk_id: number;
    useful_flag: boolean;
  };
}

// Reindex
export interface ReindexRequest {
  client_id: number;
  room_ids?: number[];
  date_from?: string;
  date_to?: string;
}

export interface ReindexResponse {
  job_id: number;
  client_id: number;
  scope: {
    room_ids?: number[];
    date_from?: string;
    date_to?: string;
    estimated_chunks: number;
  };
  status: string;
  created_at: string;
}

// Upload Flow Types
export interface UploadProgress {
  stage: 'preparing' | 'uploading' | 'processing' | 'complete' | 'error';
  progress: number;
  message: string;
  job_id?: number;
  upload_id?: number;
}

// Chat Message Types
export interface ChatMessage {
  id: number;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: CitationDto[];
  evaluation?: EvaluationPayload;
  streaming?: boolean;
}

// Error Types
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ApiErrorDetails {
  field_errors?: ValidationError[];
  missing_room_ids?: number[];
  existing_job_id?: number;
  client_status?: string;
  current_status?: JobStatus;
  retryable_statuses?: JobStatus[];
  [key: string]: any;
}
