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
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          role?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      agent_messages: {
        Row: {
          content: string
          created_at: string
          data: Json | null
          from_agent: string
          id: string
          role: string
          task_id: string | null
          to_agent: string | null
        }
        Insert: {
          content: string
          created_at?: string
          data?: Json | null
          from_agent: string
          id?: string
          role?: string
          task_id?: string | null
          to_agent?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          data?: Json | null
          from_agent?: string
          id?: string
          role?: string
          task_id?: string | null
          to_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          agent: string
          created_at: string
          duration_ms: number | null
          id: string
          input_tokens: number | null
          output_tokens: number | null
          status: string
          summary: string | null
          task_id: string | null
          tool_calls: Json | null
        }
        Insert: {
          agent: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          input_tokens?: number | null
          output_tokens?: number | null
          status: string
          summary?: string | null
          task_id?: string | null
          tool_calls?: Json | null
        }
        Update: {
          agent?: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          input_tokens?: number | null
          output_tokens?: number | null
          status?: string
          summary?: string | null
          task_id?: string | null
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tasks: {
        Row: {
          assignee: string | null
          claimed_at: string | null
          created_at: string
          created_by: string
          depends_on: string | null
          error: string | null
          finished_at: string | null
          id: string
          input: Json
          kind: string
          priority: number
          result: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          assignee?: string | null
          claimed_at?: string | null
          created_at?: string
          created_by?: string
          depends_on?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          kind: string
          priority?: number
          result?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          assignee?: string | null
          claimed_at?: string | null
          created_at?: string
          created_by?: string
          depends_on?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          kind?: string
          priority?: number
          result?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tasks_depends_on_fkey"
            columns: ["depends_on"]
            isOneToOne: false
            referencedRelation: "agent_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_envelopes: {
        Row: {
          allocation: number
          balance_cents: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          allocation?: number
          balance_cents?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          allocation?: number
          balance_cents?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      budget_ledger: {
        Row: {
          created_at: string
          delta_cents: number
          envelope: string
          id: string
          memo: string | null
          order_id: string | null
        }
        Insert: {
          created_at?: string
          delta_cents: number
          envelope: string
          id?: string
          memo?: string | null
          order_id?: string | null
        }
        Update: {
          created_at?: string
          delta_cents?: number
          envelope?: string
          id?: string
          memo?: string | null
          order_id?: string | null
        }
        Relationships: []
      }
      channel_publications: {
        Row: {
          channel: string
          created_at: string
          external_id: string | null
          id: string
          last_error: string | null
          payload: Json | null
          product_id: string
          published_at: string | null
          selected_media: Json
          status: string
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          external_id?: string | null
          id?: string
          last_error?: string | null
          payload?: Json | null
          product_id: string
          published_at?: string | null
          selected_media?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          external_id?: string | null
          id?: string
          last_error?: string | null
          payload?: Json | null
          product_id?: string
          published_at?: string | null
          selected_media?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_publications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_publications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      cj_webhook_events: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          payload: Json | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          payload?: Json | null
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          payload?: Json | null
          type?: string
        }
        Relationships: []
      }
      designs: {
        Row: {
          created_at: string
          created_by: string | null
          height: number | null
          id: string
          image_path: string | null
          image_url: string
          metadata: Json | null
          model: string | null
          prompt: string | null
          status: string
          title: string
          updated_at: string
          width: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          height?: number | null
          id?: string
          image_path?: string | null
          image_url: string
          metadata?: Json | null
          model?: string | null
          prompt?: string | null
          status?: string
          title?: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          height?: number | null
          id?: string
          image_path?: string | null
          image_url?: string
          metadata?: Json | null
          model?: string | null
          prompt?: string | null
          status?: string
          title?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          source?: string | null
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
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          email: string
          id: string
          metadata: Json | null
          name: string | null
          product_id: string | null
          provider: string | null
          provider_ref: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          currency?: string
          email: string
          id?: string
          metadata?: Json | null
          name?: string | null
          product_id?: string | null
          provider?: string | null
          provider_ref?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          email?: string
          id?: string
          metadata?: Json | null
          name?: string | null
          product_id?: string | null
          provider?: string | null
          provider_ref?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      page_events: {
        Row: {
          country: string | null
          created_at: string | null
          event_type: string
          id: string
          path: string
          product_id: string | null
          referrer: string | null
          session_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          path: string
          product_id?: string | null
          referrer?: string | null
          session_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          path?: string
          product_id?: string | null
          referrer?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          active: boolean
          category: string
          examples: string | null
          fee_rate: number
          key: string
          match_keywords: string[]
          min_profit_cents: number
          ship_addl_cents: number
          ship_first_cents: number
          target_margin: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          examples?: string | null
          fee_rate?: number
          key: string
          match_keywords?: string[]
          min_profit_cents?: number
          ship_addl_cents?: number
          ship_first_cents?: number
          target_margin?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          examples?: string | null
          fee_rate?: number
          key?: string
          match_keywords?: string[]
          min_profit_cents?: number
          ship_addl_cents?: number
          ship_first_cents?: number
          target_margin?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_media: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          is_transparent: boolean
          metadata: Json
          position: number
          product_id: string
          source: string
          url: string
          variant_key: string | null
          view_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          is_transparent?: boolean
          metadata?: Json
          position?: number
          product_id: string
          source?: string
          url: string
          variant_key?: string | null
          view_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          is_transparent?: boolean
          metadata?: Json
          position?: number
          product_id?: string
          source?: string
          url?: string
          variant_key?: string | null
          view_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          api_synced_at: string | null
          apliq_id: string | null
          buffer_qty: number
          category: string | null
          cost_cents: number | null
          created_at: string
          currency: string
          description: string | null
          display_order: number | null
          external_product_id: string | null
          fulfillment_type: string | null
          id: string
          image_urls: string[]
          is_archived: boolean | null
          is_published: boolean
          last_low_stock_alert_at: string | null
          low_stock_threshold: number
          price_cents: number
          price_cents_discounted: number | null
          printful_id: string | null
          raw_payload: Json | null
          shipping_cents: number | null
          slug: string
          source: string
          title: string
          updated_at: string
          variants: Json
        }
        Insert: {
          api_synced_at?: string | null
          apliq_id?: string | null
          buffer_qty?: number
          category?: string | null
          cost_cents?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          display_order?: number | null
          external_product_id?: string | null
          fulfillment_type?: string | null
          id?: string
          image_urls?: string[]
          is_archived?: boolean | null
          is_published?: boolean
          last_low_stock_alert_at?: string | null
          low_stock_threshold?: number
          price_cents?: number
          price_cents_discounted?: number | null
          printful_id?: string | null
          raw_payload?: Json | null
          shipping_cents?: number | null
          slug: string
          source?: string
          title: string
          updated_at?: string
          variants?: Json
        }
        Update: {
          api_synced_at?: string | null
          apliq_id?: string | null
          buffer_qty?: number
          category?: string | null
          cost_cents?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          display_order?: number | null
          external_product_id?: string | null
          fulfillment_type?: string | null
          id?: string
          image_urls?: string[]
          is_archived?: boolean | null
          is_published?: boolean
          last_low_stock_alert_at?: string | null
          low_stock_threshold?: number
          price_cents?: number
          price_cents_discounted?: number | null
          printful_id?: string | null
          raw_payload?: Json | null
          shipping_cents?: number | null
          slug?: string
          source?: string
          title?: string
          updated_at?: string
          variants?: Json
        }
        Relationships: []
      }
      site_config: {
        Row: {
          about_hat_angles: string[] | null
          about_shirt_flat: string | null
          about_shirt_folded: string | null
          about_shirt_logo: string | null
          about_shirt_model: string | null
          guarantee_days: string | null
          hero_cta: string | null
          hero_headline: string | null
          hero_subheadline: string | null
          id: string
          launch_pricing_active: boolean | null
          metadata: Json | null
          price_display: string | null
          price_original: string | null
          theme: string | null
          updated_at: string | null
        }
        Insert: {
          about_hat_angles?: string[] | null
          about_shirt_flat?: string | null
          about_shirt_folded?: string | null
          about_shirt_logo?: string | null
          about_shirt_model?: string | null
          guarantee_days?: string | null
          hero_cta?: string | null
          hero_headline?: string | null
          hero_subheadline?: string | null
          id: string
          launch_pricing_active?: boolean | null
          metadata?: Json | null
          price_display?: string | null
          price_original?: string | null
          theme?: string | null
          updated_at?: string | null
        }
        Update: {
          about_hat_angles?: string[] | null
          about_shirt_flat?: string | null
          about_shirt_folded?: string | null
          about_shirt_logo?: string | null
          about_shirt_model?: string | null
          guarantee_days?: string | null
          hero_cta?: string | null
          hero_headline?: string | null
          hero_subheadline?: string | null
          id?: string
          launch_pricing_active?: boolean | null
          metadata?: Json | null
          price_display?: string | null
          price_original?: string | null
          theme?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      studio_projects: {
        Row: {
          artboard_h: number | null
          artboard_w: number | null
          canvas: Json
          canvas_kind: string | null
          created_at: string
          created_by: string | null
          id: string
          manufacturer: string | null
          metadata: Json | null
          name: string
          price_cents: number | null
          print_area: Json | null
          source: string | null
          status: string
          template_image: string | null
          template_key: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          artboard_h?: number | null
          artboard_w?: number | null
          canvas?: Json
          canvas_kind?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          manufacturer?: string | null
          metadata?: Json | null
          name?: string
          price_cents?: number | null
          print_area?: Json | null
          source?: string | null
          status?: string
          template_image?: string | null
          template_key?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          artboard_h?: number | null
          artboard_w?: number | null
          canvas?: Json
          canvas_kind?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          manufacturer?: string | null
          metadata?: Json | null
          name?: string
          price_cents?: number | null
          print_area?: Json | null
          source?: string | null
          status?: string
          template_image?: string | null
          template_key?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      supplier_integrations: {
        Row: {
          created_at: string
          credentials: Json
          enabled: boolean
          id: string
          name: string
          notes: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credentials?: Json
          enabled?: boolean
          id?: string
          name: string
          notes?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credentials?: Json
          enabled?: boolean
          id?: string
          name?: string
          notes?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      tiktok_accounts: {
        Row: {
          access_expires_at: string
          access_token: string
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          open_id: string
          refresh_expires_at: string | null
          refresh_token: string
          scope: string | null
          union_id: string | null
          updated_at: string
        }
        Insert: {
          access_expires_at: string
          access_token: string
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          open_id: string
          refresh_expires_at?: string | null
          refresh_token: string
          scope?: string | null
          union_id?: string | null
          updated_at?: string
        }
        Update: {
          access_expires_at?: string
          access_token?: string
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          open_id?: string
          refresh_expires_at?: string | null
          refresh_token?: string
          scope?: string | null
          union_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tiktok_oauth_states: {
        Row: {
          code_verifier: string
          created_at: string
          state: string
        }
        Insert: {
          code_verifier: string
          created_at?: string
          state: string
        }
        Update: {
          code_verifier?: string
          created_at?: string
          state?: string
        }
        Relationships: []
      }
      tiktok_post_queue: {
        Row: {
          account_id: string | null
          approved_at: string | null
          caption: string
          created_at: string
          error: string | null
          id: string
          media_url: string
          posted_at: string | null
          privacy_level: string
          product_id: string | null
          publish_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          approved_at?: string | null
          caption?: string
          created_at?: string
          error?: string | null
          id?: string
          media_url: string
          posted_at?: string | null
          privacy_level?: string
          product_id?: string | null
          publish_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          approved_at?: string | null
          caption?: string
          created_at?: string
          error?: string | null
          id?: string
          media_url?: string
          posted_at?: string | null
          privacy_level?: string
          product_id?: string | null
          publish_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_post_queue_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "tiktok_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiktok_post_queue_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiktok_post_queue_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_posts: {
        Row: {
          created_at: string
          id: string
          media: Json
          post_mode: string
          post_type: string
          privacy: string
          product_id: string | null
          publish_id: string | null
          raw: Json | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          media?: Json
          post_mode?: string
          post_type: string
          privacy?: string
          product_id?: string | null
          publish_id?: string | null
          raw?: Json | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          media?: Json
          post_mode?: string
          post_type?: string
          privacy?: string
          product_id?: string | null
          publish_id?: string | null
          raw?: Json | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_posts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiktok_posts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
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
      products_public: {
        Row: {
          created_at: string | null
          currency: string | null
          description: string | null
          display_order: number | null
          id: string | null
          image_urls: string[] | null
          is_archived: boolean | null
          is_published: boolean | null
          price_cents: number | null
          price_cents_discounted: number | null
          slug: string | null
          source: string | null
          title: string | null
          updated_at: string | null
          variants: Json | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          display_order?: number | null
          id?: string | null
          image_urls?: string[] | null
          is_archived?: boolean | null
          is_published?: boolean | null
          price_cents?: number | null
          price_cents_discounted?: number | null
          slug?: string | null
          source?: string | null
          title?: string | null
          updated_at?: string | null
          variants?: never
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          display_order?: number | null
          id?: string | null
          image_urls?: string[] | null
          is_archived?: boolean | null
          is_published?: boolean | null
          price_cents?: number | null
          price_cents_discounted?: number | null
          slug?: string | null
          source?: string | null
          title?: string | null
          updated_at?: string | null
          variants?: never
        }
        Relationships: []
      }
    }
    Functions: {
      apply_inventory_buffer: {
        Args: { buffer: number; variants: Json }
        Returns: Json
      }
      delete_order: { Args: { order_id: string }; Returns: undefined }
      generate_tts_audio: { Args: { text_to_speak: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
