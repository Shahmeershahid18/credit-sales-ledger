// Customers and vendors share one ledger engine. For a customer you sell on credit
// and receive payments; for a vendor you buy on credit and make payments. Every
// screen takes its wording and links from here.

export type ContactKind = 'customer' | 'vendor';

export const CONTACT_KINDS: ContactKind[] = ['customer', 'vendor'];

export function isContactKind(value: unknown): value is ContactKind {
  return value === 'customer' || value === 'vendor';
}

export type SideTerms = {
  kind: ContactKind;
  one: string; // customer
  One: string; // Customer
  many: string; // customers
  Many: string; // Customers
  base: string; // /customers
  nameLabel: string;
  namePlaceholder: string;

  entry: string; // sale
  Entry: string; // Sale
  Entries: string; // Sales
  entrySegment: string; // /customers/[id]/<segment>/new
  newEntryTitle: string;
  newEntryHref: string;
  entryDate: string;
  notesPlaceholder: string;
  totalLabel: string; // total of all entries

  paymentTitle: string;
  paymentHref: string;
  paidLabel: string; // all payments
  paidShort: string; // column header
  amountLabel: string; // payment form amount field
  payFull: string;
  advanceLabel: string;

  balanceLabel: string; // what is still unpaid
  overdueTitle: string;
  overdueHref: string;
  topTitle: string;
  agingTitle: string;
};

export const SIDES: Record<ContactKind, SideTerms> = {
  customer: {
    kind: 'customer',
    one: 'customer',
    One: 'Customer',
    many: 'customers',
    Many: 'Customers',
    base: '/customers',
    nameLabel: 'Customer or business name',
    namePlaceholder: 'e.g. Ali Traders',

    entry: 'sale',
    Entry: 'Sale',
    Entries: 'Sales',
    entrySegment: 'sale',
    newEntryTitle: 'New credit sale',
    newEntryHref: '/sales/new',
    entryDate: 'Sale date',
    notesPlaceholder: 'Site, vehicle or bill reference',
    totalLabel: 'Total credit sale',

    paymentTitle: 'Record payment',
    paymentHref: '/payments/new',
    paidLabel: 'Payment received',
    paidShort: 'Received',
    amountLabel: 'Amount received',
    payFull: 'Pay full balance',
    advanceLabel: 'advance received',

    balanceLabel: 'Outstanding',
    overdueTitle: 'Overdue',
    overdueHref: '/overdue',
    topTitle: 'Top outstanding customers',
    agingTitle: 'Receivable by age',
  },
  vendor: {
    kind: 'vendor',
    one: 'vendor',
    One: 'Vendor',
    many: 'vendors',
    Many: 'Vendors',
    base: '/vendors',
    nameLabel: 'Vendor or supplier name',
    namePlaceholder: 'e.g. Lucky Cement Depot',

    entry: 'purchase',
    Entry: 'Purchase',
    Entries: 'Purchases',
    entrySegment: 'purchase',
    newEntryTitle: 'New credit purchase',
    newEntryHref: '/purchases/new',
    entryDate: 'Purchase date',
    notesPlaceholder: 'Bill or invoice number',
    totalLabel: 'Total purchases',

    paymentTitle: 'Pay vendor',
    paymentHref: '/vendor-payments/new',
    paidLabel: 'Payment made',
    paidShort: 'Paid',
    amountLabel: 'Amount paid',
    payFull: 'Pay full balance',
    advanceLabel: 'advance paid',

    balanceLabel: 'Payable',
    overdueTitle: 'Bills to pay',
    overdueHref: '/bills',
    topTitle: 'Largest amounts to pay',
    agingTitle: 'Payable by age',
  },
};
