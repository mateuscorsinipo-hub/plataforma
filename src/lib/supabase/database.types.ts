export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      achievements: {
        Row: {
          category: string;
          code: string;
          created_at: string;
          description: string;
          icon: string;
          id: string;
          is_active: boolean;
          metric: string;
          sort_order: number;
          threshold: number;
          title: string;
          updated_at: string;
          xp_reward: number;
        };
        ComputedFields: never;
        Insert: {
          category?: string;
          code: string;
          created_at?: string;
          description: string;
          icon?: string;
          id?: string;
          is_active?: boolean;
          metric: string;
          sort_order?: number;
          threshold: number;
          title: string;
          updated_at?: string;
          xp_reward?: number;
        };
        Update: {
          category?: string;
          code?: string;
          created_at?: string;
          description?: string;
          icon?: string;
          id?: string;
          is_active?: boolean;
          metric?: string;
          sort_order?: number;
          threshold?: number;
          title?: string;
          updated_at?: string;
          xp_reward?: number;
        };
        Relationships: [];
      };
      admin_audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: NonNullable<Json>;
          id: number;
          target_id: string | null;
          target_type: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          id?: never;
          target_id?: string | null;
          target_type: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          id?: never;
          target_id?: string | null;
          target_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_conversation_sources: {
        Row: {
          conversation_id: string;
          created_at: string;
          file_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          conversation_id: string;
          created_at?: string;
          file_id: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          created_at?: string;
          file_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_conversation_sources_conversation_id_user_id_fkey";
            columns: ["conversation_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "ai_conversations";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "ai_conversation_sources_file_id_user_id_fkey";
            columns: ["file_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "uploaded_files";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      ai_conversations: {
        Row: {
          created_at: string;
          folder_id: string | null;
          id: string;
          last_message_at: string;
          subject_id: string | null;
          summary: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          folder_id?: string | null;
          id?: string;
          last_message_at?: string;
          subject_id?: string | null;
          summary?: string | null;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          folder_id?: string | null;
          id?: string;
          last_message_at?: string;
          subject_id?: string | null;
          summary?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_conversations_folder_id_user_id_fkey";
            columns: ["folder_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "ai_conversations_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_conversations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_conversations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_generation_sources: {
        Row: {
          file_id: string;
          generation_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          file_id: string;
          generation_id: string;
          user_id: string;
        };
        Update: {
          file_id?: string;
          generation_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_generation_sources_file_id_user_id_fkey";
            columns: ["file_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "uploaded_files";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "ai_generation_sources_generation_id_user_id_fkey";
            columns: ["generation_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "ai_generations";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      ai_generations: {
        Row: {
          content: Json | null;
          content_markdown: string | null;
          created_at: string;
          error_message: string | null;
          folder_id: string | null;
          id: string;
          input_tokens: number | null;
          kind: Database["public"]["Enums"]["generation_kind"];
          model: string | null;
          output_tokens: number | null;
          params: NonNullable<Json>;
          source_chars: number | null;
          status: Database["public"]["Enums"]["generation_status"];
          subject_id: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          content?: Json | null;
          content_markdown?: string | null;
          created_at?: string;
          error_message?: string | null;
          folder_id?: string | null;
          id?: string;
          input_tokens?: number | null;
          kind: Database["public"]["Enums"]["generation_kind"];
          model?: string | null;
          output_tokens?: number | null;
          params?: NonNullable<Json>;
          source_chars?: number | null;
          status?: Database["public"]["Enums"]["generation_status"];
          subject_id?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          content?: Json | null;
          content_markdown?: string | null;
          created_at?: string;
          error_message?: string | null;
          folder_id?: string | null;
          id?: string;
          input_tokens?: number | null;
          kind?: Database["public"]["Enums"]["generation_kind"];
          model?: string | null;
          output_tokens?: number | null;
          params?: NonNullable<Json>;
          source_chars?: number | null;
          status?: Database["public"]["Enums"]["generation_status"];
          subject_id?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_generations_folder_id_user_id_fkey";
            columns: ["folder_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "ai_generations_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_generations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_generations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_messages: {
        Row: {
          attachments: NonNullable<Json>;
          citations: NonNullable<Json>;
          content: string;
          conversation_id: string;
          created_at: string;
          error_code: string | null;
          id: string;
          input_tokens: number | null;
          model: string | null;
          output_tokens: number | null;
          role: string;
          status: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          attachments?: NonNullable<Json>;
          citations?: NonNullable<Json>;
          content: string;
          conversation_id: string;
          created_at?: string;
          error_code?: string | null;
          id?: string;
          input_tokens?: number | null;
          model?: string | null;
          output_tokens?: number | null;
          role: string;
          status?: string;
          user_id: string;
        };
        Update: {
          attachments?: NonNullable<Json>;
          citations?: NonNullable<Json>;
          content?: string;
          conversation_id?: string;
          created_at?: string;
          error_code?: string | null;
          id?: string;
          input_tokens?: number | null;
          model?: string | null;
          output_tokens?: number | null;
          role?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_user_id_fkey";
            columns: ["conversation_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "ai_conversations";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      app_settings: {
        Row: {
          description: string | null;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          description?: string | null;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: NonNullable<Json>;
        };
        Update: {
          description?: string | null;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: NonNullable<Json>;
        };
        Relationships: [];
      };
      billing_customers: {
        Row: {
          created_at: string;
          provider: string;
          provider_customer_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          provider: string;
          provider_customer_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          provider?: string;
          provider_customer_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_customers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_customers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_events: {
        Row: {
          created_at: string;
          error: string | null;
          id: string;
          object_id: string | null;
          processed_at: string | null;
          provider: string;
          type: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          error?: string | null;
          id: string;
          object_id?: string | null;
          processed_at?: string | null;
          provider: string;
          type: string;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          id?: string;
          object_id?: string | null;
          processed_at?: string | null;
          provider?: string;
          type?: string;
        };
        Relationships: [];
      };
      calendar_events: {
        Row: {
          all_day: boolean;
          created_at: string;
          description: string | null;
          ends_at: string;
          event_type: string;
          id: string;
          location: string | null;
          plan_id: string | null;
          recurrence: string;
          recurrence_until: string | null;
          recurrence_weekdays: number[] | null;
          reminder_minutes: number | null;
          starts_at: string;
          subject_id: string | null;
          timezone: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          all_day?: boolean;
          created_at?: string;
          description?: string | null;
          ends_at: string;
          event_type?: string;
          id?: string;
          location?: string | null;
          plan_id?: string | null;
          recurrence?: string;
          recurrence_until?: string | null;
          recurrence_weekdays?: number[] | null;
          reminder_minutes?: number | null;
          starts_at: string;
          subject_id?: string | null;
          timezone?: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          all_day?: boolean;
          created_at?: string;
          description?: string | null;
          ends_at?: string;
          event_type?: string;
          id?: string;
          location?: string | null;
          plan_id?: string | null;
          recurrence?: string;
          recurrence_until?: string | null;
          recurrence_weekdays?: number[] | null;
          reminder_minutes?: number | null;
          starts_at?: string;
          subject_id?: string | null;
          timezone?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_events_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "study_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calendar_events_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calendar_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calendar_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_messages: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          message: string;
          name: string;
          reference_url: string | null;
          status: string;
          topic: string;
          updated_at: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          message: string;
          name: string;
          reference_url?: string | null;
          status?: string;
          topic: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          message?: string;
          name?: string;
          reference_url?: string | null;
          status?: string;
          topic?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contact_messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      document_chunks: {
        Row: {
          chunk_index: number;
          content: string;
          created_at: string;
          file_id: string;
          id: string;
          page_end: number | null;
          page_start: number | null;
          search_vector: unknown;
          token_estimate: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          chunk_index: number;
          content: string;
          created_at?: string;
          file_id: string;
          id?: string;
          page_end?: number | null;
          page_start?: number | null;
          search_vector?: never;
          token_estimate: number;
          user_id: string;
        };
        Update: {
          chunk_index?: number;
          content?: string;
          created_at?: string;
          file_id?: string;
          id?: string;
          page_end?: number | null;
          page_start?: number | null;
          search_vector?: never;
          token_estimate?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_chunks_file_id_user_id_fkey";
            columns: ["file_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "uploaded_files";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      flashcard_decks: {
        Row: {
          cards_count: number;
          created_at: string;
          description: string | null;
          folder_id: string | null;
          id: string;
          source_generation_id: string | null;
          source_material_id: string | null;
          subject_id: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          cards_count?: number;
          created_at?: string;
          description?: string | null;
          folder_id?: string | null;
          id?: string;
          source_generation_id?: string | null;
          source_material_id?: string | null;
          subject_id?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cards_count?: number;
          created_at?: string;
          description?: string | null;
          folder_id?: string | null;
          id?: string;
          source_generation_id?: string | null;
          source_material_id?: string | null;
          subject_id?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "flashcard_decks_folder_id_user_id_fkey";
            columns: ["folder_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "flashcard_decks_source_generation_id_fkey";
            columns: ["source_generation_id"];
            isOneToOne: false;
            referencedRelation: "ai_generations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "flashcard_decks_source_material_id_fkey";
            columns: ["source_material_id"];
            isOneToOne: false;
            referencedRelation: "study_materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "flashcard_decks_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "flashcard_decks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "flashcard_decks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      flashcard_reviews: {
        Row: {
          card_id: string;
          difficulty_after: number | null;
          due_before: string | null;
          duration_ms: number | null;
          elapsed_days: number | null;
          id: string;
          rating: number;
          reviewed_at: string;
          scheduled_days: number | null;
          stability_after: number | null;
          state_before: Database["public"]["Enums"]["card_state"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          card_id: string;
          difficulty_after?: number | null;
          due_before?: string | null;
          duration_ms?: number | null;
          elapsed_days?: number | null;
          id?: string;
          rating: number;
          reviewed_at?: string;
          scheduled_days?: number | null;
          stability_after?: number | null;
          state_before: Database["public"]["Enums"]["card_state"];
          user_id: string;
        };
        Update: {
          card_id?: string;
          difficulty_after?: number | null;
          due_before?: string | null;
          duration_ms?: number | null;
          elapsed_days?: number | null;
          id?: string;
          rating?: number;
          reviewed_at?: string;
          scheduled_days?: number | null;
          stability_after?: number | null;
          state_before?: Database["public"]["Enums"]["card_state"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "flashcard_reviews_card_id_user_id_fkey";
            columns: ["card_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "flashcards";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      flashcards: {
        Row: {
          back: string;
          created_at: string;
          deck_id: string;
          difficulty: number;
          due_at: string;
          elapsed_days: number;
          explanation: string | null;
          front: string;
          id: string;
          lapses: number;
          last_review_at: string | null;
          learning_steps: number;
          reps: number;
          scheduled_days: number;
          source_ref: string | null;
          stability: number;
          state: Database["public"]["Enums"]["card_state"];
          suspended: boolean;
          tags: string[];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          back: string;
          created_at?: string;
          deck_id: string;
          difficulty?: number;
          due_at?: string;
          elapsed_days?: number;
          explanation?: string | null;
          front: string;
          id?: string;
          lapses?: number;
          last_review_at?: string | null;
          learning_steps?: number;
          reps?: number;
          scheduled_days?: number;
          source_ref?: string | null;
          stability?: number;
          state?: Database["public"]["Enums"]["card_state"];
          suspended?: boolean;
          tags?: string[];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          back?: string;
          created_at?: string;
          deck_id?: string;
          difficulty?: number;
          due_at?: string;
          elapsed_days?: number;
          explanation?: string | null;
          front?: string;
          id?: string;
          lapses?: number;
          last_review_at?: string | null;
          learning_steps?: number;
          reps?: number;
          scheduled_days?: number;
          source_ref?: string | null;
          stability?: number;
          state?: Database["public"]["Enums"]["card_state"];
          suspended?: boolean;
          tags?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "flashcards_deck_id_user_id_fkey";
            columns: ["deck_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "flashcard_decks";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      focus_timers: {
        Row: {
          started_at: string;
          subject_id: string | null;
          task_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          started_at?: string;
          subject_id?: string | null;
          task_id?: string | null;
          user_id: string;
        };
        Update: {
          started_at?: string;
          subject_id?: string | null;
          task_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "focus_timers_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "focus_timers_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "study_plan_tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "focus_timers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "focus_timers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      folders: {
        Row: {
          color: string;
          created_at: string;
          exam_date: string | null;
          id: string;
          name: string;
          subject_id: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          color?: string;
          created_at?: string;
          exam_date?: string | null;
          id?: string;
          name: string;
          subject_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          exam_date?: string | null;
          id?: string;
          name?: string;
          subject_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "folders_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "folders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "folders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      guardian_consents: {
        Row: {
          created_at: string;
          decided_at: string | null;
          expires_at: string;
          guardian_email: string;
          guardian_name: string;
          id: string;
          requested_at: string;
          status: Database["public"]["Enums"]["consent_status"];
          token_hash: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          decided_at?: string | null;
          expires_at: string;
          guardian_email: string;
          guardian_name: string;
          id?: string;
          requested_at?: string;
          status?: Database["public"]["Enums"]["consent_status"];
          token_hash: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          decided_at?: string | null;
          expires_at?: string;
          guardian_email?: string;
          guardian_name?: string;
          id?: string;
          requested_at?: string;
          status?: Database["public"]["Enums"]["consent_status"];
          token_hash?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guardian_consents_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guardian_consents_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      leaderboard_entries: {
        Row: {
          league: string;
          updated_at: string;
          user_id: string;
          week_start: string;
          xp: number;
        };
        ComputedFields: never;
        Insert: {
          league: string;
          updated_at?: string;
          user_id: string;
          week_start: string;
          xp?: number;
        };
        Update: {
          league?: string;
          updated_at?: string;
          user_id?: string;
          week_start?: string;
          xp?: number;
        };
        Relationships: [
          {
            foreignKeyName: "leaderboard_entries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leaderboard_entries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      league_rollovers: {
        Row: {
          changed: number;
          processed_at: string;
          week_start: string;
        };
        ComputedFields: never;
        Insert: {
          changed?: number;
          processed_at?: string;
          week_start: string;
        };
        Update: {
          changed?: number;
          processed_at?: string;
          week_start?: string;
        };
        Relationships: [];
      };
      material_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          event: string;
          from_status: Database["public"]["Enums"]["material_status"] | null;
          id: number;
          material_id: string;
          note: string | null;
          to_status: Database["public"]["Enums"]["material_status"];
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          event: string;
          from_status?: Database["public"]["Enums"]["material_status"] | null;
          id?: never;
          material_id: string;
          note?: string | null;
          to_status: Database["public"]["Enums"]["material_status"];
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          event?: string;
          from_status?: Database["public"]["Enums"]["material_status"] | null;
          id?: never;
          material_id?: string;
          note?: string | null;
          to_status?: Database["public"]["Enums"]["material_status"];
        };
        Relationships: [
          {
            foreignKeyName: "material_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "material_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "material_events_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "study_materials";
            referencedColumns: ["id"];
          },
        ];
      };
      material_ratings: {
        Row: {
          created_at: string;
          material_id: string;
          updated_at: string;
          user_id: string;
          value: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          material_id: string;
          updated_at?: string;
          user_id: string;
          value: number;
        };
        Update: {
          created_at?: string;
          material_id?: string;
          updated_at?: string;
          user_id?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "material_ratings_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "study_materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "material_ratings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "material_ratings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      material_reports: {
        Row: {
          created_at: string;
          details: string | null;
          id: string;
          material_id: string;
          reason: Database["public"]["Enums"]["report_reason"];
          reporter_id: string | null;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database["public"]["Enums"]["report_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          details?: string | null;
          id?: string;
          material_id: string;
          reason: Database["public"]["Enums"]["report_reason"];
          reporter_id?: string | null;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          details?: string | null;
          id?: string;
          material_id?: string;
          reason?: Database["public"]["Enums"]["report_reason"];
          reporter_id?: string | null;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "material_reports_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "study_materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "material_reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "material_reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "material_reports_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "material_reports_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      material_saves: {
        Row: {
          created_at: string;
          folder_id: string | null;
          kind: string;
          material_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          folder_id?: string | null;
          kind: string;
          material_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          folder_id?: string | null;
          kind?: string;
          material_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "material_saves_folder_id_user_id_fkey";
            columns: ["folder_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "material_saves_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "study_materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "material_saves_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "material_saves_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      material_views: {
        Row: {
          created_at: string;
          material_id: string;
          viewed_on: string;
          viewer_id: string | null;
          viewer_key: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          material_id: string;
          viewed_on?: string;
          viewer_id?: string | null;
          viewer_key: string;
        };
        Update: {
          created_at?: string;
          material_id?: string;
          viewed_on?: string;
          viewer_id?: string | null;
          viewer_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "material_views_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "study_materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "material_views_viewer_id_fkey";
            columns: ["viewer_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "material_views_viewer_id_fkey";
            columns: ["viewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          link: string | null;
          read_at: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          read_at?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          read_at?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"];
          avatar_url: string | null;
          bio: string | null;
          birth_date: string | null;
          created_at: string;
          display_name: string;
          grade_year: number | null;
          id: string;
          onboarding_completed_at: string | null;
          privacy_accepted_at: string | null;
          profile_visibility: string;
          school_stage: Database["public"]["Enums"]["school_stage"] | null;
          show_achievements_publicly: boolean;
          show_in_leaderboard: boolean;
          show_stats_publicly: boolean;
          terms_accepted_at: string | null;
          updated_at: string;
          username: string;
        };
        ComputedFields: never;
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"];
          avatar_url?: string | null;
          bio?: string | null;
          birth_date?: string | null;
          created_at?: string;
          display_name?: string;
          grade_year?: number | null;
          id: string;
          onboarding_completed_at?: string | null;
          privacy_accepted_at?: string | null;
          profile_visibility?: string;
          school_stage?: Database["public"]["Enums"]["school_stage"] | null;
          show_achievements_publicly?: boolean;
          show_in_leaderboard?: boolean;
          show_stats_publicly?: boolean;
          terms_accepted_at?: string | null;
          updated_at?: string;
          username: string;
        };
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"];
          avatar_url?: string | null;
          bio?: string | null;
          birth_date?: string | null;
          created_at?: string;
          display_name?: string;
          grade_year?: number | null;
          id?: string;
          onboarding_completed_at?: string | null;
          privacy_accepted_at?: string | null;
          profile_visibility?: string;
          school_stage?: Database["public"]["Enums"]["school_stage"] | null;
          show_achievements_publicly?: boolean;
          show_in_leaderboard?: boolean;
          show_stats_publicly?: boolean;
          terms_accepted_at?: string | null;
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
      quiz_answers: {
        Row: {
          answer_text: string | null;
          answered_at: string;
          attempt_id: string;
          feedback: Json | null;
          id: string;
          is_correct: boolean | null;
          question_id: string;
          score: number | null;
          selected_option_id: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          answer_text?: string | null;
          answered_at?: string;
          attempt_id: string;
          feedback?: Json | null;
          id?: string;
          is_correct?: boolean | null;
          question_id: string;
          score?: number | null;
          selected_option_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          answer_text?: string | null;
          answered_at?: string;
          attempt_id?: string;
          feedback?: Json | null;
          id?: string;
          is_correct?: boolean | null;
          question_id?: string;
          score?: number | null;
          selected_option_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_answers_attempt_id_user_id_fkey";
            columns: ["attempt_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "quiz_attempts";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "quiz_answers_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "quiz_questions";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_attempts: {
        Row: {
          correct_count: number | null;
          created_at: string;
          current_position: number;
          deadline_at: string | null;
          duration_seconds: number | null;
          flagged_question_ids: string[];
          graded_at: string | null;
          id: string;
          max_score: number | null;
          quiz_id: string;
          score: number | null;
          started_at: string;
          status: Database["public"]["Enums"]["attempt_status"];
          submitted_at: string | null;
          total_count: number | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          correct_count?: number | null;
          created_at?: string;
          current_position?: number;
          deadline_at?: string | null;
          duration_seconds?: number | null;
          flagged_question_ids?: string[];
          graded_at?: string | null;
          id?: string;
          max_score?: number | null;
          quiz_id: string;
          score?: number | null;
          started_at?: string;
          status?: Database["public"]["Enums"]["attempt_status"];
          submitted_at?: string | null;
          total_count?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          correct_count?: number | null;
          created_at?: string;
          current_position?: number;
          deadline_at?: string | null;
          duration_seconds?: number | null;
          flagged_question_ids?: string[];
          graded_at?: string | null;
          id?: string;
          max_score?: number | null;
          quiz_id?: string;
          score?: number | null;
          started_at?: string;
          status?: Database["public"]["Enums"]["attempt_status"];
          submitted_at?: string | null;
          total_count?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_user_id_fkey";
            columns: ["quiz_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "quizzes";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      quiz_questions: {
        Row: {
          correct_option_id: string | null;
          created_at: string;
          explanation: string | null;
          id: string;
          options: NonNullable<Json>;
          points: number;
          position: number;
          prompt: string;
          quiz_id: string;
          reference_answer: string | null;
          subject_id: string | null;
          topic: string | null;
          type: Database["public"]["Enums"]["question_type"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          correct_option_id?: string | null;
          created_at?: string;
          explanation?: string | null;
          id?: string;
          options?: NonNullable<Json>;
          points?: number;
          position: number;
          prompt: string;
          quiz_id: string;
          reference_answer?: string | null;
          subject_id?: string | null;
          topic?: string | null;
          type: Database["public"]["Enums"]["question_type"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          correct_option_id?: string | null;
          created_at?: string;
          explanation?: string | null;
          id?: string;
          options?: NonNullable<Json>;
          points?: number;
          position?: number;
          prompt?: string;
          quiz_id?: string;
          reference_answer?: string | null;
          subject_id?: string | null;
          topic?: string | null;
          type?: Database["public"]["Enums"]["question_type"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_user_id_fkey";
            columns: ["quiz_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "quizzes";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "quiz_questions_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      quizzes: {
        Row: {
          created_at: string;
          description: string | null;
          difficulty: Database["public"]["Enums"]["difficulty"];
          duration_minutes: number | null;
          exam_type: string | null;
          folder_id: string | null;
          id: string;
          kind: Database["public"]["Enums"]["quiz_kind"];
          questions_count: number;
          source_generation_id: string | null;
          subject_id: string | null;
          title: string;
          topic: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          difficulty?: Database["public"]["Enums"]["difficulty"];
          duration_minutes?: number | null;
          exam_type?: string | null;
          folder_id?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["quiz_kind"];
          questions_count?: number;
          source_generation_id?: string | null;
          subject_id?: string | null;
          title: string;
          topic?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          difficulty?: Database["public"]["Enums"]["difficulty"];
          duration_minutes?: number | null;
          exam_type?: string | null;
          folder_id?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["quiz_kind"];
          questions_count?: number;
          source_generation_id?: string | null;
          subject_id?: string | null;
          title?: string;
          topic?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quizzes_folder_id_user_id_fkey";
            columns: ["folder_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "quizzes_source_generation_id_fkey";
            columns: ["source_generation_id"];
            isOneToOne: false;
            referencedRelation: "ai_generations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quizzes_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quizzes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quizzes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limits: {
        Row: {
          count: number;
          key: string;
          window_start: string;
        };
        ComputedFields: never;
        Insert: {
          count?: number;
          key: string;
          window_start: string;
        };
        Update: {
          count?: number;
          key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      reminder_deliveries: {
        Row: {
          channel: string;
          event_id: string;
          occurrence_at: string;
          sent_at: string;
        };
        ComputedFields: never;
        Insert: {
          channel: string;
          event_id: string;
          occurrence_at: string;
          sent_at?: string;
        };
        Update: {
          channel?: string;
          event_id?: string;
          occurrence_at?: string;
          sent_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminder_deliveries_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "calendar_events";
            referencedColumns: ["id"];
          },
        ];
      };
      study_materials: {
        Row: {
          author_id: string;
          content: string;
          copyright_declared_at: string | null;
          created_at: string;
          description: string;
          favorites_count: number;
          file_id: string | null;
          grade_year: number | null;
          id: string;
          material_type: Database["public"]["Enums"]["material_type"];
          moderation_note: string | null;
          published_at: string | null;
          rating_count: number;
          rating_sum: number;
          saves_count: number;
          school_stage: Database["public"]["Enums"]["school_stage"] | null;
          search_vector: unknown;
          slug: string;
          status: Database["public"]["Enums"]["material_status"];
          subject_id: string;
          tags: string[];
          title: string;
          topic: string | null;
          updated_at: string;
          views_count: number;
          visibility: Database["public"]["Enums"]["visibility"];
        };
        ComputedFields: never;
        Insert: {
          author_id: string;
          content?: string;
          copyright_declared_at?: string | null;
          created_at?: string;
          description?: string;
          favorites_count?: number;
          file_id?: string | null;
          grade_year?: number | null;
          id?: string;
          material_type?: Database["public"]["Enums"]["material_type"];
          moderation_note?: string | null;
          published_at?: string | null;
          rating_count?: number;
          rating_sum?: number;
          saves_count?: number;
          school_stage?: Database["public"]["Enums"]["school_stage"] | null;
          search_vector?: unknown;
          slug: string;
          status?: Database["public"]["Enums"]["material_status"];
          subject_id: string;
          tags?: string[];
          title: string;
          topic?: string | null;
          updated_at?: string;
          views_count?: number;
          visibility?: Database["public"]["Enums"]["visibility"];
        };
        Update: {
          author_id?: string;
          content?: string;
          copyright_declared_at?: string | null;
          created_at?: string;
          description?: string;
          favorites_count?: number;
          file_id?: string | null;
          grade_year?: number | null;
          id?: string;
          material_type?: Database["public"]["Enums"]["material_type"];
          moderation_note?: string | null;
          published_at?: string | null;
          rating_count?: number;
          rating_sum?: number;
          saves_count?: number;
          school_stage?: Database["public"]["Enums"]["school_stage"] | null;
          search_vector?: unknown;
          slug?: string;
          status?: Database["public"]["Enums"]["material_status"];
          subject_id?: string;
          tags?: string[];
          title?: string;
          topic?: string | null;
          updated_at?: string;
          views_count?: number;
          visibility?: Database["public"]["Enums"]["visibility"];
        };
        Relationships: [
          {
            foreignKeyName: "study_materials_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "study_materials_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "study_materials_file_id_fkey";
            columns: ["file_id"];
            isOneToOne: false;
            referencedRelation: "uploaded_files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "study_materials_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      study_plan_tasks: {
        Row: {
          completed_at: string | null;
          created_at: string;
          description: string | null;
          estimated_minutes: number;
          id: string;
          link_id: string | null;
          link_type: string | null;
          original_date: string | null;
          plan_id: string;
          position: number;
          priority: number;
          scheduled_date: string;
          status: Database["public"]["Enums"]["task_status"];
          subject_id: string | null;
          task_type: Database["public"]["Enums"]["task_type"];
          title: string;
          topic: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          estimated_minutes: number;
          id?: string;
          link_id?: string | null;
          link_type?: string | null;
          original_date?: string | null;
          plan_id: string;
          position?: number;
          priority?: number;
          scheduled_date: string;
          status?: Database["public"]["Enums"]["task_status"];
          subject_id?: string | null;
          task_type: Database["public"]["Enums"]["task_type"];
          title: string;
          topic?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          estimated_minutes?: number;
          id?: string;
          link_id?: string | null;
          link_type?: string | null;
          original_date?: string | null;
          plan_id?: string;
          position?: number;
          priority?: number;
          scheduled_date?: string;
          status?: Database["public"]["Enums"]["task_status"];
          subject_id?: string | null;
          task_type?: Database["public"]["Enums"]["task_type"];
          title?: string;
          topic?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "study_plan_tasks_plan_id_user_id_fkey";
            columns: ["plan_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "study_plans";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "study_plan_tasks_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      study_plans: {
        Row: {
          created_at: string;
          daily_minutes: number;
          exam_date: string;
          exam_type: string;
          generator_version: number;
          goal: string | null;
          id: string;
          last_adapted_at: string | null;
          level: string;
          start_date: string;
          status: Database["public"]["Enums"]["plan_status"];
          target: string | null;
          title: string;
          topics: NonNullable<Json>;
          updated_at: string;
          user_id: string;
          weekdays: number[];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          daily_minutes: number;
          exam_date: string;
          exam_type?: string;
          generator_version?: number;
          goal?: string | null;
          id?: string;
          last_adapted_at?: string | null;
          level?: string;
          start_date: string;
          status?: Database["public"]["Enums"]["plan_status"];
          target?: string | null;
          title: string;
          topics?: NonNullable<Json>;
          updated_at?: string;
          user_id: string;
          weekdays: number[];
        };
        Update: {
          created_at?: string;
          daily_minutes?: number;
          exam_date?: string;
          exam_type?: string;
          generator_version?: number;
          goal?: string | null;
          id?: string;
          last_adapted_at?: string | null;
          level?: string;
          start_date?: string;
          status?: Database["public"]["Enums"]["plan_status"];
          target?: string | null;
          title?: string;
          topics?: NonNullable<Json>;
          updated_at?: string;
          user_id?: string;
          weekdays?: number[];
        };
        Relationships: [
          {
            foreignKeyName: "study_plans_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "study_plans_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      study_sessions: {
        Row: {
          activity_type: string;
          created_at: string;
          duration_seconds: number;
          ended_at: string;
          id: string;
          local_date: string;
          source_id: string | null;
          started_at: string;
          subject_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          activity_type: string;
          created_at?: string;
          duration_seconds: number;
          ended_at: string;
          id?: string;
          local_date: string;
          source_id?: string | null;
          started_at: string;
          subject_id?: string | null;
          user_id: string;
        };
        Update: {
          activity_type?: string;
          created_at?: string;
          duration_seconds?: number;
          ended_at?: string;
          id?: string;
          local_date?: string;
          source_id?: string | null;
          started_at?: string;
          subject_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "study_sessions_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "study_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "study_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      subjects: {
        Row: {
          color: string;
          created_at: string;
          icon: string;
          id: string;
          is_active: boolean;
          kind: string;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          color?: string;
          created_at?: string;
          icon?: string;
          id?: string;
          is_active?: boolean;
          kind?: string;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          icon?: string;
          id?: string;
          is_active?: boolean;
          kind?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          canceled_at: string | null;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          id: string;
          plan_id: string;
          provider: string;
          provider_subscription_id: string | null;
          status: Database["public"]["Enums"]["subscription_status"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          plan_id: string;
          provider: string;
          provider_subscription_id?: string | null;
          status: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          plan_id?: string;
          provider?: string;
          provider_subscription_id?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      uploaded_files: {
        Row: {
          bucket: string;
          char_count: number | null;
          chunk_count: number | null;
          created_at: string;
          error_message: string | null;
          folder_id: string | null;
          id: string;
          mime_type: string;
          original_name: string;
          page_count: number | null;
          processed_at: string | null;
          purpose: string;
          sha256: string | null;
          size_bytes: number;
          status: Database["public"]["Enums"]["file_status"];
          storage_path: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          bucket?: string;
          char_count?: number | null;
          chunk_count?: number | null;
          created_at?: string;
          error_message?: string | null;
          folder_id?: string | null;
          id?: string;
          mime_type: string;
          original_name: string;
          page_count?: number | null;
          processed_at?: string | null;
          purpose?: string;
          sha256?: string | null;
          size_bytes: number;
          status?: Database["public"]["Enums"]["file_status"];
          storage_path: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          bucket?: string;
          char_count?: number | null;
          chunk_count?: number | null;
          created_at?: string;
          error_message?: string | null;
          folder_id?: string | null;
          id?: string;
          mime_type?: string;
          original_name?: string;
          page_count?: number | null;
          processed_at?: string | null;
          purpose?: string;
          sha256?: string | null;
          size_bytes?: number;
          status?: Database["public"]["Enums"]["file_status"];
          storage_path?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "uploaded_files_folder_id_user_id_fkey";
            columns: ["folder_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "uploaded_files_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "uploaded_files_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      usage_records: {
        Row: {
          created_at: string;
          feature: string;
          id: number;
          metadata: NonNullable<Json>;
          period_key: string;
          quantity: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          feature: string;
          id?: never;
          metadata?: NonNullable<Json>;
          period_key: string;
          quantity?: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          feature?: string;
          id?: never;
          metadata?: NonNullable<Json>;
          period_key?: string;
          quantity?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usage_records_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "usage_records_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_achievements: {
        Row: {
          achievement_id: string;
          unlocked_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          achievement_id: string;
          unlocked_at?: string;
          user_id: string;
        };
        Update: {
          achievement_id?: string;
          unlocked_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey";
            columns: ["achievement_id"];
            isOneToOne: false;
            referencedRelation: "achievements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_preferences: {
        Row: {
          created_at: string;
          daily_goal_minutes: number;
          difficulties: string[];
          email_reminders: boolean;
          explanation_level: string;
          goals: string[];
          preferred_period: string | null;
          study_weekdays: number[];
          timezone: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          daily_goal_minutes?: number;
          difficulties?: string[];
          email_reminders?: boolean;
          explanation_level?: string;
          goals?: string[];
          preferred_period?: string | null;
          study_weekdays?: number[];
          timezone?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          daily_goal_minutes?: number;
          difficulties?: string[];
          email_reminders?: boolean;
          explanation_level?: string;
          goals?: string[];
          preferred_period?: string | null;
          study_weekdays?: number[];
          timezone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          granted_by: string | null;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          granted_by?: string | null;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          granted_by?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_roles_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_stats: {
        Row: {
          current_streak: number;
          last_active_date: string | null;
          league: string;
          level: number;
          longest_streak: number;
          updated_at: string;
          user_id: string;
          xp_total: number;
        };
        ComputedFields: never;
        Insert: {
          current_streak?: number;
          last_active_date?: string | null;
          league?: string;
          level?: number;
          longest_streak?: number;
          updated_at?: string;
          user_id: string;
          xp_total?: number;
        };
        Update: {
          current_streak?: number;
          last_active_date?: string | null;
          league?: string;
          level?: number;
          longest_streak?: number;
          updated_at?: string;
          user_id?: string;
          xp_total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "user_stats_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_stats_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_subjects: {
        Row: {
          created_at: string;
          subject_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          subject_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          subject_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_subjects_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_subjects_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_subjects_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      xp_transactions: {
        Row: {
          amount: number;
          created_at: string;
          id: number;
          local_date: string;
          reason: string | null;
          source_id: string;
          source_type: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          created_at?: string;
          id?: never;
          local_date: string;
          reason?: string | null;
          source_id: string;
          source_type: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: never;
          local_date?: string;
          reason?: string | null;
          source_id?: string;
          source_type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "xp_transactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profile_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "xp_transactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      profile_cards: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          is_public: boolean | null;
          username: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: never;
          bio?: never;
          created_at?: string | null;
          display_name?: never;
          id?: string | null;
          is_public?: never;
          username?: string | null;
        };
        Update: {
          avatar_url?: never;
          bio?: never;
          created_at?: string | null;
          display_name?: never;
          id?: string | null;
          is_public?: never;
          username?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      achievement_metric: {
        Args: { p_metric: string; p_user_id: string };
        Returns: number;
      };
      admin_find_users: {
        Args: { p_limit?: number; p_query: string };
        Returns: {
          account_status: Database["public"]["Enums"]["account_status"];
          birth_date: string;
          created_at: string;
          display_name: string;
          email: string;
          id: string;
          last_sign_in_at: string;
          roles: string[];
          username: string;
        }[];
      };
      age_in_years: { Args: { p_birth: string }; Returns: number };
      apply_flashcard_review: {
        Args: {
          p_card_id: string;
          p_difficulty: number;
          p_due_at: string;
          p_duration_ms: number;
          p_elapsed_days: number;
          p_expected_last_review: string;
          p_lapses: number;
          p_learning_steps: number;
          p_rating: number;
          p_reps: number;
          p_reviewed_at: string;
          p_scheduled_days: number;
          p_stability: number;
          p_state: Database["public"]["Enums"]["card_state"];
        };
        Returns: string;
      };
      award_xp: {
        Args: {
          p_amount: number;
          p_daily_cap?: number;
          p_local_date: string;
          p_reason: string;
          p_source_id: string;
          p_source_type: string;
          p_user_id: string;
        };
        Returns: number;
      };
      can_answer_attempt: {
        Args: { p_attempt_id: string; p_question_id: string };
        Returns: boolean;
      };
      check_achievements: {
        Args: { p_local_date: string; p_user_id: string };
        Returns: string[];
      };
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      consume_usage: {
        Args: {
          p_feature: string;
          p_limit: number;
          p_metadata?: Json;
          p_period_key: string;
          p_quantity: number;
          p_user_id: string;
        };
        Returns: {
          allowed: boolean;
          record_id: number;
          used: number;
        }[];
      };
      finalize_quiz_attempt: {
        Args: { p_attempt_id: string };
        Returns: {
          correct_count: number | null;
          created_at: string;
          current_position: number;
          deadline_at: string | null;
          duration_seconds: number | null;
          flagged_question_ids: string[];
          graded_at: string | null;
          id: string;
          max_score: number | null;
          quiz_id: string;
          score: number | null;
          started_at: string;
          status: Database["public"]["Enums"]["attempt_status"];
          submitted_at: string | null;
          total_count: number | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "quiz_attempts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      folder_summaries: {
        Args: Record<PropertyKey, never>;
        Returns: {
          color: string;
          conversations_count: number;
          created_at: string;
          decks_count: number;
          exam_date: string;
          files_count: number;
          generations_count: number;
          id: string;
          name: string;
          quizzes_count: number;
          saved_count: number;
          subject_id: string;
        }[];
      };
      get_league_leaderboard: {
        Args: { p_limit?: number };
        Returns: {
          avatar_url: string;
          is_me: boolean;
          level: number;
          rank: number;
          user_id: string;
          username: string;
          xp: number;
        }[];
      };
      get_public_profile: { Args: { p_username: string }; Returns: Json };
      has_guardian_consent: { Args: { p_user_id: string }; Returns: boolean };
      immutable_unaccent: { Args: { value: string }; Returns: string };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_moderator: { Args: Record<PropertyKey, never>; Returns: boolean };
      leaderboard_week_start: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      level_for_xp: { Args: { p_xp: number }; Returns: number };
      my_achievements: {
        Args: Record<PropertyKey, never>;
        Returns: {
          category: string;
          code: string;
          description: string;
          icon: string;
          progress: number;
          sort_order: number;
          threshold: number;
          title: string;
          unlocked_at: string;
          xp_reward: number;
        }[];
      };
      my_league_status: {
        Args: Record<PropertyKey, never>;
        Returns: {
          league: string;
          members: number;
          rank: number;
          week_start: string;
          xp: number;
        }[];
      };
      purge_expired_data: { Args: Record<PropertyKey, never>; Returns: Json };
      purge_old_notifications: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      purge_orphan_uploads: {
        Args: { p_older_than?: string };
        Returns: {
          storage_path: string;
        }[];
      };
      quiz_recurring_errors: {
        Args: { p_quiz_id: string };
        Returns: {
          attempts: number;
          prompt: string;
          question_id: string;
          topic: string;
          wrong: number;
        }[];
      };
      record_material_view: {
        Args: {
          p_material_id: string;
          p_viewer_id: string;
          p_viewer_key: string;
        };
        Returns: boolean;
      };
      refresh_streak: {
        Args: { p_local_date: string; p_user_id: string };
        Returns: number;
      };
      related_materials: {
        Args: { p_limit?: number; p_material_id: string };
        Returns: {
          author_id: string;
          content: string;
          copyright_declared_at: string | null;
          created_at: string;
          description: string;
          favorites_count: number;
          file_id: string | null;
          grade_year: number | null;
          id: string;
          material_type: Database["public"]["Enums"]["material_type"];
          moderation_note: string | null;
          published_at: string | null;
          rating_count: number;
          rating_sum: number;
          saves_count: number;
          school_stage: Database["public"]["Enums"]["school_stage"] | null;
          search_vector: unknown;
          slug: string;
          status: Database["public"]["Enums"]["material_status"];
          subject_id: string;
          tags: string[];
          title: string;
          topic: string | null;
          updated_at: string;
          views_count: number;
          visibility: Database["public"]["Enums"]["visibility"];
        }[];
        SetofOptions: {
          from: "*";
          to: "study_materials";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      rollover_leagues: { Args: { p_week_start: string }; Returns: number };
      run_league_rollover: {
        Args: { p_week_start: string };
        Returns: {
          new_league: string;
          old_league: string;
          user_id: string;
        }[];
      };
      search_document_chunks: {
        Args: { p_file_ids: string[]; p_limit?: number; p_query: string };
        Returns: {
          chunk_index: number;
          content: string;
          file_id: string;
          id: string;
          page_end: number;
          page_start: number;
          rank: number;
          token_estimate: number;
        }[];
      };
      search_materials: {
        Args: {
          p_grade_year?: number;
          p_limit?: number;
          p_material_type?: Database["public"]["Enums"]["material_type"];
          p_offset?: number;
          p_query?: string;
          p_school_stage?: Database["public"]["Enums"]["school_stage"];
          p_sort?: string;
          p_subject_id?: string;
          p_topic?: string;
        };
        Returns: {
          author_id: string;
          description: string;
          favorites_count: number;
          grade_year: number;
          id: string;
          material_type: Database["public"]["Enums"]["material_type"];
          published_at: string;
          rating_count: number;
          rating_sum: number;
          saves_count: number;
          school_stage: Database["public"]["Enums"]["school_stage"];
          slug: string;
          subject_id: string;
          tags: string[];
          title: string;
          topic: string;
          total_count: number;
          views_count: number;
        }[];
      };
      search_profiles: {
        Args: { p_limit?: number; p_query: string };
        Returns: {
          avatar_url: string;
          display_name: string;
          materials_count: number;
          username: string;
        }[];
      };
      setting_int: {
        Args: { p_default: number; p_key: string };
        Returns: number;
      };
      setting_text: {
        Args: { p_default: string; p_key: string };
        Returns: string;
      };
      stats_daily: {
        Args: { p_from: string; p_to: string; p_tz?: string };
        Returns: {
          day: string;
          quizzes: number;
          reviews: number;
          study_minutes: number;
          xp: number;
        }[];
      };
      stats_subjects: {
        Args: { p_from: string; p_to: string; p_tz?: string };
        Returns: {
          answered: number;
          correct: number;
          study_minutes: number;
          subject_id: string;
        }[];
      };
      stats_weak_topics: {
        Args: { p_limit?: number };
        Returns: {
          accuracy: number;
          answered: number;
          correct: number;
          subject_id: string;
          topic: string;
        }[];
      };
      submit_material: {
        Args: { p_material_id: string };
        Returns: Database["public"]["Enums"]["material_status"];
      };
      submit_quiz_attempt: {
        Args: { p_attempt_id: string };
        Returns: {
          correct_count: number | null;
          created_at: string;
          current_position: number;
          deadline_at: string | null;
          duration_seconds: number | null;
          flagged_question_ids: string[];
          graded_at: string | null;
          id: string;
          max_score: number | null;
          quiz_id: string;
          score: number | null;
          started_at: string;
          status: Database["public"]["Enums"]["attempt_status"];
          submitted_at: string | null;
          total_count: number | null;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "quiz_attempts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      weekly_activity: {
        Args: { p_from: string; p_to: string; p_tz?: string };
        Returns: {
          active_days: number;
          correct_answers: number;
          flashcard_reviews: number;
          focus_sessions: number;
          mock_exams: number;
          quizzes_completed: number;
          study_minutes: number;
        }[];
      };
      withdraw_material: {
        Args: { p_material_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      account_status: "active" | "pending_guardian" | "suspended";
      app_role: "admin" | "moderator";
      attempt_status: "in_progress" | "submitted" | "graded";
      card_state: "new" | "learning" | "review" | "relearning";
      consent_status: "pending" | "granted" | "revoked" | "expired";
      difficulty: "easy" | "medium" | "hard";
      file_status: "pending_upload" | "processing" | "ready" | "failed";
      generation_kind:
        | "summary_quick"
        | "summary_detailed"
        | "study_guide"
        | "key_concepts"
        | "glossary"
        | "flashcards"
        | "quiz"
        | "mock_exam"
        | "essay_questions"
        | "explanation";
      generation_status: "pending" | "completed" | "failed";
      material_status:
        | "draft"
        | "pending_review"
        | "published"
        | "rejected"
        | "removed";
      material_type:
        | "summary"
        | "mind_map"
        | "exercise_list"
        | "notes"
        | "presentation"
        | "flashcards"
        | "essay"
        | "other";
      plan_status: "active" | "paused" | "completed" | "archived";
      question_type: "multiple_choice" | "true_false" | "open";
      quiz_kind: "quiz" | "mock_exam";
      report_reason:
        | "copyright"
        | "inappropriate"
        | "spam"
        | "incorrect"
        | "personal_data"
        | "harassment"
        | "other";
      report_status:
        | "open"
        | "resolved_removed"
        | "resolved_kept"
        | "dismissed";
      school_stage:
        | "fundamental_1"
        | "fundamental_2"
        | "medio"
        | "pre_vestibular"
        | "superior"
        | "outro";
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
        | "incomplete_expired"
        | "unpaid"
        | "paused";
      task_status: "pending" | "done" | "skipped";
      task_type:
        | "study"
        | "summary"
        | "flashcards"
        | "quiz"
        | "exercises"
        | "mock_exam"
        | "review";
      visibility: "public" | "unlisted" | "private";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      account_status: ["active", "pending_guardian", "suspended"],
      app_role: ["admin", "moderator"],
      attempt_status: ["in_progress", "submitted", "graded"],
      card_state: ["new", "learning", "review", "relearning"],
      consent_status: ["pending", "granted", "revoked", "expired"],
      difficulty: ["easy", "medium", "hard"],
      file_status: ["pending_upload", "processing", "ready", "failed"],
      generation_kind: [
        "summary_quick",
        "summary_detailed",
        "study_guide",
        "key_concepts",
        "glossary",
        "flashcards",
        "quiz",
        "mock_exam",
        "essay_questions",
        "explanation",
      ],
      generation_status: ["pending", "completed", "failed"],
      material_status: [
        "draft",
        "pending_review",
        "published",
        "rejected",
        "removed",
      ],
      material_type: [
        "summary",
        "mind_map",
        "exercise_list",
        "notes",
        "presentation",
        "flashcards",
        "essay",
        "other",
      ],
      plan_status: ["active", "paused", "completed", "archived"],
      question_type: ["multiple_choice", "true_false", "open"],
      quiz_kind: ["quiz", "mock_exam"],
      report_reason: [
        "copyright",
        "inappropriate",
        "spam",
        "incorrect",
        "personal_data",
        "harassment",
        "other",
      ],
      report_status: ["open", "resolved_removed", "resolved_kept", "dismissed"],
      school_stage: [
        "fundamental_1",
        "fundamental_2",
        "medio",
        "pre_vestibular",
        "superior",
        "outro",
      ],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "incomplete",
        "incomplete_expired",
        "unpaid",
        "paused",
      ],
      task_status: ["pending", "done", "skipped"],
      task_type: [
        "study",
        "summary",
        "flashcards",
        "quiz",
        "exercises",
        "mock_exam",
        "review",
      ],
      visibility: ["public", "unlisted", "private"],
    },
  },
} as const;
