'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, AlertCircle, FileBarChart, Plus, ArrowDownLeft, LogOut, UserCog } from 'lucide-react';
import { signOutAction } from '@/app/actions/auth';
import { Logo } from './Logo';

interface NavigationProps {
  isDemo: boolean;
  account: { name: string; email: string; isAdmin: boolean } | null;
}

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, match: (p: string) => p === '/dashboard' },
  { label: 'Customers', href: '/customers', icon: Users, match: (p: string) => p.startsWith('/customers') },
  { label: 'Overdue', href: '/overdue', icon: AlertCircle, match: (p: string) => p.startsWith('/overdue') },
  { label: 'Monthly Report', href: '/reports/monthly', icon: FileBarChart, match: (p: string) => p.startsWith('/reports') },
];

function SignOutButton({ className }: { className: string }) {
  return (
    <form action={signOutAction}>
      <button type="submit" className={className} title="Sign out" aria-label="Sign out">
        <LogOut className="w-4 h-4" />
      </button>
    </form>
  );
}

export function Navigation({ isDemo, account }: NavigationProps) {
  const pathname = usePathname();
  const initial = (account?.name[0] ?? 'D').toUpperCase();
  const usersActive = pathname.startsWith('/users');
  const accountActive = pathname.startsWith('/account');

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 h-screen sticky top-0 bg-zinc-900 text-zinc-300 border-r border-zinc-800">
        <div className="px-5 h-16 flex items-center border-b border-zinc-800">
          <Link href="/dashboard" aria-label="Credit Ledger home">
            <Logo markClassName="w-8 h-8" textClassName="text-white" />
          </Link>
        </div>

        <div className="p-3 space-y-2">
          <Link
            href="/sales/new"
            className="h-9 rounded-lg bg-white text-zinc-900 hover:bg-zinc-100 text-sm font-medium flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            New Sale
          </Link>
          <Link
            href="/payments/new"
            className="h-9 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 text-sm font-medium flex items-center justify-center gap-1.5"
          >
            <ArrowDownLeft className="w-4 h-4" />
            Record Payment
          </Link>
        </div>

        <nav className="px-3 py-2 space-y-0.5 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 h-9 px-3 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-emerald-400' : ''}`} />
                {item.label}
              </Link>
            );
          })}

          {account?.isAdmin && (
            <>
              <p className="px-3 pt-5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Admin</p>
              <Link
                href="/users"
                aria-current={usersActive ? 'page' : undefined}
                className={`flex items-center gap-3 h-9 px-3 rounded-lg text-sm font-medium transition-colors ${
                  usersActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <UserCog className={`w-4 h-4 ${usersActive ? 'text-emerald-400' : ''}`} />
                Users
              </Link>
            </>
          )}
        </nav>

        <div className="p-3 border-t border-zinc-800 flex items-center gap-1">
          {account ? (
            <Link
              href="/account"
              title="Account and password"
              className={`flex-1 min-w-0 flex items-center gap-3 p-1.5 -m-0.5 rounded-lg transition-colors ${
                accountActive ? 'bg-zinc-800' : 'hover:bg-zinc-800/60'
              }`}
            >
              <span className="w-8 h-8 rounded-full bg-zinc-700 text-white text-sm font-medium flex items-center justify-center shrink-0">
                {initial}
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-zinc-200 truncate">{account.name}</span>
                <span className="block text-xs text-zinc-500 truncate">{account.isAdmin ? 'Admin' : account.email}</span>
              </span>
            </Link>
          ) : (
            <div className="flex-1 min-w-0 flex items-center gap-3 p-1.5">
              <span className="w-8 h-8 rounded-full bg-zinc-700 text-white text-sm font-medium flex items-center justify-center shrink-0">
                {initial}
              </span>
              <span className="text-sm text-zinc-300">{isDemo ? 'Demo mode' : 'Signed in'}</span>
            </div>
          )}
          {!isDemo && (
            <SignOutButton className="w-8 h-8 shrink-0 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center" />
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 h-14 px-4 bg-white/90 backdrop-blur border-b border-zinc-200 flex items-center justify-between">
        <Link href="/dashboard" aria-label="Credit Ledger home">
          <Logo markClassName="w-7 h-7" />
        </Link>
        <div className="flex items-center gap-1.5">
          <Link
            href="/sales/new"
            className="h-8 px-2.5 rounded-lg bg-zinc-900 text-white text-xs font-medium flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Sale
          </Link>
          <Link
            href="/payments/new"
            className="h-8 px-2.5 rounded-lg bg-emerald-600 text-white text-xs font-medium flex items-center gap-1"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            Payment
          </Link>
          {account && (
            <Link
              href="/account"
              aria-label="Account"
              className={`ml-0.5 w-8 h-8 rounded-full text-sm font-medium flex items-center justify-center ${
                accountActive || usersActive ? 'bg-emerald-600 text-white' : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
              }`}
            >
              {initial}
            </Link>
          )}
        </div>
      </header>

      {/* Mobile bottom tabs */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-zinc-200 grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 h-14 text-[11px] font-medium ${
                active ? 'text-emerald-700' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.label === 'Monthly Report' ? 'Report' : item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
