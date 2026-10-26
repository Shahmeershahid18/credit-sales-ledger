/**
 * Supabase database types for the schema in supabase/migrations.
 *
 * Written by hand to match the migrations. Once your Supabase project exists you can
 * regenerate this file with:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
 */

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string;
          full_name?: string;
          role?: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: string;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          phone: string | null;
          address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          name: string;
          phone?: string | null;
          address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          phone?: string | null;
          address?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      credit_sales: {
        Row: {
          id: string;
          owner_id: string;
          customer_id: string;
          sale_date: string;
          material: string;
          quantity: number;
          unit: string | null;
          rate: number;
          amount: number;
          credit_days: number;
          due_date: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          customer_id: string;
          sale_date?: string;
          material: string;
          quantity?: number;
          unit?: string | null;
          rate: number;
          credit_days?: number;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          customer_id?: string;
          sale_date?: string;
          material?: string;
          quantity?: number;
          unit?: string | null;
          rate?: number;
          credit_days?: number;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'credit_sales_customer_owner_fkey';
            columns: ['customer_id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id', 'owner_id'];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          owner_id: string;
          customer_id: string;
          payment_date: string;
          amount: number;
          method: string;
          sale_id: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          customer_id: string;
          payment_date?: string;
          amount: number;
          method?: string;
          sale_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          customer_id?: string;
          payment_date?: string;
          amount?: number;
          method?: string;
          sale_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_customer_owner_fkey';
            columns: ['customer_id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id', 'owner_id'];
          },
        ];
      };
      materials: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          unit: string;
          rate: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          name: string;
          unit?: string;
          rate?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          unit?: string;
          rate?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      sale_balances: {
        Row: {
          id: string | null;
          customer_id: string | null;
          sale_date: string | null;
          material: string | null;
          quantity: number | null;
          unit: string | null;
          rate: number | null;
          amount: number | null;
          credit_days: number | null;
          due_date: string | null;
          notes: string | null;
          created_at: string | null;
          paid_amount: number | null;
          outstanding: number | null;
          days_overdue: number | null;
          owner_id: string | null;
        };
        Relationships: [];
      };
      customer_summary: {
        Row: {
          customer_id: string | null;
          name: string | null;
          phone: string | null;
          address: string | null;
          total_credit_sale: number | null;
          payment_received: number | null;
          outstanding: number | null;
          overdue: number | null;
          advance: number | null;
          next_due_date: string | null;
          status: string | null;
          owner_id: string | null;
        };
        Relationships: [];
      };
      overdue_aging: {
        Row: {
          customer_id: string | null;
          credit_days: number | null;
          total_outstanding: number | null;
          total_overdue: number | null;
          d1_30: number | null;
          d31_60: number | null;
          d61_90: number | null;
          d90_plus: number | null;
          owner_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_active_user: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      app_today: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      monthly_report: {
        Args: { p_month: string; p_owner: string };
        Returns: {
          material_sold: number;
          payment_received: number;
          payment_due: number;
          balance_remaining: number;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
