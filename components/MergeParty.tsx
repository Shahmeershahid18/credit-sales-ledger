'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Combine, Loader2 } from 'lucide-react';
import { mergePartyAction } from '@/app/actions/parties';
import { Field, FormError, buttonClass } from './ui';
import { Select } from './Select';

interface MergePartyProps {
  party: { id: string; name: string }; // the one that is kept
  options: { id: string; name: string; roles: string }[];
  redirectTo: string;
}

/**
 * Combines a duplicate (for example the same business entered once as a customer
 * and once as a vendor) into this party, with all of its entries
 */
export function MergeParty({ party, options, redirectTo }: MergePartyProps) {
  const router = useRouter();
  const [mergeId, setMergeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const other = options.find((o) => o.id === mergeId);

  const merge = async () => {
    if (!other) return;
    const ok = window.confirm(
      `Merge "${other.name}" into "${party.name}"?\n\nAll of its sales, purchases and payments move to "${party.name}", and "${other.name}" is removed. This cannot be undone.`
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    const result = await mergePartyAction(party.id, other.id);
    if (!result.success) {
      setBusy(false);
      return setError(result.error);
    }
    router.push(redirectTo);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Merge a duplicate</h2>
        <p className="text-sm text-zinc-500 mt-0.5">
          Entered the same business twice, for example once as a customer and once as a vendor? Merge it into{' '}
          <span className="font-medium text-zinc-700">{party.name}</span> to keep one combined ledger.
        </p>
      </div>
      <FormError message={error} />
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <Field label="Party to merge in" htmlFor="merge" className="flex-1">
          <Select
            id="merge"
            value={mergeId}
            onChange={setMergeId}
            placeholder="Select a party…"
            searchPlaceholder="Search parties…"
            options={options.map((o) => ({ value: o.id, label: o.name, meta: o.roles }))}
          />
        </Field>
        <button type="button" onClick={merge} disabled={!other || busy} className={buttonClass('secondary', 'h-10')}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Combine className="w-4 h-4" />}
          Merge
        </button>
      </div>
    </div>
  );
}
