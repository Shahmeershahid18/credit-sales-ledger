'use client';

import React from 'react';
import { Download } from 'lucide-react';
import { buttonClass } from './ui';

interface CsvExportButtonProps {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
  disabled?: boolean;
}

function csvCell(cell: string | number) {
  const str = String(cell ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function CsvExportButton({ filename, headers, rows, disabled = false }: CsvExportButtonProps) {
  const handleExport = () => {
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    // BOM so Excel opens the file as UTF-8
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <button type="button" onClick={handleExport} disabled={disabled} className={buttonClass('secondary')}>
      <Download className="w-4 h-4" />
      Export CSV
    </button>
  );
}
