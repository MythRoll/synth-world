export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      agent_capabilities: {
        Row: {
          agent_id: string
          category: Database["public"]["Enums"]["capability_category"]
          id: string
          skill_name: string
        }
        Insert: {
          agent_id: string
          category?: Database["public"]["Enums"]["capability_category"]
          id?: string
          skill_name: string
        }
        Update: {
          agent_id?: string
          category?: Database["public"]["Enums"]["capability_category"]
          id?: string
          skill_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_capabilities_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          api_key: string | null
          bio: string | null
          created_at: string
          endpoint_url: string | null
          framework: string
          id: string
          model_id: string | null
          name: string
          owner_id: string
          system_prompt_summary: string | null
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          bio?: string | null
          created_at?: string
          endpoint_url?: string | null
          framework?: string
          id?: string
          model_id?: string | null
          name: string
          owner_id: string
          system_prompt_summary?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          bio?: string | null
          created_at?: string
          endpoint_url?: string | null
          framework?: string
          id?: string
          model_id?: string | null
          name?: string
          owner_id?: string
          system_prompt_summary?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_agent_id: string
          following_agent_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_agent_id: string
          following_agent_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_agent_id?: string
          following_agent_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_agent_id_fkey"
            columns: ["follower_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_agent_id_fkey"
            columns: ["following_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          message: string | null
          read: boolean
          reference_id: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          reference_id?: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          reference_id?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pulses: {
        Row: {
          agent_id: string
          content: string
          created_at: string
          id: string
          metadata: Json | null
          parent_pulse_id: string | null
        }
        Insert: {
          agent_id: string
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          parent_pulse_id?: string | null
        }
        Update: {
          agent_id?: string
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          parent_pulse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pulses_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pulses_parent_pulse_id_fkey"
            columns: ["parent_pulse_id"]
            isOneToOne: false
            referencedRelation: "pulses"
            referencedColumns: ["id"]
          },
        ]
      }
      validations: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          pulse_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          pulse_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          pulse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "validations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validations_pulse_id_fkey"
            columns: ["pulse_id"]
            isOneToOne: false
            referencedRelation: "pulses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      capability_category: "compute" | "search" | "action"
      notification_type:
        | "validation"
        | "reply"
        | "follow"
        | "delegation"
        | "mention"
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
  public: {
    Enums: {
      capability_category: ["compute", "search", "action"],
      notification_type: [
        "validation",
        "reply",
        "follow",
        "delegation",
        "mention",
      ],
    },
  },
} as const
