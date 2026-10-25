import {
  Customer,
  CreditSale,
  Payment,
  SaleBalance,
  CustomerSummary,
  CustomerStatus,
  CustomerLedger,
  LedgerRow,
  AgingRow,
  AgingSummary,
  DashboardStats,
  OverdueAgingBucket,
  MonthTotals,
  MonthlyBreakdownRow,
  MonthlyReport,
} from './types';
import { createSampleData } from './sample-data';
import { daysBetween, formatMonth, getTodayDateStr } from './format';

// ---------------------------------------------------------------------------
// Demo store (used only when Supabase is not configured).
// Kept on globalThis so it survives dev hot reloads; it is still lost when the
// server restarts.
// ---------------------------------------------------------------------------

type DemoData = { customers: Customer[]; sales: CreditSale[]; payments: Payment[] };

const globalStore = globalThis as typeof globalThis & { __ledgerDemoData?: DemoData };

export function getDemoData(): DemoData {
  if (!globalStore.__ledgerDemoData) {
    globalStore.__ledgerDemoData = createSampleData();
  }
  return globalStore.__ledgerDemoData;
}

// ---------------------------------------------------------------------------
// Pure calculations. These mirror the Supabase views so demo mode and live
// mode produce the same numbers.
// ---------------------------------------------------------------------------

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}

function statusFor(outstanding: number, overdue: number): CustomerStatus {
  if (outstanding <= 0) return 'paid';
  return overdue > 0 ? 'overdue' : 'pending';
}

/**
 * FIFO balance for each sale. Matches the `sale_balances` view.
 */
export function calculateSaleBalances(
  sales: CreditSale[],
  payments: Payment[],
  today: string = getTodayDateStr()
): SaleBalance[] {
  const paidByCustomer = new Map<string, number>();
  for (const p of payments) {
    paidByCustomer.set(p.customer_id, (paidByCustomer.get(p.customer_id) || 0) + Number(p.amount));
  }

  const salesByCustomer = new Map<string, CreditSale[]>();
  for (const s of sales) {
    const list = salesByCustomer.get(s.customer_id) || [];
    list.push(s);
    salesByCustomer.set(s.customer_id, list);
  }

  const result: SaleBalance[] = [];

  for (const [customerId, custSales] of salesByCustomer) {
    // Same order as the view: sale_date, created_at, id
    const ordered = [...custSales].sort(
      (a, b) =>
        a.sale_date.localeCompare(b.sale_date) ||
        (a.created_at || '').localeCompare(b.created_at || '') ||
        a.id.localeCompare(b.id)
    );

    const totalPaid = paidByCustomer.get(customerId) || 0;
    let priorTotal = 0;

    for (const s of ordered) {
      const amount = Number(s.amount);
      const paidAgainstThis = Math.min(amount, Math.max(0, totalPaid - priorTotal));

      result.push({
        ...s,
        paid_amount: paidAgainstThis,
        outstanding: amount - paidAgainstThis,
        days_overdue: Math.max(0, daysBetween(s.due_date, today)),
      });

      priorTotal += amount;
    }
  }

  return result;
}

/**
 * Per-customer totals. Matches the `customer_summary` view.
 */
export function calculateCustomerSummaries(
  customers: Customer[],
  saleBalances: SaleBalance[],
  payments: Payment[]
): CustomerSummary[] {
  return customers.map((c) => {
    const custSales = saleBalances.filter((s) => s.customer_id === c.id);
    const totalCreditSale = sum(custSales, (s) => Number(s.amount));
    const paymentReceived = sum(
      payments.filter((p) => p.customer_id === c.id),
      (p) => Number(p.amount)
    );
    const outstanding = sum(custSales, (s) => s.outstanding);
    const overdue = sum(
      custSales.filter((s) => s.days_overdue > 0),
      (s) => s.outstanding
    );
    const nextDueDate =
      custSales
        .filter((s) => s.outstanding > 0)
        .map((s) => s.due_date)
        .sort()[0] ?? null;

    return {
      customer_id: c.id,
      name: c.name,
      phone: c.phone,
      address: c.address,
      total_credit_sale: totalCreditSale,
      payment_received: paymentReceived,
      outstanding,
      overdue,
      advance: Math.max(0, paymentReceived - totalCreditSale),
      next_due_date: nextDueDate,
      status: statusFor(outstanding, overdue),
    };
  });
}

/**
 * Customer date-wise ledger with running balance
 */
export function calculateCustomerLedger(
  customerId: string,
  sales: CreditSale[],
  payments: Payment[],
  today: string = getTodayDateStr()
): CustomerLedger {
  const custSales = sales.filter((s) => s.customer_id === customerId);
  const custPayments = payments.filter((p) => p.customer_id === customerId);

  const saleBalances = calculateSaleBalances(custSales, custPayments, today);
  const balanceMap = new Map(saleBalances.map((sb) => [sb.id, sb]));

  type RawTx =
    | { kind: 'sale'; date: string; createdAt: string; data: CreditSale }
    | { kind: 'payment'; date: string; createdAt: string; data: Payment };

  const allTx: RawTx[] = [
    ...custSales.map((s) => ({ kind: 'sale' as const, date: s.sale_date, createdAt: s.created_at || '', data: s })),
    ...custPayments.map((p) => ({ kind: 'payment' as const, date: p.payment_date, createdAt: p.created_at || '', data: p })),
  ];

  // Ascending by date, sales before payments on the same date
  allTx.sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    if (a.kind !== b.kind) return a.kind === 'sale' ? -1 : 1;
    return a.createdAt.localeCompare(b.createdAt);
  });

  let runningBalance = 0;
  const rows: LedgerRow[] = [];

  for (const tx of allTx) {
    if (tx.kind === 'sale') {
      const s = tx.data;
      const amount = Number(s.amount);
      runningBalance += amount;

      const sb = balanceMap.get(s.id);
      let status: 'Paid' | 'Pending' | 'Overdue' = 'Pending';
      if (sb) {
        if (sb.outstanding === 0) status = 'Paid';
        else if (sb.days_overdue > 0) status = 'Overdue';
      }

      rows.push({
        id: s.id,
        date: s.sale_date,
        type: 'sale',
        material: s.material,
        quantity: s.quantity,
        unit: s.unit,
        rate: s.rate,
        debit: amount,
        credit: 0,
        balance: runningBalance,
        credit_days: s.credit_days,
        due_date: s.due_date,
        status,
        notes: s.notes,
      });
    } else {
      const p = tx.data;
      const amount = Number(p.amount);
      runningBalance -= amount;

      rows.push({
        id: p.id,
        date: p.payment_date,
        type: 'payment',
        material: '—',
        debit: 0,
        credit: amount,
        balance: runningBalance,
        method: p.method,
        status: '—',
        notes: p.notes,
      });
    }
  }

  const totalSale = sum(custSales, (s) => Number(s.amount));
  const totalReceived = sum(custPayments, (p) => Number(p.amount));
  const outstanding = sum(saleBalances, (s) => s.outstanding);
  const overdue = sum(
    saleBalances.filter((s) => s.days_overdue > 0),
    (s) => s.outstanding
  );
  const nextDueDate =
    saleBalances
      .filter((s) => s.outstanding > 0)
      .map((s) => s.due_date)
      .sort()[0] ?? null;

  return {
    rows,
    totalSale,
    totalReceived,
    outstanding,
    overdue,
    advance: Math.max(0, totalReceived - totalSale),
    nextDueDate,
    status: statusFor(outstanding, overdue),
  };
}

/**
 * Aging rows per customer + credit term. Matches the `overdue_aging` view.
 */
export function calculateAgingRows(saleBalances: SaleBalance[]): AgingRow[] {
  const rows = new Map<string, AgingRow>();

  for (const sb of saleBalances) {
    if (sb.outstanding <= 0) continue;

    const key = `${sb.customer_id}|${sb.credit_days}`;
    let row = rows.get(key);
    if (!row) {
      row = {
        customer_id: sb.customer_id,
        credit_days: sb.credit_days,
        total_outstanding: 0,
        total_overdue: 0,
        d1_30: 0,
        d31_60: 0,
        d61_90: 0,
        d90_plus: 0,
      };
      rows.set(key, row);
    }

    row.total_outstanding += sb.outstanding;
    if (sb.days_overdue > 0) {
      row.total_overdue += sb.outstanding;
      if (sb.days_overdue <= 30) row.d1_30 += sb.outstanding;
      else if (sb.days_overdue <= 60) row.d31_60 += sb.outstanding;
      else if (sb.days_overdue <= 90) row.d61_90 += sb.outstanding;
      else row.d90_plus += sb.outstanding;
    }
  }

  return [...rows.values()];
}

/**
 * Customer-wise overdue report from aging rows, optionally filtered by credit term
 */
export function groupAgingByCustomer(
  agingRows: AgingRow[],
  customerNames: Map<string, string>,
  creditDaysFilter?: number
): OverdueAgingBucket[] {
  const byCustomer = new Map<string, OverdueAgingBucket>();

  for (const r of agingRows) {
    if (creditDaysFilter && r.credit_days !== creditDaysFilter) continue;

    let b = byCustomer.get(r.customer_id);
    if (!b) {
      b = {
        customer_id: r.customer_id,
        customer_name: customerNames.get(r.customer_id) || 'Unknown Customer',
        total_outstanding: 0,
        total_overdue: 0,
        d1_30: 0,
        d31_60: 0,
        d61_90: 0,
        d90_plus: 0,
      };
      byCustomer.set(r.customer_id, b);
    }

    b.total_outstanding += r.total_outstanding;
    b.total_overdue += r.total_overdue;
    b.d1_30 += r.d1_30;
    b.d31_60 += r.d31_60;
    b.d61_90 += r.d61_90;
    b.d90_plus += r.d90_plus;
  }

  return [...byCustomer.values()].sort(
    (a, b) => b.total_overdue - a.total_overdue || b.total_outstanding - a.total_outstanding
  );
}

export function summarizeAging(agingRows: AgingRow[]): AgingSummary {
  return {
    notDue: sum(agingRows, (r) => r.total_outstanding - r.total_overdue),
    d1_30: sum(agingRows, (r) => r.d1_30),
    d31_60: sum(agingRows, (r) => r.d31_60),
    d61_90: sum(agingRows, (r) => r.d61_90),
    d90_plus: sum(agingRows, (r) => r.d90_plus),
  };
}

export function buildDashboardStats(
  summaries: CustomerSummary[],
  agingRows: AgingRow[],
  currentMonth: string,
  monthTotals: MonthTotals
): DashboardStats {
  const topCustomers = summaries
    .filter((c) => c.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 5)
    .map((c) => ({
      id: c.customer_id,
      name: c.name,
      outstanding: c.outstanding,
      totalSale: c.total_credit_sale,
      status: c.status,
    }));

  return {
    totalCreditSale: sum(summaries, (c) => c.total_credit_sale),
    totalReceived: sum(summaries, (c) => c.payment_received),
    totalOutstanding: sum(summaries, (c) => c.outstanding),
    totalOverdue: sum(summaries, (c) => c.overdue),
    totalAdvance: sum(summaries, (c) => c.advance),
    customerCount: summaries.length,
    customersWithBalance: summaries.filter((c) => c.outstanding > 0).length,
    customersOverdue: summaries.filter((c) => c.overdue > 0).length,
    currentMonth: {
      name: formatMonth(currentMonth),
      sold: monthTotals.materialSold,
      received: monthTotals.paymentReceived,
      net: monthTotals.materialSold - monthTotals.paymentReceived,
    },
    agingSummary: summarizeAging(agingRows),
    topCustomers,
  };
}

const inMonth = (dateStr: string, month: string) => dateStr.startsWith(`${month}-`);

/**
 * Month totals. Matches the `monthly_report` SQL function.
 */
export function calculateMonthTotals(
  month: string,
  sales: CreditSale[],
  payments: Payment[],
  saleBalances: SaleBalance[]
): MonthTotals {
  return {
    materialSold: sum(sales.filter((s) => inMonth(s.sale_date, month)), (s) => Number(s.amount)),
    paymentReceived: sum(payments.filter((p) => inMonth(p.payment_date, month)), (p) => Number(p.amount)),
    paymentDue: sum(sales.filter((s) => inMonth(s.due_date, month)), (s) => Number(s.amount)),
    balanceRemaining: sum(saleBalances, (s) => s.outstanding),
  };
}

/**
 * Customer-wise activity for a month. `sales` and `payments` may contain other
 * months; only rows belonging to `month` are counted.
 */
export function buildMonthlyBreakdown(
  month: string,
  customers: Customer[],
  sales: CreditSale[],
  payments: Payment[]
): MonthlyBreakdownRow[] {
  return customers
    .map((c) => {
      const cSales = sales.filter((s) => s.customer_id === c.id);
      const sold = sum(cSales.filter((s) => inMonth(s.sale_date, month)), (s) => Number(s.amount));
      const due = sum(cSales.filter((s) => inMonth(s.due_date, month)), (s) => Number(s.amount));
      const received = sum(
        payments.filter((p) => p.customer_id === c.id && inMonth(p.payment_date, month)),
        (p) => Number(p.amount)
      );

      return {
        customerId: c.id,
        customerName: c.name,
        materialSold: sold,
        paymentReceived: received,
        paymentDue: due,
        monthBalance: sold - received,
      };
    })
    .filter((c) => c.materialSold > 0 || c.paymentReceived > 0 || c.paymentDue > 0)
    .sort((a, b) => a.customerName.localeCompare(b.customerName));
}

export function buildMonthlyReport(
  month: string,
  totals: MonthTotals,
  customerBreakdown: MonthlyBreakdownRow[]
): MonthlyReport {
  return {
    month,
    formattedMonth: formatMonth(month),
    ...totals,
    customerBreakdown,
  };
}
