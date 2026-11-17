-- Customer returns and vendor returns.
--
-- A return is a payments row with method = 'return' and the reason in notes:
--   * kind 'customer': goods a customer returned -> lowers what they owe you
--   * kind 'vendor':   goods you returned to a vendor -> lowers what you owe them
-- Like a payment it clears unpaid bills oldest first (or the bill in sale_id first), but it
-- is not money: "payment received / made" and the monthly report leave returns out, and
-- customer_summary reports them in their own `returned` column.
--
-- Safe to run more than once.

create index if not exists idx_payments_returns on payments (owner_id, kind, payment_date) where method = 'return';

-- payment_received: money only (returns left out); returned: returns; advance still counts
-- everything that cleared bills.
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
  select
    customer_id,
    kind,
    sum(amount) as total_cleared,
    coalesce(sum(amount) filter (where method <> 'return'), 0) as total_paid,
    coalesce(sum(amount) filter (where method = 'return'), 0) as total_returned
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
  greatest(0, coalesce(p.total_cleared, 0) - coalesce(b.total_sale, 0)) as advance,
  b.next_due_date,
  case
    when coalesce(b.outstanding, 0) = 0 then 'paid'
    when coalesce(b.overdue, 0) > 0 then 'overdue'
    else 'pending'
  end as status,
  c.owner_id,
  c.side as kind,
  c.is_customer,
  c.is_vendor,
  coalesce(p.total_returned, 0) as returned
from sides c
left join bal b on b.customer_id = c.id and b.kind = c.side
left join paid p on p.customer_id = c.id and p.kind = c.side;

-- Received / paid count money only: no adjustments, no returns, no opening balances
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
      where owner_id = p_owner and kind = p_kind and not is_opening
        and date_trunc('month', sale_date) = date_trunc('month', p_month)), 0),
    coalesce((select sum(amount) from payments
      where owner_id = p_owner and kind = p_kind and method not in ('adjustment', 'return') and not is_opening
        and date_trunc('month', payment_date) = date_trunc('month', p_month)), 0),
    coalesce((select sum(amount) from credit_sales
      where owner_id = p_owner and kind = p_kind
        and date_trunc('month', due_date) = date_trunc('month', p_month)), 0),
    coalesce((select sum(outstanding) from sale_balances where owner_id = p_owner and kind = p_kind), 0)
$$;
