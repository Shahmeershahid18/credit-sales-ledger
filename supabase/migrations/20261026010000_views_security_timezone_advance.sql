-- Follow-up to 20261026000000_credit_sale_schema.sql
--
-- 1. Views are recreated with security_invoker = true so Row Level Security on the
--    underlying tables is respected (otherwise the views run as their owner and
--    anyone with the anon key could read every row through them).
-- 2. "Today" comes from app_today(), which uses the business timezone instead of the
--    database's UTC clock. Keep it in sync with NEXT_PUBLIC_APP_TIMEZONE.
-- 3. customer_summary reports all payments received plus any advance (payments
--    beyond total sales), and overdue_aging includes total_outstanding.

-- Business "today"
create or replace function app_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Karachi')::date
$$;

alter table credit_sales alter column sale_date set default app_today();
alter table payments alter column payment_date set default app_today();

-- Recreate views (column lists change, so drop first)
drop function if exists monthly_report(date);
drop view if exists overdue_aging;
drop view if exists customer_summary;
drop view if exists sale_balances;

-- sale_balances: FIFO allocation of each customer's payments to their oldest sales first
create view sale_balances
with (security_invoker = true) as
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
  from payments
  group by customer_id
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
  greatest(0, app_today() - s.due_date) as days_overdue
from s
left join p on p.customer_id = s.customer_id;

-- customer_summary: one row per customer for cards and dashboard
create view customer_summary
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
  end as status
from customers c
left join bal b on b.customer_id = c.id
left join paid p on p.customer_id = c.id;

-- overdue_aging: customer-wise and credit-term buckets of unpaid sales
create view overdue_aging
with (security_invoker = true) as
select
  customer_id,
  credit_days,
  sum(outstanding)                                                          as total_outstanding,
  coalesce(sum(outstanding) filter (where days_overdue > 0), 0)             as total_overdue,
  coalesce(sum(outstanding) filter (where days_overdue between 1 and 30), 0)  as d1_30,
  coalesce(sum(outstanding) filter (where days_overdue between 31 and 60), 0) as d31_60,
  coalesce(sum(outstanding) filter (where days_overdue between 61 and 90), 0) as d61_90,
  coalesce(sum(outstanding) filter (where days_overdue > 90), 0)            as d90_plus
from sale_balances
where outstanding > 0
group by customer_id, credit_days;

-- monthly_report: totals for the month containing p_month
create function monthly_report(p_month date)
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
      where date_trunc('month', sale_date) = date_trunc('month', p_month)), 0),
    coalesce((select sum(amount) from payments
      where date_trunc('month', payment_date) = date_trunc('month', p_month)), 0),
    coalesce((select sum(amount) from credit_sales
      where date_trunc('month', due_date) = date_trunc('month', p_month)), 0),
    coalesce((select sum(outstanding) from sale_balances), 0)
$$;

grant select on sale_balances, customer_summary, overdue_aging to authenticated;
grant execute on function monthly_report(date) to authenticated;
grant execute on function app_today() to authenticated;
