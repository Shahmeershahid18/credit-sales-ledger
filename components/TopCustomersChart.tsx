import React from 'react';
import Link from 'next/link';
import { DashboardStats } from '@/lib/types';
import { formatRs } from '@/lib/format';
import { StatusBadge } from './StatusBadge';
import { ArrowRight } from 'lucide-react';

interface TopCustomersChartProps {
  customers: DashboardStats['topCustomers'];
}

export function TopCustomersChart({ customers }: TopCustomersChartProps) {
  const maxOutstanding = Math.max(...customers.map((c) => c.outstanding), 1);

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-4 sm:p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Top outstanding customers</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Highest unpaid balances</p>
        </div>
        <Link href="/customers" className="text-xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1">
          View all
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {customers.length === 0 ? (
        <div className="flex-1 min-h-56 flex items-center justify-center text-sm text-zinc-400">
          No outstanding balances
        </div>
      ) : (
        <ul className="space-y-4">
          {customers.map((c) => {
            const percentage = Math.max(2, Math.round((c.outstanding / maxOutstanding) * 100));
            return (
              <li key={c.id}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <Link href={`/customers/${c.id}`} className="font-medium text-zinc-900 hover:text-emerald-700 truncate">
                    {c.name}
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:block">
                      <StatusBadge status={c.status} />
                    </span>
                    <span className="font-semibold text-zinc-900 tabular-nums">{formatRs(c.outstanding)}</span>
                  </div>
                </div>
                <div className="mt-1.5 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${c.status === 'overdue' ? 'bg-rose-500' : 'bg-amber-500'}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
