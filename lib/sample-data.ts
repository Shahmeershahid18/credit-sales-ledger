import { BusinessEntry, Customer, CreditSale, CustomerPrice, Material, Payment, StockCount, StockItem } from './types';
import { addDays, calculateDueDate, getTodayDateStr, shiftMonth } from './format';
import { stockTotal } from './profit';

/**
 * Demo records with dates relative to today so overdue calculations always look realistic.
 * Mirrors supabase/seed.sql. Purchases are bills with kind 'vendor'; Ittefaq Steel is
 * both a vendor and a customer, to show the combined ledger.
 */
export function createSampleData(): {
  customers: Customer[];
  sales: CreditSale[];
  payments: Payment[];
  materials: Material[];
  businessEntries: BusinessEntry[];
  stockCounts: StockCount[];
  customerPrices: CustomerPrice[];
} {
  const today = getTodayDateStr();
  const daysAgo = (days: number) => addDays(today, -days);
  const createdAt = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

  const customers: Customer[] = [
    { id: 'cust-1', is_customer: true, is_vendor: false, name: 'Ali Traders', phone: '+92 300 1234567', address: 'Shop #14, Main Market, Lahore', created_at: createdAt(60) },
    { id: 'cust-2', is_customer: true, is_vendor: false, name: 'Khan Construction', phone: '+92 321 9876543', address: 'Plot 45, Sector G-11, Islamabad', created_at: createdAt(50) },
    { id: 'cust-3', is_customer: true, is_vendor: false, name: 'Metro Builders & Co.', phone: '+92 333 4567890', address: 'Industrial Area, Karachi', created_at: createdAt(40) },
    { id: 'cust-4', is_customer: true, is_vendor: false, name: 'Bilal Hardware Store', phone: '+92 345 1122334', address: 'Circular Road, Faisalabad', created_at: createdAt(30) },
    { id: 'cust-5', is_customer: true, is_vendor: false, name: 'Hamza & Sons Ltd.', phone: '+92 312 8877665', address: 'GT Road, Gujranwala', created_at: createdAt(20) },
    { id: 'vend-1', is_customer: false, is_vendor: true, name: 'Lucky Cement Depot', phone: '+92 301 5551234', address: 'Ravi Road, Lahore', created_at: createdAt(70) },
    { id: 'vend-2', is_customer: true, is_vendor: true, name: 'Ittefaq Steel Mills', phone: '+92 322 4448899', address: 'Kot Lakhpat, Lahore', created_at: createdAt(65) },
    { id: 'vend-3', is_customer: false, is_vendor: true, name: 'Indus Sand & Crush', phone: '+92 334 7776655', address: 'Kala Shah Kaku', created_at: createdAt(45) },
  ];

  const sale = (
    id: string,
    customer_id: string,
    ago: number,
    material: string,
    quantity: number,
    unit: string,
    rate: number,
    credit_days: number,
    notes: string
  ): CreditSale => ({
    id,
    customer_id,
    kind: id.startsWith('pur') ? 'vendor' : 'customer',
    sale_date: daysAgo(ago),
    material,
    quantity,
    unit,
    rate,
    amount: quantity * rate,
    credit_days,
    due_date: calculateDueDate(daysAgo(ago), credit_days),
    notes,
    created_at: createdAt(ago),
  });

  const sales: CreditSale[] = [
    // Ali Traders: 150k overdue by 10 days + 150k due in 10 days
    sale('sale-1', 'cust-1', 40, 'DG Cement Bags', 100, 'bag', 1500, 30, 'Delivery to Site A - Batch 1'),
    sale('sale-2', 'cust-1', 20, 'Steel Rebars (Grade 60)', 1, 'ton', 150000, 30, 'Site B reinforcement'),
    // Khan Construction: first sale settled, second not yet due
    sale('sale-3', 'cust-2', 75, 'Crush / Aggregate', 4, 'truck', 65000, 60, 'Foundation phase 1'),
    sale('sale-4', 'cust-2', 15, 'Bestway Cement Bags', 200, 'bag', 1300, 30, 'Slab pouring'),
    // Metro Builders: 220k overdue 35 days (31–60 bucket) + 130k not yet due
    sale('sale-5', 'cust-3', 95, 'Heavy Steel Beams', 2, 'ton', 160000, 60, 'Warehouse frame'),
    sale('sale-6', 'cust-3', 10, 'Fine River Sand', 5, 'truck', 26000, 30, 'Plaster work'),
    // Bilal Hardware: fully paid
    sale('sale-7', 'cust-4', 45, 'Paints & Primers', 30, 'can', 6000, 30, 'Order #883'),
    // Hamza & Sons: fresh, not yet due
    sale('sale-8', 'cust-5', 5, 'PVC Pipes & Fittings', 50, 'pcs', 1800, 30, 'Plumbing supply'),
    // Purchases from vendors
    // Lucky Cement: 280,200 bought, 120k paid; 15k overdue 20 days, 145,200 due within a week
    sale('pur-1', 'vend-1', 50, 'DG Cement Bags', 100, 'bag', 1350, 30, 'Bill #LC-2207'),
    sale('pur-2', 'vend-1', 25, 'Bestway Cement Bags', 120, 'bag', 1210, 30, 'Bill #LC-2291'),
    // Ittefaq Steel: one purchase, not yet due
    sale('pur-3', 'vend-2', 20, 'Steel Rebars (Grade 60)', 2, 'ton', 138000, 60, 'Invoice 5531'),
    // Ittefaq Steel also buys cement from you: its ledger nets this against the steel
    sale('sale-9', 'vend-2', 12, 'DG Cement Bags', 150, 'bag', 1500, 30, 'Mill boundary wall'),
    // Indus Sand & Crush: fully paid
    sale('pur-4', 'vend-3', 40, 'Fine River Sand', 6, 'truck', 22000, 15, 'Gate pass 118'),
  ];

  const payment = (
    id: string,
    customer_id: string,
    ago: number,
    amount: number,
    method: Payment['method'],
    notes: string
  ): Payment => ({
    id,
    customer_id,
    kind: id.startsWith('vpm') ? 'vendor' : 'customer',
    payment_date: daysAgo(ago),
    amount,
    method,
    notes,
    created_at: createdAt(ago),
  });

  const payments: Payment[] = [
    payment('pmt-1', 'cust-1', 12, 100000, 'bank', 'Bank Transfer (Meezan Bank Tx #7891)'),
    payment('pmt-2', 'cust-2', 30, 260000, 'cheque', 'Cheque #44901 Habib Bank'),
    payment('pmt-3', 'cust-3', 25, 100000, 'cash', 'Cash collection on site'),
    payment('pmt-4', 'cust-4', 15, 180000, 'bank', 'Online transfer'),
    payment('vpm-1', 'vend-1', 18, 120000, 'bank', 'IBFT to Lucky Cement'),
    payment('vpm-2', 'vend-3', 20, 132000, 'cash', 'Paid at yard'),
  ];

  // One pill per material, with the sale rate and the purchase rate where known
  const materials: Material[] = [];
  for (const s of sales) {
    const isSale = s.kind === 'customer';
    let m = materials.find((x) => x.name === s.material);
    if (!m) {
      m = { id: `mat-${materials.length + 1}`, name: s.material, unit: s.unit, rate: null, purchase_rate: null, cost_price: null, created_at: s.created_at };
      materials.push(m);
    }
    if (isSale) m.rate = s.rate;
    else m.purchase_rate = s.rate;
  }

  // What each product costs to make or buy, for the profit estimate
  const COST_PRICES: Record<string, number> = {
    'DG Cement Bags': 1350,
    'Bestway Cement Bags': 1210,
    'Steel Rebars (Grade 60)': 138000,
    'Heavy Steel Beams': 142000,
    'Fine River Sand': 22000,
    'Crush / Aggregate': 52000,
    'Paints & Primers': 4700,
  };
  for (const m of materials) m.cost_price = COST_PRICES[m.name] ?? null;

  const thisMonth = today.slice(0, 7);
  const months = [-3, -2, -1, 0].map((d) => shiftMonth(thisMonth, d));
  const dayOf = (month: string, day: number) => `${month}-${String(day).padStart(2, '0')}`;

  // Rent, salaries and bills each month; starting capital and one withdrawal
  const businessEntries: BusinessEntry[] = [];
  const entry = (kind: BusinessEntry['kind'], date: string, amount: number, category: string | null, notes: string | null) => {
    if (date > today) return;
    businessEntries.push({ id: `bus-${businessEntries.length + 1}`, kind, entry_date: date, amount, category, notes, created_at: `${date}T09:00:00.000Z` });
  };
  entry('investment', dayOf(months[0], 1), 1500000, null, 'Starting capital');
  for (const m of months.slice(1)) {
    entry('expense', dayOf(m, 1), 25000, 'Rent', 'Shop and yard');
    entry('expense', dayOf(m, 2), 60000, 'Salaries', '3 staff');
    entry('expense', dayOf(m, 10), 9500, 'Electricity', null);
    entry('expense', dayOf(m, 15), 12000, 'Transport', 'Loader and fuel');
  }
  entry('withdrawal', dayOf(months[2], 28), 40000, null, 'Household');

  // Month-end stock counts for the three months before this one; this month is not counted yet
  const ITEMS: Omit<StockItem, 'quantity' | 'amount'>[] = [
    { kind: 'raw', name: 'Steel billets', unit: 'ton', rate: 135000 },
    { kind: 'raw', name: 'Cement (loose)', unit: 'bag', rate: 1250 },
    { kind: 'finished', name: 'Steel Rebars (Grade 60)', unit: 'ton', rate: 138000 },
    { kind: 'finished', name: 'DG Cement Bags', unit: 'bag', rate: 1350 },
  ];
  const countOf = (month: string, value: number): StockCount => {
    const items = ITEMS.map((i) => {
      const quantity = i.unit === 'ton' ? Math.round((value / 4 / i.rate) * 10) / 10 : Math.round(value / 4 / i.rate);
      return { ...i, quantity, amount: quantity * i.rate };
    });
    return { id: `stk-${month}`, month, items, total: stockTotal(items), notes: null, updated_at: `${dayOf(month, 28)}T18:00:00.000Z` };
  };
  const monthTotal = (month: string, kind: CreditSale['kind']) =>
    sales.filter((s) => s.kind === kind && s.sale_date.startsWith(month)).reduce((t, s) => t + s.amount, 0);
  const stockCounts: StockCount[] = [countOf(months[0], 900000)];
  for (const m of months.slice(1, 3)) {
    // Closing = opening + purchases − about 78% of sales (the cost of what was sold)
    const closing = stockCounts[stockCounts.length - 1].total + monthTotal(m, 'vendor') - 0.78 * monthTotal(m, 'customer');
    stockCounts.push(countOf(m, Math.max(200000, closing)));
  }

  // Khan Construction gets its own rate and a cheaper mix of Bestway cement; Ittefaq a special DG rate
  const customerPrices: CustomerPrice[] = [
    { id: 'cpr-1', customer_id: 'cust-2', material: 'Bestway Cement Bags', unit: 'bag', sale_rate: 1300, cost_price: 1150, updated_at: createdAt(16) },
    { id: 'cpr-2', customer_id: 'vend-2', material: 'DG Cement Bags', unit: 'bag', sale_rate: 1500, cost_price: null, updated_at: createdAt(13) },
  ];

  return { customers, sales, payments, materials, businessEntries, stockCounts, customerPrices };
}
