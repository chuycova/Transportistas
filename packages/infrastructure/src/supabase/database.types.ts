export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          is_resolved: boolean
          location_id: number | null
          notification_sent: boolean
          payload: Json
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          route_id: string | null
          severity: string
          tenant_id: string
          vehicle_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          location_id?: number | null
          notification_sent?: boolean
          payload?: Json
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          route_id?: string | null
          severity?: string
          tenant_id: string
          vehicle_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          location_id?: number | null
          notification_sent?: boolean
          payload?: Json
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          route_id?: string | null
          severity?: string
          tenant_id?: string
          vehicle_id?: string
        }
        Relationships: [
          { foreignKeyName: "alerts_location_id_fkey"; columns: ["location_id"]; isOneToOne: false; referencedRelation: "locations"; referencedColumns: ["id"] },
          { foreignKeyName: "alerts_resolved_by_fkey"; columns: ["resolved_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "alerts_route_id_fkey"; columns: ["route_id"]; isOneToOne: false; referencedRelation: "routes"; referencedColumns: ["id"] },
          { foreignKeyName: "alerts_tenant_id_fkey"; columns: ["tenant_id"]; isOneToOne: false; referencedRelation: "tenants"; referencedColumns: ["id"] },
          { foreignKeyName: "alerts_vehicle_id_fkey"; columns: ["vehicle_id"]; isOneToOne: false; referencedRelation: "vehicles"; referencedColumns: ["id"] },
        ]
      }
      locations: {
        Row: {
          accuracy_m: number | null
          deviation_m: number | null
          heading_deg: number | null
          id: number
          is_off_route: boolean
          point: unknown
          received_at: string
          recorded_at: string
          route_id: string | null
          speed_kmh: number | null
          tenant_id: string
          vehicle_id: string
        }
        Insert: {
          accuracy_m?: number | null
          deviation_m?: number | null
          heading_deg?: number | null
          id?: number
          is_off_route?: boolean
          point: unknown
          received_at?: string
          recorded_at: string
          route_id?: string | null
          speed_kmh?: number | null
          tenant_id: string
          vehicle_id: string
        }
        Update: {
          accuracy_m?: number | null
          deviation_m?: number | null
          heading_deg?: number | null
          id?: number
          is_off_route?: boolean
          point?: unknown
          received_at?: string
          recorded_at?: string
          route_id?: string | null
          speed_kmh?: number | null
          tenant_id?: string
          vehicle_id?: string
        }
        Relationships: [
          { foreignKeyName: "locations_route_id_fkey"; columns: ["route_id"]; isOneToOne: false; referencedRelation: "routes"; referencedColumns: ["id"] },
          { foreignKeyName: "locations_tenant_id_fkey"; columns: ["tenant_id"]; isOneToOne: false; referencedRelation: "tenants"; referencedColumns: ["id"] },
          { foreignKeyName: "locations_vehicle_id_fkey"; columns: ["vehicle_id"]; isOneToOne: false; referencedRelation: "vehicles"; referencedColumns: ["id"] },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          fcm_token: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          fcm_token?: string | null
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          role?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          fcm_token?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "profiles_tenant_id_fkey"; columns: ["tenant_id"]; isOneToOne: false; referencedRelation: "tenants"; referencedColumns: ["id"] },
        ]
      }
      routes: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          dest_name: string
          dest_point: unknown
          deviation_threshold_m: number | null
          estimated_duration_s: number | null
          id: string
          name: string
          origin_name: string
          origin_point: unknown
          polyline: unknown
          status: string
          stops: Json
          tenant_id: string
          total_distance_m: number | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          dest_name: string
          dest_point: unknown
          deviation_threshold_m?: number | null
          estimated_duration_s?: number | null
          id?: string
          name: string
          origin_name: string
          origin_point: unknown
          polyline: unknown
          status?: string
          stops?: Json
          tenant_id: string
          total_distance_m?: number | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          dest_name?: string
          dest_point?: unknown
          deviation_threshold_m?: number | null
          estimated_duration_s?: number | null
          id?: string
          name?: string
          origin_name?: string
          origin_point?: unknown
          polyline?: unknown
          status?: string
          stops?: Json
          tenant_id?: string
          total_distance_m?: number | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          { foreignKeyName: "routes_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "routes_tenant_id_fkey"; columns: ["tenant_id"]; isOneToOne: false; referencedRelation: "tenants"; referencedColumns: ["id"] },
          { foreignKeyName: "routes_vehicle_id_fkey"; columns: ["vehicle_id"]; isOneToOne: false; referencedRelation: "vehicles"; referencedColumns: ["id"] },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          plan: string
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          plan?: string
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          plan?: string
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          alias: string | null
          assigned_driver_id: string | null
          brand: string | null
          color: string | null
          created_at: string
          id: string
          metadata: Json
          model: string | null
          plate: string
          status: string
          tenant_id: string
          updated_at: string
          vehicle_type: string
          year: number | null
        }
        Insert: {
          alias?: string | null
          assigned_driver_id?: string | null
          brand?: string | null
          color?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          model?: string | null
          plate: string
          status?: string
          tenant_id: string
          updated_at?: string
          vehicle_type?: string
          year?: number | null
        }
        Update: {
          alias?: string | null
          assigned_driver_id?: string | null
          brand?: string | null
          color?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          model?: string | null
          plate?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          vehicle_type?: string
          year?: number | null
        }
        Relationships: [
          { foreignKeyName: "vehicles_assigned_driver_id_fkey"; columns: ["assigned_driver_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "vehicles_tenant_id_fkey"; columns: ["tenant_id"]; isOneToOne: false; referencedRelation: "tenants"; referencedColumns: ["id"] },
        ]
      }
    }
    Views: {
      routes_with_polyline: {
        Row: {
          created_at: string | null
          description: string | null
          dest_name: string | null
          deviation_threshold_m: number | null
          estimated_duration_s: number | null
          id: string | null
          name: string | null
          origin_name: string | null
          polyline_coords: Json | null
          status: string | null
          tenant_id: string | null
          total_distance_m: number | null
          updated_at: string | null
          vehicle_id: string | null
        }
        Insert: { [_ in never]: never }
        Update: { [_ in never]: never }
        Relationships: [
          { foreignKeyName: "routes_tenant_id_fkey"; columns: ["tenant_id"]; isOneToOne: false; referencedRelation: "tenants"; referencedColumns: ["id"] },
        ]
      }
    }
    Functions: {
      auth_role: { Args: Record<PropertyKey, never>; Returns: string }
      auth_tenant_id: { Args: Record<PropertyKey, never>; Returns: string }
      bulk_insert_locations: { Args: { p_locations: Json }; Returns: undefined }
      calculate_deviation_meters: { Args: { route_polyline: unknown; vehicle_point: unknown }; Returns: number }
      create_route: {
        Args: {
          p_created_by: string; p_description: string; p_dest_name: string
          p_dest_wkt: string; p_deviation_threshold_m: number
          p_estimated_duration_s: number; p_name: string; p_origin_name: string
          p_origin_wkt: string; p_polyline_wkt: string; p_stops: Json
          p_tenant_id: string; p_total_distance_m: number
        }
        Returns: string
      }
      get_latest_locations: {
        Args: { p_tenant_id: string }
        Returns: { heading_deg: number; is_off_route: boolean; lat: number; lng: number; recorded_at: string; speed_kmh: number; vehicle_id: string }[]
      }
      get_vehicle_track: {
        Args: { p_from: string; p_to: string; p_vehicle_id: string }
        Returns: { heading_deg: number; is_off_route: boolean; lat: number; lng: number; recorded_at: string; speed_kmh: number }[]
      }
      insert_location: {
        Args: {
          p_accuracy_m: number; p_deviation_m: number; p_heading_deg: number
          p_is_off_route: boolean; p_lat: number; p_lng: number
          p_recorded_at: string; p_route_id: string; p_speed_kmh: number
          p_tenant_id: string; p_vehicle_id: string
        }
        Returns: Json
      }
      is_off_route: { Args: { route_polyline: unknown; threshold_m?: number; vehicle_point: unknown }; Returns: boolean }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
