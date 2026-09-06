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
      ai_trades: {
        Row: {
          amount: number
          created_at: string
          id: string
          price: number
          profit: number
          side: string
          symbol: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          price: number
          profit?: number
          side: string
          symbol: string
          user_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          price?: number
          profit?: number
          side?: string
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_trading_settings: {
        Row: {
          boost_date: string | null
          created_at: string
          daily_rate: number
          enabled: boolean
          id: string
          last_accrued_at: string | null
          last_payout_date: string | null
          plan_id: string
          plan_rate: number
          started_at: string | null
          total_profit: number
          updated_at: string
          user_id: string
        }
        Insert: {
          boost_date?: string | null
          created_at?: string
          daily_rate?: number
          enabled?: boolean
          id?: string
          last_accrued_at?: string | null
          last_payout_date?: string | null
          plan_id?: string
          plan_rate?: number
          started_at?: string | null
          total_profit?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          boost_date?: string | null
          created_at?: string
          daily_rate?: number
          enabled?: boolean
          id?: string
          last_accrued_at?: string | null
          last_payout_date?: string | null
          plan_id?: string
          plan_rate?: number
          started_at?: string | null
          total_profit?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crypto_deposits: {
        Row: {
          actually_paid: number
          created_at: string
          credited_at: string | null
          id: string
          pay_address: string | null
          pay_amount: number | null
          pay_currency: string
          payment_id: string | null
          plan_id: string | null
          price_amount: number
          price_currency: string
          purpose: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actually_paid?: number
          created_at?: string
          credited_at?: string | null
          id?: string
          pay_address?: string | null
          pay_amount?: number | null
          pay_currency: string
          payment_id?: string | null
          plan_id?: string | null
          price_amount: number
          price_currency?: string
          purpose?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actually_paid?: number
          created_at?: string
          credited_at?: string | null
          id?: string
          pay_address?: string | null
          pay_amount?: number | null
          pay_currency?: string
          payment_id?: string | null
          plan_id?: string | null
          price_amount?: number
          price_currency?: string
          purpose?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_ai_codes: {
        Row: {
          code: string
          code_date: string
          created_at: string
          sent_at: string | null
        }
        Insert: {
          code: string
          code_date: string
          created_at?: string
          sent_at?: string | null
        }
        Update: {
          code?: string
          code_date?: string
          created_at?: string
          sent_at?: string | null
        }
        Relationships: []
      }
      holdings: {
        Row: {
          amount: number
          created_at: string
          id: string
          symbol: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          symbol: string
          user_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount: number
          created_at: string
          filled_at: string | null
          id: string
          price: number
          side: string
          status: string
          symbol: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          filled_at?: string | null
          id?: string
          price: number
          side: string
          status?: string
          symbol: string
          type: string
          user_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          filled_at?: string | null
          id?: string
          price?: number
          side?: string
          status?: string
          symbol?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_buys: {
        Row: {
          active: boolean
          amount_usd: number
          created_at: string
          frequency: string
          id: string
          last_run: string | null
          symbol: string
          user_id: string
        }
        Insert: {
          active?: boolean
          amount_usd: number
          created_at?: string
          frequency: string
          id?: string
          last_run?: string | null
          symbol: string
          user_id?: string
        }
        Update: {
          active?: boolean
          amount_usd?: number
          created_at?: string
          frequency?: string
          id?: string
          last_run?: string | null
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          code: string
          created_at: string
          id: string
          referee_id: string
          referrer_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          referee_id: string
          referrer_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          referee_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      security_settings: {
        Row: {
          created_at: string
          id: string
          login_alerts: boolean
          two_factor_enabled: boolean
          user_id: string
          withdrawal_whitelist: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          login_alerts?: boolean
          two_factor_enabled?: boolean
          user_id?: string
          withdrawal_whitelist?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          login_alerts?: boolean
          two_factor_enabled?: boolean
          user_id?: string
          withdrawal_whitelist?: boolean
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          address: string
          amount: number
          created_at: string
          fee_amount: number
          fee_pct: number
          id: string
          net_amount: number
          status: string
          symbol: string
          usd_value: number
          user_id: string
        }
        Insert: {
          address: string
          amount: number
          created_at?: string
          fee_amount?: number
          fee_pct?: number
          id?: string
          net_amount?: number
          status?: string
          symbol: string
          usd_value?: number
          user_id?: string
        }
        Update: {
          address?: string
          amount?: number
          created_at?: string
          fee_amount?: number
          fee_pct?: number
          id?: string
          net_amount?: number
          status?: string
          symbol?: string
          usd_value?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_referral: { Args: { p_code: string }; Returns: Json }
      credit_crypto_deposit: {
        Args: {
          p_actually_paid: number
          p_payment_id: string
          p_status: string
        }
        Returns: undefined
      }
      ensure_daily_ai_code: { Args: never; Returns: string }
      get_my_referral_info: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_daily_ai_code_sent: { Args: never; Returns: undefined }
      purge_expired_ai_codes: { Args: never; Returns: number }
      redeem_ai_code: { Args: { p_code: string }; Returns: Json }
      run_daily_ai_trading_payout: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
