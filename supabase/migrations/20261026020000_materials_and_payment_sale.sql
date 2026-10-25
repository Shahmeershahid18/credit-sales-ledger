-- Follow-up to 20261026010000_views_security_timezone_advance.sql
--
-- 1. materials: saved material "pills" for the sale form (name, unit, default rate).
--    Backfilled from materials already used in past sales.
-- 2. payments.sale_id: a payment can optionally be recorded against one sale.
--    That sale is paid first; anything left over (and all unlinked payments) is
--    applied to the customer's oldest unpaid sales first (FIFO), as before.

-- 1. Materials -----------------------------------------------------------------

create table if not exists materials (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  unit        text not null default 'bag',
  rate        numeric(14,2) check (rate is null or rate >= 0),
  created_at  timestamptz not null default now()
);

create unique index if not exists materials_name_key on materials (lower(trim(name)));

alter table materials enable row level security;

drop policy if exists "Owner has full access to materials" on materials;
create policy "Owner has full access to materials"
  on materials for all
  to authenticated
  using (true) with check (true);

grant select, insert, update, delete on materials to authenticated;

-- Latest unit and rate used for each material in past sales
insert into materials (name, unit, rate)
select distinct on (lower(trim(material)))
  trim(material), coalesce(nullif(trim(unit), ''), 'bag'), rate
from credit_sales
order by lower(trim(material)), sale_date desc, created_at desc
on conflict do nothing;

-- 2. Payment against a specific sale ---------------------------------------------

-- Lets the foreign key below check that the sale belongs to the same customer
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'credit_sales_id_customer_key') then
    alter table credit_sales add constraint credit_sales_id_customer_key unique (id, customer_id);
  end if;
end $$;

alter table payments add column if not exists sale_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_sale_fkey') then
    alter table payments
      add constraint payments_sale_fkey
      foreign key (sale_id, customer_id) references credit_sales (id, customer_id)
      on delete set null (sale_id);
  end if;
end $$;

create index if not exists idx_payments_sale on payments (sale_id);

-- sale_balances: linked payments settle their own sale first, then FIFO.
-- Same columns as before, so dependent views keep working.
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
  greatest(0, app_today() - o.due_date) as days_overdue
from ordered o
left join pool p on p.customer_id = o.customer_id;
