'use server';

import { revalidatePath } from 'next/cache';
import { ContactKindSchema, CreditSaleSchema, firstIssue } from '@/lib/validators';
import { createCreditSale, updateCreditSale } from '@/lib/queries';
import { requireUser } from '@/lib/auth';

function parseSale(formData: FormData) {
  const kind = ContactKindSchema.safeParse(formData.get('kind') ?? 'customer');
  if (!kind.success) return { error: 'Invalid contact type' } as const;
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
  if (!parsed.success) return { error: firstIssue(parsed.error) } as const;
  return { kind: kind.data, data: parsed.data } as const;
}

/**
 * Records a credit sale, or a credit purchase when the form's `kind` is "vendor"
 */
export async function addSaleAction(formData: FormData) {
  try {
    await requireUser();
    const input = parseSale(formData);
    if ('error' in input) return { success: false, error: input.error };

    const newSale = await createCreditSale(input.kind, input.data);

    revalidatePath('/', 'layout');
    return { success: true, sale: newSale };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save';
    return { success: false, error: message };
  }
}

/**
 * Corrects a credit sale or purchase
 */
export async function updateSaleAction(id: string, formData: FormData) {
  try {
    await requireUser();
    const input = parseSale(formData);
    if ('error' in input) return { success: false, error: input.error };

    const sale = await updateCreditSale(input.kind, id, input.data);

    revalidatePath('/', 'layout');
    return { success: true, sale };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save';
    return { success: false, error: message };
  }
}
