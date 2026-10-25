/**
 * App-wide configuration read from environment variables.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Business timezone used to decide what "today" is (due dates, overdue days, current month).
 * Must match the timezone used by `app_today()` in the Supabase migration.
 */
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || 'Asia/Karachi';

/**
 * Supabase is used when both URL and anon key are set.
 * Otherwise the app runs in demo mode with in-memory sample data.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
