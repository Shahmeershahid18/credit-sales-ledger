import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  ArrowDownLeft,
  CalendarClock,
  FileBarChart,
  MessageCircle,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/config';
import { Logo } from '@/components/Logo';
import { buttonClass } from '@/components/ui';

export const metadata: Metadata = {
  title: { absolute: 'Credit Ledger · Credit sales, purchases and payments' },
  description:
    'Record material sold and bought on credit, payments received and made, and due dates. See what customers owe you and what you owe vendors, automatically.',
};

const FEATURES = [
  {
    icon: Users,
    title: 'Customers and vendors',
    text: 'What customers owe you and what you owe suppliers, each in a date-wise ledger with a running balance and a clear Paid, Pending or Overdue status.',
  },
  {
    icon: CalendarClock,
    title: '30, 60 and 90-day terms',
    text: 'Pick a credit term and the due date is worked out for you. Overdue amounts are aged into 1–30, 31–60, 61–90 and 90+ days.',
  },
  {
    icon: ArrowDownLeft,
    title: 'Payments that settle themselves',
    text: 'Payments clear the oldest unpaid bill first, or the exact one you choose, on both sides. Advances are tracked separately.',
  },
  {
    icon: FileBarChart,
    title: 'Monthly report',
    text: 'Sold, purchased, received and paid for any month, with amounts falling due and CSV export.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp reminders',
    text: 'Send a polite reminder with the outstanding amount and due date in one tap, straight from the ledger.',
  },
  {
    icon: UserCog,
    title: 'A private ledger for each user',
    text: 'Everyone signs in to their own ledger and sees only their own customers, vendors and payments.',
  },
];

const STEPS = [
  { title: 'Add customers and vendors', text: 'Name, phone and address. That is all it takes.' },
  { title: 'Record sales and purchases', text: 'Material, quantity, rate and credit term. The amount and due date are calculated.' },
  { title: 'Record payments', text: 'Received or paid, by cash, bank or cheque. Balances, bills and reports update instantly.' },
];

export default function LandingPage() {
  const isLive = isSupabaseConfigured();
  const cta = isLive ? { href: '/login', label: 'Sign in' } : { href: '/dashboard', label: 'Open demo' };

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-zinc-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" aria-label="Credit Ledger home">
            <Logo markClassName="w-8 h-8" />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <a href="#features" className="hidden sm:inline-flex h-9 px-3 items-center rounded-lg text-sm font-medium text-zinc-600 hover:text-zinc-900">
              Features
            </a>
            <a href="#how-it-works" className="hidden sm:inline-flex h-9 px-3 items-center rounded-lg text-sm font-medium text-zinc-600 hover:text-zinc-900">
              How it works
            </a>
            <Link href={cta.href} className={buttonClass('primary')}>
              {cta.label}
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-emerald-50/80 via-white to-white"
          />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-12 text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-200 bg-white text-xs font-medium text-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5" />
              Credit sales, purchases and payments
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-balance max-w-3xl mx-auto">
              Know who owes you, and who you owe.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-zinc-600 max-w-2xl mx-auto text-pretty">
              Credit Ledger records the material you sell and buy on credit and every payment received or made,
              then shows what customers owe you, what you owe vendors and what is overdue, automatically.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href={cta.href} className={buttonClass('primary', 'h-11 px-6 text-base w-full sm:w-auto')}>
                {cta.label}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#features" className={buttonClass('secondary', 'h-11 px-6 text-base w-full sm:w-auto')}>
                See features
              </a>
            </div>
          </div>

          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
            <ProductPreview />
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 border-t border-zinc-100 bg-zinc-50/60">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
            <div className="max-w-2xl">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Everything a credit book needs</h2>
              <p className="mt-3 text-zinc-600">
                Built around how material is actually sold and bought on credit: terms, partial payments and follow-ups.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="bg-white rounded-xl border border-zinc-200 p-5">
                    <span className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </span>
                    <h3 className="mt-4 font-semibold text-zinc-900">{f.title}</h3>
                    <p className="mt-1.5 text-sm text-zinc-600 leading-relaxed">{f.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Up and running in minutes</h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="relative pl-12">
                  <span className="absolute left-0 top-0 w-8 h-8 rounded-full bg-zinc-900 text-white text-sm font-semibold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <h3 className="font-semibold text-zinc-900">{step.title}</h3>
                  <p className="mt-1 text-sm text-zinc-600">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Call to action */}
        <section className="px-4 sm:px-6 pb-16 sm:pb-24">
          <div className="max-w-6xl mx-auto rounded-2xl bg-zinc-900 px-6 py-12 sm:px-12 sm:py-14 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Stop keeping your credit book in your head.</h2>
              <p className="mt-2 text-zinc-400">What you will receive, what you have to pay and when, in one place.</p>
            </div>
            <Link
              href={cta.href}
              className="inline-flex items-center justify-center gap-1.5 h-11 px-6 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium shrink-0"
            >
              {cta.label}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-zinc-500">
          <Logo markClassName="w-6 h-6" textClassName="text-zinc-700 text-sm" />
          <p>© {new Date().getFullYear()} Credit Ledger</p>
        </div>
      </footer>
    </div>
  );
}

/**
 * Illustration of the dashboard, drawn with HTML so it stays sharp at every size
 */
function ProductPreview() {
  const stats = [
    { label: 'To receive', value: 'Rs. 900,000', sub: 'Rs. 270,000 overdue', color: 'text-amber-700' },
    { label: 'To pay', value: 'Rs. 436,200', sub: 'Rs. 15,000 overdue', color: 'text-rose-700' },
    { label: 'Net position', value: 'Rs. 463,800', sub: 'Owed to you', color: 'text-emerald-700' },
    { label: 'Due in 7 days', value: 'Rs. 145,200', sub: 'Bills to pay', color: 'text-zinc-900' },
  ];
  const aging = [
    { label: 'Not due', amount: 'Rs. 630,000', pct: 70, color: 'bg-emerald-500' },
    { label: '1–30 days', amount: 'Rs. 50,000', pct: 6, color: 'bg-amber-500' },
    { label: '31–60 days', amount: 'Rs. 220,000', pct: 24, color: 'bg-orange-500' },
  ];
  const rows = [
    { name: 'Ittefaq Steel Mills', amount: 'Rs. 276,000', status: 'Pending', cls: 'bg-amber-50 text-amber-800 ring-amber-600/20' },
    { name: 'Lucky Cement Depot', amount: 'Rs. 160,200', status: 'Overdue', cls: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
  ];

  return (
    <div aria-hidden="true" className="rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-zinc-900/5 overflow-hidden">
      <div className="h-9 px-4 border-b border-zinc-100 bg-zinc-50 flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
        <span className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
        <span className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
      </div>
      <div className="p-4 sm:p-6 bg-zinc-50/50 space-y-4 text-left">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-zinc-200 p-3 sm:p-4">
              <p className="text-[11px] sm:text-xs text-zinc-500">{s.label}</p>
              <p className={`mt-1 text-sm sm:text-lg font-semibold tabular-nums ${s.color}`}>{s.value}</p>
              <p className="mt-0.5 text-[10px] sm:text-[11px] text-zinc-500">{s.sub}</p>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-zinc-200 p-4">
            <p className="text-xs font-semibold text-zinc-900">Receivable by age</p>
            <div className="mt-3 h-3 rounded-full overflow-hidden flex">
              {aging.map((a) => (
                <span key={a.label} className={a.color} style={{ width: `${a.pct}%` }} />
              ))}
            </div>
            <ul className="mt-3 space-y-2 text-xs">
              {aging.map((a) => (
                <li key={a.label} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-sm ${a.color}`} />
                  <span className="text-zinc-600">{a.label}</span>
                  <span className="ml-auto font-semibold tabular-nums text-zinc-900">{a.amount}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded-xl border border-zinc-200 p-4">
            <p className="text-xs font-semibold text-zinc-900">Bills to pay</p>
            <ul className="mt-2 divide-y divide-zinc-100">
              {rows.map((r) => (
                <li key={r.name} className="py-2 flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-zinc-800 truncate">{r.name}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className={`px-1.5 py-0.5 rounded-md ring-1 ring-inset ${r.cls}`}>{r.status}</span>
                    <span className="font-semibold tabular-nums text-zinc-900">{r.amount}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
