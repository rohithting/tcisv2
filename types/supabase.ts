// Generated Supabase types (simplified for now)
export interface Database {
  public: {
    Tables: {
      platform_users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          platform_role: 'super_admin' | 'backend' | 'admin' | 'manager' | 'user';
          is_active: boolean;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          platform_role?: 'super_admin' | 'backend' | 'admin' | 'manager' | 'user';
          is_active?: boolean;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          platform_role?: 'super_admin' | 'backend' | 'admin' | 'manager' | 'user';
          is_active?: boolean;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      clients: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          logo_url: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          description?: string | null;
          logo_url?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          description?: string | null;
          logo_url?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      admin_settings: {
        Row: {
          id: number;
          platform_name: string;
          platform_logo_url: string | null;
          favicon_url: string | null;
          primary_color: string;
          secondary_color: string;
          enable_signups: boolean;
          require_email_verification: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          platform_name?: string;
          platform_logo_url?: string | null;
          favicon_url?: string | null;
          primary_color?: string;
          secondary_color?: string;
          enable_signups?: boolean;
          require_email_verification?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          platform_name?: string;
          platform_logo_url?: string | null;
          favicon_url?: string | null;
          primary_color?: string;
          secondary_color?: string;
          enable_signups?: boolean;
          require_email_verification?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_user_platform_role: {
        Args: { user_id: string };
        Returns: 'super_admin' | 'backend' | 'admin' | 'manager' | 'user';
      };
      is_super_admin: {
        Args: { user_id: string };
        Returns: boolean;
      };
      has_client_access: {
        Args: { user_id: string; client_id: number };
        Returns: boolean;
      };
    };
    Enums: {
      platform_role: 'super_admin' | 'backend' | 'admin' | 'manager' | 'user';
      user_role: 'admin' | 'manager' | 'user';
      job_status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
      room_type: 'internal' | 'external';
      evaluation_scale: '1-5' | '1-10' | 'pass_fail' | 'custom';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
