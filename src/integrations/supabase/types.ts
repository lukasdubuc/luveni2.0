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
      products: {
        Row: {
          api_synced_at: string | null
          apliq_id: string | null
          created_at: string
          currency: string
          description: string | null
          display_order: number | null
          fulfillment_type: string | null
          id: string
          image_urls: string[]
          is_archived: boolean | null
          is_published: boolean
          price_cents: number
          price_cents_discounted: number | null
          printful_id: string | null
          slug: string
          title: string
          updated_at: string
          variants: Json
        }
        Insert: {
          api_synced_at?: string | null
          apliq_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          display_order?: number | null
          fulfillment_type?: string | null
          id?: string
          image_urls?: string[]
          is_archived?: boolean | null
          is_published?: boolean
          price_cents?: number
          price_cents_discounted?: number | null
          printful_id?: string | null
          slug: string
          title: string
          updated_at?: string
          variants?: Json
        }
        Update: {
          api_synced_at?: string | null
          apliq_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          display_order?: number | null
          fulfillment_type?: string | null
          id?: string
          image_urls?: string[]
          is_archived?: boolean | null
          is_published?: boolean
          price_cents?: number
          price_cents_discounted?: number | null
          printful_id?: string | null
          slug?: string
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
          title?: string | null
          updated_at?: string | null
          variants?: Json | null
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
          title?: string | null
          updated_at?: string | null
          variants?: Json | null
        }
        Relationships: []
      }
    }
    Functions: {
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
