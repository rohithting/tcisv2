import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
// Common validation schemas
export const UuidSchema = z.string().uuid();
export const DateTimeSchema = z.string().datetime();
// Client Schema
export const CreateClientSchema = z.object({
  name: z.string().min(3).max(80),
  description: z.string().max(240).optional(),
  logo_url: z.string().url().optional()
});
// Room Schema
export const CreateRoomSchema = z.object({
  client_id: z.number().int().positive(),
  name: z.string().min(3).max(80),
  room_type: z.enum([
    'internal',
    'external'
  ]),
  description: z.string().max(240).optional()
});
// Upload Schema
export const UploadUrlSchema = z.object({
  client_id: z.number().int().positive(),
  room_id: z.number().int().positive(),
  file_name: z.string().min(1).max(255),
  file_digest: z.string().min(64).max(64)
});
// Ingest Schema
export const IngestSchema = z.object({
  job_id: z.number().int().positive()
});
// Jobs Schema
export const JobsQuerySchema = z.object({
  client_id: UuidSchema,
  room_id: UuidSchema.optional(),
  status: z.enum([
    'pending',
    'queued',
    'processing',
    'completed',
    'failed',
    'cancelled'
  ]).optional(),
  limit: z.number().min(1).max(200).default(50),
  offset: z.number().min(0).default(0)
});
// Conversations Schema
export const CreateConversationSchema = z.object({
  client_id: z.number().int().positive(),
  title: z.string().min(1).max(80).optional(),
  user_id: z.string().uuid().optional()
});
// Query Schema - FIXED: conversation_id should be int, not UUID
export const QueryFiltersSchema = z.object({
  types: z.array(z.enum([
    'internal',
    'external'
  ])).optional(),
  room_ids: z.array(z.number().int().positive()).optional(),
  date_from: DateTimeSchema.optional(),
  date_to: DateTimeSchema.optional(),
  participants: z.array(z.string().max(80)).max(20).optional()
});
export const QuerySchema = z.object({
  client_id: z.number().int().positive(),
  conversation_id: z.number().int().positive(),
  question: z.string().min(1).max(1000),
  filters: QueryFiltersSchema.default({}),
  evaluation_mode: z.boolean().default(false),
  subject_user: z.string().min(1).max(80).optional()
}).refine((data)=>!data.evaluation_mode || data.subject_user, {
  message: 'subject_user is required when evaluation_mode is true',
  path: [
    'subject_user'
  ]
});
// Feedback Schema
export const FeedbackSchema = z.object({
  query_id: z.string().uuid(),
  chunk_id: z.string().uuid(),
  useful_flag: z.boolean()
});
// Admin Utilities Schemas
export const JobRetrySchema = z.object({
  job_id: z.string().uuid()
});
export const ReindexSchema = z.object({
  client_id: z.number().int().positive(),
  room_ids: z.array(z.number().int().positive()).optional(),
  date_from: DateTimeSchema.optional(),
  date_to: DateTimeSchema.optional()
});
/**
 * Validate request body against schema
 */ export async function validateRequestBody(req, schema, correlationId) {
  let body;
  try {
    // Clone the request to avoid "Body already consumed" error
    const clonedReq = req.clone();
    body = await clonedReq.json();
  } catch (error) {
    throw new Response(JSON.stringify({
      error_code: 'E_BAD_INPUT',
      message: 'Invalid JSON in request body',
      details: error.message
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...correlationId ? {
          'x-corr-id': correlationId
        } : {}
      }
    });
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const fieldErrors = result.error.errors.map((err)=>({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }));
    throw new Response(JSON.stringify({
      error_code: 'E_BAD_INPUT',
      message: 'Validation failed',
      details: {
        field_errors: fieldErrors
      }
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...correlationId ? {
          'x-corr-id': correlationId
        } : {}
      }
    });
  }
  return result.data;
}
/**
 * Validate URL search parameters against schema
 */ export function validateSearchParams(url, schema, correlationId) {
  const params = {};
  // Convert URL search params to object
  for (const [key, value] of url.searchParams.entries()){
    // Handle arrays (repeated params)
    if (params[key]) {
      if (Array.isArray(params[key])) {
        params[key].push(value);
      } else {
        params[key] = [
          params[key],
          value
        ];
      }
    } else {
      // Try to parse as JSON for complex types, fallback to string
      try {
        params[key] = JSON.parse(value);
      } catch  {
        params[key] = value;
      }
    }
  }
  const result = schema.safeParse(params);
  if (!result.success) {
    const fieldErrors = result.error.errors.map((err)=>({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }));
    throw new Response(JSON.stringify({
      error_code: 'E_BAD_INPUT',
      message: 'Invalid query parameters',
      details: {
        field_errors: fieldErrors
      }
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...correlationId ? {
          'x-corr-id': correlationId
        } : {}
      }
    });
  }
  return result.data;
}
/**
 * Common validation helpers
 */ export const ValidationHelpers = {
  isValidUuid: (value)=>UuidSchema.safeParse(value).success,
  isValidDateTime: (value)=>DateTimeSchema.safeParse(value).success,
  isValidSha256: (value)=>/^[a-f0-9]{64}$/i.test(value),
  isValidFileName: (value)=>/\.txt$/i.test(value)
};
