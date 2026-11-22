-- Profit and loss.
--
-- 1. materials.cost_price: what one unit of a product costs you to make (raw material,
--    labour, power…). Used for the item-wise margin, and to estimate the cost of what was
--    sold in a month that has no stock count yet.
-- 2. business_entries: money that is not a sale, purchase or party payment:
--      * 'expense'    rent, salaries, electricity… (lowers net profit)
--      * 'investment' money the owner puts into the business (not income)
--      * 'withdrawal' money the owner takes out (not an expense)
-- 3. stock_counts: the value of stock in hand at the end of a month (raw material and
--    finished goods), one per month. A month's cost of goods sold is
--      opening stock (last month's count) + purchases − closing stock (this month's count)
--
-- Safe to run more than once.

-- 1. Cost price per product ------------------------------------------------------------

alter table materials add column if not exists cost_price numeric(14,2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'materials_cost_price_check') then
    alter table materials add constraint materials_cost_price_check check (cost_price is null or cost_price >= 0);
  end if;
end $$;

-- 2. Expenses, owner investment and withdrawals -------------------------------------------

create table if not exists business_entries (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references profiles (id) on delete cascade,
  kind        text not null check (kind in ('expense', 'investment', 'withdrawal')),
  entry_date  date not null,
  amount      numeric(14,2) not null check (amount > 0),
  category    text check (category is null or length(category) <= 60),
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_business_entries_owner_date on business_entries (owner_id, entry_date);

-- 3. Month-end stock counts ----------------------------------------------------------------

create table if not exists stock_counts (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references profiles (id) on delete cascade,
  month       date not null check (extract(day from month) = 1), -- first day of the month counted
  items       jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  total       numeric(14,2) not null check (total >= 0),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner_id, month)
);

-- Row Level Security: same rule as the other ledger tables ------------------------------------

alter table business_entries enable row level security;
alter table stock_counts enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['business_entries', 'stock_counts'] loop
    execute format('drop policy if exists "Own ledger, admins all ledgers" on %I', t);
    execute format(
      'create policy "Own ledger, admins all ledgers" on %I for all to authenticated
         using ((owner_id = (select auth.uid()) and (select public.is_active_user())) or (select public.is_admin()))
         with check ((owner_id = (select auth.uid()) and (select public.is_active_user())) or (select public.is_admin()))',
      t
    );
  end loop;
end $$;

revoke all on business_entries, stock_counts from anon;
grant select, insert, update, delete on business_entries, stock_counts to authenticated;
