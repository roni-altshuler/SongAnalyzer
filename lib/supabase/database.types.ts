/**
 * Hand-written Supabase database types.
 *
 * These mirror supabase/migrations/0001_init.sql. They are intended to be
 * regenerated via the Supabase CLI once the local stack is running:
 *
 *   npx supabase gen types typescript --local > lib/supabase/database.types.ts
 *
 * Until then, keep this file in sync with the migration manually.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AnalysisMode = 'lyrics' | 'audio' | 'combined';

/**
 * Shape of `analyses.result` (jsonb). Stream C owns the canonical type in
 * lib/types.ts and may extend this shape — keep this as a loose contract.
 */
export interface AnalysisResultJson {
  mood?: string;
  vibe?: string;
  energy?: number | string;
  sentiment?: string;
  themes?: string[];
  confidence?: number;
  engines?: {
    transformer?: Json;
    keyword?: Json;
  };
  moodColor?: {
    from: string;
    to: string;
  };
  [key: string]: Json | undefined;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      songs: {
        Row: {
          id: string;
          spotify_id: string | null;
          genius_id: number | null;
          musicbrainz_recording_id: string | null;
          title: string;
          artist: string;
          album: string | null;
          release_year: number | null;
          cover_url: string | null;
          preview_url: string | null;
          acousticbrainz_features: Json | null;
          // pgvector columns (0006). PostgREST serialises vectors as strings;
          // writes accept a number[] payload.
          sonic_vector: string | number[] | null;
          sonic_vector_version: string | null;
          audio_features_v2: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          spotify_id?: string | null;
          genius_id?: number | null;
          musicbrainz_recording_id?: string | null;
          title: string;
          artist: string;
          album?: string | null;
          release_year?: number | null;
          cover_url?: string | null;
          preview_url?: string | null;
          acousticbrainz_features?: Json | null;
          sonic_vector?: string | number[] | null;
          sonic_vector_version?: string | null;
          audio_features_v2?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          spotify_id?: string | null;
          genius_id?: number | null;
          musicbrainz_recording_id?: string | null;
          title?: string;
          artist?: string;
          album?: string | null;
          release_year?: number | null;
          cover_url?: string | null;
          preview_url?: string | null;
          acousticbrainz_features?: Json | null;
          sonic_vector?: string | number[] | null;
          sonic_vector_version?: string | null;
          audio_features_v2?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      analyses: {
        Row: {
          id: string;
          user_id: string | null;
          song_id: string | null;
          mode: AnalysisMode;
          lyrics_excerpt: string | null;
          audio_storage_path: string | null;
          result: AnalysisResultJson;
          language: string | null;
          translated: boolean;
          is_public: boolean;
          share_slug: string | null;
          system_seed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          song_id?: string | null;
          mode: AnalysisMode;
          lyrics_excerpt?: string | null;
          audio_storage_path?: string | null;
          result: AnalysisResultJson;
          language?: string | null;
          translated?: boolean;
          is_public?: boolean;
          share_slug?: string | null;
          system_seed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          song_id?: string | null;
          mode?: AnalysisMode;
          lyrics_excerpt?: string | null;
          audio_storage_path?: string | null;
          result?: AnalysisResultJson;
          language?: string | null;
          translated?: boolean;
          is_public?: boolean;
          share_slug?: string | null;
          system_seed?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'analyses_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'analyses_song_id_fkey';
            columns: ['song_id'];
            referencedRelation: 'songs';
            referencedColumns: ['id'];
          },
        ];
      };
      shares: {
        Row: {
          analysis_id: string;
          view_count: number;
          og_image_path: string | null;
          last_rendered_at: string | null;
        };
        Insert: {
          analysis_id: string;
          view_count?: number;
          og_image_path?: string | null;
          last_rendered_at?: string | null;
        };
        Update: {
          analysis_id?: string;
          view_count?: number;
          og_image_path?: string | null;
          last_rendered_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'shares_analysis_id_fkey';
            columns: ['analysis_id'];
            referencedRelation: 'analyses';
            referencedColumns: ['id'];
          },
        ];
      };
      song_fingerprints: {
        Row: {
          song_id: string;
          hash: number;
          offset_ms: number;
          source: 'preview' | 'upload' | 'seed';
        };
        Insert: {
          song_id: string;
          hash: number;
          offset_ms: number;
          source?: 'preview' | 'upload' | 'seed';
        };
        Update: {
          song_id?: string;
          hash?: number;
          offset_ms?: number;
          source?: 'preview' | 'upload' | 'seed';
        };
        Relationships: [
          {
            foreignKeyName: 'song_fingerprints_song_id_fkey';
            columns: ['song_id'];
            referencedRelation: 'songs';
            referencedColumns: ['id'];
          },
        ];
      };
      analysis_cache: {
        Row: {
          lyrics_hash: string;
          result: Json;
          hit_count: number;
          created_at: string;
          last_hit_at: string | null;
        };
        Insert: {
          lyrics_hash: string;
          result: Json;
          hit_count?: number;
          created_at?: string;
          last_hit_at?: string | null;
        };
        Update: {
          lyrics_hash?: string;
          result?: Json;
          hit_count?: number;
          created_at?: string;
          last_hit_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      profile_has_public_analysis: {
        Args: { profile_id: string };
        Returns: boolean;
      };
      match_fingerprints: {
        Args: { q_hashes: number[]; q_offsets: number[] };
        Returns: Array<{ song_id: string; votes: number; delta_bucket: number }>;
      };
      match_similar_songs: {
        Args: { source_song: string; match_limit?: number };
        Returns: Array<{
          id: string;
          title: string;
          artist: string;
          cover_url: string | null;
          preview_url: string | null;
          distance: number;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// Convenience row aliases used by lib/db/*.ts.
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type SongRow = Database['public']['Tables']['songs']['Row'];
export type SongInsert = Database['public']['Tables']['songs']['Insert'];
export type AnalysisRow = Database['public']['Tables']['analyses']['Row'];
export type AnalysisInsert = Database['public']['Tables']['analyses']['Insert'];
export type ShareRow = Database['public']['Tables']['shares']['Row'];
export type SongFingerprintRow = Database['public']['Tables']['song_fingerprints']['Row'];
export type SongFingerprintInsert = Database['public']['Tables']['song_fingerprints']['Insert'];
export type AnalysisCacheRow = Database['public']['Tables']['analysis_cache']['Row'];
