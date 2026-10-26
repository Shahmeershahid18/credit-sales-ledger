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

export const MaterialSchema = z.object({
  name: z.string().trim().min(1, 'Material name is required').max(80, 'Material name is too long'),
  unit: z.string().trim().min(1, 'Unit is required').max(20),
  rate: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z.coerce.number().min(0, 'Rate cannot be negative').nullable()
  ),
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
