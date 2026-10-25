-- Credit Sale & Monthly Monitoring Schema
-- Single-user system with FIFO allocation for credit sales and payments

-- Enable pgcrypto for gen_random_uuid()
create extension if not exists "pgcrypto";

-- 1. Customers Table
create table if not exists customers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  address     text,
  created_at  timestamptz not null default now()
);

-- 2. Credit Sales (Material given on credit)
create table if not exists credit_sales (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references customers(id) on delete restrict,
  sale_date    date not null default current_date,
  material     text not null,
  quantity     numeric(12,2) not null default 1 check (quantity > 0),
  unit         text default 'bag',               -- bag, ton, kg, pcs, truck
  rate         numeric(14,2) not null check (rate >= 0),
  amount       numeric(14,2) generated always as (quantity * rate) stored,
  credit_days  int not null default 30 check (credit_days >= 0),
  due_date     date generated always as (sale_date + credit_days) stored,
  notes        text,
  created_at   timestamptz not null default now()
);

-- 3. Payments Received
create table if not exists payments (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references customers(id) on delete restrict,
  payment_date  date not null default current_date,
  amount        numeric(14,2) not null check (amount > 0),
  method        text not null default 'cash',     -- cash, bank, cheque
  notes         text,
  created_at    timestamptz not null default now()
);

-- Indexes for optimal lookup performance
create index if not exists idx_credit_sales_cust_date on credit_sales (customer_id, sale_date);
create index if not exists idx_credit_sales_due_date on credit_sales (due_date);
create index if not exists idx_payments_cust_date on payments (customer_id, payment_date);

-- 4. VIEW: sale_balances (FIFO Payment Allocation)
-- Accurately calculates how much of each sale is paid and outstanding based on cumulative payments
create or replace view sale_balances as
with s as (
  select cs.*,
    coalesce(sum(cs.amount) over (
      partition by cs.customer_id
      order by cs.sale_date, cs.created_at, cs.id
      rows between unbounded preceding and 1 preceding
    ), 0) as prior_total
  from credit_sales cs
),
p as (
  select customer_id, sum(amount) as paid
  from payments group by customer_id
)
select
  s.id,
  s.customer_id,
  s.sale_date,
  s.material,
  s.quantity,
  s.unit,
  s.rate,
  s.amount,
  s.credit_days,
  s.due_date,
  s.notes,
  s.created_at,
  least(s.amount, greatest(0, coalesce(p.paid, 0) - s.prior_total)) as paid_amount,
  s.amount - least(s.amount, greatest(0, coalesce(p.paid, 0) - s.prior_total)) as outstanding,
  greatest(0, current_date - s.due_date) as days_overdue
from s
left join p on p.customer_id = s.customer_id;

-- 5. VIEW: customer_summary
-- Powers customer cards, customer directory and dashboard
create or replace view customer_summary as
select
  c.id as customer_id,
  c.name,
  c.phone,
  c.address,
  coalesce(sum(sb.amount), 0)       as total_credit_sale,
  coalesce(sum(sb.paid_amount), 0)  as payment_received,
  coalesce(sum(sb.outstanding), 0)  as outstanding,
  coalesce(sum(sb.outstanding) filter (where sb.due_date < current_date), 0) as overdue,
  min(sb.due_date) filter (where sb.outstanding > 0) as next_due_date,
  case
    when coalesce(sum(sb.outstanding), 0) = 0 and count(sb.id) > 0 then 'paid'
    when coalesce(sum(sb.outstanding) filter (where sb.due_date < current_date), 0) > 0 then 'overdue'
    when coalesce(sum(sb.outstanding), 0) > 0 then 'pending'
    else 'paid'
  end as status
from customers c
left join sale_balances sb on sb.customer_id = c.id
group by c.id, c.name, c.phone, c.address;

-- 6. VIEW: overdue_aging
-- Customer-wise and credit-term overdue buckets
create or replace view overdue_aging as
select
  customer_id,
  credit_days,
  sum(outstanding) filter (where days_overdue between 1  and 30) as d1_30,
  sum(outstanding) filter (where days_overdue between 31 and 60) as d31_60,
  sum(outstanding) filter (where days_overdue between 61 and 90) as d61_90,
  sum(outstanding) filter (where days_overdue > 90)              as d90_plus,
  sum(outstanding) filter (where days_overdue > 0)               as total_overdue
from sale_balances
where outstanding > 0
group by customer_id, credit_days;

-- 7. FUNCTION: monthly_report
-- Computes material sold, payment received, due, and remaining balance for a given month
create or replace function monthly_report(p_month date)
returns table (
  material_sold numeric,
  payment_received numeric,
  payment_due numeric,
  balance_remaining numeric
)
language sql stable as $$
  select
    coalesce((select sum(amount) from credit_sales
      where date_trunc('month', sale_date) = date_trunc('month', p_month)), 0),
    coalesce((select sum(amount) from payments
      where date_trunc('month', payment_date) = date_trunc('month', p_month)), 0),
    coalesce((select sum(amount) from credit_sales
      where date_trunc('month', due_date) = date_trunc('month', p_month)), 0),
    coalesce((select sum(outstanding) from sale_balances), 0)
$$;

-- 8. Row Level Security (RLS) for Single-User Mode
alter table customers enable row level security;
alter table credit_sales enable row level security;
alter table payments enable row level security;

-- Authenticated owner policy
create policy "Owner has full access to customers"
  on customers for all
  to authenticated
  using (true) with check (true);

create policy "Owner has full access to credit_sales"
  on credit_sales for all
  to authenticated
  using (true) with check (true);

create policy "Owner has full access to payments"
  on payments for all
  to authenticated
  using (true) with check (true);
