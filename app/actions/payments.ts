'use server';

import { revalidatePath } from 'next/cache';
import { PaymentSchema, firstIssue } from '@/lib/validators';
import { createPayment, getCustomerSaleOptions } from '@/lib/queries';
import { requireUser } from '@/lib/auth';
import { SaleOption } from '@/lib/types';

export async function addPaymentAction(formData: FormData) {
  try {
    await requireUser();
    const parsed = PaymentSchema.safeParse({
      customer_id: formData.get('customer_id') ?? '',
      payment_date: formData.get('payment_date') ?? '',
      amount: formData.get('amount'),
      method: formData.get('method') || 'cash',
      sale_id: formData.get('sale_id'),
      notes: formData.get('notes'),
    });
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const newPayment = await createPayment(parsed.data);

    revalidatePath('/');
    revalidatePath('/customers');
    revalidatePath(`/customers/${parsed.data.customer_id}`);
    revalidatePath('/overdue');
    revalidatePath('/reports/monthly');

    return { success: true, payment: newPayment };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record payment';
    return { success: false, error: message };
  }
}

/**
 * Sales of one customer with their unpaid amount, for the "For sale" picker
 */
export async function getCustomerSalesAction(
  customerId: string
): Promise<{ success: true; sales: SaleOption[] } | { success: false; error: string }> {
  try {
    await requireUser();
    return { success: true, sales: await getCustomerSaleOptions(customerId) };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to load sales' };
  }
}
