'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { VIEW_AS_COOKIE } from '@/lib/auth';

export type SignInState = { error?: string; email?: string };

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect('/dashboard'); // demo mode has no login

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Please enter your email and password.', email };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === 'user_banned') {
      return { error: 'This account has been disabled. Contact your administrator.', email };
    }
    if (error.code === 'invalid_credentials') {
      return { error: 'Incorrect email or password.', email };
    }
    return { error: error.message, email };
  }

  // Start in your own ledger, not one an admin had open on this browser before
  (await cookies()).delete(VIEW_AS_COOKIE);
  redirect('/dashboard');
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  (await cookies()).delete(VIEW_AS_COOKIE);
  redirect('/login');
}
