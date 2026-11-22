-- The cost of each sale, saved with the sale.
--
-- credit_sales.cost_rate: what one unit of this sale cost you (same unit as `rate`).
-- It is filled in on the sale form from the customer's own cost price (or the general
-- one) on the day of the sale and can be changed there, so a later change of cost price
-- never changes the profit of past sales, just as each sale keeps its own sale rate.
-- Purchases and opening balances leave it empty. Sales recorded before this migration
-- have none: they use the current cost price until they are edited.
-- It is for your profit figures only; statements never show it.
--
-- Safe to run more than once.

alter table credit_sales add column if not exists cost_rate numeric(14,2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'credit_sales_cost_rate_check') then
    alter table credit_sales add constraint credit_sales_cost_rate_check check (cost_rate is null or cost_rate >= 0);
  end if;
end $$;
