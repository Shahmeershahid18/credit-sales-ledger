'use server';

import { revalidatePath } from 'next/cache';
import { ContactKindSchema, CustomerSchema, firstIssue } from '@/lib/validators';
import { createCustomer, updateCustomer } from '@/lib/queries';
import { requireUser } from '@/lib/auth';

function readCustomerForm(formData: FormData) {
  return CustomerSchema.safeParse({
    name: formData.get('name') ?? '',
    phone: formData.get('phone'),
    address: formData.get('address'),
  });
}

/**
 * Adds a customer, or a vendor when the form's `kind` is "vendor"
 */
export async function addCustomerAction(formData: FormData) {
  try {
    await requireUser();
    const kind = ContactKindSchema.safeParse(formData.get('kind') ?? 'customer');
    if (!kind.success) return { success: false, error: 'Invalid contact type' };
    const parsed = readCustomerForm(formData);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const newCustomer = await createCustomer(kind.data, parsed.data);

    revalidatePath('/', 'layout');
    return { success: true, customer: newCustomer };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save';
    return { success: false, error: message };
  }
}

export async function updateCustomerAction(id: string, formData: FormData) {
  try {
    await requireUser();
    const parsed = readCustomerForm(formData);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const customer = await updateCustomer(id, parsed.data);

    revalidatePath('/', 'layout');
    return { success: true, customer };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save changes';
    return { success: false, error: message };
  }
}
