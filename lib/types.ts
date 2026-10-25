export type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  created_at: string;
};

export type CreditSale = {
  id: string;
  customer_id: string;
  sale_date: string; // YYYY-MM-DD
  material: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  credit_days: number;
  due_date: string; // YYYY-MM-DD
  notes?: string | null;
  created_at: string;
};

export type PaymentMethod = 'cash' | 'bank' | 'cheque';

export type Payment = {
  id: string;
  customer_id: string;
  payment_date: string; // YYYY-MM-DD
  amount: number;
  method: PaymentMethod;
  notes?: string | null;
  created_at: string;
};

export type SaleBalance = CreditSale & {
  paid_amount: number;
  outstanding: number;
  days_overdue: number;
};

export type CustomerStatus = 'paid' | 'pending' | 'overdue';

export type CustomerSummary = {
  customer_id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  total_credit_sale: number;
  payment_received: number; // all payments received from the customer
  outstanding: number; // unpaid amount of sales (FIFO)
  overdue: number; // unpaid amount of sales past their due date
  advance: number; // payments received beyond total sales
  next_due_date: string | null;
  status: CustomerStatus;
};

export type LedgerRow = {
  id: string;
  date: string;
  type: 'sale' | 'payment';
  material?: string;
  quantity?: number;
  unit?: string;
  rate?: number;
  debit: number; // Sale amount (increases balance)
  credit: number; // Payment amount (reduces balance)
  balance: number; // Running balance after this transaction
  credit_days?: number;
  due_date?: string;
  status?: 'Paid' | 'Pending' | 'Overdue' | '—';
  method?: string;
  notes?: string | null;
};

export type CustomerLedger = {
  rows: LedgerRow[]; // chronological order
  totalSale: number;
  totalReceived: number;
  outstanding: number;
  overdue: number;
  advance: number;
  nextDueDate: string | null;
  status: CustomerStatus;
};

/**
 * One row per customer + credit term, same shape as the `overdue_aging` view
 */
export type AgingRow = {
  customer_id: string;
  credit_days: number;
  total_outstanding: number;
  total_overdue: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
};

export type OverdueAgingBucket = {
  customer_id: string;
  customer_name: string;
  total_outstanding: number;
  total_overdue: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
};

export type AgingSummary = {
  notDue: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
};

export type MonthTotals = {
  materialSold: number;
  paymentReceived: number;
  paymentDue: number;
  balanceRemaining: number;
};

export type DashboardStats = {
  totalCreditSale: number;
  totalReceived: number;
  totalOutstanding: number;
  totalOverdue: number;
  totalAdvance: number;
  customerCount: number;
  customersWithBalance: number;
  customersOverdue: number;
  currentMonth: {
    name: string;
    sold: number;
    received: number;
    net: number; // sold − received (negative when more was collected than sold)
  };
  agingSummary: AgingSummary;
  topCustomers: {
    id: string;
    name: string;
    outstanding: number;
    totalSale: number;
    status: CustomerStatus;
  }[];
};

export type MonthlyBreakdownRow = {
  customerId: string;
  customerName: string;
  materialSold: number;
  paymentReceived: number;
  paymentDue: number;
  monthBalance: number;
};

export type MonthlyReport = MonthTotals & {
  month: string; // YYYY-MM
  formattedMonth: string;
  customerBreakdown: MonthlyBreakdownRow[];
};
