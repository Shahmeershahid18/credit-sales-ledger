import React from 'react';
import { formatRs, formatDate } from '@/lib/format';
import { MessageCircle } from 'lucide-react';
import { buttonClass } from './ui';

interface WhatsAppButtonProps {
  customerName: string;
  phone?: string | null;
  outstanding: number;
  dueDate?: string | null;
  compact?: boolean;
}

/**
 * Opens WhatsApp with a pre-filled payment reminder. Hidden when nothing is owed.
 */
export function WhatsAppButton({ customerName, phone, outstanding, dueDate, compact = false }: WhatsAppButtonProps) {
  if (outstanding <= 0) return null;

  // Digits only; local 03xx numbers become 92 3xx
  let cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  if (cleanPhone.startsWith('03')) {
    cleanPhone = '92' + cleanPhone.slice(1);
  }

  const duePart = dueDate ? `, due on ${formatDate(dueDate)}` : '';
  const message = `Assalam o Alaikum ${customerName},\n\nThis is a reminder that your outstanding balance is ${formatRs(outstanding)}${duePart}.\n\nPlease arrange the payment at your earliest convenience. Thank you.`;
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={phone ? `Send reminder to ${phone}` : 'Open reminder in WhatsApp'}
      aria-label="Send WhatsApp reminder"
      className={
        compact
          ? 'w-8 h-8 rounded-md text-emerald-700 hover:bg-emerald-50 inline-flex items-center justify-center'
          : buttonClass('secondary')
      }
    >
      <MessageCircle className="w-4 h-4 text-emerald-600" />
      {!compact && <span className="hidden sm:inline">Reminder</span>}
    </a>
  );
}
