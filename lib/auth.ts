import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Profile, UserRole } from '@/lib/types';

/** Cookie holding the user whose ledger an admin is viewing */
export const VIEW_AS_COOKIE = 'ledger_view_as';

const USERS_MIGRATION = 'supabase/migrations/20261026030000_users_and_separate_ledgers.sql';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AuthState =
  | { mode: 'demo' }
  | { mode: 'signed-out' }
  | { mode: 'blocked'; email: string | null; reason: 'disabled' | 'no-profile' }
  // owner: the ledger being viewed (the user's own, or the one an admin opened)
  | { mode: 'live'; user: Profile; owner: Profile };

type ProfileRow = { id: string; email: string; full_name: string; role: string; active: boolean; created_at: string };

export function toProfile(r: ProfileRow): Profile {
  const role: UserRole = r.role === 'admin' ? 'admin' : 'user';
  return { id: r.id, email: r.email, full_name: r.full_name, role, active: r.active, created_at: r.created_at };
}

/**
 * Verified auth state for the current request, with the user's profile and the
 * ledger they are working in. Cached per request.
 */
export const getAuthState = cache(async (): Promise<AuthState> => {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { mode: 'demo' };

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { mode: 'signed-out' };

  const email = typeof claims.email === 'string' ? claims.email : null;
  const { data: row, error } = await supabase.from('profiles').select('*').eq('id', claims.sub).maybeSingle();
  if (error) {
    if (['PGRST205', '42P01'].includes(error.code ?? '') || /schema cache|does not exist/i.test(error.message)) {
      throw new Error(`User accounts need a database update. Run ${USERS_MIGRATION} in the Supabase SQL Editor.`);
    }
    throw new Error(error.message);
  }
  if (!row) return { mode: 'blocked', email, reason: 'no-profile' };

  const user = toProfile(row);
  if (!user.active) return { mode: 'blocked', email, reason: 'disabled' };

  let owner = user;
  if (user.role === 'admin') {
    const viewAs = (await cookies()).get(VIEW_AS_COOKIE)?.value;
    if (viewAs && viewAs !== user.id && UUID_RE.test(viewAs)) {
      const { data: other } = await supabase.from('profiles').select('*').eq('id', viewAs).maybeSingle();
      if (other) owner = toProfile(other);
    }
  }

  return { mode: 'live', user, owner };
});

/**
 * Throws unless someone is signed in with an enabled account (demo mode passes).
 * Use in Server Actions.
 */
export async function requireUser(): Promise<Extract<AuthState, { mode: 'demo' | 'live' }>> {
  const state = await getAuthState();
  if (state.mode === 'signed-out') {
    throw new Error('Your session has expired. Please sign in again.');
  }
  if (state.mode === 'blocked') {
    throw new Error('This account has been disabled.');
  }
  return state;
}

/**
 * Throws unless the signed-in user is an admin. Returns their profile.
 */
export async function requireAdmin(): Promise<Profile> {
  const state = await requireUser();
  if (state.mode !== 'live' || state.user.role !== 'admin') {
    throw new Error('You do not have permission to do this.');
  }
  return state.user;
}
