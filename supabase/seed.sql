-- Seed Data for Credit Sale Monitoring System
-- Optional sample data, added to the first admin's ledger.
-- Safe to run more than once (fixed ids + on conflict do nothing).
-- Run after all migrations and after creating your first user (uses app_today(), profiles and kind).

do $$
begin
  if not exists (select 1 from profiles where role = 'admin') then
    raise exception 'Create your first user in Authentication → Users before adding sample data.';
  end if;
end $$;

-- 1. Insert Customers
with owner as (select id from profiles where role = 'admin' order by created_at, id limit 1)
insert into customers (id, owner_id, name, phone, address, created_at)
select v.id::uuid, owner.id, v.name, v.phone, v.address, now() - v.age::interval
from owner, (values
  ('11111111-1111-1111-1111-111111111111', 'Ali Traders', '+92 300 1234567', 'Shop #14, Main Market, Lahore', '60 days'),
  ('22222222-2222-2222-2222-222222222222', 'Khan Construction', '+92 321 9876543', 'Plot 45, Sector G-11, Islamabad', '50 days'),
  ('33333333-3333-3333-3333-333333333333', 'Metro Builders & Co.', '+92 333 4567890', 'Industrial Area, Karachi', '40 days'),
  ('44444444-4444-4444-4444-444444444444', 'Bilal Hardware Store', '+92 345 1122334', 'Circular Road, Faisalabad', '30 days'),
  ('55555555-5555-5555-5555-555555555555', 'Hamza & Sons Ltd.', '+92 312 8877665', 'GT Road, Gujranwala', '20 days')
) as v(id, name, phone, address, age)
on conflict (id) do nothing;

-- 2. Insert Credit Sales (owner taken from the customer)
insert into credit_sales (id, owner_id, customer_id, sale_date, material, quantity, unit, rate, credit_days, notes)
select v.id::uuid, c.owner_id, c.id, app_today() - v.days_ago, v.material, v.quantity, v.unit, v.rate, v.credit_days, v.notes
from (values
  -- Ali Traders: 300,000 total sales (e.g. 150k + 150k)
  ('a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 40, 'DG Cement Bags', 100, 'bag', 1500, 30, 'Delivery to Site A - Batch 1'),
  ('a2222222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 20, 'Steel Rebars (Grade 60)', 1, 'ton', 150000, 30, 'Site B reinforcement'),
  -- Khan Construction: 520,000 total sales
  ('b1111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 75, 'Crush / Aggregate', 4, 'truck', 65000, 60, 'Foundation phase 1'),
  ('b2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 15, 'Bestway Cement Bags', 200, 'bag', 1300, 30, 'Slab pouring'),
  -- Metro Builders: 450,000 total sales
  ('c1111111-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 95, 'Heavy Steel Beams', 2, 'ton', 160000, 60, 'Warehouse frame'),
  ('c2222222-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 10, 'Fine River Sand', 5, 'truck', 26000, 30, 'Plaster work'),
  -- Bilal Hardware: 180,000 total sales (fully paid)
  ('d1111111-dddd-dddd-dddd-dddddddddddd', '44444444-4444-4444-4444-444444444444', 45, 'Paints & Primers', 30, 'can', 6000, 30, 'Order #883'),
  -- Hamza & Sons: 90,000 total sales (fresh pending)
  ('e1111111-eeee-eeee-eeee-eeeeeeeeeeee', '55555555-5555-5555-5555-555555555555', 5, 'PVC Pipes & Fittings', 50, 'pcs', 1800, 30, 'Plumbing supply')
) as v(id, customer_id, days_ago, material, quantity, unit, rate, credit_days, notes)
join customers c on c.id = v.customer_id::uuid
on conflict (id) do nothing;

-- 3. Insert Payments (owner taken from the customer)
insert into payments (id, owner_id, customer_id, payment_date, amount, method, notes)
select v.id::uuid, c.owner_id, c.id, app_today() - v.days_ago, v.amount, v.method, v.notes
from (values
  -- Ali Traders: 100,000 paid (1st sale partially settled, 200,000 remaining)
  ('f1111111-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', 12, 100000, 'bank', 'Bank Transfer (Meezan Bank Tx #7891)'),
  -- Khan Construction: 260,000 paid
  ('f2222222-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222', 30, 260000, 'cheque', 'Cheque #44901 Habib Bank'),
  -- Metro Builders: 100,000 paid
  ('f3333333-ffff-ffff-ffff-ffffffffffff', '33333333-3333-3333-3333-333333333333', 25, 100000, 'cash', 'Cash collection on site'),
  -- Bilal Hardware: 180,000 paid (settles 100% of bill)
  ('f4444444-ffff-ffff-ffff-ffffffffffff', '44444444-4444-4444-4444-444444444444', 15, 180000, 'bank', 'Online transfer')
) as v(id, customer_id, days_ago, amount, method, notes)
join customers c on c.id = v.customer_id::uuid
on conflict (id) do nothing;

-- 4. Vendors, with purchases and payments made (needs the vendors migration)
with owner as (select id from profiles where role = 'admin' order by created_at, id limit 1)
insert into customers (id, owner_id, kind, name, phone, address, created_at)
select v.id::uuid, owner.id, 'vendor', v.name, v.phone, v.address, now() - v.age::interval
from owner, (values
  ('66666666-6666-6666-6666-666666666666', 'Lucky Cement Depot', '+92 301 5551234', 'Ravi Road, Lahore', '70 days'),
  ('77777777-7777-7777-7777-777777777777', 'Ittefaq Steel Mills', '+92 322 4448899', 'Kot Lakhpat, Lahore', '65 days'),
  ('88888888-8888-8888-8888-888888888888', 'Indus Sand & Crush', '+92 334 7776655', 'Kala Shah Kaku', '45 days')
) as v(id, name, phone, address, age)
on conflict (id) do nothing;

insert into credit_sales (id, owner_id, customer_id, sale_date, material, quantity, unit, rate, credit_days, notes)
select v.id::uuid, c.owner_id, c.id, app_today() - v.days_ago, v.material, v.quantity, v.unit, v.rate, v.credit_days, v.notes
from (values
  -- Lucky Cement: 280,200 bought, 120,000 paid; 15,000 overdue, the rest due within a week
  ('91111111-9999-9999-9999-999999999999', '66666666-6666-6666-6666-666666666666', 50, 'DG Cement Bags', 100, 'bag', 1350, 30, 'Bill #LC-2207'),
  ('92222222-9999-9999-9999-999999999999', '66666666-6666-6666-6666-666666666666', 25, 'Bestway Cement Bags', 120, 'bag', 1210, 30, 'Bill #LC-2291'),
  -- Ittefaq Steel: not yet due
  ('93333333-9999-9999-9999-999999999999', '77777777-7777-7777-7777-777777777777', 20, 'Steel Rebars (Grade 60)', 2, 'ton', 138000, 60, 'Invoice 5531'),
  -- Indus Sand & Crush: fully paid
  ('94444444-9999-9999-9999-999999999999', '88888888-8888-8888-8888-888888888888', 40, 'Fine River Sand', 6, 'truck', 22000, 15, 'Gate pass 118')
) as v(id, customer_id, days_ago, material, quantity, unit, rate, credit_days, notes)
join customers c on c.id = v.customer_id::uuid and c.kind = 'vendor'
on conflict (id) do nothing;

insert into payments (id, owner_id, customer_id, payment_date, amount, method, notes)
select v.id::uuid, c.owner_id, c.id, app_today() - v.days_ago, v.amount, v.method, v.notes
from (values
  ('95555555-9999-9999-9999-999999999999', '66666666-6666-6666-6666-666666666666', 18, 120000, 'bank', 'IBFT to Lucky Cement'),
  ('96666666-9999-9999-9999-999999999999', '88888888-8888-8888-8888-888888888888', 20, 132000, 'cash', 'Paid at yard')
) as v(id, customer_id, days_ago, amount, method, notes)
join customers c on c.id = v.customer_id::uuid and c.kind = 'vendor'
on conflict (id) do nothing;
