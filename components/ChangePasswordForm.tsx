'use client';

import React, { useActionState, useEffect, useRef } from 'react';
import { CircleCheck, Loader2 } from 'lucide-react';
import { changePasswordAction, type ChangePasswordState } from '@/app/actions/account';
import { Field, FormError, buttonClass, inputClass } from './ui';

const initialState: ChangePasswordState = {};

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <FormError message={state.error ?? null} />
      {state.success && (
        <p role="status" className="px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CircleCheck className="w-4 h-4 shrink-0" />
          Password changed. Use the new password next time you sign in.
        </p>
      )}

      <Field label="Current password" htmlFor="current">
        <input id="current" name="current" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="New password" htmlFor="password" hint="At least 8 characters">
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className={inputClass} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm">
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required className={inputClass} />
        </Field>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className={buttonClass('primary')}>
          {pending && <Loader2 className="w-4 h-4 animate-spin" />}
          {pending ? 'Saving…' : 'Change password'}
        </button>
      </div>
    </form>
  );
}
