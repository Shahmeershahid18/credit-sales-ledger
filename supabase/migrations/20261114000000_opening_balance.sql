-- Opening balance for a party: what was owed before you started using the app.
--
-- It is stored as one flagged entry (is_opening = true):
--   * "They owe me"  -> an opening bill on the customer side (credit_sales, kind 'customer'),
--                       or, for a vendor-only party, an advance you paid (payments, kind 'vendor')
--   * "I owe them"   -> an opening bill on the vendor side (credit_sales, kind 'vendor'),
--                       or, for a customer-only party, an advance they paid (payments, kind 'customer')
-- An opening bill is paid off and goes overdue like any bill. Reports do not count it as a
-- sale, purchase or payment of the month it is dated in.
--
-- Safe to run more than once.

alter table credit_sales add column if not exists is_opening boolean not null default false;
alter table payments add column if not exists is_opening boolean not null default false;

create index if not exists idx_credit_sales_opening on credit_sales (customer_id) where is_opening;
create index if not exists idx_payments_opening on payments (customer_id) where is_opening;

-- Sold / purchased and received / paid count new business and money only: no opening
-- balances and no adjustments. What fell due and what is still unpaid include openings.
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
      where owner_id = p_owner and kind = p_kind and method <> 'adjustment' and not is_opening
        and date_trunc('month', payment_date) = date_trunc('month', p_month)), 0),
    coalesce((select sum(amount) from credit_sales
      where owner_id = p_owner and kind = p_kind
        and date_trunc('month', due_date) = date_trunc('month', p_month)), 0),
    coalesce((select sum(outstanding) from sale_balances where owner_id = p_owner and kind = p_kind), 0)
$$;

-- Sets (or, with p_amount = 0, removes) a party's opening balance. The app decides where it
-- goes: p_kind is the side, p_advance true stores it as an advance payment instead of a bill.
-- An existing opening entry in the same place is updated in place, so payments linked to an
-- opening bill stay linked; an opening entry anywhere else is removed.
create or replace function set_opening_balance(
  p_party uuid,
  p_kind text,
  p_advance boolean,
  p_amount numeric,
  p_date date,
  p_credit_days int default 0
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  party customers%rowtype;
  kept uuid;
begin
  select * into party from customers where id = p_party;
  if not found then
    raise exception 'Party not found';
  end if;
  if p_kind not in ('customer', 'vendor') then
    raise exception 'Invalid side';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'The opening balance cannot be negative';
  end if;
  if p_date is null then
    raise exception 'Choose the date of the opening balance';
  end if;

  if p_amount > 0 and not p_advance then
    select id into kept from credit_sales
      where customer_id = p_party and is_opening and kind = p_kind
      order by created_at limit 1;
    if kept is null then
      insert into credit_sales (owner_id, customer_id, kind, sale_date, material, quantity, unit, rate, credit_days, is_opening)
      values (party.owner_id, p_party, p_kind, p_date, 'Opening balance', 1, null, p_amount, greatest(coalesce(p_credit_days, 0), 0), true)
      returning id into kept;
    else
      update credit_sales
        set sale_date = p_date, rate = p_amount, quantity = 1, credit_days = greatest(coalesce(p_credit_days, 0), 0)
        where id = kept;
    end if;
    delete from credit_sales where customer_id = p_party and is_opening and id <> kept;
    delete from payments where customer_id = p_party and is_opening;
  elsif p_amount > 0 then
    select id into kept from payments
      where customer_id = p_party and is_opening and kind = p_kind
      order by created_at limit 1;
    if kept is null then
      insert into payments (owner_id, customer_id, kind, payment_date, amount, method, is_opening)
      values (party.owner_id, p_party, p_kind, p_date, p_amount, 'cash', true)
      returning id into kept;
    else
      update payments set payment_date = p_date, amount = p_amount where id = kept;
    end if;
    delete from payments where customer_id = p_party and is_opening and id <> kept;
    delete from credit_sales where customer_id = p_party and is_opening;
  else
    delete from credit_sales where customer_id = p_party and is_opening;
    delete from payments where customer_id = p_party and is_opening;
  end if;
end;
$$;

revoke execute on function set_opening_balance(uuid, text, boolean, numeric, date, int) from public, anon;
grant execute on function set_opening_balance(uuid, text, boolean, numeric, date, int) to authenticated;
