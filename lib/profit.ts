import { BusinessEntry, BusinessEntryKind, CreditSale, CustomerMargin, CustomerPrice, CustomerPriceRow, ItemMargin, Material, Payment, ProfitMonth, StockCount } from './types';
import { shiftMonth, unitGroup } from './format';

// Profit and loss, worked out the same way in demo mode and live mode.
//
// Cost of goods sold (what the goods sold in a month cost you):
//   * 'stock':    opening stock + purchases − closing stock, when the month and the month
//                 before both have a stock count. Exact: it includes waste and every cost
//                 that went into stock.
//   * 'estimate': quantity sold × the product's cost price, until the month is counted. A
//                 customer's own cost price for the product wins over the general one.
// Customer returns lower sales (and their cost, in the estimate); vendor returns lower
// purchases. Opening balances are not sales or purchases. Owner investment and
// withdrawals are not income or expenses.

export type ProfitSale = Pick<CreditSale, 'id' | 'customer_id' | 'kind' | 'sale_date' | 'material' | 'quantity' | 'unit' | 'amount' | 'is_opening'>;
export type ProfitReturn = Pick<Payment, 'customer_id' | 'kind' | 'payment_date' | 'amount' | 'sale_id' | 'is_opening'>; // method 'return' only
export type ProfitEntry = Pick<BusinessEntry, 'kind' | 'entry_date' | 'amount' | 'category'>;
export type ProfitCount = Pick<StockCount, 'month' | 'total'>;
export type ProfitCost = Pick<Material, 'name' | 'unit' | 'cost_price'>;
export type ProfitCustomerCost = Pick<CustomerPrice, 'customer_id' | 'material' | 'unit' | 'cost_price'>;

export type ProfitInputs = {
  sales: ProfitSale[]; // sales and purchases (both kinds)
  returns: ProfitReturn[]; // customer and vendor returns
  entries: ProfitEntry[];
  counts: ProfitCount[];
  materials: ProfitCost[];
  customerCosts: ProfitCustomerCost[]; // customers' own cost prices
};

/** Wording for the three kinds of business entry */
export const ENTRY_TERMS: Record<BusinessEntryKind, { label: string; one: string; hint: string; save: string }> = {
  expense: {
    label: 'Expense',
    one: 'expense',
    hint: 'Rent, salaries, bills and other running costs. Lowers your net profit.',
    save: 'Save expense',
  },
  investment: {
    label: 'Investment',
    one: 'investment',
    hint: 'Money you put into the business. It is your capital, not income, so profit does not change.',
    save: 'Save investment',
  },
  withdrawal: {
    label: 'Withdrawal',
    one: 'withdrawal',
    hint: 'Money you take out of the business for yourself. It is not an expense, so profit does not change.',
    save: 'Save withdrawal',
  },
};

const nameKey = (name: string) => name.trim().toLowerCase();
const inMonth = (date: string, month: string) => date.startsWith(`${month}-`);
const total = <T>(items: T[], pick: (x: T) => number) => items.reduce((s, x) => s + pick(x), 0);

/** `qty` in unit `from` expressed in unit `to` (kg ↔ ton), or null when they cannot be compared */
export function convertQuantity(qty: number, from: string, to: string): number | null {
  if (nameKey(from) === nameKey(to)) return qty;
  const a = unitGroup(from);
  const b = unitGroup(to);
  return a.key === b.key ? (qty * a.factor) / b.factor : null;
}

/** Cost prices: each customer's own, and the general ones of the saved products */
export type CostBook = { general: Map<string, ProfitCost>; customer: Map<string, { unit: string; cost_price: number }> };

const customerKey = (customerId: string, material: string) => `${customerId}|${nameKey(material)}`;

export function costBook(materials: ProfitCost[], customerCosts: ProfitCustomerCost[] = []): CostBook {
  const customer = new Map<string, { unit: string; cost_price: number }>();
  for (const c of customerCosts) {
    if (c.cost_price !== null && c.cost_price !== undefined) {
      customer.set(customerKey(c.customer_id, c.material), { unit: c.unit, cost_price: Number(c.cost_price) });
    }
  }
  return { general: new Map(materials.map((m) => [nameKey(m.name), m])), customer };
}

/** The cost price used for a customer's sale of a product: theirs, else the general one */
export function costPriceFor(customerId: string, material: string, book: CostBook): { unit: string; cost_price: number; own: boolean } | null {
  const own = book.customer.get(customerKey(customerId, material));
  if (own) return { ...own, own: true };
  const product = book.general.get(nameKey(material));
  if (!product || product.cost_price === null || product.cost_price === undefined) return null;
  return { unit: product.unit, cost_price: Number(product.cost_price), own: false };
}

/** What a sale cost you, at its cost price; null without a usable cost price */
export function saleCost(sale: Pick<ProfitSale, 'customer_id' | 'material' | 'quantity' | 'unit'>, book: CostBook): number | null {
  const price = costPriceFor(sale.customer_id, sale.material, book);
  if (!price) return null;
  const qty = convertQuantity(Number(sale.quantity), sale.unit, price.unit);
  return qty === null ? null : qty * price.cost_price;
}

/** Profit for each month in `months` (YYYY-MM, any order) */
export function buildProfitMonths(months: string[], input: ProfitInputs): ProfitMonth[] {
  const costs = costBook(input.materials, input.customerCosts);
  const counts = new Map(input.counts.map((c) => [c.month, Number(c.total)]));
  const salesById = new Map(input.sales.map((s) => [s.id, s]));

  return months.map((month) => {
    const bills = input.sales.filter((s) => !s.is_opening && inMonth(s.sale_date, month));
    const sold = bills.filter((s) => s.kind === 'customer');
    const bought = bills.filter((s) => s.kind === 'vendor');
    const returns = input.returns.filter((r) => !r.is_opening && inMonth(r.payment_date, month));
    const customerReturns = returns.filter((r) => r.kind === 'customer');
    const entries = input.entries.filter((e) => inMonth(e.entry_date, month));

    const sales = total(sold, (s) => Number(s.amount));
    const returned = total(customerReturns, (r) => Number(r.amount));
    const purchases = total(bought, (s) => Number(s.amount));
    const vendorReturns = total(
      returns.filter((r) => r.kind === 'vendor'),
      (r) => Number(r.amount)
    );

    // Estimate: sales at cost price; products without one are listed
    let estimate = 0;
    let costedSales = 0;
    const uncosted = new Map<string, { name: string; amount: number }>();
    for (const s of sold) {
      const cost = saleCost(s, costs);
      if (cost === null) {
        const u = uncosted.get(nameKey(s.material)) ?? { name: s.material.trim(), amount: 0 };
        u.amount += Number(s.amount);
        uncosted.set(nameKey(s.material), u);
      } else {
        estimate += cost;
        costedSales += Number(s.amount);
      }
    }
    // Goods returned by customers come back at cost: the linked sale's cost ratio, or the month's
    const monthRatio = costedSales > 0 ? estimate / costedSales : 0;
    for (const r of customerReturns) {
      const sale = r.sale_id ? salesById.get(r.sale_id) : undefined;
      const saleCostValue = sale ? saleCost(sale, costs) : null;
      const ratio = sale && saleCostValue !== null && Number(sale.amount) > 0 ? saleCostValue / Number(sale.amount) : monthRatio;
      estimate -= Number(r.amount) * ratio;
    }

    const openingStock = counts.get(shiftMonth(month, -1)) ?? null;
    const closingStock = counts.get(month) ?? null;
    const netSales = sales - returned;
    const netPurchases = purchases - vendorReturns;
    const method: ProfitMonth['method'] = openingStock !== null && closingStock !== null ? 'stock' : 'estimate';
    const costOfSales = method === 'stock' ? openingStock! + netPurchases - closingStock! : estimate;
    const grossProfit = netSales - costOfSales;
    const expenses = total(
      entries.filter((e) => e.kind === 'expense'),
      (e) => Number(e.amount)
    );

    return {
      month,
      sales,
      customerReturns: returned,
      netSales,
      purchases,
      vendorReturns,
      netPurchases,
      openingStock,
      closingStock,
      method,
      costOfSales,
      estimatedCost: estimate,
      uncosted: [...uncosted.values()].sort((a, b) => b.amount - a.amount),
      grossProfit,
      expenses,
      netProfit: grossProfit - expenses,
      invested: total(
        entries.filter((e) => e.kind === 'investment'),
        (e) => Number(e.amount)
      ),
      withdrawn: total(
        entries.filter((e) => e.kind === 'withdrawal'),
        (e) => Number(e.amount)
      ),
    };
  });
}

/** Each product sold in `month`: quantity, sales, cost at its cost price and margin */
export function buildItemMargins(month: string, sales: ProfitSale[], costs: CostBook): ItemMargin[] {
  const items = new Map<string, ItemMargin & { complete: boolean }>();

  for (const s of sales) {
    if (s.kind !== 'customer' || s.is_opening || !inMonth(s.sale_date, month)) continue;
    const key = nameKey(s.material);
    const product = costs.general.get(key);
    const item = items.get(key) ?? {
      key,
      name: product?.name ?? s.material.trim(),
      unit: product?.unit ?? s.unit,
      quantity: 0,
      sales: 0,
      costPrice: product?.cost_price ?? null,
      customerPriced: false,
      cost: 0,
      complete: true,
    };
    if (costPriceFor(s.customer_id, s.material, costs)?.own) item.customerPriced = true;
    item.quantity += convertQuantity(Number(s.quantity), s.unit, item.unit) ?? 0;
    item.sales += Number(s.amount);
    const cost = saleCost(s, costs);
    if (cost === null) item.complete = false;
    else item.cost = (item.cost ?? 0) + cost;
    items.set(key, item);
  }

  return [...items.values()]
    .map(({ complete, ...item }) => ({ ...item, cost: complete ? item.cost : null }))
    .sort((a, b) => b.sales - a.sales || a.name.localeCompare(b.name));
}

/**
 * Each customer's sales in `month` (after their returns), what those goods cost at the cost
 * prices (theirs first) and the margin. Sales without a cost price are counted apart.
 */
export function buildCustomerMargins(
  month: string,
  sales: ProfitSale[],
  returns: ProfitReturn[],
  book: CostBook,
  names: Map<string, string>
): CustomerMargin[] {
  const rows = new Map<string, CustomerMargin & { costedSales: number }>();
  const row = (id: string) => {
    const r = rows.get(id) ?? { id, name: names.get(id) ?? 'Unknown', sales: 0, returned: 0, cost: 0, uncosted: 0, costedSales: 0 };
    rows.set(id, r);
    return r;
  };
  for (const s of sales) {
    if (s.kind !== 'customer' || s.is_opening || !inMonth(s.sale_date, month)) continue;
    const r = row(s.customer_id);
    r.sales += Number(s.amount);
    const cost = saleCost(s, book);
    if (cost === null) r.uncosted += Number(s.amount);
    else {
      r.cost += cost;
      r.costedSales += Number(s.amount);
    }
  }
  // Returned goods come back at the customer's own cost ratio
  const ratios = new Map([...rows.values()].map((r) => [r.id, r.costedSales > 0 ? r.cost / r.costedSales : 0]));
  for (const ret of returns) {
    if (ret.kind !== 'customer' || ret.is_opening || !inMonth(ret.payment_date, month)) continue;
    const r = row(ret.customer_id);
    r.returned += Number(ret.amount);
    r.cost -= Number(ret.amount) * (ratios.get(r.id) ?? 0);
  }
  return [...rows.values()]
    .map((r) => ({ id: r.id, name: r.name, sales: r.sales, returned: r.returned, cost: r.cost, uncosted: r.uncosted }))
    .sort((a, b) => b.sales - b.returned - (a.sales - a.returned) || a.name.localeCompare(b.name));
}

/** A month's expenses by category, largest first */
export function expensesByCategory(month: string, entries: ProfitEntry[]): { category: string; amount: number }[] {
  const byCategory = new Map<string, { category: string; amount: number }>();
  for (const e of entries) {
    if (e.kind !== 'expense' || !inMonth(e.entry_date, month)) continue;
    const name = e.category?.trim() || 'Other';
    const row = byCategory.get(nameKey(name)) ?? { category: name, amount: 0 };
    row.amount += Number(e.amount);
    byCategory.set(nameKey(name), row);
  }
  return [...byCategory.values()].sort((a, b) => b.amount - a.amount);
}

/** Stock item amounts and the count's total, rounded to paisa */
export function stockTotal(items: { quantity: number; rate: number }[]): number {
  return Math.round(total(items, (i) => i.quantity * i.rate) * 100) / 100;
}

/** The rate the sale form fills in for a customer's product: their own rate, else the last one charged */
export type CustomerRate = { rate: number; unit: string; source: 'own' | 'last'; date: string | null };

export function toCustomerRates(rows: CustomerPriceRow[]): Record<string, CustomerRate> {
  const rates: Record<string, CustomerRate> = {};
  for (const r of rows) {
    if (r.sale_rate !== null) rates[r.key] = { rate: r.sale_rate, unit: r.unit, source: 'own', date: null };
    else if (r.last_rate !== null) rates[r.key] = { rate: r.last_rate, unit: r.last_unit ?? r.unit, source: 'last', date: r.last_date };
  }
  return rates;
}
