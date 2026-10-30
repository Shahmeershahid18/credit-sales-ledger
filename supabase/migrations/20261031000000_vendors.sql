-- Follow-up to 20261026030000_users_and_separate_ledgers.sql
--
-- Vendors: the same ledger, the other way round.
-- 1. customers.kind: every contact is either a 'customer' (you sell on credit and
--    receive payments) or a 'vendor' (you buy on credit and make payments).
--    Existing contacts become customers. A contact's kind cannot change later,
--    because its entries mean different things on each side.
--    For a vendor, credit_sales rows are purchases and payments rows are payments made.
-- 2. materials.purchase_rate: a saved material keeps a sale rate and a purchase rate.
-- 3. The views expose kind, and monthly_report takes the side to report on.
--
-- Safe to run more than once.

-- 1. Contact kind ---------------------------------------------------------------------

alter table customers add column if not exists kind text not null default 'customer';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'customers_kind_check') then
    alter table customers add constraint customers_kind_check check (kind in ('customer', 'vendor'));
  end if;
end $$;

create index if not exists idx_customers_owner_kind on customers (owner_id, kind);

create or replace function public.prevent_contact_kind_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind is distinct from old.kind then
    raise exception 'A customer cannot be changed into a vendor, or a vendor into a customer.';
  end if;
  return new;
end;
$$;

drop trigger if exists contact_kind_is_fixed on customers;
create trigger contact_kind_is_fixed
  before update of kind on customers
  for each row execute function public.prevent_contact_kind_change();

-- 2. Purchase rate on saved materials -----------------------------------------------

alter table materials add column if not exists purchase_rate numeric(14,2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'materials_purchase_rate_check') then
    alter table materials add constraint materials_purchase_rate_check check (purchase_rate is null or purchase_rate >= 0);
  end if;
end $$;

-- 3. Views and report: same columns as before plus kind at the end --------------------

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
  o.owner_id,
  c.kind
from ordered o
join customers c on c.id = o.customer_id
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
  c.owner_id,
  c.kind
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
  owner_id,
  kind
from sale_balances
where outstanding > 0
group by customer_id, credit_days, owner_id, kind;

-- monthly_report: totals for one side of one ledger for the month containing p_month.
-- For vendors: material_sold = purchased, payment_received = paid, balance_remaining = payable.
drop function if exists monthly_report(date, uuid);
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
  with contacts as (
    select id from customers where owner_id = p_owner and kind = p_kind
  )
  select
    coalesce((select sum(amount) from credit_sales
      where customer_id in (select id from contacts)
        and date_trunc('month', sale_date) = date_trunc('month', p_month)), 0),
    coalesce((select sum(amount) from payments
      where customer_id in (select id from contacts)
        and date_trunc('month', payment_date) = date_trunc('month', p_month)), 0),
    coalesce((select sum(amount) from credit_sales
      where customer_id in (select id from contacts)
        and date_trunc('month', due_date) = date_trunc('month', p_month)), 0),
    coalesce((select sum(outstanding) from sale_balances where owner_id = p_owner and kind = p_kind), 0)
$$;

grant select on sale_balances, customer_summary, overdue_aging to authenticated;
grant execute on function monthly_report(date, uuid, text) to authenticated;
