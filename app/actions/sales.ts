'use server';

import { revalidatePath } from 'next/cache';
import { CreditSaleSchema, firstIssue } from '@/lib/validators';
import { createCreditSale } from '@/lib/queries';
import { requireUser } from '@/lib/auth';

export async function addSaleAction(formData: FormData) {
  try {
    await requireUser();
    const parsed = CreditSaleSchema.safeParse({
      customer_id: formData.get('customer_id') ?? '',
      sale_date: formData.get('sale_date') ?? '',
      material: formData.get('material') ?? '',
      quantity: formData.get('quantity'),
      unit: formData.get('unit') || 'bag',
      rate: formData.get('rate'),
      credit_days: formData.get('credit_days') ?? 30,
      notes: formData.get('notes'),
    });
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const newSale = await createCreditSale(parsed.data);

    revalidatePath('/');
    revalidatePath('/customers');
    revalidatePath(`/customers/${parsed.data.customer_id}`);
    revalidatePath('/overdue');
    revalidatePath('/reports/monthly');

    return { success: true, sale: newSale };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record credit sale';
    return { success: false, error: message };
  }
}
