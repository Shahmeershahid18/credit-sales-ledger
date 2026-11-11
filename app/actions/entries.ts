'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { deleteLedgerEntry } from '@/lib/queries';
import { requireUser } from '@/lib/auth';

const EntryTypeSchema = z.enum(['sale', 'purchase', 'received', 'paid', 'adjustment']);

/**
 * Deletes a sale, purchase, payment or adjustment from a party's ledger
 */
export async function deleteEntryAction(
  partyId: string,
  type: string,
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireUser();
    const entryType = EntryTypeSchema.safeParse(type);
    if (!entryType.success) return { success: false, error: 'Unknown entry type' };

    await deleteLedgerEntry(partyId, entryType.data, id);

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete' };
  }
}
