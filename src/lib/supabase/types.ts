export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type PortalMode = 'legacy' | 'dynamic'
export type ProjectStatus = 'draft' | 'active' | 'archived'
export type ProductTier = 'lite' | 'express' | 'pro'
export type CapabilityKey = 'products' | 'domains' | 'hosting' | 'invoices' | 'bonuses_reports' | 'blogger' | 'analytics'
export type CapabilityState = 'unavailable' | 'available' | 'active'
export type SupportEndReason = 'manual' | 'expired' | 'replaced' | 'client_inactive' | 'access_revoked'
export type SupportSessionRow = { id: string; admin_user_id: string; client_id: string; token_hash: string; return_path: string; started_at: string; expires_at: string; ended_at: string | null; end_reason: SupportEndReason | null }

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" }
  public: {
    Tables: {
      admin_support_sessions: {
        Row: SupportSessionRow
        Insert: never
        Update: never
        Relationships: []
      }
      admin_support_events: {
        Row: { id: string; support_session_id: string; admin_user_id: string; client_id: string; project_id: string; capability_key: CapabilityKey; scope: 'support_readonly'; created_at: string }
        Insert: never
        Update: never
        Relationships: [{ foreignKeyName: "admin_support_events_session_owner_client_fkey"; columns: ["support_session_id", "admin_user_id", "client_id"]; isOneToOne: false; referencedRelation: "admin_support_sessions"; referencedColumns: ["id", "admin_user_id", "client_id"] }]
      }
      admin_project_favorites: {
        Row: { admin_user_id: string; project_id: string; position: number | null; created_at: string }
        Insert: { admin_user_id: string; project_id: string; position?: number | null; created_at?: string }
        Update: { admin_user_id?: string; project_id?: string; position?: number | null; created_at?: string }
        Relationships: [{ foreignKeyName: "admin_project_favorites_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "client_projects"; referencedColumns: ["id"] }]
      }
      client_projects: {
        Row: { id: string; client_id: string | null; slug: string; name: string; domain: string; status: ProjectStatus; product_tier: ProductTier | null; client_access_enabled: boolean; hosting_label: string | null; hosting_management_url: string | null; analytics_registry_key: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; client_id?: string | null; slug: string; name: string; domain: string; status?: ProjectStatus; product_tier?: ProductTier | null; client_access_enabled?: boolean; hosting_label?: string | null; hosting_management_url?: string | null; analytics_registry_key?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; client_id?: string | null; slug?: string; name?: string; domain?: string; status?: ProjectStatus; product_tier?: ProductTier | null; client_access_enabled?: boolean; hosting_label?: string | null; hosting_management_url?: string | null; analytics_registry_key?: string | null; created_at?: string; updated_at?: string }
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
      blogger_site_memberships: {
        Row: { id: string; user_id: string; site_key: string; created_by: string | null; created_at: string }
        Insert: { id?: string; user_id: string; site_key: string; created_by?: string | null; created_at?: string }
        Update: { user_id?: string; site_key?: string; created_by?: string | null }
        Relationships: []
      }
      client_resources: {
        Row: { id: string; client_id: string; kind: 'report' | 'update' | 'photo'; title: string; body: string; report_path: string | null; storage_path: string | null; content_type: string | null; created_by: string | null; created_at: string }
        Insert: { id?: string; client_id: string; kind: 'report' | 'update' | 'photo'; title: string; body?: string; report_path?: string | null; storage_path?: string | null; content_type?: string | null; created_by?: string | null; created_at?: string }
        Update: { title?: string; body?: string }
        Relationships: []
      }
      billing_products: {
        Row: { id: string; name: string; description: string | null; default_net_cents: number | null; tax_mode: string; tax_rate_bps: number; active: boolean; sort_order: number; created_at: string; updated_at: string }
        Insert: { id?: string; name: string; description?: string | null; default_net_cents?: number | null; tax_mode?: string; tax_rate_bps?: number; active?: boolean; sort_order?: number; created_at?: string; updated_at?: string }
        Update: { name?: string; description?: string | null; default_net_cents?: number | null; tax_mode?: string; tax_rate_bps?: number; active?: boolean; sort_order?: number; updated_at?: string }
        Relationships: []
      }
      billing_documents: {
        Row: { id: string; document_type: string; number: string | null; status: string; client_id: string | null; recipient_name: string; recipient_email: string; recipient_company: string | null; title: string; notes: string | null; document_date: string; due_date: string | null; source_proposal_id: string | null; parent_invoice_id: string | null; net_cents: number; tax_cents: number; total_cents: number; issued_at: string | null; created_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; document_type: string; number?: string | null; status?: string; client_id?: string | null; recipient_name: string; recipient_email: string; recipient_company?: string | null; title: string; notes?: string | null; document_date?: string; due_date?: string | null; source_proposal_id?: string | null; parent_invoice_id?: string | null; net_cents?: number; tax_cents?: number; total_cents?: number; issued_at?: string | null; created_by?: string | null; created_at?: string; updated_at?: string }
        Update: { document_type?: string; number?: string | null; status?: string; client_id?: string | null; recipient_name?: string; recipient_email?: string; recipient_company?: string | null; title?: string; notes?: string | null; document_date?: string; due_date?: string | null; source_proposal_id?: string | null; parent_invoice_id?: string | null; net_cents?: number; tax_cents?: number; total_cents?: number; issued_at?: string | null; updated_at?: string }
        Relationships: [{ foreignKeyName: "billing_documents_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] }]
      }
      billing_document_lines: {
        Row: { id: string; document_id: string; product_id: string | null; product_name: string | null; description: string; quantity: number; unit_net_cents: number; tax_mode: string; tax_rate_bps: number; net_cents: number; tax_cents: number; total_cents: number; sort_order: number; created_at: string }
        Insert: { id?: string; document_id: string; product_id?: string | null; product_name?: string | null; description: string; quantity: number; unit_net_cents: number; tax_mode: string; tax_rate_bps: number; net_cents: number; tax_cents: number; total_cents: number; sort_order?: number; created_at?: string }
        Update: never
        Relationships: [{ foreignKeyName: "billing_document_lines_document_id_fkey"; columns: ["document_id"]; isOneToOne: false; referencedRelation: "billing_documents"; referencedColumns: ["id"] }]
      }
      billing_number_sequences: {
        Row: { series: string; year: number; last_number: number }
        Insert: never
        Update: never
        Relationships: []
      }
      billing_payments: {
        Row: { id: string; document_id: string; amount_cents: number; paid_on: string; method: string; note: string | null; advance_invoice_id: string | null; reversed_at: string | null; reversed_by: string | null; created_by: string | null; created_at: string }
        Insert: { id?: string; document_id: string; amount_cents: number; paid_on?: string; method: string; note?: string | null; advance_invoice_id?: string | null; reversed_at?: string | null; reversed_by?: string | null; created_by?: string | null; created_at?: string }
        Update: { reversed_at?: string | null; reversed_by?: string | null }
        Relationships: [{ foreignKeyName: "billing_payments_document_id_fkey"; columns: ["document_id"]; isOneToOne: false; referencedRelation: "billing_documents"; referencedColumns: ["id"] }]
      }
      billing_payment_options: {
        Row: { id: string; document_id: string; method: string; url: string | null; instructions: string | null; active: boolean; created_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; document_id: string; method: string; url?: string | null; instructions?: string | null; active?: boolean; created_by?: string | null; created_at?: string; updated_at?: string }
        Update: { method?: string; url?: string | null; instructions?: string | null; active?: boolean; updated_at?: string }
        Relationships: [{ foreignKeyName: "billing_payment_options_document_id_fkey"; columns: ["document_id"]; isOneToOne: true; referencedRelation: "billing_documents"; referencedColumns: ["id"] }]
      }
      billing_share_links: {
        Row: { id: string; document_id: string; token_hash: string; expires_at: string; revoked_at: string | null; created_by: string | null; created_at: string }
        Insert: { id?: string; document_id: string; token_hash: string; expires_at?: string; revoked_at?: string | null; created_by?: string | null; created_at?: string }
        Update: { revoked_at?: string | null }
        Relationships: [{ foreignKeyName: "billing_share_links_document_id_fkey"; columns: ["document_id"]; isOneToOne: false; referencedRelation: "billing_documents"; referencedColumns: ["id"] }]
      }
      ledger_income: {
        Row: { id: string; category: string; description: string; occurred_on: string; source_mode: string; net_cents: number; tax_mode: string; tax_rate_bps: number; tax_cents: number; total_cents: number; created_by: string | null; created_at: string }
        Insert: { id?: string; category: string; description: string; occurred_on: string; source_mode: string; net_cents: number; tax_mode: string; tax_rate_bps: number; tax_cents: number; total_cents: number; created_by?: string | null; created_at?: string }
        Update: never
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
        Row: { amount: number; client_id: string | null; concept: string; created_at: string; id: string; issued_at: string; notes: string | null; number: string; paid_at: string | null; payment_method: string; recipient_company: string | null; recipient_email: string; recipient_kind: string; recipient_name: string; status: string; updated_at: string }
        Insert: { amount: number; client_id?: string | null; concept: string; created_at?: string; id?: string; issued_at?: string; notes?: string | null; number: string; paid_at?: string | null; payment_method?: string; recipient_company?: string | null; recipient_email: string; recipient_kind?: string; recipient_name: string; status?: string; updated_at?: string }
        Update: { amount?: number; client_id?: string | null; concept?: string; created_at?: string; id?: string; issued_at?: string; notes?: string | null; number?: string; paid_at?: string | null; payment_method?: string; recipient_company?: string | null; recipient_email?: string; recipient_kind?: string; recipient_name?: string; status?: string; updated_at?: string }
        Relationships: [{ foreignKeyName: "invoices_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] }]
      }
      invoice_audit: {
        Row: { id: string; invoice_id: string; actor_id: string | null; operation: string; old_record: Json | null; new_record: Json | null; created_at: string }
        Insert: never
        Update: never
        Relationships: []
      }
      payment_requests: {
        Row: { id: string; client_id: string | null; recipient_name: string; recipient_email: string; recipient_company: string | null; concept: string; amount: number; status: string; created_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; client_id?: string | null; recipient_name: string; recipient_email: string; recipient_company?: string | null; concept: string; amount: number; status?: string; created_by?: string | null; created_at?: string; updated_at?: string }
        Update: { client_id?: string | null; recipient_name?: string; recipient_email?: string; recipient_company?: string | null; concept?: string; amount?: number; status?: string; updated_at?: string }
        Relationships: []
      }
      payment_links: {
        Row: { id: string; payment_request_id: string | null; invoice_id: string | null; provider: string; url: string; created_by: string | null; created_at: string }
        Insert: { id?: string; payment_request_id?: string | null; invoice_id?: string | null; provider?: string; url: string; created_by?: string | null; created_at?: string }
        Update: { url?: string }
        Relationships: []
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
      save_billing_product: { Args: { p_id: string | null; p_name: string; p_description: string | null; p_default_net_cents: number | null; p_tax_mode: string; p_tax_rate_bps: number; p_active: boolean; p_sort_order: number }; Returns: Database['public']['Tables']['billing_products']['Row'] }
      delete_billing_product: { Args: { p_id: string }; Returns: boolean }
      save_billing_document_draft: { Args: { p_id: string | null; p_document_type: string; p_client_id: string | null; p_recipient_name: string; p_recipient_email: string; p_recipient_company: string | null; p_title: string; p_notes: string | null; p_document_date: string; p_due_date: string | null; p_source_proposal_id: string | null; p_parent_invoice_id: string | null; p_lines: Json }; Returns: Database['public']['Tables']['billing_documents']['Row'] }
      issue_billing_document: { Args: { p_document_id: string }; Returns: Database['public']['Tables']['billing_documents']['Row'] }
      record_billing_payment: { Args: { p_document_id: string; p_amount_cents: number; p_paid_on: string; p_method: string; p_note: string | null }; Returns: { payment_id: string; balance_cents: number; advance_invoice_id: string | null }[] }
      reverse_billing_payment: { Args: { p_payment_id: string }; Returns: boolean }
      set_billing_payment_option: { Args: { p_document_id: string; p_method: string; p_url: string | null; p_instructions: string | null; p_active: boolean }; Returns: boolean }
      create_billing_share: { Args: { p_document_id: string; p_token_hash: string; p_expires_at: string }; Returns: Database['public']['Tables']['billing_share_links']['Row'] }
      revoke_billing_share: { Args: { p_share_id: string }; Returns: boolean }
      resolve_billing_share: { Args: { p_token_hash: string }; Returns: Json }
      create_ledger_income: { Args: { p_category: string; p_description: string; p_occurred_on: string; p_source_mode: string; p_net_cents: number; p_tax_mode: string; p_tax_rate_bps: number }; Returns: Database['public']['Tables']['ledger_income']['Row'] }
      mark_message_read: { Args: { p_message_id: string }; Returns: undefined }
      create_invoice_draft: { Args: { p_amount: number; p_client_id: string | null; p_concept: string; p_issued_at: string; p_notes: string | null; p_payment_method: string; p_recipient_company: string | null; p_recipient_email: string; p_recipient_kind: string; p_recipient_name: string }; Returns: { id: string; number: string }[] }
      issue_invoice_with_payment_link: { Args: { p_invoice_id: string; p_payment_url: string | null }; Returns: { id: string; number: string; status: string }[] }
      mark_invoice_paid: { Args: { p_invoice_id: string }; Returns: boolean }
      start_admin_support_session: { Args: { p_client_id: string; p_token_hash: string; p_return_path: string }; Returns: SupportSessionRow[] }
      end_admin_support_session: { Args: { p_token_hash: string; p_reason: SupportEndReason }; Returns: boolean }
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
