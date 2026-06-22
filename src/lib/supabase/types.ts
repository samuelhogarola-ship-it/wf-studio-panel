export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      activities: {
        Row: {
          id: string
          client_id: string
          pack_id: string
          activity_type: string
          title: string
          description: string | null
          hours_used: number
          work_date: string
          notify_client: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          pack_id: string
          activity_type: string
          title: string
          description?: string | null
          hours_used: number
          work_date?: string
          notify_client?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['activities']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'activities_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_pack_id_fkey'
            columns: ['pack_id']
            isOneToOne: false
            referencedRelation: 'packs'
            referencedColumns: ['id']
          }
        ]
      }
      clients: {
        Row: {
          id: string
          name: string
          company: string | null
          email: string
          phone: string | null
          status: 'active' | 'inactive'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          company?: string | null
          email: string
          phone?: string | null
          status?: 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['clients']['Insert']>
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          client_id: string
          activity_id: string | null
          title: string
          body: string | null
          hours_delta: number | null
          remaining_hours: number | null
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          activity_id?: string | null
          title: string
          body?: string | null
          hours_delta?: number | null
          remaining_hours?: number | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'notifications_activity_id_fkey'
            columns: ['activity_id']
            isOneToOne: false
            referencedRelation: 'activities'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          }
        ]
      }
      packs: {
        Row: {
          id: string
          client_id: string
          name: string
          hours_total: number
          price: number | null
          invoice_number: string | null
          purchase_date: string
          status: 'active' | 'inactive'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          name: string
          hours_total: number
          price?: number | null
          invoice_number?: string | null
          purchase_date?: string
          status?: 'active' | 'inactive'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['packs']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'packs_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          }
        ]
      }
      profiles: {
        Row: {
          id: string
          email: string | null
          role: 'admin' | 'client'
          created_at: string
        }
        Insert: {
          id: string
          email?: string | null
          role?: 'admin' | 'client'
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
        Relationships: []
      }
    }
    Views: {
      client_summary: {
        Row: {
          client_id: string
          client_name: string
          client_email: string
          total_hours: number
          used_hours: number
          remaining_hours: number
        }
        Relationships: []
      }
      pack_summary: {
        Row: {
          pack_id: string
          client_id: string
          pack_name: string
          hours_total: number
          used_hours: number
          remaining_hours: number
        }
        Relationships: []
      }
    }
    Functions: {
      current_client_id: {
        Args: Record<PropertyKey, never>
        Returns: string | null
      }
      current_client_email: {
        Args: Record<PropertyKey, never>
        Returns: string | null
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
