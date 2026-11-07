'use server';

import { revalidatePath } from 'next/cache';
import { SettlementSchema, firstIssue } from '@/lib/validators';
import { mergeParties, settleParty } from '@/lib/queries';
import { requireUser } from '@/lib/auth';

type Result = { success: true } | { success: false; error: string };

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

/**
 * Records an adjustment that sets the party's purchases off against its sales
 */
export async function settlePartyAction(
  partyId: string,
  input: { amount: string | number; date: string; notes?: string }
): Promise<Result> {
  try {
    await requireUser();
    const parsed = SettlementSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    await settleParty(partyId, parsed.data.amount, parsed.data.date, parsed.data.notes);
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to record the adjustment') };
  }
}

/**
 * Combines a duplicate party into the one being kept, with all its entries
 */
export async function mergePartyAction(keepId: string, mergeId: string): Promise<Result> {
  try {
    await requireUser();
    await mergeParties(keepId, mergeId);
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to merge') };
  }
}
