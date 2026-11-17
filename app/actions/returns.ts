'use server';

import { revalidatePath } from 'next/cache';
import { ContactKindSchema, ReturnSchema, firstIssue } from '@/lib/validators';
import { createReturn, updateReturn } from '@/lib/queries';
import { requireUser } from '@/lib/auth';

function parseReturn(formData: FormData) {
  const kind = ContactKindSchema.safeParse(formData.get('kind') ?? 'customer');
  if (!kind.success) return { error: 'Invalid contact type' } as const;
  const parsed = ReturnSchema.safeParse({
    customer_id: formData.get('customer_id') ?? '',
    return_date: formData.get('return_date') ?? '',
    amount: formData.get('amount'),
    sale_id: formData.get('sale_id'),
    reason: formData.get('reason') ?? '',
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) } as const;
  return { kind: kind.data, data: parsed.data } as const;
}

/**
 * Records a customer return (kind "customer") or a vendor return (kind "vendor")
 */
export async function addReturnAction(formData: FormData) {
  try {
    await requireUser();
    const input = parseReturn(formData);
    if ('error' in input) return { success: false, error: input.error };

    const entry = await createReturn(input.kind, input.data);

    revalidatePath('/', 'layout');
    return { success: true, entry };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save the return' };
  }
}

/**
 * Corrects a return
 */
export async function updateReturnAction(id: string, formData: FormData) {
  try {
    await requireUser();
    const input = parseReturn(formData);
    if ('error' in input) return { success: false, error: input.error };

    const entry = await updateReturn(input.kind, id, input.data);

    revalidatePath('/', 'layout');
    return { success: true, entry };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save the return' };
  }
}
