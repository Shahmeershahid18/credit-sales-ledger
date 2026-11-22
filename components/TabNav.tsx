import React from 'react';
import Link from 'next/link';

/** A row of link tabs, one of them active (the page's current choice) */
export function TabNav({ label, items }: { label: string; items: { label: string; href: string; active: boolean }[] }) {
  return (
    <nav aria-label={label} className="flex gap-1 p-1 rounded-lg bg-zinc-100 w-fit max-w-full overflow-x-auto">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={`h-8 px-3 sm:px-4 rounded-md text-sm font-medium flex items-center whitespace-nowrap ${
            item.active ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
