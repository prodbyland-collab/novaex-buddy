import type { Database as GeneratedDatabase, Json, Tables } from "./types";

type PublicSchema = GeneratedDatabase["public"];
type Security = Tables<"security_settings"> & { approved_addresses: string[] };
type Announcement = {
  id: string;
  kind: "code" | "news";
  body: string;
  code: string | null;
  code_date: string | null;
  expires_at: string | null;
  author_id: string | null;
  created_at: string;
};
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
type Fn<Args, Returns> = { Args: Args; Returns: Returns };

// Extend generated types with the checked-in migrations until schema generation
// is run against the deployed database.
export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<PublicSchema, "Tables" | "Functions"> & {
    Tables: Omit<PublicSchema["Tables"], "security_settings"> & {
      security_settings: Table<Security>;
      group_announcements: Table<Announcement>;
      admin_audit_log: Table<{
        id: string;
        actor_id: string;
        actor_label: string;
        target_id: string | null;
        target_label: string | null;
        action: string;
        details: Json;
        outcome: string;
        error_message: string | null;
        created_at: string;
        completed_at: string | null;
      }>;
      member_notifications: Table<{
        id: string;
        user_id: string | null;
        kind: string;
        event_key: string;
        details: Json;
        created_at: string;
        expires_at: string | null;
      }>;
      notification_reads: Table<{ user_id: string; notification_id: string; read_at: string }>;
    };
    Functions: PublicSchema["Functions"] & {
      session_is_verified: Fn<Record<string, never>, boolean>;
      perform_admin_action: Fn<
        { p_actor: string; p_action: string; p_target?: string | null; p_details?: Json },
        Json
      >;
      begin_admin_auth_action: Fn<
        { p_actor: string; p_target: string; p_action: string; p_details?: Json },
        string
      >;
      finish_admin_auth_action: Fn<
        { p_id: string; p_success: boolean; p_error?: string | null },
        undefined
      >;
      mark_notifications_read: Fn<{ p_ids?: string[] | null }, undefined>;
      ensure_my_account: Fn<Record<string, never>, undefined>;
      set_my_trading_mode: Fn<{ p_enabled: boolean }, Tables<"ai_trading_settings">>;
      configure_my_security: Fn<{ p_whitelist: boolean; p_addresses: string[] }, Security>;
      record_withdrawal: Fn<
        {
          p_user_id: string;
          p_symbol: string;
          p_amount: number;
          p_address: string;
          p_unit_price: number;
          p_request_id: string;
        },
        Tables<"withdrawals">
      >;
      record_market_order: Fn<
        {
          p_user_id: string;
          p_symbol: string;
          p_side: string;
          p_amount: number;
          p_price: number;
          p_request_id: string;
        },
        Tables<"orders">
      >;
      admin_change_balance: Fn<
        { p_user_id: string; p_symbol: string; p_value: number; p_replace: boolean },
        number
      >;
      admin_change_withdrawal: Fn<{ p_id: string; p_status: string }, undefined>;
      publish_daily_group_code: Fn<Record<string, never>, string | null>;
      rotate_daily_group_code: Fn<Record<string, never>, string>;
      admin_account_totals: Fn<Record<string, never>, Json>;
      reserve_deposit: Fn<
        { p_user_id: string; p_currency: string; p_amount: number; p_plan_id: string | null },
        Json
      >;
    };
  };
};
