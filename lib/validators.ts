import { z } from 'zod';
import { isValidDateStr } from './format';

const dateField = z.string().refine(isValidDateStr, 'Please enter a valid date');

const optionalText = z
  .string()
  .trim()
  .nullish()
  .transform((v) => v || null);

export const CustomerSchema = z.object({
  name: z.string().trim().min(2, 'Customer name must be at least 2 characters'),
  phone: optionalText,
  address: optionalText,
});

export const CreditSaleSchema = z.object({
  customer_id: z.string().min(1, 'Please select a customer'),
  sale_date: dateField,
  material: z.string().trim().min(1, 'Material name is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  unit: z.string().trim().min(1).default('bag'),
  rate: z.coerce.number().positive('Rate must be greater than 0'),
  credit_days: z.coerce.number().int('Credit days must be a whole number').min(0, 'Credit days must be 0 or more'),
  notes: optionalText,
});

export const PaymentSchema = z.object({
  customer_id: z.string().min(1, 'Please select a customer'),
  payment_date: dateField,
  amount: z.coerce.number().positive('Payment amount must be greater than 0'),
  method: z.enum(['cash', 'bank', 'cheque']).default('cash'),
  sale_id: optionalText,
  notes: optionalText,
});

/** A customer return or vendor return: the reason is required */
export const ReturnSchema = z.object({
  customer_id: z.string().min(1, 'Please select the party'),
  return_date: dateField,
  amount: z.coerce.number().positive('The return amount must be greater than 0'),
  sale_id: optionalText,
  reason: z.string().trim().min(2, 'Please enter the reason for the return').max(200, 'The reason is too long'),
});

function optionalRate(message: string) {
  return z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z.coerce.number().min(0, message).nullable()
  );
}

export const ContactKindSchema = z.enum(['customer', 'vendor']);

export const PartyRolesSchema = z
  .object({ is_customer: z.boolean(), is_vendor: z.boolean() })
  .refine((r) => r.is_customer || r.is_vendor, 'Choose customer, vendor or both.');

/** A party's opening balance; an amount of 0 means none */
export const OpeningBalanceSchema = z
  .object({
    amount: z.coerce.number().min(0, 'The opening balance cannot be negative'),
    direction: z.enum(['receivable', 'payable']),
    date: dateField,
    due_date: z.preprocess((v) => (v === '' || v === null || v === undefined ? null : v), dateField.nullable()),
  })
  .refine((o) => !o.due_date || o.due_date >= o.date, {
    message: 'The due date cannot be before the opening balance date',
    path: ['due_date'],
  });

export const SettlementSchema = z.object({
  amount: z.coerce.number().positive('The adjustment amount must be greater than 0'),
  date: dateField,
  notes: optionalText,
});

/** A statement period: both dates valid, from on or before to */
export const StatementRangeSchema = z
  .object({ from: dateField, to: dateField })
  .refine((r) => r.from <= r.to, 'The start date must be on or before the end date');

export const MaterialSchema = z.object({
  name: z.string().trim().min(1, 'Material name is required').max(80, 'Material name is too long'),
  unit: z.string().trim().min(1, 'Unit is required').max(20),
  rate: optionalRate('Sale rate cannot be negative'),
  purchase_rate: optionalRate('Purchase rate cannot be negative'),
});

/** An expense, owner investment or owner withdrawal */
export const BusinessEntrySchema = z
  .object({
    kind: z.enum(['expense', 'investment', 'withdrawal']),
    entry_date: dateField,
    amount: z.coerce.number().positive('The amount must be greater than 0'),
    category: z.string().trim().max(60, 'The category is too long').nullish().transform((v) => v || null),
    notes: z.string().trim().max(200, 'The note is too long').nullish().transform((v) => v || null),
  })
  .refine((e) => e.kind !== 'expense' || e.category, { message: 'Please choose or type the expense category', path: ['category'] })
  .transform((e) => (e.kind === 'expense' ? e : { ...e, category: null }));

export const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Please choose a valid month');

/** The stock in hand at the end of a month, line by line */
export const StockCountSchema = z.object({
  items: z
    .array(
      z.object({
        kind: z.enum(['raw', 'finished']),
        name: z.string().trim().min(1, 'Every stock line needs an item name').max(80, 'An item name is too long'),
        quantity: z.coerce.number().min(0, 'Quantity cannot be negative'),
        unit: z.string().trim().max(20).default(''),
        rate: z.coerce.number().min(0, 'Rate cannot be negative'),
      })
    )
    .max(300, 'Too many stock lines'),
  notes: z.string().trim().max(200, 'The note is too long').nullish().transform((v) => v || null),
});

export const CostPriceSchema = optionalRate('The cost price cannot be negative');

/**
 * First validation message, for showing in a form
 */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input';
}

export type CustomerFormData = z.infer<typeof CustomerSchema>;
export type CreditSaleFormData = z.infer<typeof CreditSaleSchema>;
export type PaymentFormData = z.infer<typeof PaymentSchema>;
export type MaterialFormData = z.infer<typeof MaterialSchema>;

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be 72 characters or fewer');

export const NewUserSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Please enter a valid email address')),
  full_name: z.string().trim().max(80, 'Name is too long'),
  password,
  role: z.enum(['admin', 'user']),
});

export const UpdateUserSchema = NewUserSchema.pick({ full_name: true, role: true });

export const PasswordSchema = password;

export const ChangePasswordSchema = z
  .object({
    current: z.string().min(1, 'Please enter your current password'),
    password,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: 'The new passwords do not match', path: ['confirm'] });

/** A customer's own prices: each product with an optional sale rate and cost price */
export const CustomerPricesSchema = z
  .array(
    z.object({
      material: z.string().trim().min(1, 'Every price needs a product').max(80, 'A product name is too long'),
      unit: z.string().trim().min(1).max(20).default('bag'),
      sale_rate: optionalRate('The sale rate cannot be negative'),
      cost_price: optionalRate('The cost price cannot be negative'),
    })
  )
  .max(500, 'Too many prices');
