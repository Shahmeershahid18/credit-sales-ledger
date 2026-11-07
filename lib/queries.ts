import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthState, toProfile } from '@/lib/auth';
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
  calculateDueSoon,
  buildMonthFlows,
  calculatePartyLedger,
  buildPartyStatement,
  cashPayments,
} from './store';
import { ContactKind, SIDES } from './contacts';
import {
  AgingRow,
  Customer,
  CreditSale,
  CustomerLedger,
  CustomerStatus,
  CustomerSummary,
  DashboardData,
  MonthFlow,
  DashboardStats,
  Material,
  MonthTotals,
  SaleOption,
  MonthlyReport,
  OverdueAgingBucket,
  PartyLedger,
  PartyStatement,
  Payment,
  PaymentMethod,
  UserListItem,
} from './types';
import { addDays, calculateDueDate, formatRs, getCurrentMonthStr, getTodayDateStr, monthRange, nextMonthStart } from './format';

// All DB reads and writes live here. When Supabase is configured they go to the
// database (views + monthly_report RPC), scoped to one user's ledger; otherwise they
// use the in-memory demo store.

type DB = SupabaseClient<Database>;

const PAGE_SIZE = 1000; // PostgREST returns at most 1000 rows per request by default
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The ledger (owner) every read and write is scoped to: the signed-in user's own,
// or the one an admin has opened. Row Level Security enforces the same rule.
type Ctx = { db: DB; ownerId: string };

async function getCtx(): Promise<Ctx | null> {
  const db = await createServerSupabaseClient();
  if (!db) return null;

  const auth = await getAuthState();
  if (auth.mode === 'blocked') throw new Error('This account has been disabled.');
  if (auth.mode !== 'live') throw new Error('Your session has expired. Please sign in again.');
  return { db, ownerId: auth.owner.id };
}

/**
 * Runs a ranged query page by page until every row is fetched.
 * The query must have a stable order.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw schemaError(error);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

function check<T>({ data, error }: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (error) throw schemaError(error);
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
const toKind = (v: string | null | undefined): ContactKind => (v === 'vendor' ? 'vendor' : 'customer');
const otherSide = (kind: ContactKind): ContactKind => (kind === 'vendor' ? 'customer' : 'vendor');

// A party is listed on a side when it has that role
const roleColumn = (kind: ContactKind) => (kind === 'vendor' ? 'is_vendor' : 'is_customer');
const hasRole = (c: Customer, kind: ContactKind) => (kind === 'vendor' ? c.is_vendor : c.is_customer);

function toCustomer(r: CustomerRow): Customer {
  return {
    id: r.id,
    is_customer: r.is_customer,
    is_vendor: r.is_vendor,
    name: r.name,
    phone: r.phone,
    address: r.address,
    created_at: r.created_at,
  };
}

function toSale(r: SaleRow): CreditSale {
  return {
    id: r.id,
    customer_id: r.customer_id,
    kind: toKind(r.kind),
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
  return value === 'bank' || value === 'cheque' || value === 'adjustment' ? value : 'cash';
}

function toPayment(r: PaymentRow): Payment {
  return {
    id: r.id,
    customer_id: r.customer_id,
    kind: toKind(r.kind),
    payment_date: r.payment_date,
    amount: num(r.amount),
    method: toPaymentMethod(r.method),
    sale_id: r.sale_id ?? null,
    settlement_id: r.settlement_id ?? null,
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
    is_customer: r.is_customer ?? r.kind !== 'vendor',
    is_vendor: r.is_vendor ?? r.kind === 'vendor',
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
// Supabase readers. Every reader is for one side: customers or vendors.
// ---------------------------------------------------------------------------

async function fetchSummaries({ db, ownerId }: Ctx, kind: ContactKind): Promise<CustomerSummary[]> {
  const rows = await fetchAll((from, to) =>
    db
      .from('customer_summary')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('kind', kind)
      .order('name')
      .order('customer_id')
      .range(from, to)
  );
  return rows.map(toSummary);
}

async function fetchAgingRows({ db, ownerId }: Ctx, kind: ContactKind, creditDays?: number): Promise<AgingRow[]> {
  const rows = await fetchAll((from, to) => {
    let q = db.from('overdue_aging').select('*').eq('owner_id', ownerId).eq('kind', kind);
    if (creditDays) q = q.eq('credit_days', creditDays);
    return q.order('customer_id').order('credit_days').range(from, to);
  });
  return rows.map(toAgingRow);
}

async function fetchCustomers({ db, ownerId }: Ctx, kind?: ContactKind): Promise<Customer[]> {
  const rows = await fetchAll((from, to) => {
    let q = db.from('customers').select('*').eq('owner_id', ownerId);
    if (kind) q = q.eq(roleColumn(kind), true);
    return q.order('name').order('id').range(from, to);
  });
  return rows.map(toCustomer);
}

async function fetchMonthTotals({ db, ownerId }: Ctx, kind: ContactKind, month: string): Promise<MonthTotals> {
  const rows = check(await db.rpc('monthly_report', { p_month: `${month}-01`, p_owner: ownerId, p_kind: kind }));
  const r = rows[0];
  return {
    materialSold: num(r?.material_sold),
    paymentReceived: num(r?.payment_received),
    paymentDue: num(r?.payment_due),
    balanceRemaining: num(r?.balance_remaining),
  };
}

async function fetchDueSoon({ db, ownerId }: Ctx, kind: ContactKind): Promise<number> {
  const today = getTodayDateStr();
  const rows = await fetchAll((from, to) =>
    db
      .from('sale_balances')
      .select('id, outstanding')
      .eq('owner_id', ownerId)
      .eq('kind', kind)
      .gt('outstanding', 0)
      .gte('due_date', today)
      .lte('due_date', addDays(today, 7))
      .order('id')
      .range(from, to)
  );
  return rows.reduce((total, r) => total + num(r.outstanding), 0);
}

// ---------------------------------------------------------------------------
// Demo store, one side at a time
// ---------------------------------------------------------------------------

function demoSide(kind: ContactKind) {
  const data = getDemoData();
  return {
    customers: data.customers.filter((c) => hasRole(c, kind)),
    sales: data.sales.filter((s) => s.kind === kind),
    payments: data.payments.filter((p) => p.kind === kind),
  };
}

function demoSummaries(kind: ContactKind): CustomerSummary[] {
  const { customers, sales, payments } = demoSide(kind);
  return calculateCustomerSummaries(customers, calculateSaleBalances(sales, payments), payments).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

function demoDashboard(kind: ContactKind, month: string): DashboardStats {
  const { sales, payments } = demoSide(kind);
  const balances = calculateSaleBalances(sales, payments);
  return buildDashboardStats(
    demoSummaries(kind),
    calculateAgingRows(balances),
    month,
    calculateMonthTotals(month, sales, cashPayments(payments), balances),
    calculateDueSoon(balances)
  );
}

/**
 * Each party's balance after netting its two sides: what it was sold minus what it
 * paid, less what it supplied minus what it was paid. + they owe you, − you owe them.
 */
function partyBalances(customers: CustomerSummary[], vendors: CustomerSummary[]): Map<string, number> {
  const net = new Map<string, number>();
  const add = (s: CustomerSummary, sign: number) =>
    net.set(s.customer_id, (net.get(s.customer_id) ?? 0) + sign * (s.total_credit_sale - s.payment_received));
  customers.forEach((s) => add(s, 1));
  vendors.forEach((s) => add(s, -1));
  return net;
}

function netPosition(customers: CustomerSummary[], vendors: CustomerSummary[]): DashboardData['net'] {
  const result = { toReceive: 0, toPay: 0, receiveParties: 0, payParties: 0 };
  for (const n of partyBalances(customers, vendors).values()) {
    if (n > 0) {
      result.toReceive += n;
      result.receiveParties += 1;
    } else if (n < 0) {
      result.toPay -= n;
      result.payParties += 1;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

/**
 * Dashboard figures for both sides: receivables (customers) and payables (vendors)
 */
export async function getDashboard(): Promise<DashboardData> {
  const month = getCurrentMonthStr();
  const ctx = await getCtx();

  if (!ctx) {
    return {
      customer: demoDashboard('customer', month),
      vendor: demoDashboard('vendor', month),
      net: netPosition(demoSummaries('customer'), demoSummaries('vendor')),
    };
  }

  const side = async (kind: ContactKind) => {
    const [summaries, agingRows, totals, dueSoon] = await Promise.all([
      fetchSummaries(ctx, kind),
      fetchAgingRows(ctx, kind),
      fetchMonthTotals(ctx, kind, month),
      fetchDueSoon(ctx, kind),
    ]);
    return { summaries, stats: buildDashboardStats(summaries, agingRows, month, totals, dueSoon) };
  };

  const [customer, vendor] = await Promise.all([side('customer'), side('vendor')]);
  return { customer: customer.stats, vendor: vendor.stats, net: netPosition(customer.summaries, vendor.summaries) };
}

/**
 * Customers or vendors with their totals on that side. Parties that are both also
 * get their net balance across the two sides.
 */
export async function getCustomerCards(kind: ContactKind, search?: string): Promise<CustomerSummary[]> {
  const ctx = await getCtx();
  let summaries = ctx ? await fetchSummaries(ctx, kind) : demoSummaries(kind);

  if (summaries.some((s) => s.is_customer && s.is_vendor)) {
    const others = ctx ? await fetchSummaries(ctx, otherSide(kind)) : demoSummaries(otherSide(kind));
    const nets = kind === 'customer' ? partyBalances(summaries, others) : partyBalances(others, summaries);
    summaries = summaries.map((s) => (s.is_customer && s.is_vendor ? { ...s, net: nets.get(s.customer_id) ?? 0 } : s));
  }

  const query = search?.toLowerCase().trim();
  if (!query) return summaries;

  return summaries.filter(
    (c) =>
      c.name.toLowerCase().includes(query) ||
      (c.phone && c.phone.toLowerCase().includes(query)) ||
      (c.address && c.address.toLowerCase().includes(query))
  );
}

export async function getCustomers(kind: ContactKind): Promise<Customer[]> {
  const ctx = await getCtx();
  if (!ctx) {
    return [...demoSide(kind).customers].sort((a, b) => a.name.localeCompare(b.name));
  }
  return fetchCustomers(ctx, kind);
}

/** Every party of the open ledger, A–Z, whatever its roles */
export async function getParties(): Promise<Customer[]> {
  const ctx = await getCtx();
  if (!ctx) {
    return [...getDemoData().customers].sort((a, b) => a.name.localeCompare(b.name));
  }
  return fetchCustomers(ctx);
}

/**
 * A party of the open ledger. With `kind`, only when it has that role (so a party
 * that is only a vendor is not found under /customers); without, any party.
 */
export async function getCustomerById(id: string, kind?: ContactKind): Promise<Customer | null> {
  const ctx = await getCtx();
  if (!ctx) {
    return getDemoData().customers.find((c) => c.id === id && (!kind || hasRole(c, kind))) || null;
  }

  if (!UUID_RE.test(id)) return null;
  const { db, ownerId } = ctx;
  let q = db.from('customers').select('*').eq('id', id).eq('owner_id', ownerId);
  if (kind) q = q.eq(roleColumn(kind), true);
  const { data, error } = await q.maybeSingle();
  if (error) throw schemaError(error);
  return data ? toCustomer(data) : null;
}

/** All bills and payments of one party, both sides */
async function fetchPartyEntries({ db, ownerId }: Ctx, partyId: string) {
  const [sales, payments] = await Promise.all([
    fetchAll((from, to) =>
      db.from('credit_sales').select('*').eq('owner_id', ownerId).eq('customer_id', partyId).order('sale_date').order('id').range(from, to)
    ),
    fetchAll((from, to) =>
      db.from('payments').select('*').eq('owner_id', ownerId).eq('customer_id', partyId).order('payment_date').order('id').range(from, to)
    ),
  ]);
  return { sales: sales.map(toSale), payments: payments.map(toPayment) };
}

/** One side of a party's account: its sales and payments received, or its purchases and payments made */
export async function getLedger(customerId: string, kind: ContactKind): Promise<CustomerLedger> {
  const ctx = await getCtx();
  const entries = !ctx
    ? getDemoData()
    : UUID_RE.test(customerId)
    ? await fetchPartyEntries(ctx, customerId)
    : { sales: [], payments: [] };
  return calculateCustomerLedger(
    customerId,
    entries.sales.filter((s) => s.kind === kind),
    entries.payments.filter((p) => p.kind === kind),
    getTodayDateStr()
  );
}

/** A party's combined ledger: both sides in one running balance */
export async function getPartyLedger(partyId: string): Promise<PartyLedger> {
  const ctx = await getCtx();
  const entries = !ctx
    ? getDemoData()
    : UUID_RE.test(partyId)
    ? await fetchPartyEntries(ctx, partyId)
    : { sales: [], payments: [] };
  return calculatePartyLedger(partyId, entries.sales, entries.payments, getTodayDateStr());
}

/** A party's statement from `from` to `to` (YYYY-MM-DD, inclusive) with the opening balance */
export async function getPartyStatement(partyId: string, from: string, to: string): Promise<PartyStatement> {
  return buildPartyStatement(await getPartyLedger(partyId), from, to);
}

export async function getOverdue(kind: ContactKind, creditDays?: number): Promise<OverdueAgingBucket[]> {
  const ctx = await getCtx();

  if (!ctx) {
    const { customers, sales, payments } = demoSide(kind);
    const names = new Map(customers.map((c) => [c.id, c.name]));
    return groupAgingByCustomer(calculateAgingRows(calculateSaleBalances(sales, payments)), names, creditDays);
  }

  const [agingRows, customers] = await Promise.all([fetchAgingRows(ctx, kind, creditDays), fetchCustomers(ctx, kind)]);
  const names = new Map(customers.map((c) => [c.id, c.name]));
  return groupAgingByCustomer(agingRows, names, creditDays);
}

/**
 * Sold, received, purchased and paid for every month from `from` to `to` (YYYY-MM),
 * oldest first. Months without activity are included with zeros.
 */
export async function getMonthFlows(from: string, to: string): Promise<MonthFlow[]> {
  const months = monthRange(from, to);
  const ctx = await getCtx();

  if (!ctx) {
    const { sales, payments } = getDemoData();
    return buildMonthFlows(months, sales, payments);
  }

  const { db, ownerId } = ctx;
  const start = `${from}-01`;
  const end = nextMonthStart(to);
  const [sales, payments] = await Promise.all([
    fetchAll((a, b) =>
      db
        .from('credit_sales')
        .select('id, kind, sale_date, amount')
        .eq('owner_id', ownerId)
        .gte('sale_date', start)
        .lt('sale_date', end)
        .order('id')
        .range(a, b)
    ),
    fetchAll((a, b) =>
      db
        .from('payments')
        .select('id, kind, payment_date, amount, method')
        .eq('owner_id', ownerId)
        .gte('payment_date', start)
        .lt('payment_date', end)
        .order('id')
        .range(a, b)
    ),
  ]);

  return buildMonthFlows(
    months,
    sales.map((x) => ({ kind: toKind(x.kind), sale_date: x.sale_date, amount: num(x.amount) })),
    payments.map((x) => ({ kind: toKind(x.kind), payment_date: x.payment_date, amount: num(x.amount), method: x.method }))
  );
}

/**
 * One side's bills made or falling due in [start, end), and the money received or
 * paid in it (settlement adjustments are not money, so they are left out)
 */
async function fetchPeriodRows({ db, ownerId }: Ctx, kind: ContactKind, start: string, end: string) {
  const [soldOrDue, payments] = await Promise.all([
    fetchAll((from, to) =>
      db
        .from('credit_sales')
        .select('*')
        .eq('owner_id', ownerId)
        .eq('kind', kind)
        .or(`and(sale_date.gte.${start},sale_date.lt.${end}),and(due_date.gte.${start},due_date.lt.${end})`)
        .order('id')
        .range(from, to)
    ),
    fetchAll((from, to) =>
      db
        .from('payments')
        .select('*')
        .eq('owner_id', ownerId)
        .eq('kind', kind)
        .neq('method', 'adjustment')
        .gte('payment_date', start)
        .lt('payment_date', end)
        .order('id')
        .range(from, to)
    ),
  ]);
  return { sales: soldOrDue.map(toSale), payments: payments.map(toPayment) };
}

/** Everything still unpaid on one side, as of today */
async function fetchBalanceRemaining({ db, ownerId }: Ctx, kind: ContactKind): Promise<number> {
  const rows = await fetchAll((from, to) =>
    db
      .from('sale_balances')
      .select('id, outstanding')
      .eq('owner_id', ownerId)
      .eq('kind', kind)
      .gt('outstanding', 0)
      .order('id')
      .range(from, to)
  );
  return rows.reduce((total, r) => total + num(r.outstanding), 0);
}

export async function getMonthlyReportData(kind: ContactKind, month: string): Promise<MonthlyReport> {
  const ctx = await getCtx();

  if (!ctx) {
    const { customers, sales, payments } = demoSide(kind);
    const cash = cashPayments(payments);
    const totals = calculateMonthTotals(month, sales, cash, calculateSaleBalances(sales, payments));
    return buildMonthlyReport(month, totals, buildMonthlyBreakdown(month, customers, sales, cash));
  }

  const [totals, customers, rows] = await Promise.all([
    fetchMonthTotals(ctx, kind, month),
    fetchCustomers(ctx, kind),
    fetchPeriodRows(ctx, kind, `${month}-01`, nextMonthStart(month)),
  ]);

  return buildMonthlyReport(month, totals, buildMonthlyBreakdown(month, customers, rows.sales, rows.payments));
}

/**
 * The same report for a whole calendar year (YYYY): sold (or purchased), received
 * (or paid) and falling due during the year, by contact.
 */
export async function getYearlyReportData(kind: ContactKind, year: string): Promise<MonthlyReport> {
  const ctx = await getCtx();

  if (!ctx) {
    const { customers, sales, payments } = demoSide(kind);
    const cash = cashPayments(payments);
    const totals = calculateMonthTotals(year, sales, cash, calculateSaleBalances(sales, payments));
    return buildMonthlyReport(year, totals, buildMonthlyBreakdown(year, customers, sales, cash));
  }

  const [customers, rows, balanceRemaining] = await Promise.all([
    fetchCustomers(ctx, kind),
    fetchPeriodRows(ctx, kind, `${year}-01-01`, `${Number(year) + 1}-01-01`),
    fetchBalanceRemaining(ctx, kind),
  ]);

  const totals = { ...calculateMonthTotals(year, rows.sales, rows.payments, []), balanceRemaining };
  return buildMonthlyReport(year, totals, buildMonthlyBreakdown(year, customers, rows.sales, rows.payments));
}

/**
 * A contact's sales (or purchases), newest first, with what is still unpaid on each.
 * Powers the "For sale" / "For purchase" picker on the payment form.
 */
export async function getCustomerSaleOptions(customerId: string, kind: ContactKind): Promise<SaleOption[]> {
  const ctx = await getCtx();

  let balances: { id: string; sale_date: string; material: string; quantity: number; unit: string; amount: number; outstanding: number }[];
  if (!ctx) {
    const { sales, payments } = demoSide(kind);
    balances = calculateSaleBalances(
      sales.filter((s) => s.customer_id === customerId),
      payments.filter((p) => p.customer_id === customerId)
    );
  } else {
    if (!UUID_RE.test(customerId)) return [];
    const { db, ownerId } = ctx;
    const rows = await fetchAll((from, to) =>
      db
        .from('sale_balances')
        .select('*')
        .eq('owner_id', ownerId)
        .eq('customer_id', customerId)
        .eq('kind', kind)
        .order('sale_date')
        .order('id')
        .range(from, to)
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
// Materials (quick-pick pills on the sale and purchase forms)
// ---------------------------------------------------------------------------

type MaterialRow = Database['public']['Tables']['materials']['Row'];
type MaterialInput = { name: string; unit: string; rate: number | null; purchase_rate: number | null };

const LATEST_MIGRATION = 'supabase/migrations/20261107000000_parties.sql';

/**
 * True when a PostgREST error means a table or column from a newer migration is missing
 */
function isMissingSchema(error: { code?: string; message: string }) {
  return ['PGRST205', 'PGRST204', '42P01', '42703'].includes(error.code ?? '') || /schema cache|does not exist/i.test(error.message);
}

function schemaError(error: { code?: string; message: string }): Error {
  if (isMissingSchema(error)) {
    return new Error(`The database needs an update. Run ${LATEST_MIGRATION} in the Supabase SQL Editor.`);
  }
  return new Error(error.message);
}

function materialError(error: { code?: string; message: string }): Error {
  if (error.code === '23505') {
    return new Error('A material with this name already exists.');
  }
  return schemaError(error);
}

function toMaterial(r: MaterialRow): Material {
  return {
    id: r.id,
    name: r.name,
    unit: r.unit,
    rate: r.rate === null ? null : num(r.rate),
    purchase_rate: r.purchase_rate === null || r.purchase_rate === undefined ? null : num(r.purchase_rate),
    created_at: r.created_at,
  };
}

const byName = (a: Material, b: Material) => a.name.localeCompare(b.name);
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Saved materials, A–Z. Returns `available: false` when the materials table
 * has not been created yet, so the sale form still works.
 */
export async function getMaterials(): Promise<{ materials: Material[]; available: boolean }> {
  const ctx = await getCtx();
  if (!ctx) {
    return { materials: [...getDemoData().materials].sort(byName), available: true };
  }

  const { data, error } = await ctx.db.from('materials').select('*').eq('owner_id', ctx.ownerId).order('name').limit(1000);
  if (error) {
    if (isMissingSchema(error)) return { materials: [], available: false };
    throw new Error(error.message);
  }
  return { materials: (data ?? []).map(toMaterial), available: true };
}

export async function createMaterial(input: MaterialInput): Promise<Material> {
  const ctx = await getCtx();

  if (!ctx) {
    const list = getDemoData().materials;
    if (list.some((m) => sameName(m.name, input.name))) throw new Error('A material with this name already exists.');
    const material: Material = { id: newDemoId('mat'), ...input, created_at: new Date().toISOString() };
    list.push(material);
    return material;
  }

  const { data, error } = await ctx.db.from('materials').insert({ ...input, owner_id: ctx.ownerId }).select().single();
  if (error) throw materialError(error);
  return toMaterial(data);
}

export async function updateMaterial(id: string, input: Partial<MaterialInput>): Promise<Material> {
  const ctx = await getCtx();

  if (!ctx) {
    const list = getDemoData().materials;
    const material = list.find((m) => m.id === id);
    if (!material) throw new Error('Material not found');
    if (input.name !== undefined && list.some((m) => m.id !== id && sameName(m.name, input.name!))) {
      throw new Error('A material with this name already exists.');
    }
    Object.assign(material, input);
    return material;
  }

  if (!UUID_RE.test(id)) throw new Error('Material not found');
  const { data, error } = await ctx.db
    .from('materials')
    .update(input)
    .eq('id', id)
    .eq('owner_id', ctx.ownerId)
    .select()
    .maybeSingle();
  if (error) throw materialError(error);
  if (!data) throw new Error('Material not found');
  return toMaterial(data);
}

export async function deleteMaterial(id: string): Promise<void> {
  const ctx = await getCtx();

  if (!ctx) {
    const list = getDemoData().materials;
    const index = list.findIndex((m) => m.id === id);
    if (index >= 0) list.splice(index, 1);
    return;
  }

  if (!UUID_RE.test(id)) return;
  const { error } = await ctx.db.from('materials').delete().eq('id', id).eq('owner_id', ctx.ownerId);
  if (error) throw materialError(error);
}

/**
 * Saves a material used in a sale or purchase as a new pill if it is not saved yet,
 * with the rate as its sale or purchase rate. A saved pill only gets the rate when
 * it has none for that side yet. Never fails the sale or purchase.
 */
async function rememberMaterial(kind: ContactKind, input: { name: string; unit: string; rate: number }): Promise<void> {
  const rateField = kind === 'vendor' ? 'purchase_rate' : 'rate';
  try {
    const { materials, available } = await getMaterials();
    if (!available) return;
    const saved = materials.find((m) => sameName(m.name, input.name));
    if (!saved) {
      await createMaterial({ name: input.name, unit: input.unit, rate: null, purchase_rate: null, [rateField]: input.rate });
    } else if (saved[rateField] === null) {
      await updateMaterial(saved.id, { [rateField]: input.rate });
    }
  } catch {
    // Duplicate created at the same moment, or no materials table yet: the entry is already saved
  }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

type CustomerInput = { name: string; phone?: string | null; address?: string | null };
type Roles = { is_customer: boolean; is_vendor: boolean };

function newDemoId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

/**
 * Throws unless the party exists in the open ledger. Recording an entry on a side
 * the party does not have yet switches that role on (a database trigger does this
 * in live mode). Returns the demo record in demo mode.
 */
async function assertParty(ctx: Ctx | null, partyId: string, kind: ContactKind): Promise<Customer | null> {
  const notFound = new Error(`${SIDES[kind].One} not found`);
  if (!ctx) {
    const party = getDemoData().customers.find((c) => c.id === partyId);
    if (!party) throw notFound;
    return party;
  }
  if (!UUID_RE.test(partyId)) throw notFound;
  const { data, error } = await ctx.db.from('customers').select('id').eq('id', partyId).eq('owner_id', ctx.ownerId).maybeSingle();
  if (error) throw schemaError(error);
  if (!data) throw notFound;
  return null;
}

function addDemoRole(party: Customer | null, kind: ContactKind) {
  if (!party) return;
  if (kind === 'vendor') party.is_vendor = true;
  else party.is_customer = true;
}

export async function createCustomer(roles: Roles, data: CustomerInput): Promise<Customer> {
  if (!roles.is_customer && !roles.is_vendor) throw new Error('Choose customer, vendor or both.');
  const values = { ...roles, name: data.name, phone: data.phone || null, address: data.address || null };
  const ctx = await getCtx();

  if (!ctx) {
    const customer: Customer = { id: newDemoId(roles.is_customer ? 'cust' : 'vend'), ...values, created_at: new Date().toISOString() };
    getDemoData().customers.push(customer);
    return customer;
  }

  const { data: row, error } = await ctx.db
    .from('customers')
    .insert({ ...values, owner_id: ctx.ownerId })
    .select()
    .single();
  if (error) throw schemaError(error);
  return toCustomer(row);
}

/**
 * Updates name, contact details and roles. A role that already has entries cannot
 * be switched off (the database refuses it too).
 */
export async function updateCustomer(id: string, data: CustomerInput & Partial<Roles>): Promise<Customer> {
  const values = {
    name: data.name,
    phone: data.phone || null,
    address: data.address || null,
    ...(data.is_customer !== undefined ? { is_customer: data.is_customer } : {}),
    ...(data.is_vendor !== undefined ? { is_vendor: data.is_vendor } : {}),
  };
  if (values.is_customer === false && values.is_vendor === false) throw new Error('Choose customer, vendor or both.');
  const ctx = await getCtx();

  if (!ctx) {
    const store = getDemoData();
    const customer = store.customers.find((c) => c.id === id);
    if (!customer) throw new Error('Not found');
    const used = (kind: ContactKind) =>
      store.sales.some((s) => s.customer_id === id && s.kind === kind) || store.payments.some((p) => p.customer_id === id && p.kind === kind);
    if (customer.is_customer && values.is_customer === false && used('customer')) {
      throw new Error('This party has sales or payments received, so it must stay a customer.');
    }
    if (customer.is_vendor && values.is_vendor === false && used('vendor')) {
      throw new Error('This party has purchases or payments made, so it must stay a vendor.');
    }
    Object.assign(customer, values);
    return customer;
  }

  if (!UUID_RE.test(id)) throw new Error('Not found');
  const { data: row, error } = await ctx.db
    .from('customers')
    .update(values)
    .eq('id', id)
    .eq('owner_id', ctx.ownerId)
    .select()
    .maybeSingle();
  if (error) throw schemaError(error);
  if (!row) throw new Error('Not found');
  return toCustomer(row);
}

/**
 * Saves a credit sale (kind 'customer') or a credit purchase (kind 'vendor')
 */
export async function createCreditSale(
  kind: ContactKind,
  data: {
    customer_id: string;
    sale_date: string;
    material: string;
    quantity: number;
    unit: string;
    rate: number;
    credit_days: number;
    notes?: string | null;
  }
): Promise<CreditSale> {
  const values = {
    customer_id: data.customer_id,
    kind,
    sale_date: data.sale_date,
    material: data.material,
    quantity: data.quantity,
    unit: data.unit,
    rate: data.rate,
    credit_days: data.credit_days,
    notes: data.notes || null,
  };
  const ctx = await getCtx();
  const party = await assertParty(ctx, data.customer_id, kind);
  let sale: CreditSale;

  if (!ctx) {
    addDemoRole(party, kind);
    sale = {
      id: newDemoId(kind === 'vendor' ? 'pur' : 'sale'),
      ...values,
      amount: data.quantity * data.rate,
      due_date: calculateDueDate(data.sale_date, data.credit_days),
      created_at: new Date().toISOString(),
    };
    getDemoData().sales.push(sale);
  } else {
    // amount and due_date are generated columns in the database
    const { data: row, error } = await ctx.db
      .from('credit_sales')
      .insert({ ...values, owner_id: ctx.ownerId })
      .select()
      .single();
    if (error) throw new Error(error.code === '23503' ? `${SIDES[kind].One} not found` : error.message);
    sale = toSale(row);
  }

  // New materials become pills so they don't have to be typed again
  await rememberMaterial(kind, { name: data.material, unit: data.unit, rate: data.rate });
  return sale;
}

/**
 * Saves a payment received (kind 'customer') or a payment made (kind 'vendor')
 */
export async function createPayment(
  kind: ContactKind,
  data: {
    customer_id: string;
    payment_date: string;
    amount: number;
    method: PaymentMethod;
    sale_id?: string | null;
    notes?: string | null;
  }
): Promise<Payment> {
  const terms = SIDES[kind];
  const wrongEntry = `The selected ${terms.entry} does not belong to this ${terms.one}.`;
  if (data.method === 'adjustment') throw new Error('Use Adjust on the party page to set purchases off against sales.');
  const values = {
    customer_id: data.customer_id,
    kind,
    payment_date: data.payment_date,
    amount: data.amount,
    method: data.method,
    notes: data.notes || null,
    ...(data.sale_id ? { sale_id: data.sale_id } : {}),
  };
  const ctx = await getCtx();
  const party = await assertParty(ctx, data.customer_id, kind);

  if (!ctx) {
    const store = getDemoData();
    if (data.sale_id && !store.sales.some((s) => s.id === data.sale_id && s.customer_id === data.customer_id && s.kind === kind)) {
      throw new Error(wrongEntry);
    }
    addDemoRole(party, kind);
    const payment: Payment = { id: newDemoId(kind === 'vendor' ? 'vpm' : 'pmt'), ...values, created_at: new Date().toISOString() };
    store.payments.push(payment);
    return payment;
  }

  const { data: row, error } = await ctx.db
    .from('payments')
    .insert({ ...values, owner_id: ctx.ownerId })
    .select()
    .single();
  if (error) {
    if (error.code === '23503') throw new Error(/sale/.test(error.message) ? wrongEntry : `${terms.One} not found`);
    throw schemaError(error);
  }
  return toPayment(row);
}

/**
 * Sets `amount` of a party's purchases off against its sales: one adjustment on each
 * side, clearing the oldest unpaid bills on both. The party must be both a customer
 * and a vendor, and `amount` at most the smaller side's unpaid bills.
 */
export async function settleParty(partyId: string, amount: number, date: string, notes?: string | null): Promise<void> {
  const party = await getCustomerById(partyId);
  if (!party) throw new Error('Party not found');
  if (!party.is_customer || !party.is_vendor) throw new Error('Only a party that is both a customer and a vendor can be settled.');
  // Checked here for a readable message; the database checks it again
  const { settleable } = await getPartyLedger(partyId);
  if (amount > settleable + 0.005) {
    throw new Error(`At most ${formatRs(settleable)} can be adjusted: the smaller of what they owe and what you owe.`);
  }
  const ctx = await getCtx();

  if (!ctx) {
    const store = getDemoData();
    const settlement_id = newDemoId('set');
    for (const kind of ['customer', 'vendor'] as const) {
      store.payments.push({
        id: newDemoId('adj'),
        customer_id: partyId,
        kind,
        payment_date: date,
        amount,
        method: 'adjustment',
        settlement_id,
        notes: notes || null,
        created_at: new Date().toISOString(),
      });
    }
    return;
  }

  if (!UUID_RE.test(partyId)) throw new Error('Party not found');
  const { error } = await ctx.db.rpc('settle_party', { p_party: partyId, p_amount: amount, p_date: date, p_notes: notes || null });
  if (error) throw schemaError(error);
}

/**
 * Moves every entry of `mergeId` to `keepId`, combines their roles and missing contact
 * details, and deletes `mergeId`. For a customer and a vendor entered separately
 * that are the same business.
 */
export async function mergeParties(keepId: string, mergeId: string): Promise<void> {
  if (keepId === mergeId) throw new Error('Choose a different party to merge.');
  const ctx = await getCtx();

  if (!ctx) {
    const store = getDemoData();
    const keep = store.customers.find((c) => c.id === keepId);
    const other = store.customers.find((c) => c.id === mergeId);
    if (!keep || !other) throw new Error('Party not found');
    keep.is_customer ||= other.is_customer;
    keep.is_vendor ||= other.is_vendor;
    keep.phone = keep.phone?.trim() ? keep.phone : other.phone;
    keep.address = keep.address?.trim() ? keep.address : other.address;
    store.sales.forEach((s) => s.customer_id === mergeId && (s.customer_id = keepId));
    store.payments.forEach((p) => p.customer_id === mergeId && (p.customer_id = keepId));
    store.customers.splice(store.customers.indexOf(other), 1);
    return;
  }

  if (!UUID_RE.test(keepId) || !UUID_RE.test(mergeId)) throw new Error('Party not found');
  const { error } = await ctx.db.rpc('merge_parties', { p_keep: keepId, p_merge: mergeId });
  if (error) throw schemaError(error);
}

// ---------------------------------------------------------------------------
// Users (admin)
// ---------------------------------------------------------------------------

/**
 * Every user with a summary of their ledger (customer side). Only admins can read
 * other users' profiles and ledgers (Row Level Security), so call this for admins only.
 */
export async function getUserList(): Promise<UserListItem[]> {
  const db = await createServerSupabaseClient();
  if (!db) return [];

  const [profiles, summaries] = await Promise.all([
    fetchAll((from, to) => db.from('profiles').select('*').order('created_at').order('id').range(from, to)),
    fetchAll((from, to) =>
      db
        .from('customer_summary')
        .select('owner_id, outstanding, overdue')
        .eq('kind', 'customer')
        .order('customer_id')
        .range(from, to)
    ),
  ]);

  const totals = new Map<string, { customerCount: number; outstanding: number; overdue: number }>();
  for (const s of summaries) {
    if (!s.owner_id) continue;
    const t = totals.get(s.owner_id) ?? { customerCount: 0, outstanding: 0, overdue: 0 };
    t.customerCount += 1;
    t.outstanding += num(s.outstanding);
    t.overdue += num(s.overdue);
    totals.set(s.owner_id, t);
  }

  return profiles.map((p) => ({
    ...toProfile(p),
    ...(totals.get(p.id) ?? { customerCount: 0, outstanding: 0, overdue: 0 }),
  }));
}
