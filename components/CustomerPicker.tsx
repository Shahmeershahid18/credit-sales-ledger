'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Select } from './Select';

/** Opens a customer's price list */
export function CustomerPicker({ customers }: { customers: { id: string; name: string }[] }) {
  const router = useRouter();
  return (
    <Select
      ariaLabel="Open a customer's prices"
      value=""
      onChange={(id) => id && router.push(`/customers/${id}/prices`)}
      disabled={customers.length === 0}
      placeholder="Open a customer's prices…"
      searchPlaceholder="Search customers…"
      options={customers.map((c) => ({ value: c.id, label: c.name }))}
    />
  );
}
