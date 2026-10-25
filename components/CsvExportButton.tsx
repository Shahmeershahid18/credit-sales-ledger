'use client';

import React from 'react';
import { Download } from 'lucide-react';

interface CsvExportButtonProps {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
  title?: string;
}

export function CsvExportButton({
  filename,
  headers,
  rows,
  title = 'Export CSV',
}: CsvExportButtonProps) {
  const handleExport = () => {
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((cell) => {
            const str = String(cell ?? '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold transition-colors shadow-xs"
      title="Download spreadsheet CSV"
    >
      <Download className="w-3.5 h-3.5 text-zinc-600" />
      <span>{title}</span>
    </button>
  );
}
