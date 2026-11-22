'use server';

import { revalidatePath } from 'next/cache';
import { BusinessEntrySchema, CostPriceSchema, MonthSchema, StockCountSchema, firstIssue } from '@/lib/validators';
import {
  createBusinessEntry,
  deleteBusinessEntry,
  deleteStockCount,
  saveStockCount,
  setCostPrice,
  updateBusinessEntry,
} from '@/lib/queries';
import { requireUser } from '@/lib/auth';
import { Material } from '@/lib/types';

type Result = { success: true } | { success: false; error: string };

const failure = (err: unknown, fallback: string): Result => ({
  success: false,
  error: err instanceof Error ? err.message : fallback,
});

/** Adds an expense, owner investment or withdrawal, or corrects one (with `id`) */
export async function saveBusinessEntryAction(
  id: string | null,
  input: { kind: string; entry_date: string; amount: string | number; category?: string | null; notes?: string | null }
): Promise<Result> {
  try {
    await requireUser();
    const parsed = BusinessEntrySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };
    if (id) await updateBusinessEntry(id, parsed.data);
    else await createBusinessEntry(parsed.data);
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err) {
    return failure(err, 'Failed to save the entry');
  }
}

export async function deleteBusinessEntryAction(id: string): Promise<Result> {
  try {
    await requireUser();
    await deleteBusinessEntry(id);
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err) {
    return failure(err, 'Failed to delete the entry');
  }
}

/** Saves the stock in hand at the end of `month` (YYYY-MM), replacing an earlier count */
export async function saveStockCountAction(month: string, input: { items: unknown; notes?: string | null }): Promise<Result> {
  try {
    await requireUser();
    const m = MonthSchema.safeParse(month);
    if (!m.success) return { success: false, error: firstIssue(m.error) };
    const parsed = StockCountSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };
    await saveStockCount(m.data, parsed.data);
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err) {
    return failure(err, 'Failed to save the stock count');
  }
}

export async function deleteStockCountAction(month: string): Promise<Result> {
  try {
    await requireUser();
    const m = MonthSchema.safeParse(month);
    if (!m.success) return { success: false, error: firstIssue(m.error) };
    await deleteStockCount(m.data);
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err) {
    return failure(err, 'Failed to delete the stock count');
  }
}

/** Sets a product's cost price; an empty value clears it */
export async function saveCostPriceAction(
  materialId: string,
  value: string | number | null
): Promise<{ success: true; material: Material } | { success: false; error: string }> {
  try {
    await requireUser();
    const parsed = CostPriceSchema.safeParse(value);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };
    const material = await setCostPrice(materialId, parsed.data);
    revalidatePath('/', 'layout');
    return { success: true, material };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save the cost price' };
  }
}
