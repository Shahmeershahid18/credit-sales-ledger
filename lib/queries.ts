import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';
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
  topBalances,
  buildQuantityHistory,
} from './store';
import { buildCustomerMargins, buildItemMargins, buildProfitMonths, convertQuantity, costBook, expensesByCategory, stockTotal, type ProfitInputs } from './profit';
import { ContactKind, SIDES } from './contacts';
import {
  AgingRow,
  BusinessEntry,
  CustomerPrice,
  CustomerPriceRow,
  BusinessEntryKind,
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
  OpeningBalance,
  PartyEntryType,
  PartyLedger,
  PartyStatement,
  ProfitMonth,
  ProfitReport,
  QuantityHistory,
  ReturnEntry,
  Payment,
  PaymentMethod,
  StockCount,
  StockItem,
  UserListItem,
} from './types';
import { addDays, calculateDueDate, daysBetween, formatDate, formatRs, getCurrentMonthStr, getTodayDateStr, monthRange, nextMonthStart, shiftMonth } from './format';

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
    is_opening: r.is_opening ?? false,
    created_at: r.created_at,
  };
}

function toPaymentMethod(value: string): PaymentMethod {
  return value === 'bank' || value === 'cheque' || value === 'adjustment' || value === 'return' ? value : 'cash';
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
    is_opening: r.is_opening ?? false,
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
    returned: num(r.returned),
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
    net.set(s.customer_id, (net.get(s.customer_id) ?? 0) + sign * (s.total_credit_sale - s.payment_received - s.returned));
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

  let customer: { summaries: CustomerSummary[]; stats: DashboardStats };
  let vendor: typeof customer;
  if (!ctx) {
    customer = { summaries: demoSummaries('customer'), stats: demoDashboard('customer', month) };
    vendor = { summaries: demoSummaries('vendor'), stats: demoDashboard('vendor', month) };
  } else {
    const side = async (kind: ContactKind) => {
      const [summaries, agingRows, totals, dueSoon] = await Promise.all([
        fetchSummaries(ctx, kind),
        fetchAgingRows(ctx, kind),
        fetchMonthTotals(ctx, kind, month),
        fetchDueSoon(ctx, kind),
      ]);
      return { summaries, stats: buildDashboardStats(summaries, agingRows, month, totals, dueSoon) };
    };
    [customer, vendor] = await Promise.all([side('customer'), side('vendor')]);
  }

  // A party that is both appears only on the side it owes after netting, with the net amount
  const nets = partyBalances(customer.summaries, vendor.summaries);
  const both = (c: CustomerSummary) => c.is_customer && c.is_vendor;
  const netReceivable = (c: CustomerSummary) => (both(c) ? Math.max(0, nets.get(c.customer_id) ?? 0) : undefined);
  const netPayable = (c: CustomerSummary) => (both(c) ? Math.max(0, -(nets.get(c.customer_id) ?? 0)) : undefined);

  return {
    customer: { ...customer.stats, topCustomers: topBalances(customer.summaries, netReceivable) },
    vendor: { ...vendor.stats, topCustomers: topBalances(vendor.summaries, netPayable) },
    net: netPosition(customer.summaries, vendor.summaries),
  };
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

/** One sale (kind 'customer') or purchase (kind 'vendor') of a party, for its edit page */
export async function getCreditSaleById(kind: ContactKind, partyId: string, id: string): Promise<CreditSale | null> {
  const ctx = await getCtx();
  if (!ctx) {
    return getDemoData().sales.find((s) => s.id === id && s.customer_id === partyId && s.kind === kind) ?? null;
  }
  if (!UUID_RE.test(id) || !UUID_RE.test(partyId)) return null;
  const { data, error } = await ctx.db
    .from('credit_sales')
    .select('*')
    .eq('owner_id', ctx.ownerId)
    .eq('id', id)
    .eq('customer_id', partyId)
    .eq('kind', kind)
    .maybeSingle();
  if (error) throw schemaError(error);
  return data ? toSale(data) : null;
}

/** One payment received (kind 'customer') or made (kind 'vendor') of a party, for its edit page */
export async function getPaymentById(kind: ContactKind, partyId: string, id: string): Promise<Payment | null> {
  const ctx = await getCtx();
  if (!ctx) {
    return getDemoData().payments.find((p) => p.id === id && p.customer_id === partyId && p.kind === kind) ?? null;
  }
  if (!UUID_RE.test(id) || !UUID_RE.test(partyId)) return null;
  const { data, error } = await ctx.db
    .from('payments')
    .select('*')
    .eq('owner_id', ctx.ownerId)
    .eq('id', id)
    .eq('customer_id', partyId)
    .eq('kind', kind)
    .maybeSingle();
  if (error) throw schemaError(error);
  return data ? toPayment(data) : null;
}

/**
 * A party's opening balance, for its edit form. An opening bill on the customer side, or
 * an advance the party was paid, is receivable; the other two are payable.
 */
export async function getOpeningBalance(partyId: string): Promise<OpeningBalance | null> {
  const ctx = await getCtx();
  let sales: CreditSale[];
  let payments: Payment[];
  if (!ctx) {
    ({ sales, payments } = getDemoData());
  } else {
    if (!UUID_RE.test(partyId)) return null;
    const { db, ownerId } = ctx;
    const [s, p] = await Promise.all([
      db.from('credit_sales').select('*').eq('owner_id', ownerId).eq('customer_id', partyId).eq('is_opening', true),
      db.from('payments').select('*').eq('owner_id', ownerId).eq('customer_id', partyId).eq('is_opening', true),
    ]);
    // Before the opening-balance migration the column does not exist: no opening balance yet
    if (s.error || p.error) return null;
    sales = (s.data ?? []).map(toSale);
    payments = (p.data ?? []).map(toPayment);
  }

  const bill = sales.find((x) => x.customer_id === partyId && x.is_opening);
  if (bill) {
    return {
      amount: Number(bill.amount),
      direction: bill.kind === 'customer' ? 'receivable' : 'payable',
      date: bill.sale_date,
      due_date: bill.due_date,
    };
  }
  const advance = payments.find((x) => x.customer_id === partyId && x.is_opening);
  if (advance) {
    return {
      amount: Number(advance.amount),
      direction: advance.kind === 'vendor' ? 'receivable' : 'payable',
      date: advance.payment_date,
      due_date: null,
    };
  }
  return null;
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
        .select('id, kind, sale_date, amount, is_opening')
        .eq('owner_id', ownerId)
        .gte('sale_date', start)
        .lt('sale_date', end)
        .order('id')
        .range(a, b)
    ),
    fetchAll((a, b) =>
      db
        .from('payments')
        .select('id, kind, payment_date, amount, method, is_opening')
        .eq('owner_id', ownerId)
        .gte('payment_date', start)
        .lt('payment_date', end)
        .order('id')
        .range(a, b)
    ),
  ]);

  return buildMonthFlows(
    months,
    sales.map((x) => ({ kind: toKind(x.kind), sale_date: x.sale_date, amount: num(x.amount), is_opening: x.is_opening })),
    payments.map((x) => ({
      kind: toKind(x.kind),
      payment_date: x.payment_date,
      amount: num(x.amount),
      method: x.method,
      is_opening: x.is_opening,
    }))
  );
}

/**
 * One side's bills made or falling due in [start, end), and the money received or
 * paid in it (settlement adjustments are not money, so they are left out)
 */
/**
 * Quantity sold (kind 'customer') or bought (kind 'vendor') per material, month and party,
 * for the months from `from` to `to` (YYYY-MM, inclusive)
 */
export async function getQuantityHistory(kind: ContactKind, from: string, to: string): Promise<QuantityHistory> {
  const months = monthRange(from, to);
  const ctx = await getCtx();

  if (!ctx) {
    const { customers, sales } = getDemoData();
    return buildQuantityHistory(months, customers, sales.filter((s) => s.kind === kind));
  }

  const { db, ownerId } = ctx;
  const [parties, sales] = await Promise.all([
    fetchCustomers(ctx),
    fetchAll((a, b) =>
      db
        .from('credit_sales')
        .select('id, customer_id, material, unit, quantity, sale_date, is_opening')
        .eq('owner_id', ownerId)
        .eq('kind', kind)
        .eq('is_opening', false)
        .gte('sale_date', `${from}-01`)
        .lt('sale_date', nextMonthStart(to))
        .order('id')
        .range(a, b)
    ),
  ]);
  return buildQuantityHistory(
    months,
    parties,
    sales.map((s) => ({ ...s, quantity: num(s.quantity) }))
  );
}

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
        .not('method', 'in', '(adjustment,return)')
        .eq('is_opening', false)
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
 * Powers the "For sale" / "For purchase" picker on the payment form. When a payment
 * is being edited, `excludePaymentId` leaves it out, so the bill it paid shows as unpaid.
 */
export async function getCustomerSaleOptions(customerId: string, kind: ContactKind, excludePaymentId?: string): Promise<SaleOption[]> {
  const ctx = await getCtx();

  let balances: { id: string; sale_date: string; material: string; quantity: number; unit: string; amount: number; outstanding: number }[];
  if (excludePaymentId) {
    if (ctx && !UUID_RE.test(customerId)) return [];
    const entries = ctx ? await fetchPartyEntries(ctx, customerId) : getDemoData();
    balances = calculateSaleBalances(
      entries.sales.filter((s) => s.customer_id === customerId && s.kind === kind),
      entries.payments.filter((p) => p.customer_id === customerId && p.kind === kind && p.id !== excludePaymentId)
    );
  } else if (!ctx) {
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

const LATEST_MIGRATION = 'supabase/migrations/20261123000000_customer_prices.sql';

/**
 * True when a PostgREST error means a table or column from a newer migration is missing
 */
function isMissingSchema(error: { code?: string; message: string }) {
  return ['PGRST205', 'PGRST204', '42P01', '42703'].includes(error.code ?? '') || /schema cache|does not exist/i.test(error.message);
}

/** A table or column from a newer migration is missing */
class SchemaUpdateError extends Error {}

function schemaError(error: { code?: string; message: string }): Error {
  if (isMissingSchema(error)) {
    return new SchemaUpdateError(`The database needs an update. Run the files in supabase/migrations you have not run yet, up to ${LATEST_MIGRATION}, in the Supabase SQL Editor.`);
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
    cost_price: r.cost_price === null || r.cost_price === undefined ? null : num(r.cost_price),
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
    const material: Material = { id: newDemoId('mat'), ...input, cost_price: null, created_at: new Date().toISOString() };
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
  if (data.method === 'return') throw new Error('Record goods returned as a return, not a payment.');
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

type SaleInput = Parameters<typeof createCreditSale>[1];
type PaymentInput = Parameters<typeof createPayment>[1];

const ADJUSTMENT_LOCKED = 'An adjustment cannot be edited. Delete it on the party page and use Adjust again.';
const OPENING_LOCKED = "Change the opening balance on the party's Edit page.";
const RETURN_LOCKED = 'This is a return: edit it as a return.';

/**
 * Where an opening balance is stored: a bill on the side that owes, or, when the party
 * does not have that role, an advance on its other side (so no role is switched on)
 */
function openingPlace(direction: OpeningBalance['direction'], roles: Roles): { kind: ContactKind; advance: boolean } {
  if (direction === 'receivable') return roles.is_customer ? { kind: 'customer', advance: false } : { kind: 'vendor', advance: true };
  return roles.is_vendor ? { kind: 'vendor', advance: false } : { kind: 'customer', advance: true };
}

/**
 * Sets a party's opening balance, replacing any earlier one; an amount of 0 removes it.
 * `roles` are the party's roles after the save it belongs to.
 */
export async function setOpeningBalance(
  partyId: string,
  roles: Roles,
  input: { amount: number; direction: OpeningBalance['direction']; date: string; due_date?: string | null }
): Promise<void> {
  const { kind, advance } = openingPlace(input.direction, roles);
  const creditDays = !advance && input.due_date ? Math.max(0, daysBetween(input.date, input.due_date)) : 0;
  const ctx = await getCtx();

  if (!ctx) {
    const store = getDemoData();
    const party = store.customers.find((c) => c.id === partyId);
    if (!party) throw new Error('Party not found');
    const now = new Date().toISOString();
    const keepBill = input.amount > 0 && !advance ? store.sales.find((s) => s.customer_id === partyId && s.is_opening && s.kind === kind) : undefined;
    const keepAdvance = input.amount > 0 && advance ? store.payments.find((p) => p.customer_id === partyId && p.is_opening && p.kind === kind) : undefined;
    for (let i = store.sales.length - 1; i >= 0; i--) {
      const s = store.sales[i];
      if (s.customer_id === partyId && s.is_opening && s !== keepBill) {
        store.payments.forEach((p) => p.sale_id === s.id && (p.sale_id = null));
        store.sales.splice(i, 1);
      }
    }
    for (let i = store.payments.length - 1; i >= 0; i--) {
      const p = store.payments[i];
      if (p.customer_id === partyId && p.is_opening && p !== keepAdvance) store.payments.splice(i, 1);
    }
    if (input.amount <= 0) return;
    if (!advance) {
      const values = {
        sale_date: input.date,
        quantity: 1,
        rate: input.amount,
        amount: input.amount,
        credit_days: creditDays,
        due_date: calculateDueDate(input.date, creditDays),
      };
      if (keepBill) Object.assign(keepBill, values);
      else
        store.sales.push({
          id: newDemoId('open'),
          customer_id: partyId,
          kind,
          material: 'Opening balance',
          unit: '',
          notes: null,
          is_opening: true,
          created_at: now,
          ...values,
        });
    } else if (keepAdvance) {
      Object.assign(keepAdvance, { payment_date: input.date, amount: input.amount });
    } else {
      store.payments.push({
        id: newDemoId('open'),
        customer_id: partyId,
        kind,
        payment_date: input.date,
        amount: input.amount,
        method: 'cash',
        notes: null,
        is_opening: true,
        created_at: now,
      });
    }
    return;
  }

  if (!UUID_RE.test(partyId)) throw new Error('Party not found');
  const { error } = await ctx.db.rpc('set_opening_balance', {
    p_party: partyId,
    p_kind: kind,
    p_advance: advance,
    p_amount: input.amount,
    p_date: input.date,
    p_credit_days: creditDays,
  });
  if (error) throw schemaError(error);
}

/**
 * Corrects a sale or purchase. Moving it to another party leaves the payments
 * recorded against it with the party that made them (they become unlinked).
 */
export async function updateCreditSale(kind: ContactKind, id: string, data: SaleInput): Promise<CreditSale> {
  const terms = SIDES[kind];
  const missing = new Error(`This ${terms.entry} no longer exists.`);
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
  const ctx = await getCtx();
  const party = await assertParty(ctx, data.customer_id, kind);
  let sale: CreditSale;

  if (!ctx) {
    const store = getDemoData();
    const existing = store.sales.find((s) => s.id === id && s.kind === kind);
    if (!existing) throw missing;
    if (existing.is_opening) throw new Error(OPENING_LOCKED);
    if (existing.customer_id !== data.customer_id) {
      store.payments.forEach((p) => p.sale_id === id && (p.sale_id = null));
      addDemoRole(party, kind);
    }
    Object.assign(existing, values, {
      amount: data.quantity * data.rate,
      due_date: calculateDueDate(data.sale_date, data.credit_days),
    });
    sale = existing;
  } else {
    if (!UUID_RE.test(id)) throw missing;
    const { db, ownerId } = ctx;
    const { data: current, error: readError } = await db
      .from('credit_sales')
      .select('customer_id, is_opening')
      .eq('id', id)
      .eq('owner_id', ownerId)
      .eq('kind', kind)
      .maybeSingle();
    if (readError) throw schemaError(readError);
    if (!current) throw missing;
    if (current.is_opening) throw new Error(OPENING_LOCKED);
    if (current.customer_id !== data.customer_id) {
      // Otherwise the linked payments would move with the bill (the foreign key cascades)
      const { error: unlinkError } = await db.from('payments').update({ sale_id: null }).eq('owner_id', ownerId).eq('sale_id', id);
      if (unlinkError) throw schemaError(unlinkError);
    }
    // amount and due_date are generated columns in the database
    const { data: row, error } = await db
      .from('credit_sales')
      .update(values)
      .eq('id', id)
      .eq('owner_id', ownerId)
      .eq('kind', kind)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.code === '23503' ? `${terms.One} not found` : error.message);
    if (!row) throw missing;
    sale = toSale(row);
  }

  await rememberMaterial(kind, { name: data.material, unit: data.unit, rate: data.rate });
  return sale;
}

/** Corrects a payment received or made. Adjustments cannot be edited. */
export async function updatePayment(kind: ContactKind, id: string, data: PaymentInput): Promise<Payment> {
  const terms = SIDES[kind];
  const missing = new Error('This payment no longer exists.');
  const wrongEntry = `The selected ${terms.entry} does not belong to this ${terms.one}.`;
  if (data.method === 'adjustment') throw new Error(ADJUSTMENT_LOCKED);
  if (data.method === 'return') throw new Error(RETURN_LOCKED);
  const values = {
    customer_id: data.customer_id,
    payment_date: data.payment_date,
    amount: data.amount,
    method: data.method,
    sale_id: data.sale_id || null,
    notes: data.notes || null,
  };
  const ctx = await getCtx();
  const party = await assertParty(ctx, data.customer_id, kind);

  if (!ctx) {
    const store = getDemoData();
    const existing = store.payments.find((p) => p.id === id && p.kind === kind);
    if (!existing) throw missing;
    if (existing.method === 'adjustment') throw new Error(ADJUSTMENT_LOCKED);
    if (existing.method === 'return') throw new Error(RETURN_LOCKED);
    if (existing.is_opening) throw new Error(OPENING_LOCKED);
    if (data.sale_id && !store.sales.some((s) => s.id === data.sale_id && s.customer_id === data.customer_id && s.kind === kind)) {
      throw new Error(wrongEntry);
    }
    addDemoRole(party, kind);
    return Object.assign(existing, values);
  }

  if (!UUID_RE.test(id)) throw missing;
  const { db, ownerId } = ctx;
  const { data: current, error: readError } = await db
    .from('payments')
    .select('method, is_opening')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .eq('kind', kind)
    .maybeSingle();
  if (readError) throw schemaError(readError);
  if (!current) throw missing;
  if (current.method === 'adjustment') throw new Error(ADJUSTMENT_LOCKED);
  if (current.method === 'return') throw new Error(RETURN_LOCKED);
  if (current.is_opening) throw new Error(OPENING_LOCKED);

  const { data: row, error } = await db
    .from('payments')
    .update(values)
    .eq('id', id)
    .eq('owner_id', ownerId)
    .eq('kind', kind)
    .select()
    .maybeSingle();
  if (error) {
    if (error.code === '23503') throw new Error(/sale/.test(error.message) ? wrongEntry : `${terms.One} not found`);
    throw schemaError(error);
  }
  if (!row) throw missing;
  return toPayment(row);
}

/**
 * Deletes one line of a party's ledger for good:
 * - a sale or purchase (payments recorded against it stay, unlinked, and go to the oldest unpaid bills)
 * - a payment received or made
 * - an adjustment, both halves together (`id` is the ledger row id: its settlement id)
 * - the opening balance (an opening bill or advance)
 */
export async function deleteLedgerEntry(partyId: string, type: PartyEntryType, id: string): Promise<void> {
  const missing = new Error('This entry no longer exists. Refresh the page.');
  const kind: ContactKind = type === 'purchase' || type === 'paid' ? 'vendor' : 'customer';
  const ctx = await getCtx();

  if (!ctx) {
    const store = getDemoData();
    const remove = <T,>(list: T[], match: (x: T) => boolean) => {
      const before = list.length;
      for (let i = list.length - 1; i >= 0; i--) if (match(list[i])) list.splice(i, 1);
      if (list.length === before) throw missing;
    };
    if (type === 'opening') {
      const bill = store.sales.find((s) => s.id === id && s.customer_id === partyId && s.is_opening);
      if (bill) {
        remove(store.sales, (s) => s === bill);
        store.payments.forEach((p) => p.sale_id === id && (p.sale_id = null));
      } else {
        remove(store.payments, (p) => p.id === id && p.customer_id === partyId && p.is_opening === true);
      }
    } else if (type === 'sale' || type === 'purchase') {
      remove(store.sales, (s) => s.id === id && s.customer_id === partyId && s.kind === kind);
      store.payments.forEach((p) => p.sale_id === id && (p.sale_id = null));
    } else if (type === 'return') {
      remove(store.payments, (p) => p.id === id && p.customer_id === partyId && p.method === 'return');
    } else if (type === 'adjustment') {
      remove(store.payments, (p) => p.customer_id === partyId && p.method === 'adjustment' && (p.settlement_id === id || p.id === id));
    } else {
      remove(store.payments, (p) => p.id === id && p.customer_id === partyId && p.kind === kind && p.method !== 'adjustment');
    }
    return;
  }

  if (!UUID_RE.test(id) || !UUID_RE.test(partyId)) throw missing;
  const { db, ownerId } = ctx;
  let result;
  if (type === 'opening') {
    result = await db.from('credit_sales').delete().eq('owner_id', ownerId).eq('customer_id', partyId).eq('is_opening', true).eq('id', id).select('id');
    if (!result.error && !result.data?.length) {
      result = await db.from('payments').delete().eq('owner_id', ownerId).eq('customer_id', partyId).eq('is_opening', true).eq('id', id).select('id');
    }
  } else if (type === 'sale' || type === 'purchase') {
    // The database unlinks the payments recorded against it
    result = await db.from('credit_sales').delete().eq('owner_id', ownerId).eq('customer_id', partyId).eq('kind', kind).eq('id', id).select('id');
  } else if (type === 'return') {
    result = await db.from('payments').delete().eq('owner_id', ownerId).eq('customer_id', partyId).eq('method', 'return').eq('id', id).select('id');
  } else if (type === 'adjustment') {
    result = await db
      .from('payments')
      .delete()
      .eq('owner_id', ownerId)
      .eq('customer_id', partyId)
      .eq('method', 'adjustment')
      .or(`settlement_id.eq.${id},id.eq.${id}`)
      .select('id');
  } else {
    result = await db
      .from('payments')
      .delete()
      .eq('owner_id', ownerId)
      .eq('customer_id', partyId)
      .eq('kind', kind)
      .eq('id', id)
      .neq('method', 'adjustment')
      .select('id');
  }
  if (result.error) throw schemaError(result.error);
  if (!result.data?.length) throw missing;
}

// ---------------------------------------------------------------------------
// Returns: goods a customer returned (kind 'customer') or you returned to a vendor
// (kind 'vendor'). Stored as payments with method 'return' and the reason in notes.
// ---------------------------------------------------------------------------

type ReturnInput = { customer_id: string; return_date: string; amount: number; sale_id?: string | null; reason: string };

/** One return of a party, for its edit page */
export async function getReturnById(kind: ContactKind, partyId: string, id: string): Promise<Payment | null> {
  const payment = await getPaymentById(kind, partyId, id);
  return payment?.method === 'return' ? payment : null;
}

function returnValues(kind: ContactKind, data: ReturnInput) {
  return {
    customer_id: data.customer_id,
    kind,
    payment_date: data.return_date,
    amount: data.amount,
    method: 'return' as const,
    sale_id: data.sale_id || null,
    notes: data.reason,
  };
}

/** Records a customer return (lowers what they owe) or a vendor return (lowers what you owe) */
export async function createReturn(kind: ContactKind, data: ReturnInput): Promise<Payment> {
  const terms = SIDES[kind];
  const wrongEntry = `The selected ${terms.entry} does not belong to this ${terms.one}.`;
  const values = returnValues(kind, data);
  const ctx = await getCtx();
  await assertParty(ctx, data.customer_id, kind);

  if (!ctx) {
    const store = getDemoData();
    if (data.sale_id && !store.sales.some((s) => s.id === data.sale_id && s.customer_id === data.customer_id && s.kind === kind)) {
      throw new Error(wrongEntry);
    }
    const entry: Payment = { id: newDemoId('ret'), ...values, created_at: new Date().toISOString() };
    store.payments.push(entry);
    return entry;
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

/** Corrects a return */
export async function updateReturn(kind: ContactKind, id: string, data: ReturnInput): Promise<Payment> {
  const terms = SIDES[kind];
  const missing = new Error('This return no longer exists.');
  const wrongEntry = `The selected ${terms.entry} does not belong to this ${terms.one}.`;
  const values = returnValues(kind, data);
  const ctx = await getCtx();
  await assertParty(ctx, data.customer_id, kind);

  if (!ctx) {
    const store = getDemoData();
    const existing = store.payments.find((p) => p.id === id && p.kind === kind && p.method === 'return');
    if (!existing) throw missing;
    if (data.sale_id && !store.sales.some((s) => s.id === data.sale_id && s.customer_id === data.customer_id && s.kind === kind)) {
      throw new Error(wrongEntry);
    }
    return Object.assign(existing, values);
  }

  if (!UUID_RE.test(id)) throw missing;
  const { data: row, error } = await ctx.db
    .from('payments')
    .update(values)
    .eq('id', id)
    .eq('owner_id', ctx.ownerId)
    .eq('kind', kind)
    .eq('method', 'return')
    .select()
    .maybeSingle();
  if (error) {
    if (error.code === '23503') throw new Error(/sale/.test(error.message) ? wrongEntry : `${terms.One} not found`);
    throw schemaError(error);
  }
  if (!row) throw missing;
  return toPayment(row);
}

/** Customer returns (kind 'customer') or vendor returns (kind 'vendor') dated from `start` up to (not including) `end` */
export async function getReturns(kind: ContactKind, start: string, end: string): Promise<ReturnEntry[]> {
  const ctx = await getCtx();
  let returns: Payment[];
  let parties: Customer[];
  let bills: { id: string; material: string; sale_date: string }[];

  if (!ctx) {
    const store = getDemoData();
    returns = store.payments.filter((p) => p.kind === kind && p.method === 'return' && p.payment_date >= start && p.payment_date < end);
    parties = store.customers;
    bills = store.sales;
  } else {
    const { db, ownerId } = ctx;
    const rows = await fetchAll((a, b) =>
      db
        .from('payments')
        .select('*')
        .eq('owner_id', ownerId)
        .eq('kind', kind)
        .eq('method', 'return')
        .gte('payment_date', start)
        .lt('payment_date', end)
        .order('id')
        .range(a, b)
    );
    returns = rows.map(toPayment);
    const saleIds = [...new Set(returns.map((r) => r.sale_id).filter((x): x is string => Boolean(x)))];
    const [p, s] = await Promise.all([
      fetchCustomers(ctx),
      saleIds.length
        ? db.from('credit_sales').select('id, material, sale_date').eq('owner_id', ownerId).in('id', saleIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (s.error) throw schemaError(s.error);
    parties = p;
    bills = s.data ?? [];
  }

  const names = new Map(parties.map((c) => [c.id, c.name]));
  const billById = new Map(bills.map((b) => [b.id, b]));
  return returns
    .map((r) => {
      const bill = r.sale_id ? billById.get(r.sale_id) : undefined;
      return {
        id: r.id,
        partyId: r.customer_id,
        partyName: names.get(r.customer_id) ?? 'Unknown',
        date: r.payment_date,
        amount: Number(r.amount),
        reason: r.notes ?? '',
        against: bill ? `${bill.material} · ${formatDate(bill.sale_date)}` : null,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.partyName.localeCompare(b.partyName));
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
    // Prices: the kept party's own stay, the others move over
    const kept = new Set(store.customerPrices.filter((p) => p.customer_id === keepId).map((p) => p.material.trim().toLowerCase()));
    store.customerPrices = store.customerPrices.filter((p) => p.customer_id !== mergeId || !kept.has(p.material.trim().toLowerCase()));
    store.customerPrices.forEach((p) => p.customer_id === mergeId && (p.customer_id = keepId));
    store.customers.splice(store.customers.indexOf(other), 1);
    return;
  }

  if (!UUID_RE.test(keepId) || !UUID_RE.test(mergeId)) throw new Error('Party not found');
  const { error } = await ctx.db.rpc('merge_parties', { p_keep: keepId, p_merge: mergeId });
  if (error) throw schemaError(error);
}

// ---------------------------------------------------------------------------
// Profit and loss: expenses and owner's money, month-end stock counts, cost prices
// ---------------------------------------------------------------------------

type BusinessEntryRow = Database['public']['Tables']['business_entries']['Row'];
type StockCountRow = Database['public']['Tables']['stock_counts']['Row'];

export type BusinessEntryInput = {
  kind: BusinessEntryKind;
  entry_date: string;
  amount: number;
  category: string | null;
  notes: string | null;
};
export type StockCountInput = { items: Omit<StockItem, 'amount'>[]; notes: string | null };

const toEntryKind = (v: string): BusinessEntryKind => (v === 'investment' || v === 'withdrawal' ? v : 'expense');
const monthStart = (month: string) => `${month}-01`;

function toBusinessEntry(r: BusinessEntryRow): BusinessEntry {
  return {
    id: r.id,
    kind: toEntryKind(r.kind),
    entry_date: r.entry_date,
    amount: num(r.amount),
    category: r.category,
    notes: r.notes,
    created_at: r.created_at,
  };
}

function toStockItems(value: Json): StockItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((x): StockItem[] => {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return [];
    const quantity = num(x.quantity as number | string | null);
    const rate = num(x.rate as number | string | null);
    return [
      {
        kind: x.kind === 'finished' ? 'finished' : 'raw',
        name: String(x.name ?? ''),
        quantity,
        unit: String(x.unit ?? ''),
        rate,
        amount: quantity * rate,
      },
    ];
  });
}

function toStockCount(r: StockCountRow): StockCount {
  return {
    id: r.id,
    month: r.month.slice(0, 7),
    items: toStockItems(r.items),
    total: num(r.total),
    notes: r.notes,
    updated_at: r.updated_at,
  };
}

/** A count's lines with their amounts, and the total */
function stockValues(input: StockCountInput) {
  const items: StockItem[] = input.items.map((i) => ({ ...i, amount: Math.round(i.quantity * i.rate * 100) / 100 }));
  return { items, total: stockTotal(items) };
}

/**
 * Everything the profit figures need for the months `from` to `to` (YYYY-MM), or null
 * when the profit migration has not been run yet
 */
async function loadProfitInputs(from: string, to: string): Promise<ProfitInputs | null> {
  const ctx = await getCtx();
  if (!ctx) {
    const d = getDemoData();
    return {
      sales: d.sales,
      returns: d.payments.filter((p) => p.method === 'return'),
      entries: d.businessEntries,
      counts: d.stockCounts,
      materials: d.materials,
      customerCosts: d.customerPrices,
    };
  }

  const { db, ownerId } = ctx;
  const start = monthStart(from);
  const end = nextMonthStart(to);
  try {
    const [sales, returns, entries, counts, materials, customerCosts] = await Promise.all([
      fetchAll((a, b) =>
        db
          .from('credit_sales')
          .select('id, customer_id, kind, sale_date, material, quantity, unit, amount, is_opening')
          .eq('owner_id', ownerId)
          .eq('is_opening', false)
          .gte('sale_date', start)
          .lt('sale_date', end)
          .order('id')
          .range(a, b)
      ),
      fetchAll((a, b) =>
        db
          .from('payments')
          .select('id, customer_id, kind, payment_date, amount, sale_id, is_opening')
          .eq('owner_id', ownerId)
          .eq('method', 'return')
          .gte('payment_date', start)
          .lt('payment_date', end)
          .order('id')
          .range(a, b)
      ),
      fetchAll((a, b) =>
        db
          .from('business_entries')
          .select('id, kind, entry_date, amount, category')
          .eq('owner_id', ownerId)
          .gte('entry_date', start)
          .lt('entry_date', end)
          .order('id')
          .range(a, b)
      ),
      fetchAll((a, b) =>
        db
          .from('stock_counts')
          .select('id, month, total')
          .eq('owner_id', ownerId)
          .gte('month', monthStart(shiftMonth(from, -1)))
          .lt('month', end)
          .order('id')
          .range(a, b)
      ),
      fetchAll((a, b) => db.from('materials').select('id, name, unit, cost_price').eq('owner_id', ownerId).order('id').range(a, b)),
      fetchCustomerPrices(ctx),
    ]);
    return {
      sales: sales.map((s) => ({ ...s, kind: toKind(s.kind), unit: s.unit ?? '', quantity: num(s.quantity), amount: num(s.amount) })),
      returns: returns.map((r) => ({ ...r, kind: toKind(r.kind), amount: num(r.amount) })),
      entries: entries.map((e) => ({ ...e, kind: toEntryKind(e.kind), amount: num(e.amount) })),
      counts: counts.map((c) => ({ month: c.month.slice(0, 7), total: num(c.total) })),
      materials: materials.map((m) => ({ ...m, cost_price: m.cost_price === null ? null : num(m.cost_price) })),
      customerCosts,
    };
  } catch (err) {
    if (err instanceof SchemaUpdateError) return null;
    throw err;
  }
}

/** Profit for each month from `from` to `to` (YYYY-MM), oldest first; null before the profit migration */
export async function getProfitMonths(from: string, to: string): Promise<ProfitMonth[] | null> {
  const inputs = await loadProfitInputs(from, to);
  return inputs && buildProfitMonths(monthRange(from, to), inputs);
}

/**
 * The profit and loss of `month` (YYYY-MM): the month and the one before, the last
 * `historyMonths` months for comparison, item-wise margins and expenses by category
 */
export async function getProfitReport(month: string, historyMonths = 12): Promise<ProfitReport | null> {
  const from = shiftMonth(month, -(Math.max(2, historyMonths) - 1));
  const inputs = await loadProfitInputs(from, month);
  if (!inputs) return null;
  const history = buildProfitMonths(monthRange(from, month), inputs);
  const book = costBook(inputs.materials, inputs.customerCosts);
  const parties = await getParties();
  return {
    month: history[history.length - 1],
    previous: history[history.length - 2],
    history,
    items: buildItemMargins(month, inputs.sales, book),
    customers: buildCustomerMargins(month, inputs.sales, inputs.returns, book, new Map(parties.map((p) => [p.id, p.name]))),
    expensesByCategory: expensesByCategory(month, inputs.entries),
  };
}

/** Expenses, investments and withdrawals dated from `start` up to (not including) `end`, newest first */
export async function getBusinessEntries(start: string, end: string): Promise<BusinessEntry[]> {
  const ctx = await getCtx();
  let entries: BusinessEntry[];
  if (!ctx) {
    entries = getDemoData().businessEntries.filter((e) => e.entry_date >= start && e.entry_date < end);
  } else {
    const rows = await fetchAll((a, b) =>
      ctx.db
        .from('business_entries')
        .select('*')
        .eq('owner_id', ctx.ownerId)
        .gte('entry_date', start)
        .lt('entry_date', end)
        .order('id')
        .range(a, b)
    );
    entries = rows.map(toBusinessEntry);
  }
  return [...entries].sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at));
}

/** Expense categories used in the last year, most used first */
export async function getExpenseCategories(): Promise<string[]> {
  const today = getTodayDateStr();
  const entries = await getBusinessEntries(addDays(today, -365), addDays(today, 1));
  const counts = new Map<string, { name: string; count: number }>();
  for (const e of entries) {
    if (e.kind !== 'expense' || !e.category) continue;
    const key = e.category.trim().toLowerCase();
    const c = counts.get(key) ?? { name: e.category.trim(), count: 0 };
    c.count += 1;
    counts.set(key, c);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).map((c) => c.name);
}

export async function getBusinessEntryById(id: string): Promise<BusinessEntry | null> {
  const ctx = await getCtx();
  if (!ctx) return getDemoData().businessEntries.find((e) => e.id === id) ?? null;
  if (!UUID_RE.test(id)) return null;
  const { data, error } = await ctx.db.from('business_entries').select('*').eq('owner_id', ctx.ownerId).eq('id', id).maybeSingle();
  if (error) throw schemaError(error);
  return data ? toBusinessEntry(data) : null;
}

export async function createBusinessEntry(input: BusinessEntryInput): Promise<BusinessEntry> {
  const ctx = await getCtx();
  if (!ctx) {
    const entry: BusinessEntry = { id: newDemoId('bus'), ...input, created_at: new Date().toISOString() };
    getDemoData().businessEntries.push(entry);
    return entry;
  }
  const { data, error } = await ctx.db
    .from('business_entries')
    .insert({ ...input, owner_id: ctx.ownerId })
    .select()
    .single();
  if (error) throw schemaError(error);
  return toBusinessEntry(data);
}

export async function updateBusinessEntry(id: string, input: BusinessEntryInput): Promise<BusinessEntry> {
  const missing = new Error('This entry no longer exists.');
  const ctx = await getCtx();
  if (!ctx) {
    const entry = getDemoData().businessEntries.find((e) => e.id === id);
    if (!entry) throw missing;
    return Object.assign(entry, input);
  }
  if (!UUID_RE.test(id)) throw missing;
  const { data, error } = await ctx.db
    .from('business_entries')
    .update(input)
    .eq('id', id)
    .eq('owner_id', ctx.ownerId)
    .select()
    .maybeSingle();
  if (error) throw schemaError(error);
  if (!data) throw missing;
  return toBusinessEntry(data);
}

export async function deleteBusinessEntry(id: string): Promise<void> {
  const ctx = await getCtx();
  if (!ctx) {
    const list = getDemoData().businessEntries;
    const index = list.findIndex((e) => e.id === id);
    if (index >= 0) list.splice(index, 1);
    return;
  }
  if (!UUID_RE.test(id)) return;
  const { error } = await ctx.db.from('business_entries').delete().eq('id', id).eq('owner_id', ctx.ownerId);
  if (error) throw schemaError(error);
}

/** Every month-end stock count, newest first */
export async function getStockCounts(): Promise<StockCount[]> {
  const ctx = await getCtx();
  if (!ctx) return [...getDemoData().stockCounts].sort((a, b) => b.month.localeCompare(a.month));
  const rows = await fetchAll((a, b) =>
    ctx.db.from('stock_counts').select('*').eq('owner_id', ctx.ownerId).order('month', { ascending: false }).order('id').range(a, b)
  );
  return rows.map(toStockCount);
}

/** The stock count at the end of `month` (YYYY-MM), if there is one */
export async function getStockCount(month: string): Promise<StockCount | null> {
  const ctx = await getCtx();
  if (!ctx) return getDemoData().stockCounts.find((c) => c.month === month) ?? null;
  const { data, error } = await ctx.db
    .from('stock_counts')
    .select('*')
    .eq('owner_id', ctx.ownerId)
    .eq('month', monthStart(month))
    .maybeSingle();
  if (error) throw schemaError(error);
  return data ? toStockCount(data) : null;
}

/** Saves (or replaces) the stock count at the end of `month` */
export async function saveStockCount(month: string, input: StockCountInput): Promise<StockCount> {
  const { items, total } = stockValues(input);
  const updated_at = new Date().toISOString();
  const ctx = await getCtx();
  if (!ctx) {
    const list = getDemoData().stockCounts;
    const existing = list.find((c) => c.month === month);
    if (existing) return Object.assign(existing, { items, total, notes: input.notes, updated_at });
    const count: StockCount = { id: newDemoId('stk'), month, items, total, notes: input.notes, updated_at };
    list.push(count);
    return count;
  }
  const { data, error } = await ctx.db
    .from('stock_counts')
    .upsert({ owner_id: ctx.ownerId, month: monthStart(month), items, total, notes: input.notes, updated_at }, { onConflict: 'owner_id,month' })
    .select()
    .single();
  if (error) throw schemaError(error);
  return toStockCount(data);
}

export async function deleteStockCount(month: string): Promise<void> {
  const ctx = await getCtx();
  if (!ctx) {
    const list = getDemoData().stockCounts;
    const index = list.findIndex((c) => c.month === month);
    if (index >= 0) list.splice(index, 1);
    return;
  }
  const { error } = await ctx.db.from('stock_counts').delete().eq('owner_id', ctx.ownerId).eq('month', monthStart(month));
  if (error) throw schemaError(error);
}

/** Sets (or clears, with null) a product's cost price */
export async function setCostPrice(materialId: string, costPrice: number | null): Promise<Material> {
  const ctx = await getCtx();
  if (!ctx) {
    const material = getDemoData().materials.find((m) => m.id === materialId);
    if (!material) throw new Error('Material not found');
    material.cost_price = costPrice;
    return material;
  }
  if (!UUID_RE.test(materialId)) throw new Error('Material not found');
  const { data, error } = await ctx.db
    .from('materials')
    .update({ cost_price: costPrice })
    .eq('id', materialId)
    .eq('owner_id', ctx.ownerId)
    .select()
    .maybeSingle();
  if (error) throw schemaError(error);
  if (!data) throw new Error('Material not found');
  return toMaterial(data);
}

// ---------------------------------------------------------------------------
// Customer-specific prices: a customer's own sale rate and cost price for a product
// ---------------------------------------------------------------------------

type CustomerPriceDbRow = Database['public']['Tables']['customer_prices']['Row'];
export type CustomerPriceInput = { material: string; unit: string; sale_rate: number | null; cost_price: number | null };

const priceKey = (material: string) => material.trim().toLowerCase();
const optionalNum = (v: number | string | null | undefined) => (v === null || v === undefined ? null : num(v));

function toCustomerPrice(r: CustomerPriceDbRow): CustomerPrice {
  return {
    id: r.id,
    customer_id: r.customer_id,
    material: r.material,
    unit: r.unit,
    sale_rate: optionalNum(r.sale_rate),
    cost_price: optionalNum(r.cost_price),
    updated_at: r.updated_at,
  };
}

/**
 * Customers' own prices (one customer, or all). Before the customer-prices migration
 * there are none, so everything falls back to the general prices.
 */
async function fetchCustomerPrices({ db, ownerId }: Ctx, customerId?: string): Promise<CustomerPrice[]> {
  try {
    const rows = await fetchAll((a, b) => {
      let q = db.from('customer_prices').select('*').eq('owner_id', ownerId);
      if (customerId) q = q.eq('customer_id', customerId);
      return q.order('id').range(a, b);
    });
    return rows.map(toCustomerPrice);
  } catch (err) {
    if (err instanceof SchemaUpdateError) return [];
    throw err;
  }
}

/** True once the customer-prices migration has been run (always in demo mode) */
export async function customerPricesAvailable(): Promise<boolean> {
  const ctx = await getCtx();
  if (!ctx) return true;
  const { error } = await ctx.db.from('customer_prices').select('id').eq('owner_id', ctx.ownerId).limit(1);
  return !error || !isMissingSchema(error);
}

/**
 * One customer's price list: every product they bought (with the last rate charged) or
 * have their own price for, with their own rates and the general ones
 */
export async function getCustomerPriceList(customerId: string): Promise<CustomerPriceRow[]> {
  const ctx = await getCtx();
  let prices: CustomerPrice[];
  let sales: Pick<CreditSale, 'material' | 'unit' | 'rate' | 'quantity' | 'sale_date' | 'is_opening'>[];
  let materials: Material[];

  if (!ctx) {
    const d = getDemoData();
    prices = d.customerPrices.filter((p) => p.customer_id === customerId);
    sales = d.sales.filter((x) => x.customer_id === customerId && x.kind === 'customer');
    materials = d.materials;
  } else {
    if (!UUID_RE.test(customerId)) return [];
    const [p, s, m] = await Promise.all([
      fetchCustomerPrices(ctx, customerId),
      fetchAll((a, b) =>
        ctx.db
          .from('credit_sales')
          .select('id, material, unit, rate, quantity, sale_date, is_opening')
          .eq('owner_id', ctx.ownerId)
          .eq('customer_id', customerId)
          .eq('kind', 'customer')
          .eq('is_opening', false)
          .order('id')
          .range(a, b)
      ),
      getMaterials(),
    ]);
    prices = p;
    sales = s.map((x) => ({ ...x, unit: x.unit ?? '', rate: num(x.rate), quantity: num(x.quantity) }));
    materials = m.materials;
  }

  const general = new Map(materials.map((m) => [priceKey(m.name), m]));
  const rows = new Map<string, CustomerPriceRow>();
  const rowFor = (material: string, unit: string) => {
    const key = priceKey(material);
    const saved = general.get(key);
    const row = rows.get(key) ?? {
      key,
      material: saved?.name ?? material.trim(),
      unit: saved?.unit ?? unit,
      sale_rate: null,
      cost_price: null,
      default_rate: saved?.rate ?? null,
      default_cost: saved?.cost_price ?? null,
      last_rate: null,
      last_date: null,
      last_unit: null,
      quantity: 0,
    };
    rows.set(key, row);
    return row;
  };

  const yearAgo = addDays(getTodayDateStr(), -365);
  for (const x of [...sales].sort((a, b) => a.sale_date.localeCompare(b.sale_date))) {
    if (x.is_opening) continue;
    const row = rowFor(x.material, x.unit);
    // Sorted oldest first, so the last one seen is the latest
    row.last_rate = x.rate;
    row.last_date = x.sale_date;
    row.last_unit = x.unit;
    if (x.sale_date >= yearAgo) row.quantity += convertQuantity(x.quantity, x.unit, row.unit) ?? 0;
  }
  for (const p of prices) {
    const row = rowFor(p.material, p.unit);
    row.unit = p.unit;
    row.sale_rate = p.sale_rate;
    row.cost_price = p.cost_price;
  }
  return [...rows.values()].sort((a, b) => (b.last_date ?? '').localeCompare(a.last_date ?? '') || a.material.localeCompare(b.material));
}

/** Customers with their own prices: how many products each, A–Z */
export async function getCustomersWithPrices(): Promise<{ id: string; name: string; count: number }[]> {
  const ctx = await getCtx();
  const prices = ctx ? await fetchCustomerPrices(ctx) : getDemoData().customerPrices;
  const parties = await getParties();
  const counts = new Map<string, number>();
  for (const p of prices) counts.set(p.customer_id, (counts.get(p.customer_id) ?? 0) + 1);
  return parties.filter((p) => counts.has(p.id)).map((p) => ({ id: p.id, name: p.name, count: counts.get(p.id)! }));
}

/**
 * Saves a customer's own prices. A product with neither a sale rate nor a cost price is
 * removed from their list (the general prices apply again).
 */
export async function saveCustomerPrices(customerId: string, items: CustomerPriceInput[]): Promise<void> {
  const ctx = await getCtx();
  await assertParty(ctx, customerId, 'customer');
  const keep = items.filter((i) => i.sale_rate !== null || i.cost_price !== null);
  const drop = items.filter((i) => i.sale_rate === null && i.cost_price === null).map((i) => priceKey(i.material));
  const updated_at = new Date().toISOString();

  if (!ctx) {
    const d = getDemoData();
    d.customerPrices = d.customerPrices.filter((p) => !(p.customer_id === customerId && drop.includes(priceKey(p.material))));
    for (const i of keep) {
      const existing = d.customerPrices.find((p) => p.customer_id === customerId && priceKey(p.material) === priceKey(i.material));
      if (existing) Object.assign(existing, { ...i, material: existing.material, updated_at });
      else d.customerPrices.push({ id: newDemoId('cpr'), customer_id: customerId, ...i, material: i.material.trim(), updated_at });
    }
    return;
  }

  // The unique index is on lower(trim(material)), so match existing rows by that key
  const existing = await fetchCustomerPrices(ctx, customerId);
  const byKey = new Map(existing.map((p) => [priceKey(p.material), p]));
  const removeIds = drop.map((k) => byKey.get(k)?.id).filter((id): id is string => Boolean(id));
  if (removeIds.length) {
    const { error } = await ctx.db.from('customer_prices').delete().eq('owner_id', ctx.ownerId).in('id', removeIds);
    if (error) throw schemaError(error);
  }
  for (const i of keep) {
    const found = byKey.get(priceKey(i.material));
    const values = { unit: i.unit, sale_rate: i.sale_rate, cost_price: i.cost_price, updated_at };
    const { error } = found
      ? await ctx.db.from('customer_prices').update(values).eq('owner_id', ctx.ownerId).eq('id', found.id)
      : await ctx.db.from('customer_prices').insert({ ...values, owner_id: ctx.ownerId, customer_id: customerId, material: i.material.trim() });
    if (error) throw schemaError(error);
  }
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
