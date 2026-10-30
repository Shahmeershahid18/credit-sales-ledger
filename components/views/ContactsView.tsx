import React from 'react';
import Link from 'next/link';
import { getCustomerCards } from '@/lib/queries';
import { ContactKind, SIDES } from '@/lib/contacts';
import { CustomerCard } from '@/components/CustomerCard';
import { EmptyState, PageHeader, buttonClass, cardClass } from '@/components/ui';
import { CalendarClock, UserPlus, Search, Users } from 'lucide-react';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
] as const;

/**
 * Customers or vendors list with search and status filter (/customers, /vendors)
 */
export async function ContactsView({ kind, q, status }: { kind: ContactKind; q?: string; status?: string }) {
  const terms = SIDES[kind];
  const query = q?.trim() || '';
  const selectedStatus = FILTERS.some((f) => f.value === status) ? status! : 'all';

  const allContacts = await getCustomerCards(kind, query);
  const filtered = selectedStatus === 'all' ? allContacts : allContacts.filter((c) => c.status === selectedStatus);

  const counts: Record<string, number> = {
    all: allContacts.length,
    overdue: allContacts.filter((c) => c.status === 'overdue').length,
    pending: allContacts.filter((c) => c.status === 'pending').length,
    paid: allContacts.filter((c) => c.status === 'paid').length,
  };

  const filterHref = (value: string) => {
    const params = new URLSearchParams();
    if (value !== 'all') params.set('status', value);
    if (query) params.set('q', query);
    const qs = params.toString();
    return qs ? `${terms.base}?${qs}` : terms.base;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={terms.Many}
        description={`${counts.all} ${counts.all === 1 ? 'account' : 'accounts'}`}
        actions={
          <>
            {kind === 'vendor' && (
              <Link href={terms.overdueHref} className={buttonClass('secondary')}>
                <CalendarClock className="w-4 h-4" />
                {terms.overdueTitle}
              </Link>
            )}
            <Link href={`${terms.base}/new`} className={buttonClass('primary')}>
              <UserPlus className="w-4 h-4" />
              New {terms.One}
            </Link>
          </>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <form method="GET" role="search" className="relative w-full md:max-w-sm">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search name, phone or address"
            aria-label={`Search ${terms.many}`}
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-zinc-300 bg-white text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          {selectedStatus !== 'all' && <input type="hidden" name="status" value={selectedStatus} />}
        </form>

        <div className="flex gap-1 p-1 rounded-lg bg-zinc-100 overflow-x-auto self-start md:self-auto">
          {FILTERS.map((f) => {
            const active = selectedStatus === f.value;
            return (
              <Link
                key={f.value}
                href={filterHref(f.value)}
                aria-current={active ? 'page' : undefined}
                className={`h-8 px-3 rounded-md text-sm font-medium whitespace-nowrap flex items-center gap-1.5 ${
                  active ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {f.label}
                <span className="text-xs text-zinc-400 tabular-nums">{counts[f.value]}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={cardClass}>
          <EmptyState
            icon={<Users className="w-5 h-5" />}
            title={
              query
                ? `No ${terms.many} match “${query}”`
                : counts.all === 0
                ? `No ${terms.many} yet`
                : `No ${terms.many} in this filter`
            }
            description={
              counts.all === 0 && !query
                ? `Add your first ${terms.one} to start recording credit ${terms.entry}s.`
                : undefined
            }
            action={
              query ? (
                <Link href={terms.base} className={buttonClass('secondary')}>
                  Clear search
                </Link>
              ) : counts.all === 0 ? (
                <Link href={`${terms.base}/new`} className={buttonClass('primary')}>
                  <UserPlus className="w-4 h-4" />
                  Add {terms.one}
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <CustomerCard key={c.customer_id} kind={kind} customer={c} />
          ))}
        </div>
      )}
    </div>
  );
}
