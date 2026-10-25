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
  Material,
  MonthTotals,
  SaleOption,
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
    sale_id: r.sale_id ?? null,
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

/**
 * A customer's sales, newest first, with what is still unpaid on each.
 * Powers the "For sale" picker on the payment form.
 */
export async function getCustomerSaleOptions(customerId: string): Promise<SaleOption[]> {
  const db = await getDb();

  let balances: { id: string; sale_date: string; material: string; quantity: number; unit: string; amount: number; outstanding: number }[];
  if (!db) {
    const { sales, payments } = getDemoData();
    balances = calculateSaleBalances(
      sales.filter((s) => s.customer_id === customerId),
      payments.filter((p) => p.customer_id === customerId)
    );
  } else {
    if (!UUID_RE.test(customerId)) return [];
    const rows = await fetchAll((from, to) =>
      db.from('sale_balances').select('*').eq('customer_id', customerId).order('sale_date').order('id').range(from, to)
    );
    balances = rows.map((r) => ({
      id: r.id ?? '',
      sale_date: r.sale_date ?? '',
      material: r.material ?? '',
      quantity: num(r.quantity),
      unit: r.unit ?? '',
      amount: num(r.amount),
      outstanding: num(r.outstanding),
    }));
  }

  return balances
    .map((b) => ({
      id: b.id,
      sale_date: b.sale_date,
      material: b.material,
      quantity: b.quantity,
      unit: b.unit,
      amount: b.amount,
      outstanding: b.outstanding,
    }))
    .sort((a, b) => b.sale_date.localeCompare(a.sale_date));
}

// ---------------------------------------------------------------------------
// Materials (quick-pick pills on the sale form)
// ---------------------------------------------------------------------------

type MaterialRow = Database['public']['Tables']['materials']['Row'];
type MaterialInput = { name: string; unit: string; rate: number | null };

const MATERIALS_MIGRATION = 'supabase/migrations/20261026020000_materials_and_payment_sale.sql';

/**
 * True when a PostgREST error means a table or column from a newer migration is missing
 */
function isMissingSchema(error: { code?: string; message: string }) {
  return ['PGRST205', 'PGRST204', '42P01', '42703'].includes(error.code ?? '') || /schema cache|does not exist/i.test(error.message);
}

function materialError(error: { code?: string; message: string }): Error {
  if (isMissingSchema(error)) {
    return new Error(`Saved materials need a database update. Run ${MATERIALS_MIGRATION} in the Supabase SQL Editor.`);
  }
  if (error.code === '23505') {
    return new Error('A material with this name already exists.');
  }
  return new Error(error.message);
}

function toMaterial(r: MaterialRow): Material {
  return { id: r.id, name: r.name, unit: r.unit, rate: r.rate === null ? null : num(r.rate), created_at: r.created_at };
}

const byName = (a: Material, b: Material) => a.name.localeCompare(b.name);
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Saved materials, A–Z. Returns `available: false` when the materials table
 * has not been created yet, so the sale form still works.
 */
export async function getMaterials(): Promise<{ materials: Material[]; available: boolean }> {
  const db = await getDb();
  if (!db) {
    return { materials: [...getDemoData().materials].sort(byName), available: true };
  }

  const { data, error } = await db.from('materials').select('*').order('name').limit(1000);
  if (error) {
    if (isMissingSchema(error)) return { materials: [], available: false };
    throw new Error(error.message);
  }
  return { materials: (data ?? []).map(toMaterial), available: true };
}

export async function createMaterial(input: MaterialInput): Promise<Material> {
  const db = await getDb();

  if (!db) {
    const list = getDemoData().materials;
    if (list.some((m) => sameName(m.name, input.name))) throw new Error('A material with this name already exists.');
    const material: Material = { id: newDemoId('mat'), ...input, created_at: new Date().toISOString() };
    list.push(material);
    return material;
  }

  const { data, error } = await db.from('materials').insert(input).select().single();
  if (error) throw materialError(error);
  return toMaterial(data);
}

export async function updateMaterial(id: string, input: MaterialInput): Promise<Material> {
  const db = await getDb();

  if (!db) {
    const list = getDemoData().materials;
    const material = list.find((m) => m.id === id);
    if (!material) throw new Error('Material not found');
    if (list.some((m) => m.id !== id && sameName(m.name, input.name))) {
      throw new Error('A material with this name already exists.');
    }
    Object.assign(material, input);
    return material;
  }

  if (!UUID_RE.test(id)) throw new Error('Material not found');
  const { data, error } = await db.from('materials').update(input).eq('id', id).select().single();
  if (error) throw materialError(error);
  return toMaterial(data);
}

export async function deleteMaterial(id: string): Promise<void> {
  const db = await getDb();

  if (!db) {
    const list = getDemoData().materials;
    const index = list.findIndex((m) => m.id === id);
    if (index >= 0) list.splice(index, 1);
    return;
  }

  if (!UUID_RE.test(id)) return;
  const { error } = await db.from('materials').delete().eq('id', id);
  if (error) throw materialError(error);
}

/**
 * Saves a material used in a sale as a new pill if it is not saved yet.
 * Existing pills are left as they are. Never fails the sale.
 */
async function rememberMaterial(input: MaterialInput): Promise<void> {
  try {
    const { materials, available } = await getMaterials();
    if (!available || materials.some((m) => sameName(m.name, input.name))) return;
    await createMaterial(input);
  } catch {
    // Duplicate created at the same moment, or no materials table yet: the sale is already saved
  }
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
  let sale: CreditSale;

  if (!db) {
    const store = getDemoData();
    if (!store.customers.some((c) => c.id === data.customer_id)) throw new Error('Customer not found');
    sale = {
      id: newDemoId('sale'),
      ...values,
      amount: data.quantity * data.rate,
      due_date: calculateDueDate(data.sale_date, data.credit_days),
      created_at: new Date().toISOString(),
    };
    store.sales.push(sale);
  } else {
    // amount and due_date are generated columns in the database
    sale = toSale(check(await db.from('credit_sales').insert(values).select().single()));
  }

  // New materials become pills so they don't have to be typed again
  await rememberMaterial({ name: data.material, unit: data.unit, rate: data.rate });
  return sale;
}

export async function createPayment(data: {
  customer_id: string;
  payment_date: string;
  amount: number;
  method: PaymentMethod;
  sale_id?: string | null;
  notes?: string | null;
}): Promise<Payment> {
  const values = {
    customer_id: data.customer_id,
    payment_date: data.payment_date,
    amount: data.amount,
    method: data.method,
    notes: data.notes || null,
    // Only sent when set, so payments still save before the sale_id migration is run
    ...(data.sale_id ? { sale_id: data.sale_id } : {}),
  };
  const db = await getDb();

  if (!db) {
    const store = getDemoData();
    if (!store.customers.some((c) => c.id === data.customer_id)) throw new Error('Customer not found');
    if (data.sale_id && !store.sales.some((s) => s.id === data.sale_id && s.customer_id === data.customer_id)) {
      throw new Error('The selected sale does not belong to this customer.');
    }
    const payment: Payment = { id: newDemoId('pmt'), ...values, created_at: new Date().toISOString() };
    store.payments.push(payment);
    return payment;
  }

  const { data: row, error } = await db.from('payments').insert(values).select().single();
  if (error) {
    if (data.sale_id && isMissingSchema(error)) {
      throw new Error(`Linking a payment to a sale needs a database update. Run ${MATERIALS_MIGRATION} in the Supabase SQL Editor.`);
    }
    if (error.code === '23503') throw new Error('The selected sale does not belong to this customer.');
    throw new Error(error.message);
  }
  return toPayment(row);
}
