import { Customer, CreditSale, Material, Payment } from './types';
import { addDays, calculateDueDate, getTodayDateStr } from './format';

/**
 * Demo records with dates relative to today so overdue calculations always look realistic.
 * Mirrors supabase/seed.sql. Vendors use the same records: their "sales" are purchases.
 */
export function createSampleData(): {
  customers: Customer[];
  sales: CreditSale[];
  payments: Payment[];
  materials: Material[];
} {
  const today = getTodayDateStr();
  const daysAgo = (days: number) => addDays(today, -days);
  const createdAt = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

  const customers: Customer[] = [
    { id: 'cust-1', kind: 'customer', name: 'Ali Traders', phone: '+92 300 1234567', address: 'Shop #14, Main Market, Lahore', created_at: createdAt(60) },
    { id: 'cust-2', kind: 'customer', name: 'Khan Construction', phone: '+92 321 9876543', address: 'Plot 45, Sector G-11, Islamabad', created_at: createdAt(50) },
    { id: 'cust-3', kind: 'customer', name: 'Metro Builders & Co.', phone: '+92 333 4567890', address: 'Industrial Area, Karachi', created_at: createdAt(40) },
    { id: 'cust-4', kind: 'customer', name: 'Bilal Hardware Store', phone: '+92 345 1122334', address: 'Circular Road, Faisalabad', created_at: createdAt(30) },
    { id: 'cust-5', kind: 'customer', name: 'Hamza & Sons Ltd.', phone: '+92 312 8877665', address: 'GT Road, Gujranwala', created_at: createdAt(20) },
    { id: 'vend-1', kind: 'vendor', name: 'Lucky Cement Depot', phone: '+92 301 5551234', address: 'Ravi Road, Lahore', created_at: createdAt(70) },
    { id: 'vend-2', kind: 'vendor', name: 'Ittefaq Steel Mills', phone: '+92 322 4448899', address: 'Kot Lakhpat, Lahore', created_at: createdAt(65) },
    { id: 'vend-3', kind: 'vendor', name: 'Indus Sand & Crush', phone: '+92 334 7776655', address: 'Kala Shah Kaku', created_at: createdAt(45) },
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
  ): Payment => ({ id, customer_id, payment_date: daysAgo(ago), amount, method, notes, created_at: createdAt(ago) });

  const payments: Payment[] = [
    payment('pmt-1', 'cust-1', 12, 100000, 'bank', 'Bank Transfer (Meezan Bank Tx #7891)'),
    payment('pmt-2', 'cust-2', 30, 260000, 'cheque', 'Cheque #44901 Habib Bank'),
    payment('pmt-3', 'cust-3', 25, 100000, 'cash', 'Cash collection on site'),
    payment('pmt-4', 'cust-4', 15, 180000, 'bank', 'Online transfer'),
    payment('vpm-1', 'vend-1', 18, 120000, 'bank', 'IBFT to Lucky Cement'),
    payment('vpm-2', 'vend-3', 20, 132000, 'cash', 'Paid at yard'),
  ];

  // One pill per material, with the sale rate and the purchase rate where known
  const customerIds = new Set(customers.filter((c) => c.kind === 'customer').map((c) => c.id));
  const materials: Material[] = [];
  for (const s of sales) {
    const isSale = customerIds.has(s.customer_id);
    let m = materials.find((x) => x.name === s.material);
    if (!m) {
      m = { id: `mat-${materials.length + 1}`, name: s.material, unit: s.unit, rate: null, purchase_rate: null, created_at: s.created_at };
      materials.push(m);
    }
    if (isSale) m.rate = s.rate;
    else m.purchase_rate = s.rate;
  }

  return { customers, sales, payments, materials };
}
