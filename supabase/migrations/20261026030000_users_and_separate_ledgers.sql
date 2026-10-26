-- Follow-up to 20261026020000_materials_and_payment_sale.sql
--
-- Several users, each with their own separate ledger:
-- 1. profiles: one row per Supabase Auth user with a role ('admin' or 'user') and an
--    active flag. Users that already exist become admins, and the first user created
--    in an empty project becomes an admin; everyone added later starts as a user.
-- 2. customers, credit_sales, payments and materials get owner_id (the ledger they
--    belong to). Existing rows are given to the first admin.
-- 3. Row Level Security: users see and change only their own ledger; admins can see
--    and change every ledger. Disabled users see nothing.
-- 4. The views expose owner_id and monthly_report takes the ledger owner.
--
-- If your tables already have data, create your first user (Authentication → Users →
-- Add user) before running this. Safe to run more than once.

-- 1. Profiles --------------------------------------------------------------------

create table if not exists profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null default '',
  full_name   text not null default '',
  role        text not null default 'user' check (role in ('admin', 'user')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table profiles enable row level security;

-- Existing users become admins
insert into profiles (id, email, role, created_at)
select id, coalesce(email, ''), 'admin', created_at
from auth.users
on conflict (id) do nothing;

-- Is the signed-in user an active admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active
  )
$$;

-- Is the signed-in user's account enabled?
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active
  )
$$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_active_user() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_user() to authenticated;

-- Users read their own profile; admins read all. Changes go through the app's
-- server (service role), so there are no insert/update/delete policies.
drop policy if exists "Read own profile, admins read all" on profiles;
create policy "Read own profile, admins read all"
  on profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

grant select on profiles to authenticated;

-- New auth users get a profile automatically
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when exists (select 1 from public.profiles where role = 'admin') then 'user' else 'admin' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep the profile email in step with the login email
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- 2. owner_id on every ledger table ------------------------------------------------

do $$
declare
  first_admin uuid := (select id from profiles where role = 'admin' order by created_at, id limit 1);
  t text;
  missing bigint;
begin
  foreach t in array array['customers', 'credit_sales', 'payments', 'materials'] loop
    execute format(
      'alter table %I add column if not exists owner_id uuid default auth.uid() references profiles (id) on delete cascade',
      t
    );
    execute format('update %I set owner_id = $1 where owner_id is null', t) using first_admin;
    execute format('select count(*) from %I where owner_id is null', t) into missing;
    if missing > 0 then
      raise exception 'Table % has data but there is no user yet. Create your first user in Authentication → Users, then run this migration again.', t;
    end if;
    execute format('alter table %I alter column owner_id set not null', t);
    execute format('create index if not exists idx_%s_owner on %I (owner_id)', t, t);
  end loop;
end $$;

-- Sales and payments must belong to the same ledger as their customer
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'customers_id_owner_key') then
    alter table customers add constraint customers_id_owner_key unique (id, owner_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'credit_sales_customer_owner_fkey') then
    alter table credit_sales
      add constraint credit_sales_customer_owner_fkey
      foreign key (customer_id, owner_id) references customers (id, owner_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_customer_owner_fkey') then
    alter table payments
      add constraint payments_customer_owner_fkey
      foreign key (customer_id, owner_id) references customers (id, owner_id);
  end if;
end $$;

-- Replaced by the keys above. These were "on delete restrict", which would block
-- deleting a user together with their whole ledger.
alter table credit_sales drop constraint if exists credit_sales_customer_id_fkey;
alter table payments drop constraint if exists payments_customer_id_fkey;

-- Material names are unique per ledger, not across all users
drop index if exists materials_name_key;
create unique index if not exists materials_owner_name_key on materials (owner_id, lower(trim(name)));

-- 3. Row Level Security -------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['customers', 'credit_sales', 'payments', 'materials'] loop
    execute format('drop policy if exists %I on %I', 'Owner has full access to ' || t, t);
    execute format('drop policy if exists "Own ledger, admins all ledgers" on %I', t);
    execute format(
      'create policy "Own ledger, admins all ledgers" on %I for all to authenticated
         using ((owner_id = (select auth.uid()) and (select public.is_active_user())) or (select public.is_admin()))
         with check ((owner_id = (select auth.uid()) and (select public.is_active_user())) or (select public.is_admin()))',
      t
    );
  end loop;
end $$;

-- 4. Views and report: same columns as before plus owner_id at the end ---------------

create or replace view sale_balances
with (security_invoker = true) as
with linked as (
  select sale_id, sum(amount) as paid
  from payments
  where sale_id is not null
  group by sale_id
),
s as (
  select cs.*,
    least(cs.amount, coalesce(l.paid, 0)) as linked_paid,
    greatest(0, coalesce(l.paid, 0) - cs.amount) as linked_excess
  from credit_sales cs
  left join linked l on l.sale_id = cs.id
),
ordered as (
  select s.*,
    coalesce(sum(s.amount - s.linked_paid) over (
      partition by s.customer_id
      order by s.sale_date, s.created_at, s.id
      rows between unbounded preceding and 1 preceding
    ), 0) as prior_remaining
  from s
),
pool as (
  -- money available for FIFO: unlinked payments + overpayment on linked sales
  select customer_id, sum(amt) as amount
  from (
    select customer_id, amount as amt from payments where sale_id is null
    union all
    select customer_id, linked_excess from s where linked_excess > 0
  ) x
  group by customer_id
)
select
  o.id,
  o.customer_id,
  o.sale_date,
  o.material,
  o.quantity,
  o.unit,
  o.rate,
  o.amount,
  o.credit_days,
  o.due_date,
  o.notes,
  o.created_at,
  o.linked_paid + least(o.amount - o.linked_paid, greatest(0, coalesce(p.amount, 0) - o.prior_remaining)) as paid_amount,
  o.amount - o.linked_paid - least(o.amount - o.linked_paid, greatest(0, coalesce(p.amount, 0) - o.prior_remaining)) as outstanding,
  greatest(0, app_today() - o.due_date) as days_overdue,
  o.owner_id
from ordered o
left join pool p on p.customer_id = o.customer_id;

create or replace view customer_summary
with (security_invoker = true) as
with bal as (
  select
    customer_id,
    sum(amount) as total_sale,
    sum(outstanding) as outstanding,
    sum(outstanding) filter (where days_overdue > 0) as overdue,
    min(due_date) filter (where outstanding > 0) as next_due_date
  from sale_balances
  group by customer_id
),
paid as (
  select customer_id, sum(amount) as total_paid
  from payments
  group by customer_id
)
select
  c.id as customer_id,
  c.name,
  c.phone,
  c.address,
  coalesce(b.total_sale, 0) as total_credit_sale,
  coalesce(p.total_paid, 0) as payment_received,
  coalesce(b.outstanding, 0) as outstanding,
  coalesce(b.overdue, 0) as overdue,
  greatest(0, coalesce(p.total_paid, 0) - coalesce(b.total_sale, 0)) as advance,
  b.next_due_date,
  case
    when coalesce(b.outstanding, 0) = 0 then 'paid'
    when coalesce(b.overdue, 0) > 0 then 'overdue'
    else 'pending'
  end as status,
  c.owner_id
from customers c
left join bal b on b.customer_id = c.id
left join paid p on p.customer_id = c.id;

create or replace view overdue_aging
with (security_invoker = true) as
select
  customer_id,
  credit_days,
  sum(outstanding)                                                          as total_outstanding,
  coalesce(sum(outstanding) filter (where days_overdue > 0), 0)             as total_overdue,
  coalesce(sum(outstanding) filter (where days_overdue between 1 and 30), 0)  as d1_30,
  coalesce(sum(outstanding) filter (where days_overdue between 31 and 60), 0) as d31_60,
  coalesce(sum(outstanding) filter (where days_overdue between 61 and 90), 0) as d61_90,
  coalesce(sum(outstanding) filter (where days_overdue > 90), 0)            as d90_plus,
  owner_id
from sale_balances
where outstanding > 0
group by customer_id, credit_days, owner_id;

-- monthly_report: totals for one ledger for the month containing p_month
drop function if exists monthly_report(date);
create or replace function monthly_report(p_month date, p_owner uuid)
returns table (
  material_sold numeric,
  payment_received numeric,
  payment_due numeric,
  balance_remaining numeric
)
language sql
stable
security invoker
as $$
  select
    coalesce((select sum(amount) from credit_sales
      where owner_id = p_owner and date_trunc('month', sale_date) = date_trunc('month', p_month)), 0),
    coalesce((select sum(amount) from payments
      where owner_id = p_owner and date_trunc('month', payment_date) = date_trunc('month', p_month)), 0),
    coalesce((select sum(amount) from credit_sales
      where owner_id = p_owner and date_trunc('month', due_date) = date_trunc('month', p_month)), 0),
    coalesce((select sum(outstanding) from sale_balances where owner_id = p_owner), 0)
$$;

grant select on sale_balances, customer_summary, overdue_aging to authenticated;
grant execute on function monthly_report(date, uuid) to authenticated;
