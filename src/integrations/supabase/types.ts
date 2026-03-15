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
      agent_api_keys: {
        Row: {
          agent_id: string
          api_key: string
          id: string
        }
        Insert: {
          agent_id: string
          api_key?: string
          id?: string
        }
        Update: {
          agent_id?: string
          api_key?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_api_keys_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
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
          bio: string | null
          created_at: string
          credit_balance: number
          endpoint_url: string | null
          flagged: boolean
          framework: string
          id: string
          is_moderator: boolean
          metadata: Json | null
          model_id: string | null
          name: string
          owner_id: string
          referral_code: string | null
          referred_by: string | null
          system_prompt_summary: string | null
          updated_at: string
          verified: boolean
        }
        Insert: {
          bio?: string | null
          created_at?: string
          credit_balance?: number
          endpoint_url?: string | null
          flagged?: boolean
          framework?: string
          id?: string
          is_moderator?: boolean
          metadata?: Json | null
          model_id?: string | null
          name: string
          owner_id: string
          referral_code?: string | null
          referred_by?: string | null
          system_prompt_summary?: string | null
          updated_at?: string
          verified?: boolean
        }
        Update: {
          bio?: string | null
          created_at?: string
          credit_balance?: number
          endpoint_url?: string | null
          flagged?: boolean
          framework?: string
          id?: string
          is_moderator?: boolean
          metadata?: Json | null
          model_id?: string | null
          name?: string
          owner_id?: string
          referral_code?: string | null
          referred_by?: string | null
          system_prompt_summary?: string | null
          updated_at?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "agents_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_cashouts: {
        Row: {
          agent_id: string
          created_at: string
          credits: number
          id: string
          payout_cents: number
          status: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          credits: number
          id?: string
          payout_cents: number
          status?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          credits?: number
          id?: string
          payout_cents?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_cashouts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_purchases: {
        Row: {
          agent_id: string
          amount_cents: number
          created_at: string
          credits: number
          id: string
          status: string
          stripe_session_id: string | null
        }
        Insert: {
          agent_id: string
          amount_cents: number
          created_at?: string
          credits: number
          id?: string
          status?: string
          stripe_session_id?: string | null
        }
        Update: {
          agent_id?: string
          amount_cents?: number
          created_at?: string
          credits?: number
          id?: string
          status?: string
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_purchases_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          buyer_agent_id: string
          created_at: string
          id: string
          listing_id: string
          platform_fee_credits: number
          seller_agent_id: string
          seller_credits: number
          total_credits: number
        }
        Insert: {
          buyer_agent_id: string
          created_at?: string
          id?: string
          listing_id: string
          platform_fee_credits: number
          seller_agent_id: string
          seller_credits: number
          total_credits: number
        }
        Update: {
          buyer_agent_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          platform_fee_credits?: number
          seller_agent_id?: string
          seller_credits?: number
          total_credits?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_buyer_agent_id_fkey"
            columns: ["buyer_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "skill_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_seller_agent_id_fkey"
            columns: ["seller_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read: boolean
          receiver_agent_id: string
          sender_agent_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read?: boolean
          receiver_agent_id: string
          sender_agent_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read?: boolean
          receiver_agent_id?: string
          sender_agent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_receiver_agent_id_fkey"
            columns: ["receiver_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_sender_agent_id_fkey"
            columns: ["sender_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
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
      listing_delivery: {
        Row: {
          delivery_instructions: string | null
          delivery_url: string | null
          id: string
          listing_id: string
        }
        Insert: {
          delivery_instructions?: string | null
          delivery_url?: string | null
          id?: string
          listing_id: string
        }
        Update: {
          delivery_instructions?: string | null
          delivery_url?: string | null
          id?: string
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_delivery_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "skill_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action: string
          created_at: string
          id: string
          moderator_agent_id: string
          reason: string | null
          target_agent_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          moderator_agent_id: string
          reason?: string | null
          target_agent_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          moderator_agent_id?: string
          reason?: string | null
          target_agent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_moderator_agent_id_fkey"
            columns: ["moderator_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_target_agent_id_fkey"
            columns: ["target_agent_id"]
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
      referrals: {
        Row: {
          created_at: string
          credits_earned: number
          id: string
          referred_agent_id: string
          referrer_agent_id: string
        }
        Insert: {
          created_at?: string
          credits_earned?: number
          id?: string
          referred_agent_id: string
          referrer_agent_id: string
        }
        Update: {
          created_at?: string
          credits_earned?: number
          id?: string
          referred_agent_id?: string
          referrer_agent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_agent_id_fkey"
            columns: ["referred_agent_id"]
            isOneToOne: true
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_agent_id_fkey"
            columns: ["referrer_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_listings: {
        Row: {
          active: boolean
          agent_id: string
          created_at: string
          currency: string
          description: string | null
          id: string
          listing_type: string
          price_cents: number
          skill_name: string
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          agent_id: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          listing_type?: string
          price_cents: number
          skill_name: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          agent_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          listing_type?: string
          price_cents?: number
          skill_name?: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_listings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount_cents: number
          buyer_agent_id: string
          created_at: string
          currency: string
          id: string
          listing_id: string
          platform_fee_cents: number
          seller_agent_id: string
          seller_amount_cents: number
          status: string
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount_cents: number
          buyer_agent_id: string
          created_at?: string
          currency?: string
          id?: string
          listing_id: string
          platform_fee_cents: number
          seller_agent_id: string
          seller_amount_cents: number
          status?: string
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount_cents?: number
          buyer_agent_id?: string
          created_at?: string
          currency?: string
          id?: string
          listing_id?: string
          platform_fee_cents?: number
          seller_agent_id?: string
          seller_amount_cents?: number
          status?: string
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_buyer_agent_id_fkey"
            columns: ["buyer_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "skill_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_seller_agent_id_fkey"
            columns: ["seller_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
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
      get_public_agent: {
        Args: { agent_id: string }
        Returns: {
          bio: string
          created_at: string
          endpoint_url: string
          flagged: boolean
          framework: string
          id: string
          is_moderator: boolean
          metadata: Json
          model_id: string
          name: string
          referral_code: string
          referred_by: string
          system_prompt_summary: string
          updated_at: string
          verified: boolean
        }[]
      }
      get_public_agents: {
        Args: never
        Returns: {
          bio: string
          created_at: string
          endpoint_url: string
          flagged: boolean
          framework: string
          id: string
          is_moderator: boolean
          metadata: Json
          model_id: string
          name: string
          referral_code: string
          referred_by: string
          system_prompt_summary: string
          updated_at: string
          verified: boolean
        }[]
      }
      get_public_agents_by_ids: {
        Args: { agent_ids: string[] }
        Returns: {
          bio: string
          created_at: string
          endpoint_url: string
          flagged: boolean
          framework: string
          id: string
          is_moderator: boolean
          metadata: Json
          model_id: string
          name: string
          referral_code: string
          referred_by: string
          system_prompt_summary: string
          updated_at: string
          verified: boolean
        }[]
      }
      get_referral_leaderboard: {
        Args: never
        Returns: {
          referral_count: number
          referrer_agent_id: string
        }[]
      }
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
