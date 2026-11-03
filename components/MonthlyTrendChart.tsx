'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { MonthFlow } from '@/lib/types';
import { formatMonth, formatMonthShort, formatRs } from '@/lib/format';
import { Segmented } from './ui';

interface MonthlyTrendChartProps {
  data: MonthFlow[]; // oldest first
  selected: string; // YYYY-MM shown in the summary card
  query?: string; // other dashboard parameters to keep, e.g. "side=vendor"
}

// Categorical slots 1–4 of the validated reference palette: money in is blue (bars)
// and aqua (line), money out is orange (bars) and yellow (line).
const SERIES = [
  { key: 'sold', label: 'Sold', color: '#2a78d6', mark: 'bar' },
  { key: 'purchased', label: 'Purchased', color: '#eb6834', mark: 'bar' },
  { key: 'received', label: 'Received', color: '#1baf7a', mark: 'line' },
  { key: 'paid', label: 'Paid', color: '#eda100', mark: 'line' },
] as const;

const axisTick = { fontSize: 11, fill: '#71717a' };
const compact = (v: number) => (v >= 1_000_000 ? `${+(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));

function Swatch({ color, mark }: { color: string; mark: 'bar' | 'line' }) {
  return mark === 'bar' ? (
    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
  ) : (
    <span className="w-3.5 h-0.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
  );
}

function TrendTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  const flow = payload?.[0]?.payload as MonthFlow | undefined;
  if (!active || !flow) return null;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5 shadow-lg shadow-zinc-900/10 text-xs min-w-[11rem]">
      <p className="font-semibold text-zinc-900 mb-1.5">{formatMonth(flow.month)}</p>
      <ul className="space-y-1">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <Swatch color={s.color} mark={s.mark} />
            <span className="text-zinc-600">{s.label}</span>
            <span className="ml-auto pl-3 font-medium text-zinc-900 tabular-nums">{formatRs(flow[s.key])}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 pt-1.5 border-t border-zinc-100 flex justify-between gap-3">
        <span className="text-zinc-600">Net cash</span>
        <span className="font-semibold text-zinc-900 tabular-nums">{formatRs(flow.received - flow.paid)}</span>
      </p>
      <p className="mt-1 text-[11px] text-zinc-400">Click to see this month</p>
    </div>
  );
}

/**
 * Last months of sold, purchased, received and paid, as a table (default) or a chart:
 * sales and purchases as bars, money received and paid as lines. Clicking a month
 * shows it in the monthly summary. Sits inside the summary card.
 */
export function MonthlyTrendChart({ data, selected, query }: MonthlyTrendChartProps) {
  const router = useRouter();
  const [view, setView] = useState<'chart' | 'table'>('table');

  const show = (month: string) => router.push(`/dashboard?${query ? `${query}&` : ''}month=${month}`, { scroll: false });
  const hasActivity = data.some((d) => d.sold || d.purchased || d.received || d.paid);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Last {data.length} months</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Click a month to see its summary</p>
        </div>
        <div className="w-36">
          <Segmented
            ariaLabel="Trend view"
            value={view}
            onChange={setView}
            options={[
              { label: 'Table', value: 'table' },
              { label: 'Chart', value: 'chart' },
            ]}
          />
        </div>
      </div>

      {view === 'chart' ? (
        <>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-zinc-600" aria-label="Legend">
            {SERIES.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <Swatch color={s.color} mark={s.mark} />
                {s.label}
              </li>
            ))}
          </ul>
          {!hasActivity ? (
            <div className="h-64 flex items-center justify-center text-sm text-zinc-400">No activity in these months</div>
          ) : (
            <div className="mt-3 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={data}
                  margin={{ top: 8, right: 4, left: -8, bottom: 0 }}
                  barGap={2}
                  barCategoryGap="28%"
                  onClick={(state) => state.activeLabel && show(String(state.activeLabel))}
                  style={{ cursor: 'pointer' }}
                >
                  <ReferenceArea x1={selected} x2={selected} fill="#f4f4f5" fillOpacity={1} ifOverflow="hidden" />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={formatMonthShort}
                    tick={axisTick}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tickFormatter={compact} tick={axisTick} axisLine={false} tickLine={false} width={48} />
                  <Tooltip content={TrendTooltip} cursor={{ fill: '#fafafa' }} />
                  {SERIES.filter((s) => s.mark === 'bar').map((s) => (
                    <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                  ))}
                  {SERIES.filter((s) => s.mark === 'line').map((s) => (
                    <Line
                      key={s.key}
                      dataKey={s.key}
                      name={s.label}
                      type="linear"
                      stroke={s.color}
                      strokeWidth={2}
                      dot={{ r: 4, fill: s.color, stroke: '#ffffff', strokeWidth: 2 }}
                      activeDot={{ r: 5, fill: s.color, stroke: '#ffffff', strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      ) : (
        <div className="mt-3 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 overflow-x-auto">
          <table className="w-full text-sm min-w-[34rem]">
            <thead>
              <tr className="border-y border-zinc-100 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
                <th className="py-2 px-4 sm:px-5">Month</th>
                {SERIES.map((s) => (
                  <th key={s.key} className="py-2 px-3 text-right">
                    {s.label}
                  </th>
                ))}
                <th className="py-2 px-4 sm:px-5 text-right">Net cash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {[...data].reverse().map((d) => (
                <tr
                  key={d.month}
                  onClick={() => show(d.month)}
                  className={`cursor-pointer hover:bg-zinc-50 ${d.month === selected ? 'bg-zinc-50' : ''}`}
                >
                  <td className="py-2 px-4 sm:px-5 font-medium text-zinc-900 whitespace-nowrap">{formatMonth(d.month)}</td>
                  {SERIES.map((s) => (
                    <td
                      key={s.key}
                      className={`py-2 px-3 text-right tabular-nums whitespace-nowrap ${d[s.key] ? 'text-zinc-700' : 'text-zinc-300'}`}
                    >
                      {d[s.key] ? formatRs(d[s.key]) : '—'}
                    </td>
                  ))}
                  <td className="py-2 px-4 sm:px-5 text-right tabular-nums font-medium text-zinc-900 whitespace-nowrap">
                    {formatRs(d.received - d.paid)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
