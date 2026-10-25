'use server';

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type SignInState = { error?: string; email?: string };

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect('/'); // demo mode has no login

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Please enter your email and password.', email };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.message, email };
  }

  redirect('/');
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect('/login');
}
