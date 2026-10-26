import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/config';
import { toProfile } from '@/lib/auth';
import { Profile, UserRole } from '@/lib/types';

// Account management through the Supabase Auth admin API (service role).
// Callers must check that the signed-in user is an admin first.

const DISABLED_FOR = '876000h'; // about 100 years

function adminClient() {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error(
      'Managing users needs SUPABASE_SERVICE_ROLE_KEY in .env.local (Supabase → Project Settings → API keys → service_role). Restart the app after adding it.'
    );
  }
  return admin;
}

function authError(error: { code?: string; message: string }): Error {
  if (error.code === 'email_exists' || /already (been )?registered/i.test(error.message)) {
    return new Error('A user with this email already exists.');
  }
  if (error.code === 'user_not_found') return new Error('User not found.');
  return new Error(error.message);
}

export async function createUser(input: {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
}): Promise<Profile> {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name },
  });
  if (error) throw authError(error);

  // The database trigger has created the profile; set the name and role
  const { data: row, error: profileError } = await admin
    .from('profiles')
    .update({ full_name: input.full_name, role: input.role })
    .eq('id', data.user.id)
    .select()
    .single();
  if (profileError) throw new Error(profileError.message);
  return toProfile(row);
}

export async function updateUser(id: string, input: { full_name: string; role: UserRole }): Promise<Profile> {
  const { data, error } = await adminClient().from('profiles').update(input).eq('id', id).select().maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('User not found.');
  return toProfile(data);
}

export async function setUserPassword(id: string, password: string): Promise<void> {
  const { error } = await adminClient().auth.admin.updateUserById(id, { password });
  if (error) throw authError(error);
}

/**
 * Disabling blocks sign-in (Supabase ban) and hides all data at once (Row Level
 * Security checks the profile's active flag).
 */
export async function setUserActive(id: string, active: boolean): Promise<Profile> {
  const admin = adminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: active ? 'none' : DISABLED_FOR });
  if (error) throw authError(error);

  const { data, error: profileError } = await admin.from('profiles').update({ active }).eq('id', id).select().single();
  if (profileError) throw new Error(profileError.message);
  return toProfile(data);
}

/**
 * Deletes the login, the profile and the user's whole ledger (cascade).
 */
export async function deleteUser(id: string): Promise<void> {
  const { error } = await adminClient().auth.admin.deleteUser(id);
  if (error) throw authError(error);
}

/**
 * Changes the signed-in user's password after checking their current one.
 */
export async function changeOwnPassword(email: string, currentPassword: string, newPassword: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) throw new Error('Passwords are not used in demo mode.');

  // Check the current password on a separate client so the browser session is untouched
  const verifier = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: wrong } = await verifier.auth.signInWithPassword({ email, password: currentPassword });
  if (wrong) throw new Error('Your current password is incorrect.');
  await verifier.auth.signOut({ scope: 'local' });

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    if (error.code === 'same_password') throw new Error('Choose a password different from your current one.');
    throw new Error(error.message);
  }
}
