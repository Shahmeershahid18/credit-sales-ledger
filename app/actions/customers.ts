'use server';

import { revalidatePath } from 'next/cache';
import { CustomerSchema, OpeningBalanceSchema, PartyRolesSchema, firstIssue } from '@/lib/validators';
import { createCustomer, setOpeningBalance, updateCustomer } from '@/lib/queries';
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

// The opening balance fields are only sent when the form shows them
function readOpening(formData: FormData) {
  if (!formData.has('opening_amount')) return { success: true as const, data: null };
  return OpeningBalanceSchema.safeParse({
    amount: formData.get('opening_amount') || 0,
    direction: formData.get('opening_direction'),
    date: formData.get('opening_date') ?? '',
    due_date: formData.get('opening_due_date'),
  });
}

/**
 * Adds a party: a customer, a vendor or both, with an optional opening balance
 */
export async function addCustomerAction(formData: FormData) {
  try {
    await requireUser();
    const roles = readRoles(formData);
    if (!roles.success) return { success: false, error: firstIssue(roles.error) };
    const parsed = readCustomerForm(formData);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };
    const opening = readOpening(formData);
    if (!opening.success) return { success: false, error: firstIssue(opening.error) };

    const newCustomer = await createCustomer(roles.data, parsed.data);

    let warning: string | undefined;
    if (opening.data && opening.data.amount > 0) {
      try {
        await setOpeningBalance(newCustomer.id, roles.data, opening.data);
      } catch (err: unknown) {
        // The party is saved; say so instead of failing, so it is not added twice
        warning = `${newCustomer.name} was added, but the opening balance was not saved: ${
          err instanceof Error ? err.message : 'unknown error'
        } Add it later with Edit.`;
      }
    }

    revalidatePath('/', 'layout');
    return { success: true, customer: newCustomer, warning };
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
    const opening = readOpening(formData);
    if (!opening.success) return { success: false, error: firstIssue(opening.error) };

    // The opening balance first: it is placed by the new roles, so a role being removed
    // no longer holds the opening entry when the roles are saved
    if (opening.data) await setOpeningBalance(id, roles.data, opening.data);
    const customer = await updateCustomer(id, { ...parsed.data, ...roles.data });

    revalidatePath('/', 'layout');
    return { success: true, customer };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save changes';
    return { success: false, error: message };
  }
}
