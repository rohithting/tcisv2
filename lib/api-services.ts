/**
 * API Service functions for TCIS Edge Functions
 * Organized by feature area with proper typing
 */

import { apiFetch, apiSSE, calculateSHA256, uploadFile, retryWithBackoff, SSEHandlers } from './api-client';
import {
  CreateClientRequest,
  CreateClientResponse,
  CreateRoomRequest,
  CreateRoomResponse,
  UploadUrlRequest,
  UploadUrlResponse,
  IngestRequest,
  IngestResponse,
  JobsResponse,
  JobRetryRequest,
  JobRetryResponse,
  CreateConversationRequest,
  CreateConversationResponse,
  QueryRequest,
  FeedbackRequest,
  FeedbackResponse,
  ReindexRequest,
  ReindexResponse,
  UploadProgress,
} from '@/types/api';

// Client Management Services
export const clientServices = {
  /**
   * Create a new client
   */
  async create(supabase: any, request: CreateClientRequest): Promise<CreateClientResponse> {
    return retryWithBackoff(() =>
      apiFetch<CreateClientResponse>(supabase, '/clients-create', {
        method: 'POST',
        body: JSON.stringify(request),
      })
    );
  },
};

// Room Management Services
export const roomServices = {
  /**
   * Create a new room
   */
  async create(supabase: any, request: CreateRoomRequest): Promise<CreateRoomResponse> {
    return retryWithBackoff(() =>
      apiFetch<CreateRoomResponse>(supabase, '/rooms-create', {
        method: 'POST',
        body: JSON.stringify(request),
      })
    );
  },
};

// Upload & Ingestion Services
export const uploadServices = {
  /**
   * Request upload URL for a file
   */
  async requestUploadUrl(supabase: any, request: UploadUrlRequest): Promise<UploadUrlResponse> {
    return apiFetch<UploadUrlResponse>(supabase, '/upload-url', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Confirm file ingestion
   */
  async confirmIngest(supabase: any, request: IngestRequest): Promise<IngestResponse> {
    return apiFetch<IngestResponse>(supabase, '/ingest', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Complete upload flow: calculate digest, get signed URL, upload file, confirm ingest
   */
  async uploadFile(
    supabase: any,
    clientId: string,
    roomId: string,
    file: File,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<{ job_id: number; upload_id: number }> {
    try {
      // Stage 1: Preparing
      onProgress?.({
        stage: 'preparing',
        progress: 10,
        message: 'Calculating file digest...',
      });

      const fileDigest = await calculateSHA256(file);

      onProgress?.({
        stage: 'preparing',
        progress: 20,
        message: 'Requesting upload URL...',
      });

      // Stage 2: Get signed URL
      const uploadResponse = await this.requestUploadUrl(supabase, {
        client_id: parseInt(clientId),
        room_id: parseInt(roomId),
        file_name: file.name,
        file_digest: fileDigest,
      });

      onProgress?.({
        stage: 'uploading',
        progress: 30,
        message: 'Uploading file...',
        job_id: uploadResponse.job_id,
        upload_id: uploadResponse.upload_id,
      });

      // Stage 3: Upload file
      await uploadFile(uploadResponse.signed_url, file);

      onProgress?.({
        stage: 'processing',
        progress: 80,
        message: 'Confirming upload...',
        job_id: uploadResponse.job_id,
        upload_id: uploadResponse.upload_id,
      });

      // Stage 4: Confirm ingestion
      await this.confirmIngest(supabase, {
        job_id: uploadResponse.job_id,
      });

      onProgress?.({
        stage: 'complete',
        progress: 100,
        message: 'Upload complete!',
        job_id: uploadResponse.job_id,
        upload_id: uploadResponse.upload_id,
      });

      return {
        job_id: uploadResponse.job_id,
        upload_id: uploadResponse.upload_id,
      };

    } catch (error: any) {
      onProgress?.({
        stage: 'error',
        progress: 0,
        message: error.message || 'Upload failed',
      });
      throw error;
    }
  },
};

// Job Management Services
export const jobServices = {
  /**
   * List jobs for a client
   */
  async list(
    supabase: any,
    clientId: string,
    options?: {
      roomId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<JobsResponse> {
    const params = new URLSearchParams({
      client_id: clientId,
    });

    if (options?.roomId) params.append('room_id', options.roomId);
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    return apiFetch<JobsResponse>(supabase, `/jobs?${params.toString()}`);
  },

  /**
   * Retry a failed job
   */
  async retry(supabase: any, request: JobRetryRequest): Promise<JobRetryResponse> {
    return apiFetch<JobRetryResponse>(supabase, '/jobs', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },
};

// Conversation Services
export const conversationServices = {
  /**
   * Create a new conversation
   */
  async create(supabase: any, request: CreateConversationRequest): Promise<CreateConversationResponse> {
    return apiFetch<CreateConversationResponse>(supabase, '/conversations-create', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Send a query with streaming response
   */
  async query(
    supabase: any,
    request: QueryRequest,
    handlers: SSEHandlers
  ): Promise<{ abort: () => void }> {
    return apiSSE(supabase, '/query', request, handlers);
  },
};

// Feedback Services
export const feedbackServices = {
  /**
   * Submit feedback on a query result
   */
  async submit(supabase: any, request: FeedbackRequest): Promise<FeedbackResponse> {
    return apiFetch<FeedbackResponse>(supabase, '/feedback', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },
};

// Admin Services
export const adminServices = {
  /**
   * Reindex client data
   */
  async reindex(supabase: any, request: ReindexRequest): Promise<ReindexResponse> {
    return apiFetch<ReindexResponse>(supabase, '/reindex', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },
};

// Drivers Management Services
export const driversServices = {
  /**
   * Create or update drivers, behaviors, and instances
   */
  async createOrUpdate(supabase: any, request: any): Promise<any> {
    return apiFetch<any>(supabase, '/drivers-create', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Vectorize drivers for semantic search
   */
  async vectorize(supabase: any, request: any): Promise<any> {
    return apiFetch<any>(supabase, '/drivers-vectorize', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Run evaluation with Gemini
   */
  async runEvaluation(supabase: any, request: any): Promise<any> {
    return apiFetch<any>(supabase, '/evaluation-run', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },
};

// Utility function to check file constraints
export const fileValidation = {
  /**
   * Validate file for upload
   */
  validateFile(file: File): { valid: boolean; error?: string } {
    // Check file type
    if (!file.name.toLowerCase().endsWith('.txt')) {
      return {
        valid: false,
        error: 'Only .txt files are supported',
      };
    }

    // Check file size (default 25MB)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`,
      };
    }

    // Check if file is empty
    if (file.size === 0) {
      return {
        valid: false,
        error: 'File cannot be empty',
      };
    }

    return { valid: true };
  },

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
};

// Query validation utilities
export const queryValidation = {
  /**
   * Validate query filters
   */
  validateFilters(filters: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate date range
    if (filters.date_from && filters.date_to) {
      const fromDate = new Date(filters.date_from);
      const toDate = new Date(filters.date_to);
      
      if (fromDate > toDate) {
        errors.push('Start date must be before end date');
      }
    }

    // Validate participants
    if (filters.participants && Array.isArray(filters.participants)) {
      if (filters.participants.length > 20) {
        errors.push('Maximum 20 participants allowed');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * Validate query request
   */
  validateQuery(request: QueryRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate question length
    if (!request.question || request.question.trim().length === 0) {
      errors.push('Question is required');
    } else if (request.question.length > 1000) {
      errors.push('Question must be less than 1000 characters');
    }

    // Validate evaluation mode requirements
    if (request.evaluation_mode && !request.subject_user) {
      errors.push('Subject user is required for evaluation mode');
    }

    // Validate filters
    if (request.filters) {
      const filterValidation = this.validateFilters(request.filters);
      errors.push(...filterValidation.errors);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
};

// Export all services as a single object
export const api = {
  clients: clientServices,
  rooms: roomServices,
  uploads: uploadServices,
  jobs: jobServices,
  conversations: conversationServices,
  feedback: feedbackServices,
  admin: adminServices,
  drivers: driversServices,
  validation: {
    file: fileValidation,
    query: queryValidation,
  },
};
