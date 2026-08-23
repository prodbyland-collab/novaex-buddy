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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
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
          price_amount: number
          price_currency: string
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
          price_amount: number
          price_currency?: string
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
          price_amount?: number
          price_currency?: string
          status?: string
          updated_at?: string
          user_id?: string
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
      withdrawals: {
        Row: {
          address: string
          amount: number
          created_at: string
          id: string
          status: string
          symbol: string
          usd_value: number
          user_id: string
        }
        Insert: {
          address: string
          amount: number
          created_at?: string
          id?: string
          status?: string
          symbol: string
          usd_value?: number
          user_id?: string
        }
        Update: {
          address?: string
          amount?: number
          created_at?: string
          id?: string
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
      credit_crypto_deposit: {
        Args: {
          p_actually_paid: number
          p_payment_id: string
          p_status: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
