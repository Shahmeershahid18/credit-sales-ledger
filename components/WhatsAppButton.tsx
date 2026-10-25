'use client';

import React from 'react';
import { formatRs, formatDate } from '@/lib/format';
import { MessageSquare } from 'lucide-react';

interface WhatsAppButtonProps {
  customerName: string;
  phone?: string | null;
  outstanding: number;
  dueDate?: string | null;
  className?: string;
}

export function WhatsAppButton({
  customerName,
  phone,
  outstanding,
  dueDate,
  className = '',
}: WhatsAppButtonProps) {
  if (outstanding <= 0) return null;

  // Clean phone number (remove spaces, dashes, parentheses)
  let cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  if (cleanPhone.startsWith('03')) {
    cleanPhone = '92' + cleanPhone.slice(1);
  }

  const formattedAmount = formatRs(outstanding);
  const duePart = dueDate ? `, due on ${formatDate(dueDate)}` : '';

  const message = `Salam ${customerName},\n\nThis is a gentle payment reminder from our ledger. Your current outstanding balance is ${formattedAmount}${duePart}.\n\nPlease arrange payment at your earliest convenience.\nThank you!`;

  const encodedMessage = encodeURIComponent(message);
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedMessage}`
    : `https://wa.me/?text=${encodedMessage}`;

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xs ${className}`}
      title={phone ? `Send WhatsApp reminder to ${phone}` : 'Open WhatsApp reminder draft'}
    >
      <MessageSquare className="w-3.5 h-3.5" />
      <span>WhatsApp Reminder</span>
    </a>
  );
}
