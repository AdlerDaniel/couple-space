// Generated from the Couple Space Supabase schema. Do not edit manually.
// Regenerate after every reviewed database migration.

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
      api_rate_limit_events: {
        Row: {
          created_at: string
          id: number
          identity_hash: string
          route: string
        }
        Insert: {
          created_at?: string
          id?: never
          identity_hash: string
          route: string
        }
        Update: {
          created_at?: string
          id?: never
          identity_hash?: string
          route?: string
        }
        Relationships: []
      }
      countdowns: {
        Row: {
          couple_id: string
          created_at: string
          created_by: string | null
          description: string | null
          icon: string
          id: string
          target_at: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          couple_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string
          id?: string
          target_at: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          couple_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string
          id?: string
          target_at?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "countdowns_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          attachments: Json
          body: string | null
          couple_id: string
          created_at: string
          deleted_for: string[]
          deleted_for_everyone: boolean
          edited_at: string | null
          id: string
          pinned_at: string | null
          reactions: Json
          read_at: string | null
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          attachments?: Json
          body?: string | null
          couple_id: string
          created_at?: string
          deleted_for?: string[]
          deleted_for_everyone?: boolean
          edited_at?: string | null
          id?: string
          pinned_at?: string | null
          reactions?: Json
          read_at?: string | null
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          attachments?: Json
          body?: string | null
          couple_id?: string
          created_at?: string
          deleted_for?: string[]
          deleted_for_everyone?: boolean
          edited_at?: string | null
          id?: string
          pinned_at?: string | null
          reactions?: Json
          read_at?: string | null
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "couple_chat_messages_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "couple_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_notifications: {
        Row: {
          actor_id: string
          body: string | null
          couple_id: string
          created_at: string
          href: string | null
          id: string
          read_at: string | null
          recipient_id: string
          title: string
          type: string
        }
        Insert: {
          actor_id: string
          body?: string | null
          couple_id: string
          created_at?: string
          href?: string | null
          id?: string
          read_at?: string | null
          recipient_id: string
          title: string
          type: string
        }
        Update: {
          actor_id?: string
          body?: string | null
          couple_id?: string
          created_at?: string
          href?: string | null
          id?: string
          read_at?: string | null
          recipient_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "couple_notifications_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_profiles: {
        Row: {
          avatar: string | null
          avatar_one: string | null
          avatar_two: string | null
          couple_id: string
          created_at: string
          id: string
          partner_one: string | null
          partner_two: string | null
          start_date: string | null
          status_one_emoji: string
          status_one_text: string | null
          status_two_emoji: string
          status_two_text: string | null
          status_updates_one: number
          status_updates_two: number
          time_zone: string
        }
        Insert: {
          avatar?: string | null
          avatar_one?: string | null
          avatar_two?: string | null
          couple_id: string
          created_at?: string
          id?: string
          partner_one?: string | null
          partner_two?: string | null
          start_date?: string | null
          status_one_emoji?: string
          status_one_text?: string | null
          status_two_emoji?: string
          status_two_text?: string | null
          status_updates_one?: number
          status_updates_two?: number
          time_zone?: string
        }
        Update: {
          avatar?: string | null
          avatar_one?: string | null
          avatar_two?: string | null
          couple_id?: string
          created_at?: string
          id?: string
          partner_one?: string | null
          partner_two?: string | null
          start_date?: string | null
          status_one_emoji?: string
          status_one_text?: string | null
          status_two_emoji?: string
          status_two_text?: string | null
          status_updates_one?: number
          status_updates_two?: number
          time_zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "couple_profiles_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: true
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      couples: {
        Row: {
          created_at: string
          id: string
          invite_code: string | null
          partner_one_id: string | null
          partner_two_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code?: string | null
          partner_one_id?: string | null
          partner_two_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string | null
          partner_one_id?: string | null
          partner_two_id?: string | null
        }
        Relationships: []
      }
      memories: {
        Row: {
          caption: string | null
          couple_id: string
          created_at: string
          event_date: string | null
          id: string
          image: string | null
          is_pinned: boolean
          reactions: Json
          text: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          caption?: string | null
          couple_id: string
          created_at?: string
          event_date?: string | null
          id?: string
          image?: string | null
          is_pinned?: boolean
          reactions?: Json
          text?: string | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          caption?: string | null
          couple_id?: string
          created_at?: string
          event_date?: string | null
          id?: string
          image?: string | null
          is_pinned?: boolean
          reactions?: Json
          text?: string | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memories_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_comments: {
        Row: {
          couple_id: string
          created_at: string
          id: string
          memory_id: string
          text: string
          user_id: string
        }
        Insert: {
          couple_id: string
          created_at?: string
          id?: string
          memory_id: string
          text: string
          user_id: string
        }
        Update: {
          couple_id?: string
          created_at?: string
          id?: string
          memory_id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_comments_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_comments_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "memories"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          disabled_at: string | null
          endpoint: string
          expiration_time: string | null
          id: string
          last_error: string | null
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          disabled_at?: string | null
          endpoint: string
          expiration_time?: string | null
          id?: string
          last_error?: string | null
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          disabled_at?: string | null
          endpoint?: string
          expiration_time?: string | null
          id?: string
          last_error?: string | null
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      question_answers: {
        Row: {
          answer_one: string | null
          answer_one_edited_at: string | null
          answer_one_likes: Json
          answer_one_photo_url: string | null
          answer_one_reactions: Json
          answer_one_voice_url: string | null
          answer_two: string | null
          answer_two_edited_at: string | null
          answer_two_likes: Json
          answer_two_photo_url: string | null
          answer_two_reactions: Json
          answer_two_voice_url: string | null
          couple_id: string
          created_at: string
          date: string
          favorite_answers: Json
          id: string
          question: string
        }
        Insert: {
          answer_one?: string | null
          answer_one_edited_at?: string | null
          answer_one_likes?: Json
          answer_one_photo_url?: string | null
          answer_one_reactions?: Json
          answer_one_voice_url?: string | null
          answer_two?: string | null
          answer_two_edited_at?: string | null
          answer_two_likes?: Json
          answer_two_photo_url?: string | null
          answer_two_reactions?: Json
          answer_two_voice_url?: string | null
          couple_id: string
          created_at?: string
          date: string
          favorite_answers?: Json
          id?: string
          question: string
        }
        Update: {
          answer_one?: string | null
          answer_one_edited_at?: string | null
          answer_one_likes?: Json
          answer_one_photo_url?: string | null
          answer_one_reactions?: Json
          answer_one_voice_url?: string | null
          answer_two?: string | null
          answer_two_edited_at?: string | null
          answer_two_likes?: Json
          answer_two_photo_url?: string | null
          answer_two_reactions?: Json
          answer_two_voice_url?: string | null
          couple_id?: string
          created_at?: string
          date?: string
          favorite_answers?: Json
          id?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_answers_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      question_comments: {
        Row: {
          attachment_mime_type: string | null
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          couple_id: string
          created_at: string
          id: string
          question_answer_id: string
          text: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attachment_mime_type?: string | null
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          couple_id: string
          created_at?: string
          id?: string
          question_answer_id: string
          text?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attachment_mime_type?: string | null
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          couple_id?: string
          created_at?: string
          id?: string
          question_answer_id?: string
          text?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_comments_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_comments_question_answer_id_fkey"
            columns: ["question_answer_id"]
            isOneToOne: false
            referencedRelation: "question_answers"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_answers: {
        Row: {
          answers: Json
          couple_id: string
          created_at: string
          id: string
          quiz_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          couple_id: string
          created_at?: string
          id?: string
          quiz_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          couple_id?: string
          created_at?: string
          id?: string
          quiz_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_comments: {
        Row: {
          couple_id: string
          created_at: string
          id: string
          quiz_id: string
          text: string
          user_id: string
        }
        Insert: {
          couple_id: string
          created_at?: string
          id?: string
          quiz_id: string
          text: string
          user_id: string
        }
        Update: {
          couple_id?: string
          created_at?: string
          id?: string
          quiz_id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_comments_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_categories: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          is_default: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_default?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_default?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      tracker_events: {
        Row: {
          category_id: string
          count: number
          couple_id: string
          created_at: string
          created_by: string
          date: string
          duration_minutes: number
          id: string
          mood: string
          note: string | null
          participants: string
          time: string | null
          updated_at: string
        }
        Insert: {
          category_id: string
          count?: number
          couple_id: string
          created_at?: string
          created_by: string
          date: string
          duration_minutes?: number
          id?: string
          mood?: string
          note?: string | null
          participants?: string
          time?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string
          count?: number
          couple_id?: string
          created_at?: string
          created_by?: string
          date?: string
          duration_minutes?: number
          id?: string
          mood?: string
          note?: string | null
          participants?: string
          time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tracker_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracker_events_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_goals: {
        Row: {
          category_id: string | null
          couple_id: string
          created_at: string
          created_by: string
          id: string
          period: string
          target_count: number
          title: string
        }
        Insert: {
          category_id?: string | null
          couple_id: string
          created_at?: string
          created_by: string
          id?: string
          period?: string
          target_count?: number
          title: string
        }
        Update: {
          category_id?: string | null
          couple_id?: string
          created_at?: string
          created_by?: string
          id?: string
          period?: string
          target_count?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_goals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tracker_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracker_goals_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_settings: {
        Row: {
          couple_id: string
          created_at: string
          id: string
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          couple_id: string
          created_at?: string
          id?: string
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          couple_id?: string
          created_at?: string
          id?: string
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notification_settings_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_items: {
        Row: {
          added_by: string
          content_type: string
          couple_id: string
          created_at: string
          external_url: string | null
          id: string
          is_watched: boolean
          poster_url: string | null
          title: string
          updated_at: string
          watched_at: string | null
        }
        Insert: {
          added_by: string
          content_type: string
          couple_id: string
          created_at?: string
          external_url?: string | null
          id?: string
          is_watched?: boolean
          poster_url?: string | null
          title: string
          updated_at?: string
          watched_at?: string | null
        }
        Update: {
          added_by?: string
          content_type?: string
          couple_id?: string
          created_at?: string
          external_url?: string | null
          id?: string
          is_watched?: boolean
          poster_url?: string | null
          title?: string
          updated_at?: string
          watched_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "watch_items_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_api_rate_limit: {
        Args: {
          p_identity_hash: string
          p_limit: number
          p_route: string
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          request_count: number
          retry_after_seconds: number
        }[]
      }
      create_couple_notification: {
        Args: {
          p_body?: string
          p_couple_id: string
          p_href?: string
          p_recipient_id: string
          p_title: string
          p_type: string
        }
        Returns: string
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
  public: {
    Enums: {},
  },
} as const
