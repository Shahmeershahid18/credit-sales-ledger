import React from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getAuthState } from '@/lib/auth';
import { getUserList } from '@/lib/queries';
import { isUserAdminConfigured } from '@/lib/supabase/admin';
import { UsersManager } from '@/components/UsersManager';
import { PageHeader, cardClass } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Users' };

export default async function UsersPage() {
  const auth = await getAuthState();

  if (auth.mode === 'demo') {
    return (
      <div className="space-y-6">
        <PageHeader title="Users" />
        <div className={`${cardClass} p-5 sm:p-6 text-sm text-zinc-600`}>
          User accounts are available once Supabase is connected. The app is running in demo mode.
        </div>
      </div>
    );
  }

  // Non-admins get a plain "page not found", so the page doesn't reveal it exists
  if (auth.mode !== 'live' || auth.user.role !== 'admin') {
    notFound();
  }

  const users = await getUserList();

  return (
    <UsersManager
      users={users}
      currentUserId={auth.user.id}
      viewingId={auth.owner.id}
      canManage={isUserAdminConfigured()}
    />
  );
}
