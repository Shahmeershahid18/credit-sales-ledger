'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  AlertCircle,
  FileBarChart,
  Plus,
  ArrowDownLeft,
  BookOpen,
  Database,
  CheckCircle2,
  AlertTriangle,
  LogOut,
} from 'lucide-react';
import { signOutAction } from '@/app/actions/auth';

interface NavigationProps {
  isDemo: boolean;
  email: string | null;
}

export function Navigation({ isDemo, email }: NavigationProps) {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
      active: pathname === '/',
    },
    {
      label: 'Customers',
      href: '/customers',
      icon: Users,
      active: pathname.startsWith('/customers'),
    },
    {
      label: 'Overdue',
      href: '/overdue',
      icon: AlertCircle,
      active: pathname.startsWith('/overdue'),
    },
    {
      label: 'Monthly Report',
      href: '/reports/monthly',
      icon: FileBarChart,
      active: pathname.startsWith('/reports'),
    },
  ];

  return (
    <>
      {/* ================= DESKTOP SIDEBAR ================= */}
      <aside className="hidden lg:flex flex-col w-64 bg-zinc-900 text-white border-r border-zinc-800 shrink-0 h-screen sticky top-0 justify-between p-4">
        <div className="space-y-6">
          {/* Brand Header */}
          <div className="px-2 pt-2">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-zinc-950 flex items-center justify-center font-black text-xl shadow-md group-hover:scale-105 transition-transform">
                <BookOpen className="w-5 h-5 text-zinc-950" />
              </div>
              <div>
                <h1 className="font-extrabold text-base tracking-tight text-white leading-none">
                  Credit Ledger
                </h1>
                <p className="text-[11px] font-medium text-zinc-400 mt-1">
                  Credit Sale & Monitoring
                </p>
              </div>
            </Link>
          </div>

          {/* Quick Transaction Action Buttons */}
          <div className="space-y-2 px-1">
            <Link
              href="/sales/new"
              className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-zinc-100 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              <Plus className="w-4 h-4 text-zinc-900" />
              <span>Record Credit Sale</span>
            </Link>
            <Link
              href="/payments/new"
              className="w-full py-2 px-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Record Payment</span>
            </Link>
          </div>

          {/* Nav List */}
          <nav className="space-y-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
              Main Navigation
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    item.active
                      ? 'bg-zinc-800 text-emerald-400 shadow-xs'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${item.active ? 'text-emerald-400' : 'text-zinc-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer info & Status */}
        <div className="pt-4 border-t border-zinc-800 space-y-3 px-2">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              Database
            </span>
            {isDemo ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-950 text-amber-400 font-semibold border border-amber-800/60 flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5" />
                Demo (in-memory)
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-950 text-emerald-400 font-semibold border border-emerald-800/60 flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" />
                Supabase
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs text-white shrink-0">
              OW
            </div>
            <div className="text-xs min-w-0 flex-1">
              <p className="font-bold text-white leading-tight">Store Owner</p>
              <p className="text-[10px] text-zinc-400 truncate" title={email ?? undefined}>
                {isDemo ? 'Demo mode' : email ?? 'Signed in'}
              </p>
            </div>
            {!isDemo && (
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      </aside>

      {/* ================= MOBILE TOP HEADER ================= */}
      <header className="lg:hidden sticky top-0 z-40 bg-zinc-900 text-white border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 text-zinc-950 flex items-center justify-center font-black">
            <BookOpen className="w-4 h-4 text-zinc-950" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-white leading-tight">
              Credit Ledger
            </h1>
            <p className="text-[9px] text-zinc-400 leading-none">Credit & Overdue</p>
          </div>
        </Link>

        <div className="flex items-center gap-1.5">
          <Link
            href="/sales/new"
            className="p-1.5 rounded-lg bg-white text-zinc-950 font-bold text-xs flex items-center gap-1"
            title="Add Sale"
          >
            <Plus className="w-4 h-4" />
            <span className="text-[11px]">Sale</span>
          </Link>
          <Link
            href="/payments/new"
            className="p-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center gap-1"
            title="Add Payment"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span className="text-[11px]">Paid</span>
          </Link>
          {!isDemo && (
            <form action={signOutAction}>
              <button
                type="submit"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </header>

      {/* ================= MOBILE BOTTOM TAB BAR ================= */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-900 border-t border-zinc-800 px-2 py-1.5 flex items-center justify-around shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                item.active
                  ? 'text-emerald-400 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200 font-medium'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
