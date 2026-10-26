'use server';

import { ChangePasswordSchema, firstIssue } from '@/lib/validators';
import { changeOwnPassword } from '@/lib/users';
import { requireUser } from '@/lib/auth';

export type ChangePasswordState = { error?: string; success?: boolean };

export async function changePasswordAction(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  try {
    const auth = await requireUser();
    if (auth.mode !== 'live') return { error: 'Passwords are not used in demo mode.' };

    const parsed = ChangePasswordSchema.safeParse({
      current: formData.get('current') ?? '',
      password: formData.get('password') ?? '',
      confirm: formData.get('confirm') ?? '',
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    await changeOwnPassword(auth.user.email, parsed.data.current, parsed.data.password);
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to change password' };
  }
}
