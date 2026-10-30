'use client';

import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { formatRs } from '@/lib/format';
import { AgingSummary } from '@/lib/types';
import { Segmented } from './ui';

interface AgingChartProps {
  data: AgingSummary;
  title?: string;
  totalLabel?: string;
}

// Severity scale: not yet due → most overdue
const SERIES = [
  { key: 'notDue', name: 'Not due', color: '#10b981' },
  { key: 'd1_30', name: '1–30 days', color: '#f59e0b' },
  { key: 'd31_60', name: '31–60 days', color: '#f97316' },
  { key: 'd61_90', name: '61–90 days', color: '#ef4444' },
  { key: 'd90_plus', name: '90+ days', color: '#991b1b' },
] as const;

const tooltipStyle = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  border: '1px solid #e4e4e7',
  fontSize: '12px',
};

export function AgingChart({ data, title = 'Outstanding by age', totalLabel = 'Outstanding' }: AgingChartProps) {
  const [chartType, setChartType] = useState<'donut' | 'bar'>('donut');

  const chartData = SERIES.map((s) => ({ name: s.name, value: data[s.key], color: s.color }));
  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-4 sm:p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
          <p className="text-xs text-zinc-500 mt-0.5 tabular-nums">Total {formatRs(total)}</p>
        </div>
        {total > 0 && (
          <div className="w-32">
            <Segmented
              ariaLabel="Chart type"
              value={chartType}
              onChange={setChartType}
              options={[
                { label: 'Donut', value: 'donut' },
                { label: 'Bar', value: 'bar' },
              ]}
            />
          </div>
        )}
      </div>

      {total === 0 ? (
        <div className="h-56 flex items-center justify-center text-sm text-zinc-400">Nothing unpaid</div>
      ) : chartType === 'donut' ? (
        <div className="h-56 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip formatter={(val) => [formatRs(Number(val)), 'Amount']} contentStyle={tooltipStyle} />
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={62} outerRadius={88} paddingAngle={2} dataKey="value" stroke="none" isAnimationActive={false}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs text-zinc-500">{totalLabel}</span>
            <span className="text-sm font-semibold text-zinc-900 tabular-nums">{formatRs(total)}</span>
          </div>
        </div>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 4, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
                tick={{ fontSize: 11, fill: '#71717a' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip formatter={(val) => [formatRs(Number(val)), 'Amount']} contentStyle={tooltipStyle} cursor={{ fill: '#f4f4f5' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <ul className="mt-4 pt-4 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {chartData.map((item) => (
          <li key={item.name} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-zinc-600">{item.name}</span>
            <span className="ml-auto font-medium text-zinc-900 tabular-nums">{formatRs(item.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
