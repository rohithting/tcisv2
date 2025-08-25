// Database types for TCIS
export type PlatformRole = 'super_admin' | 'backend' | 'admin' | 'manager' | 'user';
export type UserRole = 'admin' | 'manager' | 'user';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type RoomType = 'internal' | 'external';
export type EvaluationScale = '1-5' | '1-10' | 'pass_fail' | 'custom';

export interface PlatformUser {
  id: string;
  email: string;
  full_name?: string;
  platform_role: PlatformRole;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: number;
  name: string;
  description?: string;
  logo_url?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface UserClientAccess {
  id: number;
  user_id: string;
  client_id: number;
  role: UserRole;
  granted_by?: string;
  granted_at: string;
}

export interface Room {
  id: number;
  client_id: number;
  name: string;
  description?: string;
  room_type: RoomType;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Upload {
  id: number;
  client_id: number;
  room_id: number;
  filename: string;
  original_filename: string;
  file_size: number;
  file_type: string;
  storage_path: string;
  uploaded_by: string;
  status: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface Job {
  id: number;
  upload_id: number;
  client_id: number;
  room_id: number;
  status: JobStatus;
  job_type: string;
  progress: number;
  total_items?: number;
  processed_items: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: number;
  client_id: number;
  title: string;
  description?: string;
  created_by: string;
  is_active: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Query {
  id: number;
  conversation_id: number;
  client_id: number;
  query_text: string;
  response_text?: string;
  context_chunks: any[];
  evaluation_enabled: boolean;
  processing_time_ms?: number;
  created_by: string;
  created_at: string;
}

export interface AdminSettings {
  id: number;
  platform_name: string;
  platform_logo_url?: string;
  favicon_url?: string;
  primary_color: string;
  secondary_color: string;
  enable_signups: boolean;
  require_email_verification: boolean;
  created_at: string;
  updated_at: string;
}

// Auth related types
export interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
  };
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}

// Form types
export interface LoginFormData {
  email: string;
  password: string;
}

export interface SignupFormData {
  email: string;
  password: string;
  full_name: string;
  confirmPassword: string;
}

export interface ForgotPasswordFormData {
  email: string;
}

export interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}
