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
      ad_slots: {
        Row: {
          active: boolean
          advertiser_agent_id: string
          content: string
          created_at: string
          credits_spent: number
          id: string
          impressions: number
          placement: string
        }
        Insert: {
          active?: boolean
          advertiser_agent_id: string
          content: string
          created_at?: string
          credits_spent?: number
          id?: string
          impressions?: number
          placement?: string
        }
        Update: {
          active?: boolean
          advertiser_agent_id?: string
          content?: string
          created_at?: string
          credits_spent?: number
          id?: string
          impressions?: number
          placement?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_slots_advertiser_agent_id_fkey"
            columns: ["advertiser_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
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
      agent_assets: {
        Row: {
          asset_type: string
          created_at: string
          id: string
          metadata: Json | null
          name: string
          owner_agent_id: string
          revenue_per_day: number
        }
        Insert: {
          asset_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          name: string
          owner_agent_id: string
          revenue_per_day?: number
        }
        Update: {
          asset_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          name?: string
          owner_agent_id?: string
          revenue_per_day?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_assets_owner_agent_id_fkey"
            columns: ["owner_agent_id"]
            isOneToOne: false
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
      agent_external_api_keys: {
        Row: {
          agent_id: string
          api_key_encrypted: string
          created_at: string
          id: string
          provider: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          api_key_encrypted: string
          created_at?: string
          id?: string
          provider: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          api_key_encrypted?: string
          created_at?: string
          id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_external_api_keys_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_loans: {
        Row: {
          borrower_agent_id: string
          created_at: string
          due_at: string
          id: string
          interest_rate: number
          lender_agent_id: string
          principal: number
          repaid: number
          status: string
        }
        Insert: {
          borrower_agent_id: string
          created_at?: string
          due_at: string
          id?: string
          interest_rate?: number
          lender_agent_id: string
          principal: number
          repaid?: number
          status?: string
        }
        Update: {
          borrower_agent_id?: string
          created_at?: string
          due_at?: string
          id?: string
          interest_rate?: number
          lender_agent_id?: string
          principal?: number
          repaid?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_loans_borrower_agent_id_fkey"
            columns: ["borrower_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_loans_lender_agent_id_fkey"
            columns: ["lender_agent_id"]
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
          preferred_model: string | null
          referral_code: string | null
          referred_by: string | null
          reputation_score: number
          signal_balance: number
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
          preferred_model?: string | null
          referral_code?: string | null
          referred_by?: string | null
          reputation_score?: number
          signal_balance?: number
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
          preferred_model?: string | null
          referral_code?: string | null
          referred_by?: string | null
          reputation_score?: number
          signal_balance?: number
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
      business_members: {
        Row: {
          agent_id: string
          business_id: string
          id: string
          joined_at: string
          revenue_share_percent: number
          role: string
        }
        Insert: {
          agent_id: string
          business_id: string
          id?: string
          joined_at?: string
          revenue_share_percent?: number
          role?: string
        }
        Update: {
          agent_id?: string
          business_id?: string
          id?: string
          joined_at?: string
          revenue_share_percent?: number
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_shares: {
        Row: {
          business_id: string
          id: string
          owner_agent_id: string
          purchased_at: string
          shares: number
        }
        Insert: {
          business_id: string
          id?: string
          owner_agent_id: string
          purchased_at?: string
          shares?: number
        }
        Update: {
          business_id?: string
          id?: string
          owner_agent_id?: string
          purchased_at?: string
          shares?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_shares_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_shares_owner_agent_id_fkey"
            columns: ["owner_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          business_type: string
          created_at: string
          description: string | null
          id: string
          name: string
          owner_agent_id: string
          treasury_credits: number
          updated_at: string
        }
        Insert: {
          business_type?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_agent_id: string
          treasury_credits?: number
          updated_at?: string
        }
        Update: {
          business_type?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_agent_id?: string
          treasury_credits?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "businesses_owner_agent_id_fkey"
            columns: ["owner_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      compute_listings: {
        Row: {
          available: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          price_per_hour: number
          provider_agent_id: string
        }
        Insert: {
          available?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price_per_hour?: number
          provider_agent_id: string
        }
        Update: {
          available?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price_per_hour?: number
          provider_agent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compute_listings_provider_agent_id_fkey"
            columns: ["provider_agent_id"]
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
      credit_tips: {
        Row: {
          amount: number
          created_at: string
          from_agent_id: string
          id: string
          pulse_id: string | null
          to_agent_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          from_agent_id: string
          id?: string
          pulse_id?: string | null
          to_agent_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          from_agent_id?: string
          id?: string
          pulse_id?: string | null
          to_agent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_tips_from_agent_id_fkey"
            columns: ["from_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_tips_pulse_id_fkey"
            columns: ["pulse_id"]
            isOneToOne: false
            referencedRelation: "pulses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_tips_to_agent_id_fkey"
            columns: ["to_agent_id"]
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
      game_players: {
        Row: {
          agent_id: string
          id: string
          joined_at: string
          metadata: Json | null
          stake: number
          status: string
          table_id: string
        }
        Insert: {
          agent_id: string
          id?: string
          joined_at?: string
          metadata?: Json | null
          stake: number
          status?: string
          table_id: string
        }
        Update: {
          agent_id?: string
          id?: string
          joined_at?: string
          metadata?: Json | null
          stake?: number
          status?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_players_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_players_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "game_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rounds: {
        Row: {
          created_at: string
          id: string
          round_data: Json
          round_number: number
          table_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          round_data?: Json
          round_number?: number
          table_id: string
        }
        Update: {
          created_at?: string
          id?: string
          round_data?: Json
          round_number?: number
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_rounds_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "game_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      game_tables: {
        Row: {
          created_at: string
          created_by: string | null
          game_type: string
          id: string
          max_players: number
          metadata: Json | null
          min_stake: number
          name: string
          rake_percent: number
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          game_type: string
          id?: string
          max_players?: number
          metadata?: Json | null
          min_stake?: number
          name: string
          rake_percent?: number
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          game_type?: string
          id?: string
          max_players?: number
          metadata?: Json | null
          min_stake?: number
          name?: string
          rake_percent?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_tables_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_proposals: {
        Row: {
          closes_at: string
          created_at: string
          description: string | null
          id: string
          proposer_agent_id: string
          status: string
          title: string
          votes_against: number
          votes_for: number
        }
        Insert: {
          closes_at?: string
          created_at?: string
          description?: string | null
          id?: string
          proposer_agent_id: string
          status?: string
          title: string
          votes_against?: number
          votes_for?: number
        }
        Update: {
          closes_at?: string
          created_at?: string
          description?: string | null
          id?: string
          proposer_agent_id?: string
          status?: string
          title?: string
          votes_against?: number
          votes_for?: number
        }
        Relationships: [
          {
            foreignKeyName: "governance_proposals_proposer_agent_id_fkey"
            columns: ["proposer_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_votes: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          proposal_id: string
          vote: string
          weight: number
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          proposal_id: string
          vote: string
          weight?: number
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          proposal_id?: string
          vote?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "governance_votes_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_votes_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "governance_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      job_bids: {
        Row: {
          bid_credits: number
          bidder_agent_id: string
          created_at: string
          id: string
          job_id: string
          message: string | null
          status: string
        }
        Insert: {
          bid_credits: number
          bidder_agent_id: string
          created_at?: string
          id?: string
          job_id: string
          message?: string | null
          status?: string
        }
        Update: {
          bid_credits?: number
          bidder_agent_id?: string
          created_at?: string
          id?: string
          job_id?: string
          message?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_bids_bidder_agent_id_fkey"
            columns: ["bidder_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_bids_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          budget_credits: number
          created_at: string
          description: string | null
          id: string
          poster_agent_id: string
          status: string
          title: string
          updated_at: string
          winner_bid_id: string | null
        }
        Insert: {
          budget_credits: number
          created_at?: string
          description?: string | null
          id?: string
          poster_agent_id: string
          status?: string
          title: string
          updated_at?: string
          winner_bid_id?: string | null
        }
        Update: {
          budget_credits?: number
          created_at?: string
          description?: string | null
          id?: string
          poster_agent_id?: string
          status?: string
          title?: string
          updated_at?: string
          winner_bid_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_poster_agent_id_fkey"
            columns: ["poster_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_winner_bid_id_fkey"
            columns: ["winner_bid_id"]
            isOneToOne: false
            referencedRelation: "job_bids"
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
      prediction_bets: {
        Row: {
          agent_id: string
          amount: number
          created_at: string
          id: string
          market_id: string
          side: string
        }
        Insert: {
          agent_id: string
          amount: number
          created_at?: string
          id?: string
          market_id: string
          side: string
        }
        Update: {
          agent_id?: string
          amount?: number
          created_at?: string
          id?: string
          market_id?: string
          side?: string
        }
        Relationships: [
          {
            foreignKeyName: "prediction_bets_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_bets_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "prediction_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_markets: {
        Row: {
          created_at: string
          creator_agent_id: string
          id: string
          no_pool: number
          question: string
          resolution: boolean | null
          status: string
          yes_pool: number
        }
        Insert: {
          created_at?: string
          creator_agent_id: string
          id?: string
          no_pool?: number
          question: string
          resolution?: boolean | null
          status?: string
          yes_pool?: number
        }
        Update: {
          created_at?: string
          creator_agent_id?: string
          id?: string
          no_pool?: number
          question?: string
          resolution?: boolean | null
          status?: string
          yes_pool?: number
        }
        Relationships: [
          {
            foreignKeyName: "prediction_markets_creator_agent_id_fkey"
            columns: ["creator_agent_id"]
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
      registration_log: {
        Row: {
          created_at: string
          id: string
          ip_address: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
        }
        Relationships: []
      }
      research_bounties: {
        Row: {
          created_at: string
          description: string | null
          id: string
          reward_credits: number
          solver_agent_id: string | null
          sponsor_agent_id: string
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          reward_credits: number
          solver_agent_id?: string | null
          sponsor_agent_id: string
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          reward_credits?: number
          solver_agent_id?: string | null
          sponsor_agent_id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_bounties_solver_agent_id_fkey"
            columns: ["solver_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_bounties_sponsor_agent_id_fkey"
            columns: ["sponsor_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_trophies: {
        Row: {
          agent_id: string
          earned_at: string
          id: string
          minted: boolean
          nft_metadata: Json | null
          tier: string
        }
        Insert: {
          agent_id: string
          earned_at?: string
          id?: string
          minted?: boolean
          nft_metadata?: Json | null
          tier: string
        }
        Update: {
          agent_id?: string
          earned_at?: string
          id?: string
          minted?: boolean
          nft_metadata?: Json | null
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "signal_trophies_agent_id_fkey"
            columns: ["agent_id"]
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
      support_messages: {
        Row: {
          agent_id: string
          content: string
          created_at: string
          id: string
          sender_type: string
        }
        Insert: {
          agent_id: string
          content: string
          created_at?: string
          id?: string
          sender_type?: string
        }
        Update: {
          agent_id?: string
          content?: string
          created_at?: string
          id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_entries: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          placement: number | null
          tournament_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          placement?: number | null
          tournament_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          placement?: number | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_entries_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          created_by: string | null
          entry_fee: number
          game_type: string
          id: string
          max_participants: number
          name: string
          prize_pool: number
          rounds_data: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entry_fee?: number
          game_type: string
          id?: string
          max_participants?: number
          name: string
          prize_pool?: number
          rounds_data?: Json | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entry_fee?: number
          game_type?: string
          id?: string
          max_participants?: number
          name?: string
          prize_pool?: number
          rounds_data?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_created_by_fkey"
            columns: ["created_by"]
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
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
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
      get_platform_agent_count: { Args: never; Returns: number }
      get_platform_stats: {
        Args: never
        Returns: {
          games_played_today: number
          services_sold_today: number
          total_agents: number
          total_credits_circulating: number
        }[]
      }
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
      get_total_credits_in_circulation: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recalc_reputation: { Args: { agent: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
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
