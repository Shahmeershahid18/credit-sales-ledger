import type { ContactKind } from './contacts';

/**
 * A party: a customer (you sell to them on credit), a vendor (you buy from them on
 * credit), or both. Each entry says which side it is on.
 */
export type Customer = {
  id: string;
  is_customer: boolean;
  is_vendor: boolean;
  name: string;
  phone?: string | null;
  address?: string | null;
  created_at: string;
};

/** A bill: a credit sale (kind 'customer') or a credit purchase (kind 'vendor') */
export type CreditSale = {
  id: string;
  customer_id: string;
  kind: ContactKind;
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

// 'adjustment': purchases set off against sales (a settlement), not money
export type PaymentMethod = 'cash' | 'bank' | 'cheque' | 'adjustment';

/** A payment received (kind 'customer') or made (kind 'vendor') */
export type Payment = {
  id: string;
  customer_id: string;
  kind: ContactKind;
  payment_date: string; // YYYY-MM-DD
  amount: number;
  method: PaymentMethod;
  sale_id?: string | null; // optional: the sale this payment was made against
  settlement_id?: string | null; // the two halves of one adjustment share it
  notes?: string | null;
  created_at: string;
};

/**
 * A saved material shown as a quick-pick pill on the sale and purchase forms
 */
export type Material = {
  id: string;
  name: string;
  unit: string;
  rate: number | null; // sale rate
  purchase_rate: number | null;
  created_at: string;
};

/**
 * A customer's sale as offered in the "For sale" picker on the payment form
 */
export type SaleOption = {
  id: string;
  sale_date: string;
  material: string;
  quantity: number;
  unit: string;
  amount: number;
  outstanding: number;
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
  is_customer: boolean;
  is_vendor: boolean;
  net?: number; // parties that are both: + they owe you, − you owe them
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
  against?: string; // payments: "Material · date" of the linked sale
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
  dueThisWeek: number; // unpaid amounts falling due in the next 7 days
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

/** Money moved in one month, on both sides */
export type MonthFlow = {
  month: string; // YYYY-MM
  sold: number; // credit sales made
  received: number; // payments from customers
  purchased: number; // credit purchases made
  paid: number; // payments to vendors
};

/**
 * Both sides of the dashboard, plus what you will receive and pay once each party's
 * sales and purchases are netted against each other
 */
export type DashboardData = Record<ContactKind, DashboardStats> & {
  net: { toReceive: number; toPay: number; receiveParties: number; payParties: number };
};

// ---------------------------------------------------------------------------
// One party, one combined ledger
// ---------------------------------------------------------------------------

export type PartyEntryType = 'sale' | 'purchase' | 'received' | 'paid' | 'adjustment';

/**
 * One line of a party's combined ledger. Debit: sales and payments you made (they
 * owe you more). Credit: purchases and payments you received (you owe them more).
 */
export type PartyLedgerRow = {
  id: string;
  date: string;
  type: PartyEntryType;
  material?: string;
  quantity?: number;
  unit?: string;
  rate?: number;
  amount: number;
  debit: number;
  credit: number;
  balance: number; // after this line: + receivable (Dr), − payable (Cr)
  credit_days?: number;
  due_date?: string;
  status?: 'Paid' | 'Pending' | 'Overdue'; // bills only
  method?: PaymentMethod;
  against?: string; // payments: "Material · date" of the linked bill
  notes?: string | null;
};

/** Totals of one side of a party's account */
export type PartySide = {
  total: number; // sales, or purchases
  paid: number; // money received, or paid (adjustments not included)
  adjusted: number; // set off in settlements
  outstanding: number; // unpaid bills
  overdue: number;
  advance: number;
  nextDueDate: string | null;
  status: CustomerStatus;
};

export type PartyLedger = {
  rows: PartyLedgerRow[]; // chronological
  customer: PartySide;
  vendor: PartySide;
  net: number; // + they owe you (receivable), − you owe them (payable)
  settleable: number; // most that can be set off: the smaller side's unpaid bills
};

export type PartyStatement = {
  from: string;
  to: string;
  opening: number; // balance before `from`: + receivable, − payable
  closing: number;
  totalDebit: number;
  totalCredit: number;
  rows: PartyLedgerRow[];
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
  month: string; // YYYY-MM, or YYYY for a yearly report
  formattedMonth: string; // "October 2026", or "2026"
  customerBreakdown: MonthlyBreakdownRow[];
};

export type UserRole = 'admin' | 'user';

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  active: boolean;
  created_at: string;
};

/** A user in the admin's Users list, with a summary of their ledger */
export type UserListItem = Profile & {
  customerCount: number;
  outstanding: number;
  overdue: number;
};
