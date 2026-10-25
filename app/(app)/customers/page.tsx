import React from 'react';
import Link from 'next/link';
import { getCustomerCards } from '@/lib/queries';
import { CustomerCard } from '@/components/CustomerCard';
import { UserPlus, Search, Users, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface CustomersPageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const resolvedParams = await searchParams;
  const query = resolvedParams.q || '';
  const selectedStatus = resolvedParams.status || 'all';

  const allCustomers = await getCustomerCards(query);

  const filteredCustomers = allCustomers.filter((c) => {
    if (selectedStatus === 'all') return true;
    return c.status === selectedStatus;
  });

  const filterHref = (status: string) => {
    const params = new URLSearchParams({ status });
    if (query) params.set('q', query);
    return `/customers?${params.toString()}`;
  };

  const countOverdue = allCustomers.filter((c) => c.status === 'overdue').length;
  const countPending = allCustomers.filter((c) => c.status === 'pending').length;
  const countPaid = allCustomers.filter((c) => c.status === 'paid').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900">
            Customers & Ledgers
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Browse customer accounts, view date-wise credit history, or add new customers
          </p>
        </div>

        <Link
          href="/customers/new"
          className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4 text-emerald-400" />
          <span>Add New Customer</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input */}
        <form method="GET" className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search customer name, phone, or address..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          {selectedStatus !== 'all' && (
            <input type="hidden" name="status" value={selectedStatus} />
          )}
        </form>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-semibold">
          <Link
            href={filterHref('all')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
              selectedStatus === 'all'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            All ({allCustomers.length})
          </Link>
          <Link
            href={filterHref('overdue')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center gap-1 ${
              selectedStatus === 'overdue'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Overdue ({countOverdue})</span>
          </Link>
          <Link
            href={filterHref('pending')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center gap-1 ${
              selectedStatus === 'pending'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending ({countPending})</span>
          </Link>
          <Link
            href={filterHref('paid')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center gap-1 ${
              selectedStatus === 'paid'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Paid ({countPaid})</span>
          </Link>
        </div>
      </div>

      {/* Customer Cards Grid */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200/90 p-12 text-center space-y-3">
          <Users className="w-10 h-10 text-zinc-300 mx-auto" />
          <h3 className="text-base font-bold text-zinc-800">No Customers Found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            {query
              ? `No customer matches the search "${query}". Try clearing the search.`
              : 'No customer accounts in this filter yet.'}
          </p>
          <Link
            href="/customers/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create First Customer</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCustomers.map((c) => (
            <CustomerCard key={c.customer_id} customer={c} />
          ))}
        </div>
      )}
    </div>
  );
}
