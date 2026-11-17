'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Package } from 'lucide-react';
import { QuantityHistory } from '@/lib/types';
import { ContactKind, SIDES } from '@/lib/contacts';
import { formatMonth, formatMonthShort, formatQuantity } from '@/lib/format';
import { CsvExportButton } from './CsvExportButton';
import { Select } from './Select';
import { EmptyState, cardClass } from './ui';

interface QuantityReportProps {
  kind: ContactKind; // customer: quantity sold; vendor: quantity bought
  history: QuantityHistory;
  description: string; // the months covered, e.g. "Last 12 months"
}

const qtyOrDash = (qty: number) => (qty > 0 ? formatQuantity(qty) : '—');

/**
 * Customer-wise (or vendor-wise) monthly quantity of one material at a time, in that
 * material's own unit, so bags and tons are never added together
 */
export function QuantityReport({ kind, history, description }: QuantityReportProps) {
  const terms = SIDES[kind];
  const { months, materials } = history;
  const [key, setKey] = useState(materials[0]?.key ?? '');
  const material = materials.find((m) => m.key === key) ?? materials[0];
  const verb = kind === 'vendor' ? 'bought' : 'sold';

  const csvHeaders = [terms.One, ...months.map(formatMonth), `Total (${material?.unit ?? ''})`];
  const csvRows = material
    ? [
        ...material.parties.map((p) => [p.name, ...p.byMonth, p.total]),
        ['Total', ...material.byMonth, material.total],
      ]
    : [];

  return (
    <section className={`${cardClass} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-zinc-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Quantity by {terms.one}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {description}: quantity {verb} each month, one material at a time
          </p>
        </div>
        {material && (
          <div className="flex items-center gap-2">
            <div className="w-full sm:w-72">
              <Select
                id="quantity-material"
                ariaLabel="Material"
                size="sm"
                value={material.key}
                onChange={setKey}
                searchPlaceholder="Search materials…"
                options={materials.map((m) => ({
                  value: m.key,
                  label: m.name,
                  description: `in ${m.unit}`,
                  meta: `${formatQuantity(m.total)} ${m.unit}`,
                }))}
              />
            </div>
            <CsvExportButton
              filename={`credit-ledger-quantity-${material.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${months[0]}-to-${months[months.length - 1]}`}
              headers={csvHeaders}
              rows={csvRows}
            />
          </div>
        )}
      </div>

      {!material ? (
        <EmptyState
          icon={<Package className="w-5 h-5" />}
          title={`Nothing ${verb} in these months`}
          description={`Quantities appear here once ${terms.entry}s are recorded.`}
        />
      ) : (
        <>
          {/* Mobile: one entry per party, with its busy months */}
          <ul className="md:hidden divide-y divide-zinc-100">
            {material.parties.map((p) => (
              <li key={p.id} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <Link href={`${terms.base}/${p.id}`} className="font-medium text-zinc-900 hover:text-emerald-700 truncate">
                    {p.name}
                  </Link>
                  <span className="text-sm font-semibold text-zinc-900 tabular-nums whitespace-nowrap">
                    {formatQuantity(p.total)} <span className="text-xs font-medium text-zinc-500">{material.unit}</span>
                  </span>
                </div>
                <p className="mt-1.5 flex flex-wrap gap-1.5">
                  {months.map((m, i) =>
                    p.byMonth[i] > 0 ? (
                      <span key={m} className="px-2 py-0.5 rounded-md bg-zinc-100 text-xs text-zinc-700 tabular-nums">
                        {formatMonthShort(m)} {m.slice(2, 4)}: <span className="font-medium text-zinc-900">{formatQuantity(p.byMonth[i])}</span>
                      </span>
                    ) : null
                  )}
                </p>
              </li>
            ))}
            <li className="px-4 py-3 flex items-baseline justify-between gap-3 bg-zinc-50 font-semibold text-zinc-900">
              <span>Total</span>
              <span className="tabular-nums">
                {formatQuantity(material.total)} <span className="text-xs font-medium text-zinc-500">{material.unit}</span>
              </span>
            </li>
          </ul>

          {/* Desktop: parties down, months across */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-xs font-medium text-zinc-500">
                  <th className="py-2 px-4 text-left sticky left-0 bg-zinc-50">{terms.One}</th>
                  {months.map((m) => (
                    <th key={m} className="py-2 px-2 text-right font-medium whitespace-nowrap">
                      {formatMonthShort(m)}
                      <span className="block text-[10px] text-zinc-400">{m.slice(0, 4)}</span>
                    </th>
                  ))}
                  <th className="py-2 px-4 text-right whitespace-nowrap">
                    Total
                    <span className="block text-[10px] text-zinc-400">{material.unit}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {material.parties.map((p) => (
                  <tr key={p.id} className="group hover:bg-zinc-50/70">
                    <td className="py-2.5 px-4 sticky left-0 bg-white group-hover:bg-zinc-50 max-w-[220px]">
                      <Link href={`${terms.base}/${p.id}`} className="font-medium text-zinc-900 hover:text-emerald-700 block truncate">
                        {p.name}
                      </Link>
                    </td>
                    {p.byMonth.map((q, i) => (
                      <td key={months[i]} className={`py-2.5 px-2 text-right tabular-nums ${q > 0 ? 'text-zinc-900' : 'text-zinc-300'}`}>
                        {qtyOrDash(q)}
                      </td>
                    ))}
                    <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-zinc-900">{formatQuantity(p.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-50 border-t border-zinc-200 font-semibold text-zinc-900">
                  <td className="py-2.5 px-4 sticky left-0 bg-zinc-50">Total</td>
                  {material.byMonth.map((q, i) => (
                    <td key={months[i]} className={`py-2.5 px-2 text-right tabular-nums ${q > 0 ? '' : 'text-zinc-300'}`}>
                      {qtyOrDash(q)}
                    </td>
                  ))}
                  <td className="py-2.5 px-4 text-right tabular-nums">{formatQuantity(material.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
