'use server';

import { revalidatePath } from 'next/cache';
import { CustomerSchema, PartyRolesSchema, firstIssue } from '@/lib/validators';
import { createCustomer, updateCustomer } from '@/lib/queries';
import { requireUser } from '@/lib/auth';

function readCustomerForm(formData: FormData) {
  return CustomerSchema.safeParse({
    name: formData.get('name') ?? '',
    phone: formData.get('phone'),
    address: formData.get('address'),
  });
}

// The form sends is_customer / is_vendor as "true" or "false"
function readRoles(formData: FormData) {
  return PartyRolesSchema.safeParse({
    is_customer: formData.get('is_customer') === 'true',
    is_vendor: formData.get('is_vendor') === 'true',
  });
}

/**
 * Adds a party: a customer, a vendor or both
 */
export async function addCustomerAction(formData: FormData) {
  try {
    await requireUser();
    const roles = readRoles(formData);
    if (!roles.success) return { success: false, error: firstIssue(roles.error) };
    const parsed = readCustomerForm(formData);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const newCustomer = await createCustomer(roles.data, parsed.data);

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
    const roles = readRoles(formData);
    if (!roles.success) return { success: false, error: firstIssue(roles.error) };
    const parsed = readCustomerForm(formData);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const customer = await updateCustomer(id, { ...parsed.data, ...roles.data });

    revalidatePath('/', 'layout');
    return { success: true, customer };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save changes';
    return { success: false, error: message };
  }
}
