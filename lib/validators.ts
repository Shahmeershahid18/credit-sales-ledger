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
  notes: optionalText,
});

/**
 * First validation message, for showing in a form
 */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input';
}

export type CustomerFormData = z.infer<typeof CustomerSchema>;
export type CreditSaleFormData = z.infer<typeof CreditSaleSchema>;
export type PaymentFormData = z.infer<typeof PaymentSchema>;
