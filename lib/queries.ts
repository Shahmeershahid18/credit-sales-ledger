import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  getDemoData,
  calculateSaleBalances,
  calculateCustomerSummaries,
  calculateCustomerLedger,
  calculateAgingRows,
  groupAgingByCustomer,
  buildDashboardStats,
  calculateMonthTotals,
  buildMonthlyBreakdown,
  buildMonthlyReport,
} from './store';
import {
  AgingRow,
  Customer,
  CreditSale,
  CustomerLedger,
  CustomerStatus,
  CustomerSummary,
  DashboardStats,
  MonthTotals,
  MonthlyReport,
  OverdueAgingBucket,
  Payment,
  PaymentMethod,
} from './types';
import { calculateDueDate, getCurrentMonthStr, getTodayDateStr, nextMonthStart } from './format';

// All DB reads and writes live here. When Supabase is configured they go to the
// database (views + monthly_report RPC); otherwise they use the in-memory demo store.

type DB = SupabaseClient<Database>;

const PAGE_SIZE = 1000; // PostgREST returns at most 1000 rows per request by default
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getDb(): Promise<DB | null> {
  return createServerSupabaseClient();
}

/**
 * Runs a ranged query page by page until every row is fetched.
 * The query must have a stable order.
 */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

function check<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('No data returned');
  return data;
}

// ---------------------------------------------------------------------------
// Row mappers (database → app types)
// ---------------------------------------------------------------------------

type CustomerRow = Database['public']['Tables']['customers']['Row'];
type SaleRow = Database['public']['Tables']['credit_sales']['Row'];
type PaymentRow = Database['public']['Tables']['payments']['Row'];
type SummaryRow = Database['public']['Views']['customer_summary']['Row'];
type AgingViewRow = Database['public']['Views']['overdue_aging']['Row'];

const num = (v: number | string | null | undefined) => Number(v ?? 0);

function toCustomer(r: CustomerRow): Customer {
  return { id: r.id, name: r.name, phone: r.phone, address: r.address, created_at: r.created_at };
}

function toSale(r: SaleRow): CreditSale {
  return {
    id: r.id,
    customer_id: r.customer_id,
    sale_date: r.sale_date,
    material: r.material,
    quantity: num(r.quantity),
    unit: r.unit ?? '',
    rate: num(r.rate),
    amount: num(r.amount),
    credit_days: r.credit_days,
    due_date: r.due_date,
    notes: r.notes,
    created_at: r.created_at,
  };
}

function toPaymentMethod(value: string): PaymentMethod {
  return value === 'bank' || value === 'cheque' ? value : 'cash';
}

function toPayment(r: PaymentRow): Payment {
  return {
    id: r.id,
    customer_id: r.customer_id,
    payment_date: r.payment_date,
    amount: num(r.amount),
    method: toPaymentMethod(r.method),
    notes: r.notes,
    created_at: r.created_at,
  };
}

function toSummary(r: SummaryRow): CustomerSummary {
  const status: CustomerStatus = r.status === 'overdue' || r.status === 'pending' ? r.status : 'paid';
  return {
    customer_id: r.customer_id ?? '',
    name: r.name ?? '',
    phone: r.phone,
    address: r.address,
    total_credit_sale: num(r.total_credit_sale),
    payment_received: num(r.payment_received),
    outstanding: num(r.outstanding),
    overdue: num(r.overdue),
    advance: num(r.advance),
    next_due_date: r.next_due_date,
    status,
  };
}

function toAgingRow(r: AgingViewRow): AgingRow {
  return {
    customer_id: r.customer_id ?? '',
    credit_days: num(r.credit_days),
    total_outstanding: num(r.total_outstanding),
    total_overdue: num(r.total_overdue),
    d1_30: num(r.d1_30),
    d31_60: num(r.d31_60),
    d61_90: num(r.d61_90),
    d90_plus: num(r.d90_plus),
  };
}

// ---------------------------------------------------------------------------
// Supabase readers
// ---------------------------------------------------------------------------

async function fetchSummaries(db: DB): Promise<CustomerSummary[]> {
  const rows = await fetchAll((from, to) =>
    db.from('customer_summary').select('*').order('name').order('customer_id').range(from, to)
  );
  return rows.map(toSummary);
}

async function fetchAgingRows(db: DB, creditDays?: number): Promise<AgingRow[]> {
  const rows = await fetchAll((from, to) => {
    let q = db.from('overdue_aging').select('*');
    if (creditDays) q = q.eq('credit_days', creditDays);
    return q.order('customer_id').order('credit_days').range(from, to);
  });
  return rows.map(toAgingRow);
}

async function fetchCustomers(db: DB): Promise<Customer[]> {
  const rows = await fetchAll((from, to) => db.from('customers').select('*').order('name').order('id').range(from, to));
  return rows.map(toCustomer);
}

async function fetchMonthTotals(db: DB, month: string): Promise<MonthTotals> {
  const rows = check(await db.rpc('monthly_report', { p_month: `${month}-01` }));
  const r = rows[0];
  return {
    materialSold: num(r?.material_sold),
    paymentReceived: num(r?.payment_received),
    paymentDue: num(r?.payment_due),
    balanceRemaining: num(r?.balance_remaining),
  };
}

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

function demoSummaries(): CustomerSummary[] {
  const { customers, sales, payments } = getDemoData();
  return calculateCustomerSummaries(customers, calculateSaleBalances(sales, payments), payments).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

export async function getDashboardTotals(): Promise<DashboardStats> {
  const month = getCurrentMonthStr();
  const db = await getDb();

  if (!db) {
    const { sales, payments } = getDemoData();
    const balances = calculateSaleBalances(sales, payments);
    return buildDashboardStats(
      demoSummaries(),
      calculateAgingRows(balances),
      month,
      calculateMonthTotals(month, sales, payments, balances)
    );
  }

  const [summaries, agingRows, totals] = await Promise.all([
    fetchSummaries(db),
    fetchAgingRows(db),
    fetchMonthTotals(db, month),
  ]);
  return buildDashboardStats(summaries, agingRows, month, totals);
}

export async function getCustomerCards(search?: string): Promise<CustomerSummary[]> {
  const db = await getDb();
  const summaries = db ? await fetchSummaries(db) : demoSummaries();

  const query = search?.toLowerCase().trim();
  if (!query) return summaries;

  return summaries.filter(
    (c) =>
      c.name.toLowerCase().includes(query) ||
      (c.phone && c.phone.toLowerCase().includes(query)) ||
      (c.address && c.address.toLowerCase().includes(query))
  );
}

export async function getCustomers(): Promise<Customer[]> {
  const db = await getDb();
  if (!db) {
    return [...getDemoData().customers].sort((a, b) => a.name.localeCompare(b.name));
  }
  return fetchCustomers(db);
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const db = await getDb();
  if (!db) {
    return getDemoData().customers.find((c) => c.id === id) || null;
  }

  if (!UUID_RE.test(id)) return null;
  const { data, error } = await db.from('customers').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toCustomer(data) : null;
}

export async function getLedger(customerId: string): Promise<CustomerLedger> {
  const db = await getDb();
  if (!db) {
    const { sales, payments } = getDemoData();
    return calculateCustomerLedger(customerId, sales, payments);
  }

  const [sales, payments] = await Promise.all([
    fetchAll((from, to) =>
      db.from('credit_sales').select('*').eq('customer_id', customerId).order('sale_date').order('id').range(from, to)
    ),
    fetchAll((from, to) =>
      db.from('payments').select('*').eq('customer_id', customerId).order('payment_date').order('id').range(from, to)
    ),
  ]);
  return calculateCustomerLedger(customerId, sales.map(toSale), payments.map(toPayment), getTodayDateStr());
}

export async function getOverdue(creditDays?: number): Promise<OverdueAgingBucket[]> {
  const db = await getDb();

  if (!db) {
    const { customers, sales, payments } = getDemoData();
    const names = new Map(customers.map((c) => [c.id, c.name]));
    return groupAgingByCustomer(calculateAgingRows(calculateSaleBalances(sales, payments)), names, creditDays);
  }

  const [agingRows, customers] = await Promise.all([fetchAgingRows(db, creditDays), fetchCustomers(db)]);
  const names = new Map(customers.map((c) => [c.id, c.name]));
  return groupAgingByCustomer(agingRows, names, creditDays);
}

export async function getMonthlyReportData(month: string): Promise<MonthlyReport> {
  const db = await getDb();

  if (!db) {
    const { customers, sales, payments } = getDemoData();
    const totals = calculateMonthTotals(month, sales, payments, calculateSaleBalances(sales, payments));
    return buildMonthlyReport(month, totals, buildMonthlyBreakdown(month, customers, sales, payments));
  }

  const start = `${month}-01`;
  const end = nextMonthStart(month);

  const [totals, customers, soldOrDue, payments] = await Promise.all([
    fetchMonthTotals(db, month),
    fetchCustomers(db),
    // Sales either sold or falling due in this month
    fetchAll((from, to) =>
      db
        .from('credit_sales')
        .select('*')
        .or(`and(sale_date.gte.${start},sale_date.lt.${end}),and(due_date.gte.${start},due_date.lt.${end})`)
        .order('id')
        .range(from, to)
    ),
    fetchAll((from, to) =>
      db.from('payments').select('*').gte('payment_date', start).lt('payment_date', end).order('id').range(from, to)
    ),
  ]);

  return buildMonthlyReport(
    month,
    totals,
    buildMonthlyBreakdown(month, customers, soldOrDue.map(toSale), payments.map(toPayment))
  );
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

type CustomerInput = { name: string; phone?: string | null; address?: string | null };

function newDemoId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

export async function createCustomer(data: CustomerInput): Promise<Customer> {
  const values = { name: data.name, phone: data.phone || null, address: data.address || null };
  const db = await getDb();

  if (!db) {
    const customer: Customer = { id: newDemoId('cust'), ...values, created_at: new Date().toISOString() };
    getDemoData().customers.push(customer);
    return customer;
  }

  return toCustomer(check(await db.from('customers').insert(values).select().single()));
}

export async function updateCustomer(id: string, data: CustomerInput): Promise<Customer> {
  const values = { name: data.name, phone: data.phone || null, address: data.address || null };
  const db = await getDb();

  if (!db) {
    const customer = getDemoData().customers.find((c) => c.id === id);
    if (!customer) throw new Error('Customer not found');
    Object.assign(customer, values);
    return customer;
  }

  if (!UUID_RE.test(id)) throw new Error('Customer not found');
  return toCustomer(check(await db.from('customers').update(values).eq('id', id).select().single()));
}

export async function createCreditSale(data: {
  customer_id: string;
  sale_date: string;
  material: string;
  quantity: number;
  unit: string;
  rate: number;
  credit_days: number;
  notes?: string | null;
}): Promise<CreditSale> {
  const values = {
    customer_id: data.customer_id,
    sale_date: data.sale_date,
    material: data.material,
    quantity: data.quantity,
    unit: data.unit,
    rate: data.rate,
    credit_days: data.credit_days,
    notes: data.notes || null,
  };
  const db = await getDb();

  if (!db) {
    const store = getDemoData();
    if (!store.customers.some((c) => c.id === data.customer_id)) throw new Error('Customer not found');
    const sale: CreditSale = {
      id: newDemoId('sale'),
      ...values,
      amount: data.quantity * data.rate,
      due_date: calculateDueDate(data.sale_date, data.credit_days),
      created_at: new Date().toISOString(),
    };
    store.sales.push(sale);
    return sale;
  }

  // amount and due_date are generated columns in the database
  return toSale(check(await db.from('credit_sales').insert(values).select().single()));
}

export async function createPayment(data: {
  customer_id: string;
  payment_date: string;
  amount: number;
  method: PaymentMethod;
  notes?: string | null;
}): Promise<Payment> {
  const values = {
    customer_id: data.customer_id,
    payment_date: data.payment_date,
    amount: data.amount,
    method: data.method,
    notes: data.notes || null,
  };
  const db = await getDb();

  if (!db) {
    const store = getDemoData();
    if (!store.customers.some((c) => c.id === data.customer_id)) throw new Error('Customer not found');
    const payment: Payment = { id: newDemoId('pmt'), ...values, created_at: new Date().toISOString() };
    store.payments.push(payment);
    return payment;
  }

  return toPayment(check(await db.from('payments').insert(values).select().single()));
}
