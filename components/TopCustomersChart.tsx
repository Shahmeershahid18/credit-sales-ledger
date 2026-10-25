'use client';

import React from 'react';
import Link from 'next/link';
import { CustomerStatus } from '@/lib/types';
import { formatRs } from '@/lib/format';
import { StatusBadge } from './StatusBadge';
import { Users, ArrowUpRight } from 'lucide-react';

interface TopCustomer {
  id: string;
  name: string;
  outstanding: number;
  totalSale: number;
  status: CustomerStatus;
}

interface TopCustomersChartProps {
  customers: TopCustomer[];
}

export function TopCustomersChart({ customers }: TopCustomersChartProps) {
  const maxOutstanding = Math.max(...customers.map((c) => c.outstanding), 1);

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/90 p-5 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 tracking-tight">
            Top Outstanding Customers
          </h3>
          <p className="text-xs text-zinc-500">Highest unpaid balances requiring follow-up</p>
        </div>
        <Link
          href="/customers"
          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
        >
          <span>View All</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {customers.length === 0 ? (
        <div className="h-56 flex flex-col items-center justify-center text-xs text-zinc-400 gap-2">
          <Users className="w-8 h-8 opacity-40" />
          <span>No outstanding balances found</span>
        </div>
      ) : (
        <div className="space-y-4 my-2">
          {customers.map((c, index) => {
            const percentage = Math.min(100, Math.round((c.outstanding / maxOutstanding) * 100));
            return (
              <div key={c.id} className="space-y-1.5 group">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-4 text-[11px] font-bold text-zinc-400">#{index + 1}</span>
                    <Link
                      href={`/customers/${c.id}`}
                      className="font-bold text-zinc-900 hover:text-emerald-700 truncate"
                    >
                      {c.name}
                    </Link>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-extrabold text-zinc-900">{formatRs(c.outstanding)}</span>
                    <StatusBadge status={c.status} showIcon={false} className="py-0.5 px-2 text-[10px]" />
                  </div>
                </div>

                {/* Visual Progress Bar */}
                <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      c.status === 'overdue'
                        ? 'bg-rose-500'
                        : 'bg-amber-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-3 border-t border-zinc-100 text-[11px] text-zinc-500 flex items-center justify-between">
        <span>Click customer name to open full ledger & send WhatsApp reminder</span>
      </div>
    </div>
  );
}
