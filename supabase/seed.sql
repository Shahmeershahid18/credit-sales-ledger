-- Seed Data for Credit Sale Monitoring System
-- Optional sample data. Safe to run more than once (fixed ids + on conflict do nothing).
-- Run after both migrations (uses app_today()).

-- 1. Insert Customers
insert into customers (id, name, phone, address, created_at) values
  ('11111111-1111-1111-1111-111111111111', 'Ali Traders', '+92 300 1234567', 'Shop #14, Main Market, Lahore', now() - interval '60 days'),
  ('22222222-2222-2222-2222-222222222222', 'Khan Construction', '+92 321 9876543', 'Plot 45, Sector G-11, Islamabad', now() - interval '50 days'),
  ('33333333-3333-3333-3333-333333333333', 'Metro Builders & Co.', '+92 333 4567890', 'Industrial Area, Karachi', now() - interval '40 days'),
  ('44444444-4444-4444-4444-444444444444', 'Bilal Hardware Store', '+92 345 1122334', 'Circular Road, Faisalabad', now() - interval '30 days'),
  ('55555555-5555-5555-5555-555555555555', 'Hamza & Sons Ltd.', '+92 312 8877665', 'GT Road, Gujranwala', now() - interval '20 days')
on conflict (id) do nothing;

-- 2. Insert Credit Sales
-- Ali Traders: 300,000 total sales (e.g. 150k + 150k)
insert into credit_sales (id, customer_id, sale_date, material, quantity, unit, rate, credit_days, notes) values
  ('a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', app_today() - 40, 'DG Cement Bags', 100, 'bag', 1500, 30, 'Delivery to Site A - Batch 1'),
  ('a2222222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', app_today() - 20, 'Steel Rebars (Grade 60)', 1, 'ton', 150000, 30, 'Site B reinforcement'),

-- Khan Construction: 520,000 total sales
  ('b1111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', app_today() - 75, 'Crush / Aggregate', 4, 'truck', 65000, 60, 'Foundation phase 1'),
  ('b2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', app_today() - 15, 'Bestway Cement Bags', 200, 'bag', 1300, 30, 'Slab pouring'),

-- Metro Builders: 450,000 total sales
  ('c1111111-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', app_today() - 95, 'Heavy Steel Beams', 2, 'ton', 160000, 60, 'Warehouse frame'),
  ('c2222222-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', app_today() - 10, 'Fine River Sand', 5, 'truck', 26000, 30, 'Plaster work'),

-- Bilal Hardware: 180,000 total sales (fully paid)
  ('d1111111-dddd-dddd-dddd-dddddddddddd', '44444444-4444-4444-4444-444444444444', app_today() - 45, 'Paints & Primers', 30, 'can', 6000, 30, 'Order #883'),

-- Hamza & Sons: 90,000 total sales (fresh pending)
  ('e1111111-eeee-eeee-eeee-eeeeeeeeeeee', '55555555-5555-5555-5555-555555555555', app_today() - 5, 'PVC Pipes & Fittings', 50, 'pcs', 1800, 30, 'Plumbing supply')
on conflict (id) do nothing;

-- 3. Insert Payments
-- Ali Traders: 100,000 paid (1st sale partially settled, 200,000 remaining)
insert into payments (id, customer_id, payment_date, amount, method, notes) values
  ('f1111111-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', app_today() - 12, 100000, 'bank', 'Bank Transfer (Meezan Bank Tx #7891)'),

-- Khan Construction: 260,000 paid
  ('f2222222-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222', app_today() - 30, 260000, 'cheque', 'Cheque #44901 Habib Bank'),

-- Metro Builders: 100,000 paid
  ('f3333333-ffff-ffff-ffff-ffffffffffff', '33333333-3333-3333-3333-333333333333', app_today() - 25, 100000, 'cash', 'Cash collection on site'),

-- Bilal Hardware: 180,000 paid (settles 100% of bill)
  ('f4444444-ffff-ffff-ffff-ffffffffffff', '44444444-4444-4444-4444-444444444444', app_today() - 15, 180000, 'bank', 'Online transfer')
on conflict (id) do nothing;
