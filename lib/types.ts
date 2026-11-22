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
  is_opening?: boolean; // the party's opening balance, not a sale or purchase
  created_at: string;
};

// 'adjustment': purchases set off against sales (a settlement), not money
// 'return': goods returned (by a customer, or to a vendor), not money
export type PaymentMethod = 'cash' | 'bank' | 'cheque' | 'adjustment' | 'return';

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
  is_opening?: boolean; // an opening balance in the party's favour (an advance), not money of that day
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
  cost_price: number | null; // what one unit of this product costs you to make
  created_at: string;
};

// ---------------------------------------------------------------------------
// Profit and loss
// ---------------------------------------------------------------------------

// expense: lowers net profit; investment / withdrawal: owner's money in or out, not profit
export type BusinessEntryKind = 'expense' | 'investment' | 'withdrawal';

export type BusinessEntry = {
  id: string;
  kind: BusinessEntryKind;
  entry_date: string; // YYYY-MM-DD
  amount: number;
  category: string | null; // expenses: rent, salaries…
  notes: string | null;
  created_at: string;
};

/** One line of a stock count: raw material or finished goods in hand */
export type StockItem = {
  kind: 'raw' | 'finished';
  name: string;
  quantity: number;
  unit: string;
  rate: number; // value per unit
  amount: number; // quantity × rate
};

/** The stock in hand at the end of a month: the closing stock of that month */
export type StockCount = {
  id: string;
  month: string; // YYYY-MM
  items: StockItem[];
  total: number;
  notes: string | null;
  updated_at: string;
};

/**
 * One month's profit. Cost of goods sold comes from the stock counts when both the
 * month and the month before are counted ('stock'); otherwise from the products'
 * cost prices ('estimate').
 */
export type ProfitMonth = {
  month: string; // YYYY-MM
  sales: number; // sales made (opening balances not included)
  customerReturns: number;
  netSales: number; // sales − customer returns
  purchases: number;
  vendorReturns: number;
  netPurchases: number; // purchases − vendor returns
  openingStock: number | null; // the month before's count
  closingStock: number | null; // this month's count
  method: 'stock' | 'estimate';
  costOfSales: number; // the figure used: from stock, or the estimate
  estimatedCost: number; // from cost prices (always worked out)
  uncosted: { name: string; amount: number }[]; // sales of products with no usable cost price
  grossProfit: number; // net sales − cost of sales
  expenses: number;
  netProfit: number; // gross profit − expenses
  invested: number;
  withdrawn: number;
};

/** Item-wise margin of the products sold in a month, from their cost prices */
export type ItemMargin = {
  key: string;
  name: string;
  unit: string; // the saved product's unit (sales in kg are counted as tons and the other way round)
  quantity: number;
  sales: number;
  costPrice: number | null;
  cost: number | null; // null when the cost price is missing or the unit does not match
};

export type ProfitReport = {
  month: ProfitMonth;
  previous: ProfitMonth;
  history: ProfitMonth[]; // oldest first, ending with `month`
  items: ItemMargin[];
  expensesByCategory: { category: string; amount: number }[]; // largest first
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
  payment_received: number; // money received from the customer (returns not included)
  returned: number; // goods returned: lowers the balance like a payment, but is not money
  outstanding: number; // unpaid amount of sales (FIFO)
  overdue: number; // unpaid amount of sales past their due date
  advance: number; // payments and returns beyond total sales
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
    netted: boolean; // customer and vendor: `outstanding` is the net after the other side
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

/** One customer return or vendor return, for the returns report */
export type ReturnEntry = {
  id: string;
  partyId: string;
  partyName: string;
  date: string; // YYYY-MM-DD
  amount: number;
  reason: string;
  against: string | null; // "Material · date" of the bill it was recorded against
};

/** Quantity of one material (in one unit) moved per month, in total and per party */
export type QuantityMaterial = {
  key: string; // material + unit, case-insensitive
  name: string;
  unit: string;
  entries: number; // sales (or purchases) recorded
  total: number;
  byMonth: number[]; // same order as QuantityHistory.months
  parties: { id: string; name: string; total: number; byMonth: number[] }[]; // largest total first
  combines?: string[]; // a combined total: the materials added up, e.g. "Item B (kg as ton)"
};

/** Customer-wise (or vendor-wise) monthly quantity history, one table per material */
export type QuantityHistory = {
  months: string[]; // YYYY-MM, oldest first
  materials: QuantityMaterial[]; // most recorded first
  combined: QuantityMaterial[]; // all materials added up, one per unit group (kg + ton as tons; bags; trucks…)
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

export type PartyEntryType = 'opening' | 'sale' | 'purchase' | 'return' | 'received' | 'paid' | 'adjustment';

/** What was owed before the party's first entry in the app */
export type OpeningBalance = {
  amount: number;
  direction: 'receivable' | 'payable'; // they owe you / you owe them
  date: string; // YYYY-MM-DD
  due_date: string | null; // opening bills only
};

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
  linked?: number; // bills: payments recorded against this bill
  notes?: string | null;
};

/** Totals of one side of a party's account */
export type PartySide = {
  total: number; // sales, or purchases
  paid: number; // money received, or paid (adjustments and returns not included)
  adjusted: number; // set off in settlements
  returned: number; // goods returned by the customer, or to the vendor
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
