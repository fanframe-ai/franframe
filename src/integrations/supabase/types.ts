export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      consent_logs: {
        Row: {
          accepted_at: string
          consent_text: string
          consent_type: string
          id: string
          ip_address: string | null
          team_id: string | null
          user_agent: string | null
          user_id: string
        }
        ComputedFields: never
        Insert: {
          accepted_at?: string
          consent_text: string
          consent_type?: string
          id?: string
          ip_address?: string | null
          team_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          consent_text?: string
          consent_type?: string
          id?: string
          ip_address?: string | null
          team_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_logs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_stats: {
        Row: {
          avg_processing_time_ms: number | null
          created_at: string
          date: string
          failed_generations: number
          id: string
          successful_generations: number
          team_id: string | null
          total_generations: number
          unique_users: number
        }
        ComputedFields: never
        Insert: {
          avg_processing_time_ms?: number | null
          created_at?: string
          date: string
          failed_generations?: number
          id?: string
          successful_generations?: number
          team_id?: string | null
          total_generations?: number
          unique_users?: number
        }
        Update: {
          avg_processing_time_ms?: number | null
          created_at?: string
          date?: string
          failed_generations?: number
          id?: string
          successful_generations?: number
          team_id?: string | null
          total_generations?: number
          unique_users?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_stats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      fanframe_sessions: {
        Row: {
          expires_at: string
          external_user_id: string
          id: string
          team_id: string
          token_hash: string
        }
        ComputedFields: never
        Insert: {
          expires_at: string
          external_user_id: string
          id?: string
          team_id: string
          token_hash: string
        }
        Update: {
          expires_at?: string
          external_user_id?: string
          id?: string
          team_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "fanframe_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_actor_leases: {
        Row: {
          expires_at: string
          lease_id: string
          owner_id: string
          team_id: string
        }
        ComputedFields: never
        Insert: {
          expires_at: string
          lease_id: string
          owner_id: string
          team_id: string
        }
        Update: {
          expires_at?: string
          lease_id?: string
          owner_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_actor_leases_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_control_audit: {
        Row: {
          actor: string | null
          created_at: string | null
          id: number
          scope: string | null
          settings: Json | null
        }
        ComputedFields: never
        Insert: {
          actor?: string | null
          created_at?: string | null
          id?: never
          scope?: string | null
          settings?: Json | null
        }
        Update: {
          actor?: string | null
          created_at?: string | null
          id?: never
          scope?: string | null
          settings?: Json | null
        }
        Relationships: []
      }
      generation_controls: {
        Row: {
          admissions_paused: boolean
          cooldown_until: string | null
          daily_budget_cents: number
          dispatch_paused: boolean
          event_budget_cents: number
          margin_percent: number
          max_active: number
          max_waiting: number
          scope: string
          starts_per_minute: number
          updated_at: string
          worker_seen_at: string | null
        }
        ComputedFields: never
        Insert: {
          admissions_paused?: boolean
          cooldown_until?: string | null
          daily_budget_cents?: number
          dispatch_paused?: boolean
          event_budget_cents?: number
          margin_percent?: number
          max_active?: number
          max_waiting?: number
          scope?: string
          starts_per_minute?: number
          updated_at?: string
          worker_seen_at?: string | null
        }
        Update: {
          admissions_paused?: boolean
          cooldown_until?: string | null
          daily_budget_cents?: number
          dispatch_paused?: boolean
          event_budget_cents?: number
          margin_percent?: number
          max_active?: number
          max_waiting?: number
          scope?: string
          starts_per_minute?: number
          updated_at?: string
          worker_seen_at?: string | null
        }
        Relationships: []
      }
      generation_queue: {
        Row: {
          attempts: number
          background_asset_url: string
          billing_completed: boolean
          completed_at: string | null
          cost_cents: number
          cost_state: string
          created_at: string | null
          credit_reserved: boolean
          error_message: string | null
          id: string
          last_event_at: string | null
          lease_id: string | null
          lease_until: string | null
          next_attempt_at: string
          output_url: string | null
          owner_id: string | null
          parameters: Json | null
          replicate_prediction_id: string | null
          request_hash: string | null
          result_image_url: string | null
          result_storage_path: string | null
          shirt_asset_url: string
          shirt_id: string
          started_at: string | null
          status: string
          submitted_at: string | null
          team_id: string | null
          test_link_id: string | null
          user_id: string | null
          user_image_url: string
          webhook_signing_key: string | null
          work_stage: string
        }
        ComputedFields: never
        Insert: {
          attempts?: number
          background_asset_url: string
          billing_completed?: boolean
          completed_at?: string | null
          cost_cents?: number
          cost_state?: string
          created_at?: string | null
          credit_reserved?: boolean
          error_message?: string | null
          id?: string
          last_event_at?: string | null
          lease_id?: string | null
          lease_until?: string | null
          next_attempt_at?: string
          output_url?: string | null
          owner_id?: string | null
          parameters?: Json | null
          replicate_prediction_id?: string | null
          request_hash?: string | null
          result_image_url?: string | null
          result_storage_path?: string | null
          shirt_asset_url: string
          shirt_id: string
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          team_id?: string | null
          test_link_id?: string | null
          user_id?: string | null
          user_image_url: string
          webhook_signing_key?: string | null
          work_stage?: string
        }
        Update: {
          attempts?: number
          background_asset_url?: string
          billing_completed?: boolean
          completed_at?: string | null
          cost_cents?: number
          cost_state?: string
          created_at?: string | null
          credit_reserved?: boolean
          error_message?: string | null
          id?: string
          last_event_at?: string | null
          lease_id?: string | null
          lease_until?: string | null
          next_attempt_at?: string
          output_url?: string | null
          owner_id?: string | null
          parameters?: Json | null
          replicate_prediction_id?: string | null
          request_hash?: string | null
          result_image_url?: string | null
          result_storage_path?: string | null
          shirt_asset_url?: string
          shirt_id?: string
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          team_id?: string | null
          test_link_id?: string | null
          user_id?: string | null
          user_image_url?: string
          webhook_signing_key?: string | null
          work_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_queue_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_queue_test_link_id_fkey"
            columns: ["test_link_id"]
            isOneToOne: false
            referencedRelation: "test_links"
            referencedColumns: ["id"]
          },
        ]
      }
      generations: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          external_user_id: string | null
          id: string
          processing_time_ms: number | null
          shirt_id: string
          status: Database["public"]["Enums"]["generation_status"]
          team_id: string | null
        }
        ComputedFields: never
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          external_user_id?: string | null
          id?: string
          processing_time_ms?: number | null
          shirt_id: string
          status?: Database["public"]["Enums"]["generation_status"]
          team_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          external_user_id?: string | null
          id?: string
          processing_time_ms?: number | null
          shirt_id?: string
          status?: Database["public"]["Enums"]["generation_status"]
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      health_checks: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          response_time_ms: number | null
          service_id: string
          service_name: string
          status: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          response_time_ms?: number | null
          service_id: string
          service_name: string
          status: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          response_time_ms?: number | null
          service_id?: string
          service_name?: string
          status?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          count: number
          created_at: string
          id: string
          user_id: string
          window_start: string
        }
        ComputedFields: never
        Insert: {
          action?: string
          count?: number
          created_at?: string
          id?: string
          user_id: string
          window_start?: string
        }
        Update: {
          action?: string
          count?: number
          created_at?: string
          id?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      system_alerts: {
        Row: {
          created_at: string
          id: string
          message: string
          notification_lease_until: string | null
          notified_at: string | null
          operation_key: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          team_id: string | null
          type: Database["public"]["Enums"]["alert_type"]
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          message: string
          notification_lease_until?: string | null
          notified_at?: string | null
          operation_key?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          team_id?: string | null
          type: Database["public"]["Enums"]["alert_type"]
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          notification_lease_until?: string | null
          notified_at?: string | null
          operation_key?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          team_id?: string | null
          type?: Database["public"]["Enums"]["alert_type"]
        }
        Relationships: [
          {
            foreignKeyName: "system_alerts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      team_secrets: {
        Row: {
          replicate_api_token: string | null
          team_id: string
        }
        ComputedFields: never
        Insert: {
          replicate_api_token?: string | null
          team_id: string
        }
        Update: {
          replicate_api_token?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_secrets_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          backgrounds: NonNullable<Json>
          created_at: string | null
          generation_prompt: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          primary_color: string | null
          purchase_urls: NonNullable<Json>
          secondary_color: string | null
          shirts: NonNullable<Json>
          slug: string
          subdomain: string
          text_overrides: Json | null
          tutorial_assets: Json | null
          updated_at: string | null
          watermark_url: string | null
          wordpress_api_base: string | null
        }
        ComputedFields: never
        Insert: {
          backgrounds?: NonNullable<Json>
          created_at?: string | null
          generation_prompt?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          primary_color?: string | null
          purchase_urls?: NonNullable<Json>
          secondary_color?: string | null
          shirts?: NonNullable<Json>
          slug: string
          subdomain: string
          text_overrides?: Json | null
          tutorial_assets?: Json | null
          updated_at?: string | null
          watermark_url?: string | null
          wordpress_api_base?: string | null
        }
        Update: {
          backgrounds?: NonNullable<Json>
          created_at?: string | null
          generation_prompt?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          purchase_urls?: NonNullable<Json>
          secondary_color?: string | null
          shirts?: NonNullable<Json>
          slug?: string
          subdomain?: string
          text_overrides?: Json | null
          tutorial_assets?: Json | null
          updated_at?: string | null
          watermark_url?: string | null
          wordpress_api_base?: string | null
        }
        Relationships: []
      }
      test_links: {
        Row: {
          created_at: string
          created_by: string | null
          credits_total: number
          credits_used: number
          expires_at: string | null
          id: string
          is_active: boolean
          label: string
          team_id: string
          token: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          credits_total?: number
          credits_used?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string
          team_id: string
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credits_total?: number
          credits_used?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string
          team_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_links_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      health_check_stats: {
        Row: {
          avg_response_time: number | null
          last_check: string | null
          operational_checks: number | null
          service_id: string | null
          service_name: string | null
          total_checks: number | null
          uptime_percentage: number | null
        }
        ComputedFields: never
        Relationships: []
      }
    }
    Functions: {
      acquire_generation_actor: {
        Args: { p_lease: string; p_owner: string; p_team: string }
        Returns: boolean
      }
      admin_generation_stats: {
        Args: { p_start: string; p_team?: string }
        Returns: Json
      }
      claim_generation_alert: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      claim_generation_work: { Args: Record<PropertyKey, never>; Returns: Json }
      cleanup_old_health_checks: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_rate_limits: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      configure_generation_controls: {
        Args: { p_scope: string; p_settings: Json }
        Returns: undefined
      }
      confirm_generation_payment: { Args: { p_id: string }; Returns: undefined }
      dearmor: { Args: { "": string }; Returns: string }
      fail_generation: {
        Args: { p_error: string; p_id: string }
        Returns: undefined
      }
      finish_generation: {
        Args: { p_id: string; p_path: string }
        Returns: undefined
      }
      gen_random_uuid: { Args: Record<PropertyKey, never>; Returns: string }
      gen_salt: { Args: { "": string }; Returns: string }
      generation_operations: { Args: { p_team?: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      install_generation_schedule: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      mark_generation_ready: {
        Args: { p_id: string; p_parameters: Json; p_path: string }
        Returns: boolean
      }
      monitor_generation_operations: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      pgp_armor_headers: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      record_generation_event: {
        Args: {
          p_id: string
          p_output?: string
          p_prediction: string
          p_status: string
        }
        Returns: undefined
      }
      release_generation_actor: {
        Args: { p_lease: string; p_owner: string; p_team: string }
        Returns: undefined
      }
      reserve_generation: {
        Args: {
          p_background_url: string
          p_balance: number
          p_consent: string
          p_hash: string
          p_id: string
          p_owner: string
          p_shirt: string
          p_shirt_url: string
          p_team: string
          p_test_link: string
        }
        Returns: Json
      }
      update_generation_work: {
        Args: {
          p_action: string
          p_delay?: number
          p_id: string
          p_lease: string
          p_value?: string
        }
        Returns: boolean
      }
    }
    Enums: {
      alert_severity: "info" | "warning" | "critical"
      alert_type: "error_spike" | "slow_processing" | "high_usage" | "api_error"
      app_role: "admin" | "super_admin"
      generation_status: "pending" | "processing" | "completed" | "failed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      alert_severity: ["info", "warning", "critical"],
      alert_type: ["error_spike", "slow_processing", "high_usage", "api_error"],
      app_role: ["admin", "super_admin"],
      generation_status: ["pending", "processing", "completed", "failed"],
    },
  },
} as const
