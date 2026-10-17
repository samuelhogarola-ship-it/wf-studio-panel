export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type PortalMode = 'legacy' | 'dynamic'
export type ProjectStatus = 'draft' | 'active' | 'archived'
export type CapabilityKey = 'products' | 'domains' | 'hosting' | 'invoices' | 'bonuses_reports' | 'blogger' | 'analytics'
export type CapabilityState = 'unavailable' | 'available' | 'active'

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" }
  public: {
    Tables: {
      client_projects: {
        Row: { id: string; client_id: string | null; slug: string; name: string; domain: string; status: ProjectStatus; client_access_enabled: boolean; hosting_label: string | null; hosting_management_url: string | null; analytics_registry_key: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; client_id?: string | null; slug: string; name: string; domain: string; status?: ProjectStatus; client_access_enabled?: boolean; hosting_label?: string | null; hosting_management_url?: string | null; analytics_registry_key?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; client_id?: string | null; slug?: string; name?: string; domain?: string; status?: ProjectStatus; client_access_enabled?: boolean; hosting_label?: string | null; hosting_management_url?: string | null; analytics_registry_key?: string | null; created_at?: string; updated_at?: string }
        Relationships: [{ foreignKeyName: "client_projects_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] }]
      }
      project_capabilities: {
        Row: { id: string; project_id: string; capability_key: CapabilityKey; state: CapabilityState; launch_url: string | null; metadata: Json; validated_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; project_id: string; capability_key: CapabilityKey; state?: CapabilityState; launch_url?: string | null; metadata?: Json; validated_at?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; project_id?: string; capability_key?: CapabilityKey; state?: CapabilityState; launch_url?: string | null; metadata?: Json; validated_at?: string | null; created_at?: string; updated_at?: string }
        Relationships: [{ foreignKeyName: "project_capabilities_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "client_projects"; referencedColumns: ["id"] }]
      }
      project_capability_audit: {
        Row: { id: string; project_id: string; capability_id: string; capability_key: CapabilityKey; actor_id: string | null; operation: 'INSERT' | 'UPDATE' | 'DELETE'; old_record: Json | null; new_record: Json | null; created_at: string }
        Insert: never
        Update: never
        Relationships: []
      }
      tool_launch_tickets: {
        Row: { code_hash: string; protocol: 'wf-blogger-handoff/v1'; site_key: string; audience: string; project_id: string; client_id: string | null; user_id: string; actor_role: 'admin' | 'client'; created_at: string; expires_at: string; consumed_at: string | null }
        Insert: never
        Update: never
        Relationships: [
          { foreignKeyName: "tool_launch_tickets_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "client_projects"; referencedColumns: ["id"] },
          { foreignKeyName: "tool_launch_tickets_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] },
        ]
      }
      client_resources: {
        Row: { id: string; client_id: string; kind: 'report' | 'update' | 'photo'; title: string; body: string; report_path: string | null; storage_path: string | null; content_type: string | null; created_by: string | null; created_at: string }
        Insert: { id?: string; client_id: string; kind: 'report' | 'update' | 'photo'; title: string; body?: string; report_path?: string | null; storage_path?: string | null; content_type?: string | null; created_by?: string | null; created_at?: string }
        Update: { title?: string; body?: string }
        Relationships: []
      }
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
        Row: { company: string | null; created_at: string; email: string; id: string; name: string; phone: string | null; project: string; portal_mode: PortalMode; status: string; updated_at: string }
        Insert: { company?: string | null; created_at?: string; email: string; id?: string; name: string; phone?: string | null; project?: string; portal_mode?: PortalMode; status?: string; updated_at?: string }
        Update: { company?: string | null; created_at?: string; email?: string; id?: string; name?: string; phone?: string | null; project?: string; portal_mode?: PortalMode; status?: string; updated_at?: string }
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
      monthly_stat_reports: {
        Row: { created_at: string; delivery_claim_token: string | null; delivery_claimed_at: string | null; email_message_id: string | null; email_sent_at: string | null; email_to: string | null; generated_at: string; is_complete: boolean; label: string; last_delivery_error: string | null; markdown: string; month_key: string; site_reports: Json; updated_at: string }
        Insert: { created_at?: string; delivery_claim_token?: string | null; delivery_claimed_at?: string | null; email_message_id?: string | null; email_sent_at?: string | null; email_to?: string | null; generated_at: string; is_complete?: boolean; label: string; last_delivery_error?: string | null; markdown: string; month_key: string; site_reports?: Json; updated_at?: string }
        Update: { created_at?: string; delivery_claim_token?: string | null; delivery_claimed_at?: string | null; email_message_id?: string | null; email_sent_at?: string | null; email_to?: string | null; generated_at?: string; is_complete?: boolean; label?: string; last_delivery_error?: string | null; markdown?: string; month_key?: string; site_reports?: Json; updated_at?: string }
        Relationships: []
      }
      notifications: {
        Row: { activity_id: string | null; body: string | null; client_id: string; created_at: string; id: string; minutes_delta: number | null; remaining_minutes: number | null; title: string }
        Insert: { activity_id?: string | null; body?: string | null; client_id: string; created_at?: string; id?: string; minutes_delta?: number | null; remaining_minutes?: number | null; title: string }
        Update: { activity_id?: string | null; body?: string | null; client_id?: string; created_at?: string; id?: string; minutes_delta?: number | null; remaining_minutes?: number | null; title?: string }
        Relationships: [{ foreignKeyName: "notifications_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] }]
      }
      pending_items: {
        Row: { client_id: string; created_at: string; description: string | null; id: string; last_reminder_sent_at: string | null; next_reminder_at: string | null; received_at: string | null; reminder_interval_days: number | null; requested_at: string; sort_order: number; status: string; title: string; updated_at: string }
        Insert: { client_id: string; created_at?: string; description?: string | null; id?: string; last_reminder_sent_at?: string | null; next_reminder_at?: string | null; received_at?: string | null; reminder_interval_days?: number | null; requested_at?: string; sort_order?: number; status?: string; title: string; updated_at?: string }
        Update: { client_id?: string; created_at?: string; description?: string | null; id?: string; last_reminder_sent_at?: string | null; next_reminder_at?: string | null; received_at?: string | null; reminder_interval_days?: number | null; requested_at?: string; sort_order?: number; status?: string; title?: string; updated_at?: string }
        Relationships: [{ foreignKeyName: "pending_items_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] }]
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
    Functions: {
      claim_monthly_stat_report_delivery: { Args: { p_claim_token: string; p_email_to: string; p_month_key: string }; Returns: boolean }
      complete_monthly_stat_report_delivery: { Args: { p_claim_token: string; p_message_id: string | null; p_month_key: string; p_sent_at: string }; Returns: boolean }
      next_invoice_number: { Args: never; Returns: string }
      release_monthly_stat_report_delivery: { Args: { p_claim_token: string; p_error: string; p_month_key: string }; Returns: boolean }
      claim_monthly_stat_report_delivery_snapshot: { Args: { p_claim_token: string; p_email_to: string; p_month_key: string }; Returns: Json }
      save_monthly_stat_report_snapshot: { Args: { p_generated_at: string; p_is_complete: boolean; p_label: string; p_markdown: string; p_month_key: string; p_site_reports: Json }; Returns: string }
      create_tool_launch_ticket: { Args: { p_code_hash: string; p_protocol: string; p_site_key: string; p_audience: string; p_project_id: string; p_client_id: string | null; p_user_id: string; p_actor_role: string }; Returns: { expires_at: string }[] }
      consume_tool_launch_ticket: { Args: { p_code_hash: string; p_protocol: string; p_site_key: string; p_audience: string }; Returns: { protocol: string; site_key: string; audience: string; project_id: string; client_id: string | null; user_id: string; actor_role: string; expires_at: string }[] }
    }
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
