export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" }
  public: {
    Tables: {
      activities: {
        Row: { activity_type: string; client_id: string; created_at: string; description: string | null; id: string; minutes_used: number; notify_client: boolean; pack_id: string; title: string; updated_at: string; work_date: string }
        Insert: { activity_type: string; client_id: string; created_at?: string; description?: string | null; id?: string; minutes_used: number; notify_client?: boolean; pack_id: string; title: string; updated_at?: string; work_date?: string }
        Update: { activity_type?: string; client_id?: string; created_at?: string; description?: string | null; id?: string; minutes_used?: number; notify_client?: boolean; pack_id?: string; title?: string; updated_at?: string; work_date?: string }
        Relationships: [
          { foreignKeyName: "activities_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] },
          { foreignKeyName: "activities_pack_id_fkey"; columns: ["pack_id"]; isOneToOne: false; referencedRelation: "packs"; referencedColumns: ["id"] },
        ]
      }
      clients: {
        Row: { company: string | null; created_at: string; email: string; id: string; name: string; phone: string | null; status: string; updated_at: string }
        Insert: { company?: string | null; created_at?: string; email: string; id?: string; name: string; phone?: string | null; status?: string; updated_at?: string }
        Update: { company?: string | null; created_at?: string; email?: string; id?: string; name?: string; phone?: string | null; status?: string; updated_at?: string }
        Relationships: []
      }
      invoices: {
        Row: { amount: number; client_id: string; concept: string; created_at: string; id: string; issued_at: string; notes: string | null; number: string; paid_at: string | null; payment_method: string; status: string; updated_at: string }
        Insert: { amount: number; client_id: string; concept: string; created_at?: string; id?: string; issued_at?: string; notes?: string | null; number: string; paid_at?: string | null; payment_method?: string; status?: string; updated_at?: string }
        Update: { amount?: number; client_id?: string; concept?: string; created_at?: string; id?: string; issued_at?: string; notes?: string | null; number?: string; paid_at?: string | null; payment_method?: string; status?: string; updated_at?: string }
        Relationships: [{ foreignKeyName: "invoices_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] }]
      }
      messages: {
        Row: { body: string; client_id: string; created_at: string; direction: string; id: string; read_at: string | null; reply_to_id: string | null; subject: string; type: string }
        Insert: { body: string; client_id: string; created_at?: string; direction?: string; id?: string; read_at?: string | null; reply_to_id?: string | null; subject: string; type?: string }
        Update: { body?: string; client_id?: string; created_at?: string; direction?: string; id?: string; read_at?: string | null; reply_to_id?: string | null; subject?: string; type?: string }
        Relationships: [
          { foreignKeyName: "messages_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] },
          { foreignKeyName: "messages_reply_to_id_fkey"; columns: ["reply_to_id"]; isOneToOne: false; referencedRelation: "messages"; referencedColumns: ["id"] },
        ]
      }
      notifications: {
        Row: { activity_id: string | null; body: string | null; client_id: string; created_at: string; id: string; minutes_delta: number | null; remaining_minutes: number | null; title: string }
        Insert: { activity_id?: string | null; body?: string | null; client_id: string; created_at?: string; id?: string; minutes_delta?: number | null; remaining_minutes?: number | null; title: string }
        Update: { activity_id?: string | null; body?: string | null; client_id?: string; created_at?: string; id?: string; minutes_delta?: number | null; remaining_minutes?: number | null; title?: string }
        Relationships: [{ foreignKeyName: "notifications_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] }]
      }
      packs: {
        Row: { billing_cycle: string; client_id: string; created_at: string; id: string; invoice_number: string | null; minutes_total: number; name: string; notes: string | null; pack_type: string; paid: boolean; price: number | null; purchase_date: string; renewal_date: string | null; status: string; updated_at: string }
        Insert: { billing_cycle?: string; client_id: string; created_at?: string; id?: string; invoice_number?: string | null; minutes_total: number; name: string; notes?: string | null; pack_type?: string; paid?: boolean; price?: number | null; purchase_date?: string; renewal_date?: string | null; status?: string; updated_at?: string }
        Update: { billing_cycle?: string; client_id?: string; created_at?: string; id?: string; invoice_number?: string | null; minutes_total?: number; name?: string; notes?: string | null; pack_type?: string; paid?: boolean; price?: number | null; purchase_date?: string; renewal_date?: string | null; status?: string; updated_at?: string }
        Relationships: [{ foreignKeyName: "packs_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] }]
      }
      profiles: {
        Row: { created_at: string; email: string | null; id: string; role: string }
        Insert: { created_at?: string; email?: string | null; id: string; role?: string }
        Update: { created_at?: string; email?: string | null; id?: string; role?: string }
        Relationships: []
      }
      services: {
        Row: { client_id: string; created_at: string; id: string; name: string; notes: string | null; pack_id: string | null; price: number | null; service_date: string; service_type: string; status: string; updated_at: string }
        Insert: { client_id: string; created_at?: string; id?: string; name: string; notes?: string | null; pack_id?: string | null; price?: number | null; service_date?: string; service_type?: string; status?: string; updated_at?: string }
        Update: { client_id?: string; created_at?: string; id?: string; name?: string; notes?: string | null; pack_id?: string | null; price?: number | null; service_date?: string; service_type?: string; status?: string; updated_at?: string }
        Relationships: [
          { foreignKeyName: "services_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] },
          { foreignKeyName: "services_pack_id_fkey"; columns: ["pack_id"]; isOneToOne: false; referencedRelation: "packs"; referencedColumns: ["id"] },
        ]
      }
    }
    Views: {
      client_summary: { Row: { client_email: string | null; client_id: string | null; client_name: string | null; remaining_minutes: number | null; total_minutes: number | null; used_minutes: number | null }; Relationships: [] }
      pack_summary: {
        Row: { client_id: string | null; minutes_total: number | null; pack_id: string | null; pack_name: string | null; pack_type: 'hours' | 'tasks' | null; remaining_minutes: number | null; used_minutes: number | null }
        Relationships: [{ foreignKeyName: "packs_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] }]
      }
    }
    Functions: { next_invoice_number: { Args: never; Returns: string } }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends { Row: infer R } ? R : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends { Row: infer R } ? R : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Insert: infer I } ? I : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Insert: infer I } ? I : never : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Update: infer U } ? U : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Update: infer U } ? U : never : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"] : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions] : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"] : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions] : never

export const Constants = { public: { Enums: {} } } as const
