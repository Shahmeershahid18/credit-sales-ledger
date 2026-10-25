import 'server-only';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type AuthState =
  | { mode: 'demo' }
  | { mode: 'live'; email: string | null }
  | { mode: 'signed-out' };

/**
 * Verified auth state for the current request.
 */
export async function getAuthState(): Promise<AuthState> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { mode: 'demo' };

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { mode: 'signed-out' };

  const email = typeof data.claims.email === 'string' ? data.claims.email : null;
  return { mode: 'live', email };
}

/**
 * Throws when Supabase is configured and nobody is signed in. Use in Server Actions.
 */
export async function requireUser(): Promise<void> {
  const state = await getAuthState();
  if (state.mode === 'signed-out') {
    throw new Error('Your session has expired. Please sign in again.');
  }
}
