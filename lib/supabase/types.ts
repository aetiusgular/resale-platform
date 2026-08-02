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
    PostgrestVersion: "14.5"
  }
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
      buyer_strikes: {
        Row: {
          created_at: string
          id: string
          offer_id: string | null
          order_id: string | null
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          offer_id?: string | null
          order_id?: string | null
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          offer_id?: string | null
          order_id?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_strikes_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_strikes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_strikes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "buyer_strikes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_sessions: {
        Row: {
          buyer_fee_bps: number | null
          buyer_fee_cents: number
          buyer_id: string
          created_at: string
          expires_at: string
          item_cents: number
          listing_id: string
          seller_fee_bps: number | null
          seller_fee_cents: number
          seller_id: string
          shipping_cents: number
          stripe_payment_intent_id: string
          total_cents: number
        }
        Insert: {
          buyer_fee_bps?: number | null
          buyer_fee_cents: number
          buyer_id: string
          created_at?: string
          expires_at?: string
          item_cents: number
          listing_id: string
          seller_fee_bps?: number | null
          seller_fee_cents: number
          seller_id: string
          shipping_cents: number
          stripe_payment_intent_id: string
          total_cents: number
        }
        Update: {
          buyer_fee_bps?: number | null
          buyer_fee_cents?: number
          buyer_id?: string
          created_at?: string
          expires_at?: string
          item_cents?: number
          listing_id?: string
          seller_fee_bps?: number | null
          seller_fee_cents?: number
          seller_id?: string
          shipping_cents?: number
          stripe_payment_intent_id?: string
          total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "checkout_sessions_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "checkout_sessions_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "checkout_sessions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collusion_flags: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          order_id: string
          reasons: string[]
          resolved_at: string | null
          seller_id: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          order_id: string
          reasons?: string[]
          resolved_at?: string | null
          seller_id: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          order_id?: string
          reasons?: string[]
          resolved_at?: string | null
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collusion_flags_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "collusion_flags_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collusion_flags_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collusion_flags_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "collusion_flags_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_actions: {
        Row: {
          action: Database["public"]["Enums"]["comment_action_type"]
          actor_id: string
          comment_id: string
          created_at: string
          id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["comment_action_type"]
          actor_id: string
          comment_id: string
          created_at?: string
          id?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["comment_action_type"]
          actor_id?: string
          comment_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "comment_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_actions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          listing_id: string
          parent_id: string | null
          pinned: boolean
          redacted: boolean
          status: Database["public"]["Enums"]["comment_status"]
          thread_type: Database["public"]["Enums"]["thread_type"]
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          listing_id: string
          parent_id?: string | null
          pinned?: boolean
          redacted?: boolean
          status?: Database["public"]["Enums"]["comment_status"]
          thread_type: Database["public"]["Enums"]["thread_type"]
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          listing_id?: string
          parent_id?: string | null
          pinned?: boolean
          redacted?: boolean
          status?: Database["public"]["Enums"]["comment_status"]
          thread_type?: Database["public"]["Enums"]["thread_type"]
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          buyer_id: string
          comments_consent_buyer: boolean
          comments_consent_seller: boolean
          created_at: string
          id: string
          listing_id: string
          seller_id: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          comments_consent_buyer?: boolean
          comments_consent_seller?: boolean
          created_at?: string
          id?: string
          listing_id: string
          seller_id: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          comments_consent_buyer?: boolean
          comments_consent_seller?: boolean
          created_at?: string
          id?: string
          listing_id?: string
          seller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "conversations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "conversations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          buyer_id: string
          created_at: string
          description: string
          id: string
          order_id: string
          photos: string[]
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          buyer_id: string
          created_at?: string
          description: string
          id?: string
          order_id: string
          photos?: string[]
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          buyer_id?: string
          created_at?: string
          description?: string
          id?: string
          order_id?: string
          photos?: string[]
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disputes_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "disputes_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      image_hashes: {
        Row: {
          created_at: string
          hash: string
          id: string
          listing_id: string
          slot: string
        }
        Insert: {
          created_at?: string
          hash: string
          id?: string
          listing_id: string
          slot: string
        }
        Update: {
          created_at?: string
          hash?: string
          id?: string
          listing_id?: string
          slot?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_hashes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          claimed_at: string | null
          code: string
          created_at: string
          generated_by: string
          status: Database["public"]["Enums"]["invite_code_status"]
          used_by: string | null
        }
        Insert: {
          claimed_at?: string | null
          code: string
          created_at?: string
          generated_by: string
          status?: Database["public"]["Enums"]["invite_code_status"]
          used_by?: string | null
        }
        Update: {
          claimed_at?: string | null
          code?: string
          created_at?: string
          generated_by?: string
          status?: Database["public"]["Enums"]["invite_code_status"]
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invite_codes_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: true
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invite_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_flags: {
        Row: {
          created_at: string
          evidence: Json
          id: string
          listing_id: string
          type: string
        }
        Insert: {
          created_at?: string
          evidence?: Json
          id?: string
          listing_id: string
          type: string
        }
        Update: {
          created_at?: string
          evidence?: Json
          id?: string
          listing_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_flags_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          brand: string
          bumped_at: string | null
          bumped_price_cents: number | null
          category: string
          comments_enabled: boolean
          condition_notes: Json
          condition_score: number
          created_at: string
          department: string
          description: string
          id: string
          images: string[]
          is_price_dropped: boolean
          possession_photo_url: string
          price_cents: number
          rejection_reason: string | null
          saves_count: number
          search_vector: unknown
          seller_id: string
          size: string
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at: string
        }
        Insert: {
          brand: string
          bumped_at?: string | null
          bumped_price_cents?: number | null
          category: string
          comments_enabled?: boolean
          condition_notes?: Json
          condition_score: number
          created_at?: string
          department?: string
          description?: string
          id?: string
          images?: string[]
          is_price_dropped?: boolean
          possession_photo_url: string
          price_cents: number
          rejection_reason?: string | null
          saves_count?: number
          search_vector?: unknown
          seller_id: string
          size: string
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at?: string
        }
        Update: {
          brand?: string
          bumped_at?: string | null
          bumped_price_cents?: number | null
          category?: string
          comments_enabled?: boolean
          condition_notes?: Json
          condition_score?: number
          created_at?: string
          department?: string
          description?: string
          id?: string
          images?: string[]
          is_price_dropped?: boolean
          possession_photo_url?: string
          price_cents?: number
          rejection_reason?: string | null
          saves_count?: number
          search_vector?: unknown
          seller_id?: string
          size?: string
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          redacted: boolean
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          redacted?: boolean
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          redacted?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          evidence: Json
          id: string
          reason: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          evidence?: Json
          id?: string
          reason?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          evidence?: Json
          id?: string
          reason?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "moderation_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          email_messages: boolean
          email_offers: boolean
          email_orders: boolean
          push_messages: boolean
          push_offers: boolean
          push_orders: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email_messages?: boolean
          email_offers?: boolean
          email_orders?: boolean
          push_messages?: boolean
          push_offers?: boolean
          push_orders?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email_messages?: boolean
          email_offers?: boolean
          email_orders?: boolean
          push_messages?: boolean
          push_offers?: boolean
          push_orders?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json
          id: string
          read_at: string | null
          title: string
          type: string
          url: string | null
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          title: string
          type: string
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          accepted_at: string | null
          amount_cents: number
          conversation_id: string
          created_at: string
          expires_at: string
          from_user: string
          id: string
          listing_id: string
          state: Database["public"]["Enums"]["offer_state"]
        }
        Insert: {
          accepted_at?: string | null
          amount_cents: number
          conversation_id: string
          created_at?: string
          expires_at?: string
          from_user: string
          id?: string
          listing_id: string
          state?: Database["public"]["Enums"]["offer_state"]
        }
        Update: {
          accepted_at?: string | null
          amount_cents?: number
          conversation_id?: string
          created_at?: string
          expires_at?: string
          from_user?: string
          id?: string
          listing_id?: string
          state?: Database["public"]["Enums"]["offer_state"]
        }
        Relationships: [
          {
            foreignKeyName: "offers_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "offers_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          created_at: string
          from_state: Database["public"]["Enums"]["order_state"] | null
          id: string
          order_id: string
          payload: Json | null
          source: Database["public"]["Enums"]["event_source"]
          stripe_event_id: string | null
          to_state: Database["public"]["Enums"]["order_state"]
        }
        Insert: {
          created_at?: string
          from_state?: Database["public"]["Enums"]["order_state"] | null
          id?: string
          order_id: string
          payload?: Json | null
          source: Database["public"]["Enums"]["event_source"]
          stripe_event_id?: string | null
          to_state: Database["public"]["Enums"]["order_state"]
        }
        Update: {
          created_at?: string
          from_state?: Database["public"]["Enums"]["order_state"] | null
          id?: string
          order_id?: string
          payload?: Json | null
          source?: Database["public"]["Enums"]["event_source"]
          stripe_event_id?: string | null
          to_state?: Database["public"]["Enums"]["order_state"]
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_fee_bps: number | null
          buyer_fee_cents: number
          buyer_id: string
          cancelled_at: string | null
          carrier: string | null
          created_at: string
          delivered_at: string | null
          disputed_at: string | null
          id: string
          item_cents: number
          listing_id: string
          paid_at: string | null
          refunded_at: string | null
          released_at: string | null
          seller_confirmed_at: string | null
          seller_fee_bps: number | null
          seller_fee_cents: number
          seller_id: string
          shipped_at: string | null
          shipping_address: Json | null
          shipping_cents: number
          state: Database["public"]["Enums"]["order_state"]
          stripe_payment_intent_id: string
          stripe_transfer_id: string | null
          total_cents: number
          tracking_number: string | null
          transfer_cents: number
          transfer_hold_reason: string | null
          updated_at: string
        }
        Insert: {
          buyer_fee_bps?: number | null
          buyer_fee_cents: number
          buyer_id: string
          cancelled_at?: string | null
          carrier?: string | null
          created_at?: string
          delivered_at?: string | null
          disputed_at?: string | null
          id?: string
          item_cents: number
          listing_id: string
          paid_at?: string | null
          refunded_at?: string | null
          released_at?: string | null
          seller_confirmed_at?: string | null
          seller_fee_bps?: number | null
          seller_fee_cents: number
          seller_id: string
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cents: number
          state?: Database["public"]["Enums"]["order_state"]
          stripe_payment_intent_id: string
          stripe_transfer_id?: string | null
          total_cents: number
          tracking_number?: string | null
          transfer_cents: number
          transfer_hold_reason?: string | null
          updated_at?: string
        }
        Update: {
          buyer_fee_bps?: number | null
          buyer_fee_cents?: number
          buyer_id?: string
          cancelled_at?: string | null
          carrier?: string | null
          created_at?: string
          delivered_at?: string | null
          disputed_at?: string | null
          id?: string
          item_cents?: number
          listing_id?: string
          paid_at?: string | null
          refunded_at?: string | null
          released_at?: string | null
          seller_confirmed_at?: string | null
          seller_fee_bps?: number | null
          seller_fee_cents?: number
          seller_id?: string
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cents?: number
          state?: Database["public"]["Enums"]["order_state"]
          stripe_payment_intent_id?: string
          stripe_transfer_id?: string | null
          total_cents?: number
          tracking_number?: string | null
          transfer_cents?: number
          transfer_hold_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_identities: {
        Row: {
          billing_name: string | null
          billing_zip: string | null
          created_at: string
          fingerprint: string
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          billing_name?: string | null
          billing_zip?: string | null
          created_at?: string
          fingerprint: string
          id?: string
          kind: string
          user_id: string
        }
        Update: {
          billing_name?: string | null
          billing_zip?: string | null
          created_at?: string
          fingerprint?: string
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_identities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payment_identities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          changed_at: string
          id: string
          listing_id: string
          new_price_cents: number
          old_price_cents: number
        }
        Insert: {
          changed_at?: string
          id?: string
          listing_id: string
          new_price_cents: number
          old_price_cents: number
        }
        Update: {
          changed_at?: string
          id?: string
          listing_id?: string
          new_price_cents?: number
          old_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          banned: boolean
          banned_at: string | null
          banned_reason: string | null
          buyer_tier_locked_until: string | null
          checker_category: string | null
          created_at: string
          current_buyer_tier_bps: number | null
          current_seller_tier_bps: number | null
          id: string
          id_verification_status: Database["public"]["Enums"]["id_verification_status"]
          id_verified: boolean
          id_verified_at: string | null
          invited_by: string | null
          payouts_enabled: boolean
          persona_inquiry_id: string | null
          phone: string | null
          phone_verified_at: string | null
          quick_setup: Json | null
          role: string
          seller_tier_locked_until: string | null
          shipping_address: Json | null
          sizes: Json
          stripe_connect_account_id: string | null
          tier: Database["public"]["Enums"]["member_tier"]
          upheld_complaints: number
          username: string
          verified_checker: boolean
        }
        Insert: {
          banned?: boolean
          banned_at?: string | null
          banned_reason?: string | null
          buyer_tier_locked_until?: string | null
          checker_category?: string | null
          created_at?: string
          current_buyer_tier_bps?: number | null
          current_seller_tier_bps?: number | null
          id: string
          id_verification_status?: Database["public"]["Enums"]["id_verification_status"]
          id_verified?: boolean
          id_verified_at?: string | null
          invited_by?: string | null
          payouts_enabled?: boolean
          persona_inquiry_id?: string | null
          phone?: string | null
          phone_verified_at?: string | null
          quick_setup?: Json | null
          role?: string
          seller_tier_locked_until?: string | null
          shipping_address?: Json | null
          sizes?: Json
          stripe_connect_account_id?: string | null
          tier?: Database["public"]["Enums"]["member_tier"]
          upheld_complaints?: number
          username: string
          verified_checker?: boolean
        }
        Update: {
          banned?: boolean
          banned_at?: string | null
          banned_reason?: string | null
          buyer_tier_locked_until?: string | null
          checker_category?: string | null
          created_at?: string
          current_buyer_tier_bps?: number | null
          current_seller_tier_bps?: number | null
          id?: string
          id_verification_status?: Database["public"]["Enums"]["id_verification_status"]
          id_verified?: boolean
          id_verified_at?: string | null
          invited_by?: string | null
          payouts_enabled?: boolean
          persona_inquiry_id?: string | null
          phone?: string | null
          phone_verified_at?: string | null
          quick_setup?: Json | null
          role?: string
          seller_tier_locked_until?: string | null
          shipping_address?: Json | null
          sizes?: Json
          stripe_connect_account_id?: string | null
          tier?: Database["public"]["Enums"]["member_tier"]
          upheld_complaints?: number
          username?: string
          verified_checker?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profiles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string
          created_at: string
          direction: Database["public"]["Enums"]["review_direction"]
          id: string
          order_id: string
          reviewer_id: string
          stars: number
          subject_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          direction: Database["public"]["Enums"]["review_direction"]
          id?: string
          order_id: string
          reviewer_id: string
          stars: number
          subject_id: string
        }
        Update: {
          body?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["review_direction"]
          id?: string
          order_id?: string
          reviewer_id?: string
          stars?: number
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string
          id: string
          query: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          query?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          query?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "saved_searches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saves: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saves_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "buyer_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_events: {
        Row: {
          created_at: string
          event_id: string
          event_name: string | null
          id: string
          inquiry_id: string | null
          payload: Json
          provider: string
          reference_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          event_name?: string | null
          id?: string
          inquiry_id?: string | null
          payload?: Json
          provider?: string
          reference_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          event_name?: string | null
          id?: string
          inquiry_id?: string | null
          payload?: Json
          provider?: string
          reference_id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      buyer_stats: {
        Row: {
          dispute_count: number | null
          member_since: string | null
          pays_fast: boolean | null
          purchase_count: number | null
          strike_count: number | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_release_delivered_orders: { Args: never; Returns: undefined }
      check_and_auto_flag_comment: {
        Args: { p_comment_id: string }
        Returns: undefined
      }
      claim_invite_code:
        | { Args: { p_code: string }; Returns: Json }
        | { Args: { p_code: string; p_user_id: string }; Returns: Json }
      expire_and_void_offers: { Args: never; Returns: undefined }
      generate_member_codes: {
        Args: { p_count?: number; p_user_id: string }
        Returns: string[]
      }
      is_admin: { Args: never; Returns: boolean }
      post_comment: {
        Args: {
          p_body: string
          p_listing_id: string
          p_parent_id?: string
          p_redacted?: boolean
          p_thread_type: Database["public"]["Enums"]["thread_type"]
        }
        Returns: string
      }
      post_review: {
        Args: { p_body?: string; p_order_id: string; p_stars: number }
        Returns: string
      }
      record_moderation_action: {
        Args: {
          p_action: string
          p_evidence?: Json
          p_reason?: string
          p_target_id: string
          p_target_type: string
        }
        Returns: string
      }
      release_expired_checkouts: { Args: never; Returns: undefined }
      send_message: {
        Args: {
          p_body: string
          p_conversation_id: string
          p_redacted?: boolean
        }
        Returns: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          redacted: boolean
          sender_id: string
        }
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      toggle_listing_comments: {
        Args: { p_enabled: boolean; p_listing_id: string }
        Returns: undefined
      }
      transition_order: {
        Args: {
          p_order_id: string
          p_payload?: Json
          p_source: Database["public"]["Enums"]["event_source"]
          p_stripe_event?: string
          p_to_state: Database["public"]["Enums"]["order_state"]
        }
        Returns: undefined
      }
    }
    Enums: {
      comment_action_type: "agree" | "flag"
      comment_status: "visible" | "removed" | "flagged"
      event_source: "webhook" | "admin" | "cron" | "user"
      id_verification_status: "unverified" | "pending" | "verified"
      invite_code_status: "unused" | "claimed"
      listing_status:
        | "draft"
        | "pending_review"
        | "active"
        | "pending_escrow"
        | "sold"
        | "removed"
      member_tier: "bronze" | "silver" | "gold"
      offer_state:
        | "open"
        | "countered"
        | "accepted"
        | "declined"
        | "expired"
        | "voided"
      order_state:
        | "paid_held"
        | "seller_confirmed"
        | "shipped"
        | "delivered"
        | "released"
        | "disputed"
        | "refunded"
        | "cancelled"
      review_direction: "buyer_to_seller" | "seller_to_buyer"
      thread_type: "lc" | "general"
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
    Enums: {
      comment_action_type: ["agree", "flag"],
      comment_status: ["visible", "removed", "flagged"],
      event_source: ["webhook", "admin", "cron", "user"],
      id_verification_status: ["unverified", "pending", "verified"],
      invite_code_status: ["unused", "claimed"],
      listing_status: [
        "draft",
        "pending_review",
        "active",
        "pending_escrow",
        "sold",
        "removed",
      ],
      member_tier: ["bronze", "silver", "gold"],
      offer_state: [
        "open",
        "countered",
        "accepted",
        "declined",
        "expired",
        "voided",
      ],
      order_state: [
        "paid_held",
        "seller_confirmed",
        "shipped",
        "delivered",
        "released",
        "disputed",
        "refunded",
        "cancelled",
      ],
      review_direction: ["buyer_to_seller", "seller_to_buyer"],
      thread_type: ["lc", "general"],
    },
  },
} as const
