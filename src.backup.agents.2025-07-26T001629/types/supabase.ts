/**
 * Supabase Database Types* Generated types for Supabase database schema*/

export interface Database {
  public: {
    Tables: {
      contexts: {
        Row: {
          id: string;
          user_id: string;
          context: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          context: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          context?: any;
          created_at?: string;
          updated_at?: string;
        }};
      agent_memories: {
        Row: {
          id: string;
          agent_id: string;
          memory_type: string;
          contentany;
          embedding?: number[];
          metadata?: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          memory_type: string;
          contentany;
          embedding?: number[];
          metadata?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          memory_type?: string;
          content any;
          embedding?: number[];
          metadata?: any;
          created_at?: string;
          updated_at?: string;
        }};
      agent_sessions: {
        Row: {
          id: string;
          agent_id: string;
          user_id: string;
          context: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          user_id: string;
          context?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          user_id?: string;
          context?: any;
          created_at?: string;
          updated_at?: string;
        }}};
    Views: {
};
    Functions: {
};
    Enums: {
}}};
