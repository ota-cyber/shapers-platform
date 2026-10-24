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
      absence_notices: {
        Row: {
          created_at: string
          id: string
          in_time: boolean
          meeting_id: string
          member_id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          in_time: boolean
          meeting_id: string
          member_id: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          in_time?: boolean
          meeting_id?: string
          member_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "absence_notices_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_notices_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "member_meetings"
            referencedColumns: ["meeting_id"]
          },
          {
            foreignKeyName: "absence_notices_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "absence_notices_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "hour_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "absence_notices_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "meeting_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "absence_notices_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_meetings"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "absence_notices_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "absence_notices_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_notices_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "onboarding_progress"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "absence_notices_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "task_stats"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "absence_notices_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "week_hours"
            referencedColumns: ["member_id"]
          },
        ]
      }
      app_settings: {
        Row: {
          backfill_days: number
          check_in_any_time: boolean
          check_in_closes_minutes: number
          check_in_opens_minutes: number
          id: boolean
          tracking_since: string
        }
        Insert: {
          backfill_days?: number
          check_in_any_time?: boolean
          check_in_closes_minutes?: number
          check_in_opens_minutes?: number
          id?: boolean
          tracking_since?: string
        }
        Update: {
          backfill_days?: number
          check_in_any_time?: boolean
          check_in_closes_minutes?: number
          check_in_opens_minutes?: number
          id?: boolean
          tracking_since?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          meeting_id: string
          member_id: string
          note: string | null
          recorded_at: string
          recorded_by: string | null
          source: string
          state: Database["public"]["Enums"]["attendance_state"]
        }
        Insert: {
          meeting_id: string
          member_id: string
          note?: string | null
          recorded_at?: string
          recorded_by?: string | null
          source: string
          state: Database["public"]["Enums"]["attendance_state"]
        }
        Update: {
          meeting_id?: string
          member_id?: string
          note?: string | null
          recorded_at?: string
          recorded_by?: string | null
          source?: string
          state?: Database["public"]["Enums"]["attendance_state"]
        }
        Relationships: [
          {
            foreignKeyName: "attendance_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "member_meetings"
            referencedColumns: ["meeting_id"]
          },
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "hour_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "meeting_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_meetings"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "onboarding_progress"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "task_stats"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "week_hours"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "hour_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "meeting_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "member_meetings"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "onboarding_progress"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "task_stats"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "week_hours"
            referencedColumns: ["member_id"]
          },
        ]
      }
      imported_week_hours: {
        Row: {
          hours: number
          member_id: string
          week_start: string
        }
        Insert: {
          hours: number
          member_id: string
          week_start: string
        }
        Update: {
          hours?: number
          member_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "imported_week_hours_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "imported_week_hours_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "hour_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "imported_week_hours_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "meeting_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "imported_week_hours_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_meetings"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "imported_week_hours_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "imported_week_hours_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imported_week_hours_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "onboarding_progress"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "imported_week_hours_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "task_stats"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "imported_week_hours_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "week_hours"
            referencedColumns: ["member_id"]
          },
        ]
      }
      meetings: {
        Row: {
          description: string | null
          ends_at: string
          gcal_event_id: string | null
          ical_uid: string
          id: string
          location: string | null
          series_id: string
          starts_at: string
          synced_at: string
          title: string
        }
        Insert: {
          description?: string | null
          ends_at: string
          gcal_event_id?: string | null
          ical_uid: string
          id?: string
          location?: string | null
          series_id: string
          starts_at: string
          synced_at?: string
          title: string
        }
        Update: {
          description?: string | null
          ends_at?: string
          gcal_event_id?: string | null
          ical_uid?: string
          id?: string
          location?: string | null
          series_id?: string
          starts_at?: string
          synced_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      member_onboarding: {
        Row: {
          completed_at: string
          completed_by: string | null
          member_id: string
          step_key: string
        }
        Insert: {
          completed_at?: string
          completed_by?: string | null
          member_id: string
          step_key: string
        }
        Update: {
          completed_at?: string
          completed_by?: string | null
          member_id?: string
          step_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_onboarding_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_onboarding_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "hour_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_onboarding_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "meeting_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_onboarding_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "member_meetings"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_onboarding_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_onboarding_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_onboarding_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "onboarding_progress"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_onboarding_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "task_stats"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_onboarding_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "week_hours"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_onboarding_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_onboarding_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "hour_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_onboarding_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "meeting_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_onboarding_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_meetings"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_onboarding_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_onboarding_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_onboarding_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "onboarding_progress"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_onboarding_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "task_stats"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_onboarding_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "week_hours"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_onboarding_step_key_fkey"
            columns: ["step_key"]
            isOneToOne: false
            referencedRelation: "onboarding_progress"
            referencedColumns: ["step_key"]
          },
          {
            foreignKeyName: "member_onboarding_step_key_fkey"
            columns: ["step_key"]
            isOneToOne: false
            referencedRelation: "onboarding_steps"
            referencedColumns: ["key"]
          },
        ]
      }
      members: {
        Row: {
          active: boolean
          avatar_url: string | null
          buddy_id: string | null
          created_at: string
          email: string
          id: string
          is_admin: boolean
          joined_on: string
          name: string
          slack_user_id: string | null
          tier: Database["public"]["Enums"]["tier_key"]
          tier_since: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          buddy_id?: string | null
          created_at?: string
          email: string
          id?: string
          is_admin?: boolean
          joined_on?: string
          name: string
          slack_user_id?: string | null
          tier?: Database["public"]["Enums"]["tier_key"]
          tier_since?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          buddy_id?: string | null
          created_at?: string
          email?: string
          id?: string
          is_admin?: boolean
          joined_on?: string
          name?: string
          slack_user_id?: string | null
          tier?: Database["public"]["Enums"]["tier_key"]
          tier_since?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_buddy_id_fkey"
            columns: ["buddy_id"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_buddy_id_fkey"
            columns: ["buddy_id"]
            isOneToOne: false
            referencedRelation: "hour_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_buddy_id_fkey"
            columns: ["buddy_id"]
            isOneToOne: false
            referencedRelation: "meeting_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_buddy_id_fkey"
            columns: ["buddy_id"]
            isOneToOne: false
            referencedRelation: "member_meetings"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_buddy_id_fkey"
            columns: ["buddy_id"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_buddy_id_fkey"
            columns: ["buddy_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_buddy_id_fkey"
            columns: ["buddy_id"]
            isOneToOne: false
            referencedRelation: "onboarding_progress"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_buddy_id_fkey"
            columns: ["buddy_id"]
            isOneToOne: false
            referencedRelation: "task_stats"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_buddy_id_fkey"
            columns: ["buddy_id"]
            isOneToOne: false
            referencedRelation: "week_hours"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_tier_fkey"
            columns: ["tier"]
            isOneToOne: false
            referencedRelation: "tiers"
            referencedColumns: ["key"]
          },
        ]
      }
      onboarding_steps: {
        Row: {
          admin_only: boolean
          auto: boolean
          description: string | null
          key: string
          sort: number
          stage: string
          title: string
        }
        Insert: {
          admin_only?: boolean
          auto?: boolean
          description?: string | null
          key: string
          sort: number
          stage: string
          title: string
        }
        Update: {
          admin_only?: boolean
          auto?: boolean
          description?: string | null
          key?: string
          sort?: number
          stage?: string
          title?: string
        }
        Relationships: []
      }
      pauses: {
        Row: {
          created_at: string
          ends_on: string
          id: string
          member_id: string
          reason: string | null
          reviewed_by: string | null
          starts_on: string
          status: Database["public"]["Enums"]["review_status"]
        }
        Insert: {
          created_at?: string
          ends_on: string
          id?: string
          member_id: string
          reason?: string | null
          reviewed_by?: string | null
          starts_on: string
          status?: Database["public"]["Enums"]["review_status"]
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          member_id?: string
          reason?: string | null
          reviewed_by?: string | null
          starts_on?: string
          status?: Database["public"]["Enums"]["review_status"]
        }
        Relationships: [
          {
            foreignKeyName: "pauses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "pauses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "hour_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "pauses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "meeting_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "pauses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_meetings"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "pauses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "pauses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pauses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "onboarding_progress"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "pauses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "task_stats"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "pauses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "week_hours"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "pauses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "pauses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "hour_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "pauses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "meeting_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "pauses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "member_meetings"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "pauses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "pauses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pauses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "onboarding_progress"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "pauses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "task_stats"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "pauses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "week_hours"
            referencedColumns: ["member_id"]
          },
        ]
      }
      project_members: {
        Row: {
          added_at: string
          member_id: string
          project_id: string
        }
        Insert: {
          added_at?: string
          member_id: string
          project_id: string
        }
        Update: {
          added_at?: string
          member_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "project_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "hour_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "project_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "meeting_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "project_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_meetings"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "project_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "project_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "onboarding_progress"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "project_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "task_stats"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "project_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "week_hours"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_general: boolean
          lead_id: string | null
          name: string
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_general?: boolean
          lead_id?: string | null
          name: string
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_general?: boolean
          lead_id?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "hour_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "meeting_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "member_meetings"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "onboarding_progress"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "task_stats"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "week_hours"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "hour_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "meeting_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "member_meetings"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "onboarding_progress"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "task_stats"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "week_hours"
            referencedColumns: ["member_id"]
          },
        ]
      }
      series: {
        Row: {
          everyone: boolean
          id: string
          name: string
          sort: number
        }
        Insert: {
          everyone?: boolean
          id: string
          name: string
          sort: number
        }
        Update: {
          everyone?: boolean
          id?: string
          name?: string
          sort?: number
        }
        Relationships: []
      }
      series_members: {
        Row: {
          member_id: string
          series_id: string
        }
        Insert: {
          member_id: string
          series_id: string
        }
        Update: {
          member_id?: string
          series_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "series_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "hour_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "series_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "meeting_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "series_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_meetings"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "series_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "series_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "onboarding_progress"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "series_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "task_stats"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "series_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "week_hours"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "series_members_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      task_events: {
        Row: {
          actor_id: string | null
          at: string
          from_value: string | null
          id: number
          kind: string
          task_id: string
          to_value: string | null
        }
        Insert: {
          actor_id?: string | null
          at?: string
          from_value?: string | null
          id?: never
          kind: string
          task_id: string
          to_value?: string | null
        }
        Update: {
          actor_id?: string | null
          at?: string
          from_value?: string | null
          id?: never
          kind?: string
          task_id?: string
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "task_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "hour_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "task_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "meeting_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "task_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "member_meetings"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "task_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "task_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "onboarding_progress"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "task_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "task_stats"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "task_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "week_hours"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "task_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_on: string | null
          id: string
          kind: string
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string
          sort_order: number
          source_meeting_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_on?: string | null
          id?: string
          kind?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id: string
          sort_order?: number
          source_meeting_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_on?: string | null
          id?: string
          kind?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string
          sort_order?: number
          source_meeting_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "hour_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "meeting_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "member_meetings"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "onboarding_progress"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "task_stats"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "week_hours"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "hour_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "meeting_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "member_meetings"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "onboarding_progress"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "task_stats"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "week_hours"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_source_meeting_id_fkey"
            columns: ["source_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_source_meeting_id_fkey"
            columns: ["source_meeting_id"]
            isOneToOne: false
            referencedRelation: "member_meetings"
            referencedColumns: ["meeting_id"]
          },
        ]
      }
      tiers: {
        Row: {
          absence_notice_hours_community: number | null
          absence_notice_hours_project: number | null
          community_misses_per_year: number | null
          key: Database["public"]["Enums"]["tier_key"]
          months_before_review: number | null
          name: string
          next_tier: Database["public"]["Enums"]["tier_key"] | null
          notice_months: number | null
          pause_weeks_per_year: number | null
          sort: number
          weekly_hours: number
        }
        Insert: {
          absence_notice_hours_community?: number | null
          absence_notice_hours_project?: number | null
          community_misses_per_year?: number | null
          key: Database["public"]["Enums"]["tier_key"]
          months_before_review?: number | null
          name: string
          next_tier?: Database["public"]["Enums"]["tier_key"] | null
          notice_months?: number | null
          pause_weeks_per_year?: number | null
          sort: number
          weekly_hours: number
        }
        Update: {
          absence_notice_hours_community?: number | null
          absence_notice_hours_project?: number | null
          community_misses_per_year?: number | null
          key?: Database["public"]["Enums"]["tier_key"]
          months_before_review?: number | null
          name?: string
          next_tier?: Database["public"]["Enums"]["tier_key"] | null
          notice_months?: number | null
          pause_weeks_per_year?: number | null
          sort?: number
          weekly_hours?: number
        }
        Relationships: []
      }
      work_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          member_id: string
          note: string | null
          planned_end: string
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          started_at: string
          status: Database["public"]["Enums"]["review_status"]
          task_id: string | null
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          member_id: string
          note?: string | null
          planned_end: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source: string
          started_at: string
          status?: Database["public"]["Enums"]["review_status"]
          task_id?: string | null
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          member_id?: string
          note?: string | null
          planned_end?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          started_at?: string
          status?: Database["public"]["Enums"]["review_status"]
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_sessions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "work_sessions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "hour_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "work_sessions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "meeting_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "work_sessions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_meetings"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "work_sessions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "work_sessions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_sessions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "onboarding_progress"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "work_sessions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "task_stats"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "work_sessions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "week_hours"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "work_sessions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "work_sessions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "hour_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "work_sessions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "meeting_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "work_sessions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "member_meetings"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "work_sessions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "work_sessions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_sessions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "onboarding_progress"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "work_sessions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "task_stats"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "work_sessions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "week_hours"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "work_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      attendance_summary: {
        Row: {
          attendance_rate: number | null
          excused: number | null
          member_id: string | null
          present: number | null
          recorded: number | null
          remote: number | null
          series_id: string | null
          unexcused: number | null
          unrecorded: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      hour_streaks: {
        Row: {
          best_streak: number | null
          current_streak: number | null
          member_id: string | null
        }
        Relationships: []
      }
      meeting_streaks: {
        Row: {
          current_streak: number | null
          member_id: string | null
        }
        Relationships: []
      }
      member_badges: {
        Row: {
          badge: string | null
          description: string | null
          earned: boolean | null
          member_id: string | null
          title: string | null
        }
        Relationships: []
      }
      member_meetings: {
        Row: {
          absence_notified: boolean | null
          ends_at: string | null
          location: string | null
          meeting_id: string | null
          member_id: string | null
          recorded_at: string | null
          series_id: string | null
          series_name: string | null
          source: string | null
          starts_at: string | null
          state: Database["public"]["Enums"]["attendance_state"] | null
          status: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      member_overview: {
        Row: {
          attendance_rate_6w: number | null
          attended_6w: number | null
          behind: boolean | null
          best_hour_streak: number | null
          buddy_id: string | null
          buddy_name: string | null
          email: string | null
          expected_by_now: number | null
          hour_streak: number | null
          hours_remaining: number | null
          is_admin: boolean | null
          joined_on: string | null
          last_active_at: string | null
          last_done_at: string | null
          meeting_streak: number | null
          member_id: string | null
          months_in_tier: number | null
          name: string | null
          next_tier: Database["public"]["Enums"]["tier_key"] | null
          next_tier_name: string | null
          onboarded: boolean | null
          onboarding_done: number | null
          onboarding_total: number | null
          open_tasks: number | null
          overdue_tasks: number | null
          paused: boolean | null
          review_on: string | null
          tasks_done_30d: number | null
          tasks_done_7d: number | null
          tier: Database["public"]["Enums"]["tier_key"] | null
          tier_name: string | null
          tier_since: string | null
          unexcused_6w: number | null
          week_hours: number | null
          week_target: number | null
        }
        Relationships: [
          {
            foreignKeyName: "members_buddy_id_fkey"
            columns: ["buddy_id"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_buddy_id_fkey"
            columns: ["buddy_id"]
            isOneToOne: false
            referencedRelation: "hour_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_buddy_id_fkey"
            columns: ["buddy_id"]
            isOneToOne: false
            referencedRelation: "meeting_streaks"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_buddy_id_fkey"
            columns: ["buddy_id"]
            isOneToOne: false
            referencedRelation: "member_meetings"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_buddy_id_fkey"
            columns: ["buddy_id"]
            isOneToOne: false
            referencedRelation: "member_overview"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_buddy_id_fkey"
            columns: ["buddy_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_buddy_id_fkey"
            columns: ["buddy_id"]
            isOneToOne: false
            referencedRelation: "onboarding_progress"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_buddy_id_fkey"
            columns: ["buddy_id"]
            isOneToOne: false
            referencedRelation: "task_stats"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_buddy_id_fkey"
            columns: ["buddy_id"]
            isOneToOne: false
            referencedRelation: "week_hours"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_tier_fkey"
            columns: ["tier"]
            isOneToOne: false
            referencedRelation: "tiers"
            referencedColumns: ["key"]
          },
        ]
      }
      onboarding_progress: {
        Row: {
          admin_only: boolean | null
          auto: boolean | null
          completed_at: string | null
          description: string | null
          done: boolean | null
          member_id: string | null
          sort: number | null
          stage: string | null
          step_key: string | null
          title: string | null
        }
        Relationships: []
      }
      org_weekly: {
        Row: {
          attendance_rate: number | null
          meetings: number | null
          members_counted: number | null
          members_on_target: number | null
          pct_on_target: number | null
          tasks_done: number | null
          total_hours: number | null
          week_start: string | null
        }
        Relationships: []
      }
      task_stats: {
        Row: {
          done_30d: number | null
          done_7d: number | null
          done_total: number | null
          last_done_at: string | null
          member_id: string | null
          open_tasks: number | null
          overdue_tasks: number | null
        }
        Relationships: []
      }
      tier_weekly: {
        Row: {
          avg_hours: number | null
          members_counted: number | null
          members_on_target: number | null
          tier: Database["public"]["Enums"]["tier_key"] | null
          total_hours: number | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_tier_fkey"
            columns: ["tier"]
            isOneToOne: false
            referencedRelation: "tiers"
            referencedColumns: ["key"]
          },
        ]
      }
      week_hours: {
        Row: {
          hours: number | null
          is_current: boolean | null
          member_id: string | null
          met: boolean | null
          paused: boolean | null
          target: number | null
          week_start: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      app_today: { Args: never; Returns: string }
      can_see_member: { Args: { p_member: string }; Returns: boolean }
      check_in_meeting: {
        Args: { p_meeting: string; p_remote?: boolean }
        Returns: {
          meeting_id: string
          member_id: string
          note: string | null
          recorded_at: string
          recorded_by: string | null
          source: string
          state: Database["public"]["Enums"]["attendance_state"]
        }
        SetofOptions: {
          from: "*"
          to: "attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      clock_in: {
        Args: { p_task_id?: string }
        Returns: {
          created_at: string
          ended_at: string | null
          id: string
          member_id: string
          note: string | null
          planned_end: string
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          started_at: string
          status: Database["public"]["Enums"]["review_status"]
          task_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "work_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      clock_out: {
        Args: never
        Returns: {
          created_at: string
          ended_at: string | null
          id: string
          member_id: string
          note: string | null
          planned_end: string
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          started_at: string
          status: Database["public"]["Enums"]["review_status"]
          task_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "work_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_expired_sessions: { Args: { p_member: string }; Returns: undefined }
      complete_onboarding_step: {
        Args: { p_done?: boolean; p_member?: string; p_step: string }
        Returns: undefined
      }
      create_project: {
        Args: {
          p_color?: string
          p_description?: string
          p_lead?: string
          p_members?: string[]
          p_name: string
        }
        Returns: {
          archived_at: string | null
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_general: boolean
          lead_id: string | null
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_member_id: { Args: never; Returns: string }
      current_session: {
        Args: never
        Returns: {
          created_at: string
          ended_at: string | null
          id: string
          member_id: string
          note: string | null
          planned_end: string
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          started_at: string
          status: Database["public"]["Enums"]["review_status"]
          task_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "work_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_my_session: { Args: { p_session: string }; Returns: undefined }
      expected_members: { Args: { p_meeting: string }; Returns: string[] }
      extend_session: {
        Args: never
        Returns: {
          created_at: string
          ended_at: string | null
          id: string
          member_id: string
          note: string | null
          planned_end: string
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          started_at: string
          status: Database["public"]["Enums"]["review_status"]
          task_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "work_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_admin: { Args: never; Returns: boolean }
      is_project_member: { Args: { p_project: string }; Returns: boolean }
      local_week_start: { Args: { ts: string }; Returns: string }
      log_hours: {
        Args: {
          p_date: string
          p_hours: number
          p_note?: string
          p_task_id?: string
        }
        Returns: {
          created_at: string
          ended_at: string | null
          id: string
          member_id: string
          note: string | null
          planned_end: string
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          started_at: string
          status: Database["public"]["Enums"]["review_status"]
          task_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "work_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      notify_absence: {
        Args: { p_meeting: string; p_reason?: string }
        Returns: {
          created_at: string
          id: string
          in_time: boolean
          meeting_id: string
          member_id: string
          reason: string | null
        }
        SetofOptions: {
          from: "*"
          to: "absence_notices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_meeting_attendance: {
        Args: {
          p_default?: Database["public"]["Enums"]["attendance_state"]
          p_exceptions?: Json
          p_meeting: string
        }
        Returns: number
      }
      request_pause: {
        Args: { p_ends: string; p_reason?: string; p_starts: string }
        Returns: {
          created_at: string
          ends_on: string
          id: string
          member_id: string
          reason: string | null
          reviewed_by: string | null
          starts_on: string
          status: Database["public"]["Enums"]["review_status"]
        }
        SetofOptions: {
          from: "*"
          to: "pauses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      require_admin: { Args: never; Returns: string }
      require_member: { Args: never; Returns: string }
      review_pause: {
        Args: { p_approve: boolean; p_pause: string }
        Returns: {
          created_at: string
          ends_on: string
          id: string
          member_id: string
          reason: string | null
          reviewed_by: string | null
          starts_on: string
          status: Database["public"]["Enums"]["review_status"]
        }
        SetofOptions: {
          from: "*"
          to: "pauses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_session: {
        Args: { p_approve: boolean; p_session: string }
        Returns: {
          created_at: string
          ended_at: string | null
          id: string
          member_id: string
          note: string | null
          planned_end: string
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          started_at: string
          status: Database["public"]["Enums"]["review_status"]
          task_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "work_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_attendance: {
        Args: {
          p_meeting: string
          p_member: string
          p_note?: string
          p_state: Database["public"]["Enums"]["attendance_state"]
        }
        Returns: {
          meeting_id: string
          member_id: string
          note: string | null
          recorded_at: string
          recorded_by: string | null
          source: string
          state: Database["public"]["Enums"]["attendance_state"]
        }
        SetofOptions: {
          from: "*"
          to: "attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      week_start: { Args: { d: string }; Returns: string }
    }
    Enums: {
      attendance_state: "present" | "remote" | "excused" | "unexcused"
      review_status: "approved" | "pending" | "rejected"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "doing" | "done"
      tier_key: "go" | "impact" | "core"
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
      attendance_state: ["present", "remote", "excused", "unexcused"],
      review_status: ["approved", "pending", "rejected"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "doing", "done"],
      tier_key: ["go", "impact", "core"],
    },
  },
} as const

