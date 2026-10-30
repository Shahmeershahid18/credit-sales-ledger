'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  AlertCircle,
  FileBarChart,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  LogOut,
  Truck,
  CalendarClock,
  ShoppingCart,
} from 'lucide-react';
import { signOutAction } from '@/app/actions/auth';
import { Logo } from './Logo';

// Extra links (such as admin pages) come from the server as data, so they are not
// part of the browser code that every user downloads.
export type NavSection = {
  title: string;
  items: { label: string; href: string; icon: React.ReactNode }[];
};

interface NavigationProps {
  isDemo: boolean;
  account: { name: string; subtitle: string } | null;
  extraSection?: NavSection | null;
}

type NavItem = { label: string; short?: string; href: string; icon: React.ElementType; match: (p: string) => boolean };

const starts = (prefix: string) => (p: string) => p.startsWith(prefix);

const dashboardItem: NavItem = { label: 'Dashboard', short: 'Home', href: '/dashboard', icon: LayoutDashboard, match: (p) => p === '/dashboard' };
const customersItem: NavItem = { label: 'Customers', href: '/customers', icon: Users, match: starts('/customers') };
const overdueItem: NavItem = { label: 'Overdue', href: '/overdue', icon: AlertCircle, match: starts('/overdue') };
const vendorsItem: NavItem = { label: 'Vendors', href: '/vendors', icon: Truck, match: starts('/vendors') };
const billsItem: NavItem = { label: 'Bills to pay', href: '/bills', icon: CalendarClock, match: starts('/bills') };
const reportItem: NavItem = { label: 'Monthly Report', short: 'Report', href: '/reports/monthly', icon: FileBarChart, match: starts('/reports') };

const sidebarSections: { title?: string; items: NavItem[] }[] = [
  { items: [dashboardItem] },
  { title: 'Sales', items: [customersItem, overdueItem] },
  { title: 'Purchases', items: [vendorsItem, billsItem] },
  { title: 'Reports', items: [reportItem] },
];

const mobileTabs = [dashboardItem, customersItem, vendorsItem, overdueItem, reportItem];

const quickActions = [
  { label: 'New sale', href: '/sales/new', icon: Plus },
  { label: 'Record payment', href: '/payments/new', icon: ArrowDownLeft },
  { label: 'New purchase', href: '/purchases/new', icon: ShoppingCart },
  { label: 'Pay vendor', href: '/vendor-payments/new', icon: ArrowUpRight },
];

const sidebarLink = (active: boolean) =>
  `flex items-center gap-3 h-9 px-3 rounded-lg text-sm font-medium transition-colors ${
    active ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
  }`;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="px-3 pt-5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{children}</p>;
}

function SignOutButton({ className }: { className: string }) {
  return (
    <form action={signOutAction}>
      <button type="submit" className={className} title="Sign out" aria-label="Sign out">
        <LogOut className="w-4 h-4" />
      </button>
    </form>
  );
}

/** "+ New" button with the four entry types, for the mobile top bar */
function NewMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="h-8 px-3 rounded-lg bg-zinc-900 text-white text-xs font-medium flex items-center gap-1"
      >
        <Plus className="w-3.5 h-3.5" />
        New
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-52 rounded-lg border border-zinc-200 bg-white shadow-lg shadow-zinc-900/10 p-1">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 h-10 px-2.5 rounded-md text-sm text-zinc-800 hover:bg-zinc-100"
              >
                <Icon className="w-4 h-4 text-zinc-500" />
                {a.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Navigation({ isDemo, account, extraSection }: NavigationProps) {
  const pathname = usePathname();
  const initial = (account?.name[0] ?? 'D').toUpperCase();
  const extraActive = extraSection?.items.some((item) => pathname.startsWith(item.href)) ?? false;
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
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/purchases/new"
              className="h-8 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white text-xs font-medium flex items-center justify-center gap-1"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Purchase
            </Link>
            <Link
              href="/vendor-payments/new"
              className="h-8 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white text-xs font-medium flex items-center justify-center gap-1"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Pay vendor
            </Link>
          </div>
        </div>

        <nav className="px-3 py-2 space-y-0.5 flex-1 overflow-y-auto">
          {sidebarSections.map((section, i) => (
            <React.Fragment key={section.title ?? i}>
              {section.title && <SectionTitle>{section.title}</SectionTitle>}
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = item.match(pathname);
                return (
                  <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={sidebarLink(active)}>
                    <Icon className={`w-4 h-4 ${active ? 'text-emerald-400' : ''}`} />
                    {item.label}
                  </Link>
                );
              })}
            </React.Fragment>
          ))}

          {extraSection && (
            <>
              <SectionTitle>{extraSection.title}</SectionTitle>
              {extraSection.items.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={sidebarLink(active)}>
                    <span className={`flex ${active ? 'text-emerald-400' : ''}`}>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
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
                <span className="block text-xs text-zinc-500 truncate">{account.subtitle}</span>
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
            href="/bills"
            aria-label="Bills to pay"
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              billsItem.match(pathname) ? 'bg-emerald-50 text-emerald-700' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
          >
            <CalendarClock className="w-4 h-4" />
          </Link>
          <Link
            href="/payments/new"
            className="h-8 px-2.5 rounded-lg bg-emerald-600 text-white text-xs font-medium flex items-center gap-1"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            Payment
          </Link>
          <NewMenu />
          {account && (
            <Link
              href="/account"
              aria-label="Account"
              className={`ml-0.5 w-8 h-8 rounded-full text-sm font-medium flex items-center justify-center ${
                accountActive || extraActive ? 'bg-emerald-600 text-white' : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
              }`}
            >
              {initial}
            </Link>
          )}
        </div>
      </header>

      {/* Mobile bottom tabs */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-zinc-200 grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {mobileTabs.map((item) => {
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
              {item.short ?? item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
