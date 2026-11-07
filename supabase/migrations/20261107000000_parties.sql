-- Follow-up to 20261031000000_vendors.sql
--
-- One party, two roles, one combined ledger:
-- 1. A contact (party) can be a customer, a vendor or both: customers.is_customer and
--    customers.is_vendor replace the fixed customers.kind.
-- 2. Every entry says which side of the party's account it is on:
--    credit_sales.kind  'customer' = sale,             'vendor' = purchase
--    payments.kind      'customer' = payment received, 'vendor' = payment made
--    Recording an entry switches on the matching role. A role with entries cannot be
--    switched off.
-- 3. Settlement: settle_party() records an adjustment that sets purchases off against
--    sales (two payments with method 'adjustment' and one settlement_id), so both
--    sides' bills are cleared oldest first. merge_parties() combines a customer and a
--    vendor that are the same business.
-- 4. Views: same columns as before. Payments are matched to bills of their own side,
--    customer_summary has one row per party and side, plus is_customer/is_vendor.
--    monthly_report counts cash only (adjustments are not money received or paid).
--
-- Existing contacts keep their side and all their entries. Safe to run more than once.

-- 1. Roles on the party ------------------------------------------------------------------

alter table customers add column if not exists is_customer boolean not null default true;
alter table customers add column if not exists is_vendor boolean not null default false;

-- 2. Side of every entry -------------------------------------------------------------------

alter table credit_sales add column if not exists kind text not null default 'customer';
alter table payments add column if not exists kind text not null default 'customer';
alter table payments add column if not exists settlement_id uuid;

-- Copy the side from the old fixed contact kind (only while that column still exists)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customers' and column_name = 'kind'
  ) then
    update customers set is_customer = (kind = 'customer'), is_vendor = (kind = 'vendor');
    update credit_sales s set kind = c.kind from customers c where c.id = s.customer_id and s.kind is distinct from c.kind;
    update payments p set kind = c.kind from customers c where c.id = p.customer_id and p.kind is distinct from c.kind;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'customers_has_role') then
    alter table customers add constraint customers_has_role check (is_customer or is_vendor);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'credit_sales_kind_check') then
    alter table credit_sales add constraint credit_sales_kind_check check (kind in ('customer', 'vendor'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_kind_check') then
    alter table payments add constraint payments_kind_check check (kind in ('customer', 'vendor'));
  end if;
  -- A payment linked to a bill must be on the same side as the bill
  if not exists (select 1 from pg_constraint where conname = 'credit_sales_id_customer_kind_key') then
    alter table credit_sales add constraint credit_sales_id_customer_kind_key unique (id, customer_id, kind);
  end if;
end $$;

-- Replaces payments_sale_fkey (sale_id, customer_id). ON UPDATE CASCADE lets
-- merge_parties move bills to another party together with their linked payments.
alter table payments drop constraint if exists payments_sale_fkey;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_sale_side_fkey') then
    alter table payments
      add constraint payments_sale_side_fkey
      foreign key (sale_id, customer_id, kind) references credit_sales (id, customer_id, kind)
      on update cascade
      on delete set null (sale_id);
  end if;
end $$;

create index if not exists idx_credit_sales_owner_kind on credit_sales (owner_id, kind);
create index if not exists idx_payments_owner_kind on payments (owner_id, kind);
create index if not exists idx_payments_settlement on payments (settlement_id);

-- Recording an entry switches on the matching role
create or replace function public.ensure_party_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'vendor' then
    update public.customers set is_vendor = true where id = new.customer_id and not is_vendor;
  else
    update public.customers set is_customer = true where id = new.customer_id and not is_customer;
  end if;
  return new;
end;
$$;

drop trigger if exists credit_sales_party_role on credit_sales;
create trigger credit_sales_party_role
  before insert or update of customer_id, kind on credit_sales
  for each row execute function public.ensure_party_role();

drop trigger if exists payments_party_role on payments;
create trigger payments_party_role
  before insert or update of customer_id, kind on payments
  for each row execute function public.ensure_party_role();

-- A role that has entries cannot be switched off
create or replace function public.keep_used_party_roles()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_customer and not new.is_customer and (
    exists (select 1 from public.credit_sales where customer_id = new.id and kind = 'customer')
    or exists (select 1 from public.payments where customer_id = new.id and kind = 'customer')
  ) then
    raise exception 'This party has sales or payments received, so it must stay a customer.';
  end if;
  if old.is_vendor and not new.is_vendor and (
    exists (select 1 from public.credit_sales where customer_id = new.id and kind = 'vendor')
    or exists (select 1 from public.payments where customer_id = new.id and kind = 'vendor')
  ) then
    raise exception 'This party has purchases or payments made, so it must stay a vendor.';
  end if;
  return new;
end;
$$;

drop trigger if exists customers_keep_used_roles on customers;
create trigger customers_keep_used_roles
  before update of is_customer, is_vendor on customers
  for each row execute function public.keep_used_party_roles();

-- The fixed kind is replaced by the roles
drop trigger if exists contact_kind_is_fixed on customers;
drop function if exists public.prevent_contact_kind_change();

-- 3. Views (same columns; the side now comes from each entry) -------------------------------

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
      partition by s.customer_id, s.kind
      order by s.sale_date, s.created_at, s.id
      rows between unbounded preceding and 1 preceding
    ), 0) as prior_remaining
  from s
),
pool as (
  -- money available for FIFO on each side: unlinked payments + overpayment on linked bills
  select customer_id, kind, sum(amt) as amount
  from (
    select customer_id, kind, amount as amt from payments where sale_id is null
    union all
    select customer_id, kind, linked_excess from s where linked_excess > 0
  ) x
  group by customer_id, kind
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
  o.owner_id,
  o.kind
from ordered o
left join pool p on p.customer_id = o.customer_id and p.kind = o.kind;

-- One row per party and side it has: a party that is both appears twice
create or replace view customer_summary
with (security_invoker = true) as
with sides as (
  select c.id, c.name, c.phone, c.address, c.owner_id, c.is_customer, c.is_vendor, 'customer'::text as side
  from customers c where c.is_customer
  union all
  select c.id, c.name, c.phone, c.address, c.owner_id, c.is_customer, c.is_vendor, 'vendor'::text as side
  from customers c where c.is_vendor
),
bal as (
  select
    customer_id,
    kind,
    sum(amount) as total_sale,
    sum(outstanding) as outstanding,
    sum(outstanding) filter (where days_overdue > 0) as overdue,
    min(due_date) filter (where outstanding > 0) as next_due_date
  from sale_balances
  group by customer_id, kind
),
paid as (
  select customer_id, kind, sum(amount) as total_paid
  from payments
  group by customer_id, kind
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
  c.owner_id,
  c.side as kind,
  c.is_customer,
  c.is_vendor
from sides c
left join bal b on b.customer_id = c.id and b.kind = c.side
left join paid p on p.customer_id = c.id and p.kind = c.side;

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
  owner_id,
  kind
from sale_balances
where outstanding > 0
group by customer_id, credit_days, owner_id, kind;

-- Nothing depends on the old column any more
drop index if exists idx_customers_owner_kind;
alter table customers drop constraint if exists customers_kind_check;
alter table customers drop column if exists kind;

-- monthly_report: one side of one ledger. Received/paid count money only, not adjustments.
create or replace function monthly_report(p_month date, p_owner uuid, p_kind text default 'customer')
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
      where owner_id = p_owner and kind = p_kind
        and date_trunc('month', sale_date) = date_trunc('month', p_month)), 0),
    coalesce((select sum(amount) from payments
      where owner_id = p_owner and kind = p_kind and method <> 'adjustment'
        and date_trunc('month', payment_date) = date_trunc('month', p_month)), 0),
    coalesce((select sum(amount) from credit_sales
      where owner_id = p_owner and kind = p_kind
        and date_trunc('month', due_date) = date_trunc('month', p_month)), 0),
    coalesce((select sum(outstanding) from sale_balances where owner_id = p_owner and kind = p_kind), 0)
$$;

-- 4. Settlement and merge ---------------------------------------------------------------------

-- Sets p_amount of the party's purchases off against its sales: one adjustment on each
-- side, so the oldest unpaid bills on both sides are cleared. Returns the settlement id.
create or replace function settle_party(p_party uuid, p_amount numeric, p_date date, p_notes text default null)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  party customers%rowtype;
  receivable numeric;
  payable numeric;
  settlement uuid := gen_random_uuid();
begin
  select * into party from customers where id = p_party;
  if not found then
    raise exception 'Party not found';
  end if;
  if not (party.is_customer and party.is_vendor) then
    raise exception 'Only a party that is both a customer and a vendor can be settled.';
  end if;

  select coalesce(sum(outstanding) filter (where kind = 'customer'), 0),
         coalesce(sum(outstanding) filter (where kind = 'vendor'), 0)
    into receivable, payable
    from sale_balances where customer_id = p_party;

  if p_amount is null or p_amount <= 0 then
    raise exception 'The adjustment amount must be greater than 0.';
  end if;
  if p_amount > least(receivable, payable) then
    raise exception 'At most % can be adjusted: the smaller of what they owe and what you owe.', least(receivable, payable);
  end if;

  insert into payments (owner_id, customer_id, kind, payment_date, amount, method, notes, settlement_id)
  values
    (party.owner_id, p_party, 'customer', coalesce(p_date, app_today()), p_amount, 'adjustment', p_notes, settlement),
    (party.owner_id, p_party, 'vendor', coalesce(p_date, app_today()), p_amount, 'adjustment', p_notes, settlement);

  return settlement;
end;
$$;

-- Moves every entry of p_merge to p_keep, combines their roles and missing details,
-- then deletes p_merge. Both must be in the same ledger.
create or replace function merge_parties(p_keep uuid, p_merge uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  keep customers%rowtype;
  other customers%rowtype;
begin
  if p_keep = p_merge then
    raise exception 'Choose a different party to merge.';
  end if;
  select * into keep from customers where id = p_keep;
  select * into other from customers where id = p_merge;
  if keep.id is null or other.id is null then
    raise exception 'Party not found';
  end if;
  if keep.owner_id <> other.owner_id then
    raise exception 'Both parties must be in the same ledger.';
  end if;

  update customers set
    is_customer = keep.is_customer or other.is_customer,
    is_vendor = keep.is_vendor or other.is_vendor,
    phone = coalesce(nullif(trim(keep.phone), ''), other.phone),
    address = coalesce(nullif(trim(keep.address), ''), other.address)
  where id = p_keep;

  -- Linked payments follow their bill (ON UPDATE CASCADE), then the rest move
  update credit_sales set customer_id = p_keep where customer_id = p_merge;
  update payments set customer_id = p_keep where customer_id = p_merge;
  delete from customers where id = p_merge;
end;
$$;

revoke execute on function settle_party(uuid, numeric, date, text) from public, anon;
revoke execute on function merge_parties(uuid, uuid) from public, anon;

grant select on sale_balances, customer_summary, overdue_aging to authenticated;
grant execute on function monthly_report(date, uuid, text) to authenticated;
grant execute on function settle_party(uuid, numeric, date, text) to authenticated;
grant execute on function merge_parties(uuid, uuid) to authenticated;
