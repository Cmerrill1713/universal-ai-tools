export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_sessions: {
        Row: {
          agent_type: string
          created_at: string | null
          ended_at: string | null
          id: string
          metadata: Json | null
          session_name: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          agent_type: string
          created_at?: string | null
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          session_name: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          agent_type?: string
          created_at?: string | null
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          session_name?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      agent_templates: {
        Row: {
          agent_type: string
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          parameters: Json | null
          parent_template_id: string | null
          storage_path: string | null
          template_category: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          agent_type: string
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          parameters?: Json | null
          parent_template_id?: string | null
          storage_path?: string | null
          template_category: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          agent_type?: string
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          parameters?: Json | null
          parent_template_id?: string | null
          storage_path?: string | null
          template_category?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_templates_parent_template_id_fkey"
            columns: ["parent_template_id"]
            isOneToOne: false
            referencedRelation: "agent_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tools: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          parameters: Json | null
          tool_type: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          parameters?: Json | null
          tool_type: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          parameters?: Json | null
          tool_type?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      ai_memories: {
        Row: {
          access_count: number | null
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          memory_type: string
          metadata: Json | null
          relevance_score: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_count?: number | null
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          memory_type: string
          metadata?: Json | null
          relevance_score?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_count?: number | null
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          memory_type?: string
          metadata?: Json | null
          relevance_score?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      app_secrets: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          key: string
          service: string | null
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          service?: string | null
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          service?: string | null
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      archived_assets: {
        Row: {
          archived_at: string | null
          archived_reason: string | null
          asset_type: string
          can_delete_local: boolean | null
          checksum: string | null
          created_at: string | null
          file_size: number | null
          id: string
          metadata: Json | null
          original_path: string
          retention_until: string | null
          storage_bucket: string
          storage_path: string
        }
        Insert: {
          archived_at?: string | null
          archived_reason?: string | null
          asset_type: string
          can_delete_local?: boolean | null
          checksum?: string | null
          created_at?: string | null
          file_size?: number | null
          id?: string
          metadata?: Json | null
          original_path: string
          retention_until?: string | null
          storage_bucket: string
          storage_path: string
        }
        Update: {
          archived_at?: string | null
          archived_reason?: string | null
          asset_type?: string
          can_delete_local?: boolean | null
          checksum?: string | null
          created_at?: string | null
          file_size?: number | null
          id?: string
          metadata?: Json | null
          original_path?: string
          retention_until?: string | null
          storage_bucket?: string
          storage_path?: string
        }
        Relationships: []
      }
      autonomous_actions: {
        Row: {
          assessment: Json
          change: Json
          created_at: string | null
          evidence: Json
          execution: Json
          id: string
          implementation_result: Json | null
          implemented_at: string | null
          priority: string
          status: string
          target: Json
          type: string
          updated_at: string | null
        }
        Insert: {
          assessment: Json
          change: Json
          created_at?: string | null
          evidence: Json
          execution: Json
          id?: string
          implementation_result?: Json | null
          implemented_at?: string | null
          priority: string
          status: string
          target: Json
          type: string
          updated_at?: string | null
        }
        Update: {
          assessment?: Json
          change?: Json
          created_at?: string | null
          evidence?: Json
          execution?: Json
          id?: string
          implementation_result?: Json | null
          implemented_at?: string | null
          priority?: string
          status?: string
          target?: Json
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      autonomous_learning: {
        Row: {
          action_id: string | null
          id: string
          learning_data: Json
          timestamp: string | null
        }
        Insert: {
          action_id?: string | null
          id?: string
          learning_data: Json
          timestamp?: string | null
        }
        Update: {
          action_id?: string | null
          id?: string
          learning_data?: Json
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "autonomous_learning_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "autonomous_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      claude_commands: {
        Row: {
          category: string
          command_content: string
          command_description: string
          command_name: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          parameters: string[] | null
          storage_path: string | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          category: string
          command_content: string
          command_description: string
          command_name: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          parameters?: string[] | null
          storage_path?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          category?: string
          command_content?: string
          command_description?: string
          command_name?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          parameters?: string[] | null
          storage_path?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      context_storage: {
        Row: {
          category: string
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          project_path: string | null
          source: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          project_path?: string | null
          source: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          project_path?: string | null
          source?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      correlation_metrics: {
        Row: {
          correlation_coefficients: Json | null
          feedback_loops_status: Json | null
          id: string
          memory_heap_usage_percent: number | null
          memory_pressure_level: string | null
          memory_trend: string | null
          ranking_accuracy: number | null
          ranking_avg_response_time: number | null
          ranking_confidence_score: number | null
          ranking_success_rate: number | null
          timestamp: string | null
          token_avg_chunk_size: number | null
          token_compression_ratio: number | null
          token_context_utilization: number | null
        }
        Insert: {
          correlation_coefficients?: Json | null
          feedback_loops_status?: Json | null
          id?: string
          memory_heap_usage_percent?: number | null
          memory_pressure_level?: string | null
          memory_trend?: string | null
          ranking_accuracy?: number | null
          ranking_avg_response_time?: number | null
          ranking_confidence_score?: number | null
          ranking_success_rate?: number | null
          timestamp?: string | null
          token_avg_chunk_size?: number | null
          token_compression_ratio?: number | null
          token_context_utilization?: number | null
        }
        Update: {
          correlation_coefficients?: Json | null
          feedback_loops_status?: Json | null
          id?: string
          memory_heap_usage_percent?: number | null
          memory_pressure_level?: string | null
          memory_trend?: string | null
          ranking_accuracy?: number | null
          ranking_avg_response_time?: number | null
          ranking_confidence_score?: number | null
          ranking_success_rate?: number | null
          timestamp?: string | null
          token_avg_chunk_size?: number | null
          token_compression_ratio?: number | null
          token_context_utilization?: number | null
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          context: Json | null
          created_at: string | null
          error_message: string
          error_type: string
          id: string
          resolved: boolean | null
          resolved_at: string | null
          severity: string | null
          stack_trace: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          error_message: string
          error_type: string
          id?: string
          resolved?: boolean | null
          resolved_at?: string | null
          severity?: string | null
          stack_trace?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          error_message?: string
          error_type?: string
          id?: string
          resolved?: boolean | null
          resolved_at?: string | null
          severity?: string | null
          stack_trace?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      feedback_collection: {
        Row: {
          content: string
          created_at: string | null
          feedback_type: string
          id: string
          metadata: Json | null
          processed: boolean | null
          processed_at: string | null
          rating: number | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          feedback_type: string
          id?: string
          metadata?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          rating?: number | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          feedback_type?: string
          id?: string
          metadata?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          rating?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      framework_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          parent_category_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          parent_category_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          parent_category_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "framework_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "framework_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      framework_optimization_analysis: {
        Row: {
          analysis_timestamp: string | null
          analysis_version: string | null
          baseline_metrics: Json | null
          configurations: Json
          created_at: string | null
          dependencies: Json
          framework_id: string
          id: number
          implementation_notes: string | null
          implementation_status: string | null
          improvement_percentage: number | null
          mathematical_analysis: Json
          optimization_opportunities: string[] | null
          optimized_metrics: Json | null
          performance_metrics: Json
          updated_at: string | null
        }
        Insert: {
          analysis_timestamp?: string | null
          analysis_version?: string | null
          baseline_metrics?: Json | null
          configurations?: Json
          created_at?: string | null
          dependencies?: Json
          framework_id: string
          id?: number
          implementation_notes?: string | null
          implementation_status?: string | null
          improvement_percentage?: number | null
          mathematical_analysis?: Json
          optimization_opportunities?: string[] | null
          optimized_metrics?: Json | null
          performance_metrics?: Json
          updated_at?: string | null
        }
        Update: {
          analysis_timestamp?: string | null
          analysis_version?: string | null
          baseline_metrics?: Json | null
          configurations?: Json
          created_at?: string | null
          dependencies?: Json
          framework_id?: string
          id?: number
          implementation_notes?: string | null
          implementation_status?: string | null
          improvement_percentage?: number | null
          mathematical_analysis?: Json
          optimization_opportunities?: string[] | null
          optimized_metrics?: Json | null
          performance_metrics?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "framework_optimization_analysis_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framework_optimization_analysis_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "optimization_dashboard"
            referencedColumns: ["id"]
          },
        ]
      }
      framework_relationships: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          relationship_type: string
          source_id: string
          strength: number | null
          target_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          relationship_type: string
          source_id: string
          strength?: number | null
          target_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          relationship_type?: string
          source_id?: string
          strength?: number | null
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "framework_relationships_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framework_relationships_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "optimization_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framework_relationships_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framework_relationships_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "optimization_dashboard"
            referencedColumns: ["id"]
          },
        ]
      }
      framework_tag_mappings: {
        Row: {
          framework_id: string
          tag_id: string
        }
        Insert: {
          framework_id: string
          tag_id: string
        }
        Update: {
          framework_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "framework_tag_mappings_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framework_tag_mappings_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "optimization_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framework_tag_mappings_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "framework_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      framework_tags: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      frameworks: {
        Row: {
          category: string
          created_at: string | null
          dependencies: string[] | null
          description: string | null
          id: string
          importance: number | null
          language: string | null
          license: string | null
          name: string
          platform: string | null
          subcategory: string | null
          tags: string[] | null
          updated_at: string | null
          url: string | null
          used_by: string[] | null
          version: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          dependencies?: string[] | null
          description?: string | null
          id: string
          importance?: number | null
          language?: string | null
          license?: string | null
          name: string
          platform?: string | null
          subcategory?: string | null
          tags?: string[] | null
          updated_at?: string | null
          url?: string | null
          used_by?: string[] | null
          version?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          dependencies?: string[] | null
          description?: string | null
          id?: string
          importance?: number | null
          language?: string | null
          license?: string | null
          name?: string
          platform?: string | null
          subcategory?: string | null
          tags?: string[] | null
          updated_at?: string | null
          url?: string | null
          used_by?: string[] | null
          version?: string | null
        }
        Relationships: []
      }
      goals: {
        Row: {
          category: string
          created_at: string | null
          description: string
          id: string
          metrics: Json | null
          milestones: Json | null
          progress: number | null
          related_tasks: string[] | null
          status: string
          target_date: string
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description: string
          id: string
          metrics?: Json | null
          milestones?: Json | null
          progress?: number | null
          related_tasks?: string[] | null
          status: string
          target_date: string
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          id?: string
          metrics?: Json | null
          milestones?: Json | null
          progress?: number | null
          related_tasks?: string[] | null
          status?: string
          target_date?: string
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      mcp_code_patterns: {
        Row: {
          after_code: string
          agent_name: string | null
          before_code: string | null
          complexity_level: string | null
          created_at: string | null
          description: string
          error_types: string[] | null
          id: string
          last_used_at: string | null
          metadata: Json | null
          pattern_type: string
          programming_language: string | null
          success_rate: number | null
          updated_at: string | null
          usage_count: number | null
          user_id: string | null
        }
        Insert: {
          after_code: string
          agent_name?: string | null
          before_code?: string | null
          complexity_level?: string | null
          created_at?: string | null
          description: string
          error_types?: string[] | null
          id?: string
          last_used_at?: string | null
          metadata?: Json | null
          pattern_type: string
          programming_language?: string | null
          success_rate?: number | null
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string | null
        }
        Update: {
          after_code?: string
          agent_name?: string | null
          before_code?: string | null
          complexity_level?: string | null
          created_at?: string | null
          description?: string
          error_types?: string[] | null
          id?: string
          last_used_at?: string | null
          metadata?: Json | null
          pattern_type?: string
          programming_language?: string | null
          success_rate?: number | null
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      mcp_context: {
        Row: {
          access_count: number | null
          category: string
          content: string
          created_at: string | null
          embedding: string | null
          expires_at: string | null
          id: string
          metadata: Json | null
          relevance_score: number | null
          session_id: string | null
          source: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_count?: number | null
          category: string
          content: string
          created_at?: string | null
          embedding?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          relevance_score?: number | null
          session_id?: string | null
          source?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_count?: number | null
          category?: string
          content?: string
          created_at?: string | null
          embedding?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          relevance_score?: number | null
          session_id?: string | null
          source?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      mcp_error_analysis: {
        Row: {
          agent_name: string | null
          error_category: string | null
          error_message: string
          error_type: string
          file_path: string | null
          first_seen: string | null
          frequency: number | null
          id: string
          last_seen: string | null
          line_number: number | null
          metadata: Json | null
          programming_language: string | null
          resolution_status: string | null
          resolved_at: string | null
          severity: string | null
          solution_pattern: string | null
          user_id: string | null
        }
        Insert: {
          agent_name?: string | null
          error_category?: string | null
          error_message: string
          error_type: string
          file_path?: string | null
          first_seen?: string | null
          frequency?: number | null
          id?: string
          last_seen?: string | null
          line_number?: number | null
          metadata?: Json | null
          programming_language?: string | null
          resolution_status?: string | null
          resolved_at?: string | null
          severity?: string | null
          solution_pattern?: string | null
          user_id?: string | null
        }
        Update: {
          agent_name?: string | null
          error_category?: string | null
          error_message?: string
          error_type?: string
          file_path?: string | null
          first_seen?: string | null
          frequency?: number | null
          id?: string
          last_seen?: string | null
          line_number?: number | null
          metadata?: Json | null
          programming_language?: string | null
          resolution_status?: string | null
          resolved_at?: string | null
          severity?: string | null
          solution_pattern?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      mcp_servers: {
        Row: {
          capabilities: Json | null
          created_at: string | null
          id: string
          last_connected: string | null
          name: string
          status: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          capabilities?: Json | null
          created_at?: string | null
          id?: string
          last_connected?: string | null
          name: string
          status?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          capabilities?: Json | null
          created_at?: string | null
          id?: string
          last_connected?: string | null
          name?: string
          status?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      mcp_task_progress: {
        Row: {
          actual_duration_ms: number | null
          agent_name: string | null
          completed_at: string | null
          created_at: string | null
          description: string
          error_message: string | null
          estimated_duration_ms: number | null
          id: string
          metadata: Json | null
          parent_task_id: string | null
          progress_percentage: number | null
          resource_usage: Json | null
          session_id: string | null
          started_at: string | null
          status: string
          task_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          actual_duration_ms?: number | null
          agent_name?: string | null
          completed_at?: string | null
          created_at?: string | null
          description: string
          error_message?: string | null
          estimated_duration_ms?: number | null
          id?: string
          metadata?: Json | null
          parent_task_id?: string | null
          progress_percentage?: number | null
          resource_usage?: Json | null
          session_id?: string | null
          started_at?: string | null
          status: string
          task_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          actual_duration_ms?: number | null
          agent_name?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string
          error_message?: string | null
          estimated_duration_ms?: number | null
          id?: string
          metadata?: Json | null
          parent_task_id?: string | null
          progress_percentage?: number | null
          resource_usage?: Json | null
          session_id?: string | null
          started_at?: string | null
          status?: string
          task_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      memories: {
        Row: {
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          metadata: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      mlx_training_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          dataset_path: string | null
          id: string
          job_name: string
          metrics: Json | null
          model_name: string
          progress: number | null
          started_at: string | null
          status: string | null
          training_config: Json | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          dataset_path?: string | null
          id?: string
          job_name: string
          metrics?: Json | null
          model_name: string
          progress?: number | null
          started_at?: string | null
          status?: string | null
          training_config?: Json | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          dataset_path?: string | null
          id?: string
          job_name?: string
          metrics?: Json | null
          model_name?: string
          progress?: number | null
          started_at?: string | null
          status?: string | null
          training_config?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      proactive_tasks: {
        Row: {
          action_details: Json
          action_type: string
          adaptation_history: Json | null
          category: string
          completed_at: string | null
          completion_rate: number | null
          created_at: string | null
          created_by: string
          dependencies: string[] | null
          description: string | null
          due_date: string | null
          estimated_duration: number | null
          id: string
          priority: string
          recurring_pattern: Json | null
          scheduled_for: string | null
          status: string
          title: string
          trigger_context: Json
          updated_at: string | null
          user_feedback: string | null
          user_id: string | null
        }
        Insert: {
          action_details?: Json
          action_type: string
          adaptation_history?: Json | null
          category: string
          completed_at?: string | null
          completion_rate?: number | null
          created_at?: string | null
          created_by: string
          dependencies?: string[] | null
          description?: string | null
          due_date?: string | null
          estimated_duration?: number | null
          id: string
          priority: string
          recurring_pattern?: Json | null
          scheduled_for?: string | null
          status: string
          title: string
          trigger_context: Json
          updated_at?: string | null
          user_feedback?: string | null
          user_id?: string | null
        }
        Update: {
          action_details?: Json
          action_type?: string
          adaptation_history?: Json | null
          category?: string
          completed_at?: string | null
          completion_rate?: number | null
          created_at?: string | null
          created_by?: string
          dependencies?: string[] | null
          description?: string | null
          due_date?: string | null
          estimated_duration?: number | null
          id?: string
          priority?: string
          recurring_pattern?: Json | null
          scheduled_for?: string | null
          status?: string
          title?: string
          trigger_context?: Json
          updated_at?: string | null
          user_feedback?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      prp_templates: {
        Row: {
          category: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          storage_path: string | null
          tags: string[] | null
          template_content: string
          title: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          storage_path?: string | null
          tags?: string[] | null
          template_content: string
          title: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          storage_path?: string | null
          tags?: string[] | null
          template_content?: string
          title?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      reranking_metrics: {
        Row: {
          avg_score: number | null
          created_at: string | null
          id: string
          metadata: Json | null
          model_used: string | null
          original_count: number
          processing_time_ms: number | null
          query_text: string
          reduction_rate: number
          reranked_count: number
        }
        Insert: {
          avg_score?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          model_used?: string | null
          original_count: number
          processing_time_ms?: number | null
          query_text: string
          reduction_rate: number
          reranked_count: number
        }
        Update: {
          avg_score?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          model_used?: string | null
          original_count?: number
          processing_time_ms?: number | null
          query_text?: string
          reduction_rate?: number
          reranked_count?: number
        }
        Relationships: []
      }
      swift_documentation: {
        Row: {
          availability: string | null
          category: string
          class_name: string | null
          created_at: string | null
          declaration: string
          documentation: string | null
          embedding: string | null
          example_code: string | null
          framework: string
          id: string
          method_name: string | null
          parameters: Json | null
          property_name: string | null
          return_type: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          availability?: string | null
          category: string
          class_name?: string | null
          created_at?: string | null
          declaration: string
          documentation?: string | null
          embedding?: string | null
          example_code?: string | null
          framework: string
          id?: string
          method_name?: string | null
          parameters?: Json | null
          property_name?: string | null
          return_type?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          availability?: string | null
          category?: string
          class_name?: string | null
          created_at?: string | null
          declaration?: string
          documentation?: string | null
          embedding?: string | null
          example_code?: string | null
          framework?: string
          id?: string
          method_name?: string | null
          parameters?: Json | null
          property_name?: string | null
          return_type?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      system_configurations: {
        Row: {
          category: string
          config_type: string
          configuration: Json
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          is_template: boolean | null
          name: string
          schema_version: string | null
          storage_path: string | null
          updated_at: string | null
        }
        Insert: {
          category: string
          config_type: string
          configuration: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_template?: boolean | null
          name: string
          schema_version?: string | null
          storage_path?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          config_type?: string
          configuration?: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_template?: boolean | null
          name?: string
          schema_version?: string | null
          storage_path?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          rating: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          rating?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          rating?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string | null
          id: string
          preference_key: string
          preference_value: Json
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          preference_key: string
          preference_value: Json
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          preference_key?: string
          preference_value?: Json
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      visual_concepts: {
        Row: {
          concept_name: string
          created_at: string | null
          description: string | null
          example_images: Json | null
          id: string
          updated_at: string | null
          usage_count: number | null
          visual_embedding: string | null
        }
        Insert: {
          concept_name: string
          created_at?: string | null
          description?: string | null
          example_images?: Json | null
          id?: string
          updated_at?: string | null
          usage_count?: number | null
          visual_embedding?: string | null
        }
        Update: {
          concept_name?: string
          created_at?: string | null
          description?: string | null
          example_images?: Json | null
          id?: string
          updated_at?: string | null
          usage_count?: number | null
          visual_embedding?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      ai_programming_knowledge: {
        Row: {
          category: string | null
          collection: string | null
          created_at: string | null
          id: string | null
          source: string | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          collection?: never
          created_at?: string | null
          id?: string | null
          source?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          collection?: never
          created_at?: string | null
          id?: string | null
          source?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      framework_network: {
        Row: {
          description: string | null
          relationship_type: string | null
          source_category: string | null
          source_id: string | null
          source_name: string | null
          strength: number | null
          target_category: string | null
          target_id: string | null
          target_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "framework_relationships_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framework_relationships_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "optimization_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framework_relationships_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "framework_relationships_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "optimization_dashboard"
            referencedColumns: ["id"]
          },
        ]
      }
      framework_stats: {
        Row: {
          avg_importance: number | null
          category: string | null
          framework_count: number | null
          languages: string[] | null
          platforms: string[] | null
        }
        Relationships: []
      }
      mcp_context_analytics: {
        Row: {
          avg_access_count: number | null
          category: string | null
          created_date: string | null
          max_access_count: number | null
          total_entries: number | null
          unique_users: number | null
        }
        Relationships: []
      }
      mcp_error_trends: {
        Row: {
          avg_frequency: number | null
          error_category: string | null
          error_type: string | null
          last_occurrence: string | null
          occurrence_count: number | null
          programming_language: string | null
          resolved_count: number | null
          total_frequency: number | null
        }
        Relationships: []
      }
      mcp_pattern_effectiveness: {
        Row: {
          avg_success_rate: number | null
          avg_usage_count: number | null
          last_used: string | null
          pattern_count: number | null
          pattern_type: string | null
          programming_language: string | null
        }
        Relationships: []
      }
      memories_view: {
        Row: {
          content: string | null
          created_at: string | null
          embedding: string | null
          id: string | null
          metadata: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
      optimization_dashboard: {
        Row: {
          analysis_timestamp: string | null
          category: string | null
          cost_benefit_ratio: string | null
          id: string | null
          implementation_status: string | null
          importance: number | null
          improvement_percentage: number | null
          name: string | null
          optimization_count: number | null
          optimization_opportunities: string[] | null
          priority_score: string | null
          production_config: Json | null
        }
        Relationships: []
      }
    }
    Functions: {
      ai_explain_sql: {
        Args: { model?: string; sql_query: string }
        Returns: string
      }
      ai_generate_sql: {
        Args: { model?: string; prompt: string; temperature?: number }
        Returns: string
      }
      ai_optimize_sql: {
        Args: { model?: string; sql_query: string }
        Returns: string
      }
      algorithm_sign: {
        Args: { algorithm: string; secret: string; signables: string }
        Returns: string
      }
      archive_asset: {
        Args:
          | { archive_reason?: string; asset_id: string }
          | {
              p_archived_reason?: string
              p_asset_type: string
              p_file_size?: number
              p_original_path: string
              p_retention_days?: number
              p_storage_bucket: string
              p_storage_path: string
            }
        Returns: string
      }
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      cleanup_expired_context: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_old_context: {
        Args: { cleanup_user_id: string; days_old?: number }
        Returns: number
      }
      create_frameworks_table_if_not_exists: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_swift_docs_table: {
        Args: { sql: string }
        Returns: undefined
      }
      delete_secret: {
        Args: { secret_key: string }
        Returns: boolean
      }
      get_all_service_credentials: {
        Args: Record<PropertyKey, never>
        Returns: {
          credentials: Json
          service_name: string
        }[]
      }
      get_category_optimization_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          pending_implementations: number
          framework_count: number
          category: string
          avg_priority_score: number
          avg_cost_benefit_ratio: number
          total_optimizations: number
        }[]
      }
      get_context_stats: {
        Args: { search_user_id: string }
        Returns: {
          categories_breakdown: Json
          newest_entry: string
          oldest_entry: string
          total_content_size: number
          total_entries: number
        }[]
      }
      get_current_user_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_framework_dependencies: {
        Args: { framework_id: string }  
        Returns: {
          name: string
          id: string
          relationship_type: string
          strength: number
        }[]
      }
      get_framework_dependents: {
        Args: { framework_id: string }  
        Returns: {
          id: string
          name: string
          relationship_type: string
          strength: number
        }[]
      }
      get_memory_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          general_memories: number
          total_memories: number
          code_memories: number
          avg_relevance_score: number
        }[]
      }
      get_missing_credentials: {
        Args: Record<PropertyKey, never>
        Returns: {
          missing_services: string[]
        }[]
      }
      get_optimization_priorities: {
        Args: { limit_count?: number }
        Returns: {
          optimization_count: number
          framework_id: string
          framework_name: string
          category: string
          priority_score: number
          cost_benefit_ratio: number
          implementation_status: string
        }[]
      }
      get_programming_resources_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          languages: string[]
          resource_type: string
          count: number
        }[]
      }
      get_prp_templates: {
        Args: { template_category?: string }
        Returns: {
          name: string
          template_content: string
          description: string
          title: string
          id: string
          category: string
          version: number
          tags: string[]
          created_at: string
        }[]
      }
      get_recent_context: {
        Args: {
          result_limit?: number
          search_category?: string
          search_project_path?: string
          search_user_id: string
        }
        Returns: {
          metadata: Json
          project_path: string
          created_at: string
          updated_at: string
          user_id: string
          source: string
          category: string
          content: string
          id: string
        }[]
      }
      get_secret: {
        Args: { secret_key: string }
        Returns: string
      }
      get_service_credentials: {
        Args: { p_service_name: string }
        Returns: {
          credentials: Json
          service_name: string
        }[]
      }
      get_system_configurations: {
        Args: { config_type_filter?: string }
        Returns: {
          id: string
          config_type: string
          name: string
          category: string
          configuration: Json
          is_template: boolean
          created_at: string
        }[]
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      increment_context_access: {
        Args: { context_id: string }
        Returns: undefined
      }
      insert_secret: {
        Args: {
          secret_description?: string
          secret_name: string
          secret_value: string
        }
        Returns: string
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown }  
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown }  
        Returns: string
      }
      read_secret: {
        Args: { secret_name: string }
        Returns: {
          name: string
          value: string
          description: string
        }[]
      }
      search_code_memories: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_text: string
        }
        Returns: {
          id: string
          content: string
          metadata: Json
          similarity: number
        }[]
      }
      search_context_by_similarity: {
        Args: {
          category_filter?: string
          max_results?: number
          query_embedding: string
          similarity_threshold?: number
          user_id_filter?: string
        }
        Returns: {
          id: string
          content: string
          category: string
          similarity: number
          metadata: Json
          created_at: string
        }[]
      }
      search_context_hybrid: {
        Args: {
          result_limit?: number
          search_category?: string
          search_project_path?: string
          search_query: string
          search_user_id: string
        }
        Returns: {
          similarity_score: number
          metadata: Json
          project_path: string
          created_at: string
          updated_at: string
          user_id: string
          source: string
          category: string
          content: string
          id: string
        }[]
      }
      search_frameworks: {
        Args: { search_term: string }
        Returns: {
          relevance_score: number
          description: string
          id: string
          name: string
          category: string
        }[]
      }
      search_optimization_opportunities: {
        Args: { search_query: string }
        Returns: {
          category: string
          framework_id: string
          framework_name: string
          opportunity: string
          priority_score: number
        }[]
      }
      search_similar_images: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          id: string
          concept_name: string
          similarity: number
        }[]
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      set_secret: {
        Args: {
          secret_description?: string
          secret_key: string
          secret_service?: string
          secret_value: string
        }
        Returns: string
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      sign: {
        Args: { algorithm?: string; payload: Json; secret: string }
        Returns: string
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      try_cast_double: {
        Args: { inp: string }
        Returns: number
      }
      update_secret: {
        Args: {
          secret_description?: string
          secret_name: string
          secret_value: string
        }
        Returns: boolean
      }
      update_visual_concept: {
        Args: {
          concept_id: string
          increment_usage?: boolean
          new_embedding: string
        }
        Returns: boolean
      }
      url_decode: {
        Args: { data: string }
        Returns: string
      }
      url_encode: {
        Args: { data: string }
        Returns: string
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      verify: {
        Args: { algorithm?: string; secret: string; token: string }
        Returns: {
          payload: Json
          valid: boolean
          header: Json
        }[]
      }
      verify_schema_completeness: {
        Args: Record<PropertyKey, never>
        Returns: {
          details: Json
          status: string
          component: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

