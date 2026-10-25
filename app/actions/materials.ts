'use server';

import { revalidatePath } from 'next/cache';
import { MaterialSchema, firstIssue } from '@/lib/validators';
import { createMaterial, deleteMaterial, updateMaterial } from '@/lib/queries';
import { requireUser } from '@/lib/auth';
import { Material } from '@/lib/types';

type MaterialResult = { success: true; material: Material } | { success: false; error: string };

function revalidateSaleForms() {
  revalidatePath('/sales/new');
  revalidatePath('/customers/[id]/sale/new', 'page');
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export async function saveMaterialAction(
  id: string | null,
  input: { name: string; unit: string; rate: string | number | null }
): Promise<MaterialResult> {
  try {
    await requireUser();
    const parsed = MaterialSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const material = id ? await updateMaterial(id, parsed.data) : await createMaterial(parsed.data);
    revalidateSaleForms();
    return { success: true, material };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to save material') };
  }
}

export async function deleteMaterialAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requireUser();
    await deleteMaterial(id);
    revalidateSaleForms();
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to delete material') };
  }
}
