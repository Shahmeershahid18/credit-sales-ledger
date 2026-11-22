-- Customer-specific prices.
--
-- customer_prices: a customer's own sale rate and/or cost price for a product, when it
-- differs from the general one on the saved material (materials.rate / cost_price).
--   * sale_rate:  filled in on that customer's sale form
--   * cost_price: what that customer's version of the product costs you to make; used for
--                 the profit estimate and the item-wise and customer-wise margins
-- Either can be empty (null): the general value is used.
--
-- merge_parties() now also moves the merged party's prices (the kept party's own win).
--
-- Safe to run more than once.

create table if not exists customer_prices (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references profiles (id) on delete cascade,
  customer_id uuid not null,
  material    text not null check (length(trim(material)) > 0),
  unit        text not null default 'bag',
  sale_rate   numeric(14,2) check (sale_rate is null or sale_rate >= 0),
  cost_price  numeric(14,2) check (cost_price is null or cost_price >= 0),
  updated_at  timestamptz not null default now(),
  foreign key (customer_id, owner_id) references customers (id, owner_id) on delete cascade
);

create unique index if not exists customer_prices_party_material_key
  on customer_prices (owner_id, customer_id, lower(trim(material)));

alter table customer_prices enable row level security;

drop policy if exists "Own ledger, admins all ledgers" on customer_prices;
create policy "Own ledger, admins all ledgers" on customer_prices for all to authenticated
  using ((owner_id = (select auth.uid()) and (select public.is_active_user())) or (select public.is_admin()))
  with check ((owner_id = (select auth.uid()) and (select public.is_active_user())) or (select public.is_admin()));

revoke all on customer_prices from anon;
grant select, insert, update, delete on customer_prices to authenticated;

-- Merge: same as before, plus the merged party's prices move to the kept party
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
  -- Prices: the kept party's own stay; the others are copied over
  insert into customer_prices (owner_id, customer_id, material, unit, sale_rate, cost_price)
    select owner_id, p_keep, material, unit, sale_rate, cost_price from customer_prices where customer_id = p_merge
    on conflict do nothing;
  delete from customers where id = p_merge;
end;
$$;

revoke execute on function merge_parties(uuid, uuid) from public, anon;
grant execute on function merge_parties(uuid, uuid) to authenticated;
