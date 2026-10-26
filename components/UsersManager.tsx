'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Ban, CircleCheck, Eye, KeyRound, Loader2, Trash2, UserPlus, Wand2 } from 'lucide-react';
import { Profile, UserListItem, UserRole } from '@/lib/types';
import { displayName, formatRs } from '@/lib/format';
import {
  createUserAction,
  deleteUserAction,
  openLedgerAction,
  setUserActiveAction,
  setUserPasswordAction,
  updateUserAction,
} from '@/app/actions/users';
import { Field, FormError, PageHeader, Segmented, buttonClass, buttonStyles, cardClass, inputClass } from './ui';

interface UsersManagerProps {
  users: UserListItem[];
  currentUserId: string;
  viewingId: string;
  canManage: boolean; // service role key is set
}

const ROLE_OPTIONS: { label: string; value: UserRole }[] = [
  { label: 'User', value: 'user' },
  { label: 'Admin', value: 'admin' },
];

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const values = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(values, (v) => chars[v % chars.length]).join('');
}

function PasswordInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      <input
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        placeholder="At least 8 characters"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} font-mono`}
      />
      <button
        type="button"
        onClick={() => onChange(generatePassword())}
        className={buttonClass('secondary', 'h-10 shrink-0')}
        title="Generate a password"
      >
        <Wand2 className="w-4 h-4" />
        <span className="hidden sm:inline">Generate</span>
      </button>
    </div>
  );
}

function Badge({ tone, children }: { tone: 'violet' | 'zinc' | 'rose' | 'sky'; children: React.ReactNode }) {
  const tones = {
    violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
    zinc: 'bg-zinc-100 text-zinc-600 ring-zinc-500/20',
    rose: 'bg-rose-50 text-rose-700 ring-rose-600/20',
    sky: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  };
  return <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ring-1 ring-inset whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

export function UsersManager({ users: initialUsers, currentUserId, viewingId, canManage }: UsersManagerProps) {
  const [users, setUsers] = useState(initialUsers);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const replaceUser = (u: Partial<UserListItem> & { id: string }) =>
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...u } : x)));

  const admins = users.filter((u) => u.role === 'admin').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={`${users.length} ${users.length === 1 ? 'account' : 'accounts'} · ${admins} ${admins === 1 ? 'admin' : 'admins'} · every user has a separate ledger`}
        actions={
          canManage && !adding ? (
            <button
              type="button"
              onClick={() => {
                setAdding(true);
                setNotice(null);
              }}
              className={buttonClass('primary')}
            >
              <UserPlus className="w-4 h-4" />
              Add user
            </button>
          ) : undefined
        }
      />

      {!canManage && (
        <div className="px-3.5 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm space-y-1">
          <p className="font-medium">One more setting is needed to add users or reset passwords</p>
          <p>
            Add <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code> to <code className="font-mono text-xs">.env.local</code> (Supabase →
            Project Settings → API keys → service_role) and restart the app. Keep this key secret.
          </p>
        </div>
      )}

      {notice && (
        <p role="status" className="px-3.5 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-2">
          <CircleCheck className="w-4 h-4 shrink-0 mt-0.5" />
          {notice}
        </p>
      )}

      {adding && (
        <AddUserForm
          onCancel={() => setAdding(false)}
          onCreated={(user) => {
            setUsers((prev) => [...prev, { ...user, customerCount: 0, outstanding: 0, overdue: 0 }]);
            setAdding(false);
            setNotice(`${user.email} can now sign in with the password you set. Share it with them privately.`);
          }}
        />
      )}

      <div className={`${cardClass} divide-y divide-zinc-100`}>
        {users.map((u) => (
          <UserRow
            key={u.id}
            user={u}
            isSelf={u.id === currentUserId}
            isViewing={u.id === viewingId}
            canManage={canManage}
            open={openId === u.id}
            onToggle={() => setOpenId(openId === u.id ? null : u.id)}
            onChange={replaceUser}
            onDeleted={(email) => {
              setUsers((prev) => prev.filter((x) => x.id !== u.id));
              setOpenId(null);
              setNotice(`${email} and their ledger were deleted.`);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function AddUserForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (user: Profile) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(generatePassword);
  const [role, setRole] = useState<UserRole>('user');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await createUserAction({ email, full_name: fullName, password, role });
    setBusy(false);
    if (!result.success) return setError(result.error);
    onCreated(result.user);
  };

  return (
    <form onSubmit={submit} className={`${cardClass} p-5 sm:p-6 space-y-4`} noValidate>
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Add user</h2>
        <p className="text-sm text-zinc-500 mt-0.5">They get an empty ledger of their own and sign in with this email and password.</p>
      </div>
      <FormError message={error} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name" htmlFor="new_name" optional>
          <input id="new_name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} autoFocus />
        </Field>
        <Field label="Email" htmlFor="new_email">
          <input
            id="new_email"
            type="email"
            autoComplete="off"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Field label="Password" htmlFor="new_password">
          <PasswordInput id="new_password" value={password} onChange={setPassword} />
        </Field>
        <Field label="Role">
          <Segmented<UserRole> ariaLabel="Role" value={role} onChange={setRole} options={ROLE_OPTIONS} />
        </Field>
      </div>
      <p className="text-xs text-zinc-500">
        {role === 'admin'
          ? 'Admins have their own ledger, can open and edit every user’s ledger, and can manage users.'
          : 'Users see only their own ledger. They can change their password from the Account page.'}
      </p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={buttonClass('ghost')}>
          Cancel
        </button>
        <button type="submit" disabled={busy} className={buttonClass('primary')}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Add user
        </button>
      </div>
    </form>
  );
}

interface UserRowProps {
  user: UserListItem;
  isSelf: boolean;
  isViewing: boolean;
  canManage: boolean;
  open: boolean;
  onToggle: () => void;
  onChange: (u: Partial<UserListItem> & { id: string }) => void;
  onDeleted: (email: string) => void;
}

function UserRow({ user, isSelf, isViewing, canManage, open, onToggle, onChange, onDeleted }: UserRowProps) {
  const name = displayName(user);

  return (
    <div className={user.active ? '' : 'bg-zinc-50/70'}>
      <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span
            className={`w-9 h-9 rounded-full text-sm font-semibold flex items-center justify-center shrink-0 ${
              user.active ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-500'
            }`}
          >
            {name[0].toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`text-sm font-medium truncate ${user.active ? 'text-zinc-900' : 'text-zinc-500'}`}>{name}</span>
              {user.role === 'admin' && <Badge tone="violet">Admin</Badge>}
              {isSelf && <Badge tone="zinc">You</Badge>}
              {!user.active && <Badge tone="rose">Disabled</Badge>}
              {isViewing && !isSelf && <Badge tone="sky">Open now</Badge>}
            </div>
            {user.full_name.trim() && <p className="text-xs text-zinc-500 truncate">{user.email}</p>}
            <p className="text-xs text-zinc-500">
              {user.customerCount} {user.customerCount === 1 ? 'customer' : 'customers'}
              {user.outstanding > 0 && (
                <>
                  {' · '}
                  <span className="tabular-nums whitespace-nowrap">{formatRs(user.outstanding)} due</span>
                </>
              )}
              {user.overdue > 0 && (
                <span className="text-rose-600 tabular-nums whitespace-nowrap"> · {formatRs(user.overdue)} overdue</span>
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          {isViewing ? (
            <Link href="/dashboard" className={buttonClass('secondary')}>
              <Eye className="w-4 h-4" />
              {isSelf ? 'My ledger' : 'Viewing'}
            </Link>
          ) : (
            <form action={openLedgerAction.bind(null, isSelf ? null : user.id)}>
              <button type="submit" className={buttonClass('secondary', 'w-full')}>
                <Eye className="w-4 h-4" />
                {isSelf ? 'My ledger' : 'Open ledger'}
              </button>
            </form>
          )}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className={buttonClass(open ? 'primary' : 'secondary')}
          >
            {open ? 'Close' : 'Manage'}
          </button>
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 divide-y divide-zinc-200">
            <DetailsSection user={user} isSelf={isSelf} canManage={canManage} onChange={onChange} />
            {isSelf ? (
              <p className="p-4 text-sm text-zinc-600">
                To change your own password, use the{' '}
                <Link href="/account" className="font-medium text-emerald-700 hover:text-emerald-800">
                  Account page
                </Link>
                .
              </p>
            ) : (
              <>
                <PasswordSection user={user} canManage={canManage} />
                <AccessSection user={user} canManage={canManage} onChange={onChange} onDeleted={onDeleted} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionStatus({ error, saved }: { error: string | null; saved: string | null }) {
  if (error) return <p className="text-xs text-rose-700">{error}</p>;
  if (saved) return <p className="text-xs text-emerald-700">{saved}</p>;
  return null;
}

function DetailsSection({
  user,
  isSelf,
  canManage,
  onChange,
}: {
  user: UserListItem;
  isSelf: boolean;
  canManage: boolean;
  onChange: UserRowProps['onChange'];
}) {
  const [fullName, setFullName] = useState(user.full_name);
  const [role, setRole] = useState<UserRole>(user.role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const dirty = fullName.trim() !== user.full_name || role !== user.role;

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(null);
    const result = await updateUserAction(user.id, { full_name: fullName, role });
    setBusy(false);
    if (!result.success) return setError(result.error);
    onChange(result.user);
    setSaved('Saved');
  };

  return (
    <div className="p-4 space-y-3">
      <p className="text-sm font-medium text-zinc-900">Details</p>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_12rem] gap-3">
        <Field label="Name" htmlFor={`name-${user.id}`}>
          <input
            id={`name-${user.id}`}
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={!canManage}
            className={inputClass}
          />
        </Field>
        <Field label="Role" hint={isSelf ? 'Your own role is fixed' : undefined}>
          {isSelf ? (
            <p className="h-10 px-3 rounded-lg border border-zinc-200 bg-zinc-100 text-sm text-zinc-500 flex items-center">Admin</p>
          ) : (
            <Segmented<UserRole> ariaLabel="Role" value={role} onChange={canManage ? setRole : () => {}} options={ROLE_OPTIONS} />
          )}
        </Field>
      </div>
      <div className="flex items-center justify-end gap-3">
        <SectionStatus error={error} saved={saved} />
        <button type="button" onClick={save} disabled={!canManage || !dirty || busy} className={buttonClass('primary', 'h-8 px-3')}>
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save
        </button>
      </div>
    </div>
  );
}

function PasswordSection({ user, canManage }: { user: UserListItem; canManage: boolean }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(null);
    const result = await setUserPasswordAction(user.id, password);
    setBusy(false);
    if (!result.success) return setError(result.error);
    setSaved('Password set. Share it with them privately.');
  };

  return (
    <div className="p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-zinc-900">Reset password</p>
        <p className="text-xs text-zinc-500">Sets a new password for {user.email}. They can change it later from their Account page.</p>
      </div>
      <PasswordInput id={`password-${user.id}`} value={password} onChange={setPassword} />
      <div className="flex items-center justify-end gap-3">
        <SectionStatus error={error} saved={saved} />
        <button type="button" onClick={save} disabled={!canManage || !password || busy} className={buttonClass('primary', 'h-8 px-3')}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
          Set password
        </button>
      </div>
    </div>
  );
}

function AccessSection({
  user,
  canManage,
  onChange,
  onDeleted,
}: {
  user: UserListItem;
  canManage: boolean;
  onChange: UserRowProps['onChange'];
  onDeleted: UserRowProps['onDeleted'];
}) {
  const [busy, setBusy] = useState<'active' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleActive = async () => {
    setBusy('active');
    setError(null);
    const result = await setUserActiveAction(user.id, !user.active);
    setBusy(null);
    if (!result.success) return setError(result.error);
    onChange(result.user);
  };

  const remove = async () => {
    const what = user.customerCount
      ? `This also deletes their ledger: ${user.customerCount} ${user.customerCount === 1 ? 'customer' : 'customers'} with all sales and payments.`
      : 'Their ledger is empty.';
    if (!window.confirm(`Delete ${user.email}? ${what} This cannot be undone.`)) return;
    setBusy('delete');
    setError(null);
    const result = await deleteUserAction(user.id);
    setBusy(null);
    if (!result.success) return setError(result.error);
    onDeleted(user.email);
  };

  return (
    <div className="p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-zinc-900">Access</p>
        <p className="text-xs text-zinc-500">
          {user.active
            ? 'Disabling signs them out and blocks sign-in. Their ledger is kept and can be enabled again.'
            : 'This account is disabled. Enable it to let them sign in again.'}
        </p>
      </div>
      {error && <p className="text-xs text-rose-700">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={toggleActive} disabled={!canManage || busy !== null} className={buttonClass('secondary', 'h-8 px-3')}>
          {busy === 'active' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : user.active ? (
            <Ban className="w-3.5 h-3.5" />
          ) : (
            <CircleCheck className="w-3.5 h-3.5" />
          )}
          {user.active ? 'Disable' : 'Enable'}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={!canManage || busy !== null}
          className={`${buttonStyles.base} h-8 px-3 bg-white text-rose-700 border border-rose-200 hover:bg-rose-50`}
        >
          {busy === 'delete' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          Delete user
        </button>
      </div>
    </div>
  );
}
