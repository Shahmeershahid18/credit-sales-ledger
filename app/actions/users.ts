'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NewUserSchema, PasswordSchema, UpdateUserSchema, firstIssue } from '@/lib/validators';
import { createUser, deleteUser, setUserActive, setUserPassword, updateUser } from '@/lib/users';
import { VIEW_AS_COOKIE, requireAdmin } from '@/lib/auth';
import { Profile } from '@/lib/types';

type Result = { success: true } | { success: false; error: string };
type UserResult = { success: true; user: Profile } | { success: false; error: string };

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

// Admins can't lock themselves out: no changing their own role, status or account here
function notSelf(admin: Profile, id: string, what: string) {
  if (admin.id === id) throw new Error(`You can't ${what} your own account.`);
}

export async function createUserAction(input: {
  email: string;
  full_name: string;
  password: string;
  role: string;
}): Promise<UserResult> {
  try {
    await requireAdmin();
    const parsed = NewUserSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const user = await createUser(parsed.data);
    revalidatePath('/users');
    return { success: true, user };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to add user') };
  }
}

export async function updateUserAction(id: string, input: { full_name: string; role: string }): Promise<UserResult> {
  try {
    const admin = await requireAdmin();
    const parsed = UpdateUserSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };
    if (admin.id === id && parsed.data.role !== admin.role) notSelf(admin, id, 'change the role of');

    const user = await updateUser(id, parsed.data);
    revalidatePath('/', 'layout');
    return { success: true, user };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to update user') };
  }
}

export async function setUserPasswordAction(id: string, password: string): Promise<Result> {
  try {
    const admin = await requireAdmin();
    if (admin.id === id) throw new Error('Change your own password on the Account page.');
    const parsed = PasswordSchema.safeParse(password);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    await setUserPassword(id, parsed.data);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to set password') };
  }
}

export async function setUserActiveAction(id: string, active: boolean): Promise<UserResult> {
  try {
    const admin = await requireAdmin();
    notSelf(admin, id, 'disable');

    const user = await setUserActive(id, active);
    revalidatePath('/users');
    return { success: true, user };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to update user') };
  }
}

export async function deleteUserAction(id: string): Promise<Result> {
  try {
    const admin = await requireAdmin();
    notSelf(admin, id, 'delete');

    await deleteUser(id);
    const cookieStore = await cookies();
    if (cookieStore.get(VIEW_AS_COOKIE)?.value === id) cookieStore.delete(VIEW_AS_COOKIE);
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to delete user') };
  }
}

/**
 * Opens another user's ledger for the signed-in admin, or returns to their own (null).
 */
export async function openLedgerAction(userId: string | null) {
  const admin = await requireAdmin();
  const cookieStore = await cookies();

  if (userId && userId !== admin.id) {
    cookieStore.set(VIEW_AS_COOKIE, userId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  } else {
    cookieStore.delete(VIEW_AS_COOKIE);
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
