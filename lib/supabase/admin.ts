import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { SUPABASE_URL } from '@/lib/config';

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * True when SUPABASE_SERVICE_ROLE_KEY is set, which adding users and resetting passwords need.
 */
export function isUserAdminConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);
}

/**
 * Service-role client for managing users. It bypasses Row Level Security, so call it
 * only from the server after checking that the signed-in user is an admin.
 */
export function createAdminClient() {
  if (!isUserAdminConfigured()) return null;

  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
