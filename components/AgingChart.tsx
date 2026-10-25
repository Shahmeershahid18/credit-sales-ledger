'use client';

import React, { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { formatRs } from '@/lib/format';
import { PieChart as PieIcon, BarChart2 } from 'lucide-react';

interface AgingChartProps {
  data: {
    notDue: number;
    d1_30: number;
    d31_60: number;
    d61_90: number;
    d90_plus: number;
  };
}

const COLORS = [
  '#10B981', // Not due: Emerald green
  '#F59E0B', // 1-30 days: Amber
  '#F97316', // 31-60 days: Orange
  '#EF4444', // 61-90 days: Red
  '#991B1B', // 90+ days: Dark Red/Crimson
];

export function AgingChart({ data }: AgingChartProps) {
  const [chartType, setChartType] = useState<'donut' | 'bar'>('donut');

  const chartData = [
    { name: 'Not Due', value: data.notDue, color: COLORS[0] },
    { name: '1–30 Days', value: data.d1_30, color: COLORS[1] },
    { name: '31–60 Days', value: data.d31_60, color: COLORS[2] },
    { name: '61–90 Days', value: data.d61_90, color: COLORS[3] },
    { name: '90+ Days', value: data.d90_plus, color: COLORS[4] },
  ];

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/90 p-5 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 tracking-tight">
            Overdue Aging Analysis
          </h3>
          <p className="text-xs text-zinc-500">
            Total Outstanding: <span className="font-semibold text-zinc-800">{formatRs(total)}</span>
          </p>
        </div>

        {/* Chart type toggle */}
        <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
          <button
            onClick={() => setChartType('donut')}
            className={`p-1.5 rounded-md text-xs font-semibold transition-all ${
              chartType === 'donut'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
            title="Donut Chart"
          >
            <PieIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`p-1.5 rounded-md text-xs font-semibold transition-all ${
              chartType === 'bar'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
            title="Bar Chart"
          >
            <BarChart2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {total === 0 ? (
        <div className="h-56 flex items-center justify-center text-xs text-zinc-400">
          No outstanding sales to display
        </div>
      ) : chartType === 'donut' ? (
        <div className="h-60 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                formatter={(val) => [formatRs(Number(val)), 'Amount']}
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  fontSize: '12px',
                }}
              />
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={88}
                paddingAngle={4}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
              Outstanding
            </span>
            <span className="text-sm font-extrabold text-zinc-900">
              {formatRs(total)}
            </span>
          </div>
        </div>
      ) : (
        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(val) => [formatRs(Number(val)), 'Amount']}
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3 border-t border-zinc-100 text-xs">
        {chartData.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-zinc-600 truncate">{item.name}:</span>
            <span className="font-bold text-zinc-900 ml-auto">{formatRs(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
