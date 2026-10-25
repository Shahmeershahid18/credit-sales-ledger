# Credit Sale & Monthly Monitoring Software — Project Plan

**Stack:** Next.js (App Router) + Supabase (Postgres) + Tailwind CSS
**Users:** Single user (owner only). No roles, no multi-user permissions.
**Goal:** A simple, small, easy-to-use tool to track material given on credit, payments received, and overdue amounts customer-wise.

---

## 1. Requirements Summary (from your notes & screenshots)

| # | Requirement | Where it lives |
|---|-------------|----------------|
| 1 | Dashboard on open: Total credit sale, Total received, Total outstanding, Overdue amount, Current month report | `/` Dashboard |
| 2 | Customer Ledger: each customer has a separate account with all sales, payment dates, due dates and remaining balance | `/customers/[id]` |
| 3 | Monthly Report: pick any month → material sold, payment received, payment due, balance remaining | `/reports/monthly` |
| 4 | Date-wise ledger: date, material given, amount, credit days | Ledger table |
| 5 | Filters for 30 / 60 / 90 credit days, and overdue customer-wise | Filter chips on Overdue + Ledger |
| 6 | Customer card UI: Total Credit Sale, Payment Received, Outstanding, Due Date, "Payment Pending" badge | Customer cards |

**Out of scope (to keep it simple):** roles, invoices/PDF billing, inventory, multi-currency, multi-branch.

---

## 2. Core Features

### 2.1 Dashboard
Summary cards (same style as screenshot 1):
- **Total Credit Sale** — sum of all credit sales
- **Payment Received** (green) — sum of all payments
- **Outstanding** — total sale − total received
- **Overdue Amount** (red) — outstanding on sales past their due date
- **Current Month** mini report (sale / received / balance)
- **Aging chart** — bar or donut: Not due, 1–30, 31–60, 61–90, 90+ days overdue
- **Top outstanding customers** — horizontal bar chart (top 5)

### 2.2 Customers
- List of customer cards: name, Total Credit Sale, Payment Received, Outstanding, nearest Due Date, status badge (`Payment Pending` / `Overdue` / `Paid`)
- Search by name
- Add / edit customer (name, phone, address)

### 2.3 Customer Ledger (date-wise)
Per customer, one table sorted by date:

| Date | Type | Material | Qty | Rate | Amount | Credit Days | Due Date | Status |
|------|------|----------|-----|------|--------|-------------|----------|--------|
| 01 Oct | Sale | Cement | 100 | 1,500 | 150,000 | 30 | 31 Oct | Pending |
| 10 Oct | Payment | — | — | — | −100,000 | — | — | — |

- Running balance column after every row
- Top of page: the 4 summary cards (Total Credit Sale, Received, Outstanding, Due Date)
- Buttons: **+ Add Sale**, **+ Add Payment**

### 2.4 Add Sale (simple form)
Customer, Date, Material, Quantity, Rate, (Amount auto = Qty × Rate), Credit Days (quick buttons **30 / 60 / 90** + custom), Notes.
Due date is auto-calculated: `sale_date + credit_days`.

### 2.5 Add Payment (simple form)
Customer, Date, Amount, Method (Cash / Bank / Cheque), Notes.
Payments are applied **oldest sale first (FIFO)**, so overdue amounts are always accurate without manual matching.

### 2.6 Overdue Report (customer-wise)
- Filter chips: **All / 30 days / 60 days / 90 days** (credit term of the sale)
- Aging buckets: **1–30, 31–60, 61–90, 90+** days past due
- Table: Customer | Outstanding | Overdue | 1–30 | 31–60 | 61–90 | 90+
- Click a customer → opens their ledger

### 2.7 Monthly Report
Month picker (October, November, any). Shows:
- Material sold in the month (amount)
- Payment received in the month
- Payment that was due in the month
- Balance still remaining
- Customer-wise breakdown table for that month
- Export to CSV (optional, phase 2)

---

## 3. Database Design (Supabase / PostgreSQL)

Only **3 tables + 3 views**. Everything else is calculated.

### 3.1 Tables

```sql
-- Customers
create table customers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  address     text,
  created_at  timestamptz not null default now()
);

-- Credit sales (material given)
create table credit_sales (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references customers(id) on delete restrict,
  sale_date    date not null default current_date,
  material     text not null,
  quantity     numeric(12,2) not null default 1,
  unit         text,                              -- bag, kg, ton, pcs...
  rate         numeric(14,2) not null,
  amount       numeric(14,2) generated always as (quantity * rate) stored,
  credit_days  int not null default 30 check (credit_days >= 0),
  due_date     date generated always as (sale_date + credit_days) stored,
  notes        text,
  created_at   timestamptz not null default now()
);

-- Payments received
create table payments (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references customers(id) on delete restrict,
  payment_date  date not null default current_date,
  amount        numeric(14,2) not null check (amount > 0),
  method        text default 'cash',              -- cash | bank | cheque
  notes         text,
  created_at    timestamptz not null default now()
);

create index on credit_sales (customer_id, sale_date);
create index on credit_sales (due_date);
create index on payments (customer_id, payment_date);
```

> If you prefer typing the total amount directly instead of Qty × Rate, change `amount` to a normal `numeric(14,2) not null` column.

### 3.2 Views (the "brain" of the app)

**a) `sale_balances`** — how much of each sale is still unpaid (FIFO allocation)

```sql
create view sale_balances as
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
  s.*,
  least(s.amount, greatest(0, coalesce(p.paid, 0) - s.prior_total)) as paid_amount,
  s.amount - least(s.amount, greatest(0, coalesce(p.paid, 0) - s.prior_total)) as outstanding,
  greatest(0, current_date - s.due_date) as days_overdue
from s
left join p on p.customer_id = s.customer_id;
```

**b) `customer_summary`** — powers the customer cards and dashboard

```sql
create view customer_summary as
select
  c.id as customer_id,
  c.name,
  coalesce(sum(sb.amount), 0)       as total_credit_sale,
  coalesce(sum(sb.paid_amount), 0)  as payment_received,
  coalesce(sum(sb.outstanding), 0)  as outstanding,
  coalesce(sum(sb.outstanding) filter (where sb.due_date < current_date), 0) as overdue,
  min(sb.due_date) filter (where sb.outstanding > 0) as next_due_date,
  case
    when coalesce(sum(sb.outstanding), 0) = 0 then 'paid'
    when coalesce(sum(sb.outstanding) filter (where sb.due_date < current_date), 0) > 0 then 'overdue'
    else 'pending'
  end as status
from customers c
left join sale_balances sb on sb.customer_id = c.id
group by c.id, c.name;
```

> Note: if a customer pays more than total sales (advance), `payment_received` here counts only what was applied. Show advance separately in phase 2 if needed.

**c) `overdue_aging`** — customer-wise overdue buckets

```sql
create view overdue_aging as
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
```
Filtering by 30 / 60 / 90 = `where credit_days = 30` (or 60 / 90) on this view.

### 3.3 Monthly report (SQL function)

```sql
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
```

### 3.4 Security (single user)
- Use **Supabase Auth** with one email + password account (disable public sign-ups in the Supabase dashboard).
- Enable **RLS** on all 3 tables with one policy: `to authenticated using (true) with check (true)`.
- Views: create with `security_invoker = true` so RLS is respected.
- Middleware in Next.js redirects to `/login` if there is no session.

---

## 4. Next.js Architecture

### 4.1 Tech choices
| Concern | Choice | Why |
|---------|--------|-----|
| Framework | Next.js 14+ App Router, TypeScript | Server components = fast, simple data fetching |
| Styling | Tailwind CSS + shadcn/ui | Clean cards, tables, badges like your screenshots |
| DB client | `@supabase/supabase-js` + `@supabase/ssr` | Official, cookie-based auth |
| Charts | Recharts | Donut + bar charts on dashboard |
| Forms | React Hook Form + Zod | Simple validation |
| Dates | date-fns | Formatting like `31 Oct 2026` |
| Hosting | Vercel (frontend) + Supabase (DB) | Free tier is enough for one user |

### 4.2 Folder structure

```
credit-sale-app/
├── app/
│   ├── layout.tsx                  # Root layout, font, global styles
│   ├── login/page.tsx              # Single-user login
│   ├── (app)/
│   │   ├── layout.tsx              # Sidebar / bottom nav + auth guard
│   │   ├── page.tsx                # 1. Dashboard
│   │   ├── customers/
│   │   │   ├── page.tsx            # Customer list (cards)
│   │   │   ├── new/page.tsx        # Add customer
│   │   │   └── [id]/
│   │   │       ├── page.tsx        # 2. Customer Ledger
│   │   │       ├── sale/new/page.tsx
│   │   │       └── payment/new/page.tsx
│   │   ├── overdue/page.tsx        # Overdue customer-wise (30/60/90 filter)
│   │   └── reports/
│   │       └── monthly/page.tsx    # 3. Monthly Report
│   └── actions/                    # Server Actions
│       ├── customers.ts
│       ├── sales.ts
│       └── payments.ts
├── components/
│   ├── ui/                         # shadcn components (button, card, badge, table...)
│   ├── StatCard.tsx                # Grey rounded card: label + big number
│   ├── StatusBadge.tsx             # Payment Pending / Overdue / Paid
│   ├── CustomerCard.tsx            # Customer name + badge + 4 stat cards
│   ├── LedgerTable.tsx             # Date-wise ledger with running balance
│   ├── AgingChart.tsx              # Donut / bar chart
│   ├── TopCustomersChart.tsx
│   ├── CreditDaysFilter.tsx        # All | 30 | 60 | 90 chips
│   ├── MonthPicker.tsx
│   ├── SaleForm.tsx
│   └── PaymentForm.tsx
├── lib/
│   ├── supabase/
│   │   ├── server.ts               # createServerClient (cookies)
│   │   ├── client.ts               # createBrowserClient
│   │   └── middleware.ts           # session refresh
│   ├── queries.ts                  # All DB reads in one place
│   ├── format.ts                   # formatRs(300000) → "Rs. 300,000"
│   └── validators.ts               # Zod schemas
├── middleware.ts                   # Redirect to /login if not signed in
├── types/database.ts               # Generated: supabase gen types typescript
├── supabase/migrations/            # SQL from section 3
└── .env.local                      # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 4.3 Data flow
```
Browser ──► Next.js Server Component ──► Supabase (views / tables)
   │                                          ▲
   └─► Form submit ──► Server Action ─────────┘
                           │
                           └─► revalidatePath() → page refreshes with new totals
```
- **Reads:** Server Components call `lib/queries.ts` (no client-side loading spinners needed).
- **Writes:** Server Actions insert into `credit_sales` / `payments`, validate with Zod, then `revalidatePath`.
- **Filters** (30/60/90, month) are URL search params: `/overdue?days=60`, `/reports/monthly?month=2026-10` — shareable and no extra state management.

### 4.4 Key queries (`lib/queries.ts`)
| Function | Source |
|----------|--------|
| `getDashboardTotals()` | `customer_summary` (sum of columns) |
| `getAgingTotals()` | `overdue_aging` (sum of buckets) |
| `getTopCustomers(5)` | `customer_summary` order by `outstanding desc` |
| `getCustomerCards(search)` | `customer_summary` |
| `getLedger(customerId)` | `credit_sales` + `payments` merged by date, running balance computed in code |
| `getOverdue(days?)` | `overdue_aging` joined with `customers`, filter `credit_days` |
| `getMonthlyReport(month)` | RPC `monthly_report` + customer-wise query |

### 4.5 Ledger running balance (logic)
1. Fetch sales (as debit) and payments (as credit) for the customer.
2. Merge into one array, sort by date ascending (sale before payment on the same day).
3. Walk through: `balance += debit - credit`.
4. Display newest first if preferred; keep the computed balance per row.

---

## 5. UI / UX Guidelines (matching your screenshots)

**Principles:** one screen = one purpose, big numbers, minimal clicks, works well on mobile (WhatsApp-style simple).

- **Cards:** light grey background `#F3F3F3`, rounded corners (`rounded-2xl`), small grey label, big bold number.
- **Colors:**
  - Payment Received → **green** (`#0B6B2E`)
  - Outstanding / Overdue → **red/dark orange**
  - `Payment Pending` badge → light orange background, dark orange text (like the screenshot)
  - `Overdue` badge → light red, `Paid` badge → light green
- **Number format:** `Rs. 300,000`, dates as `31 Oct 2026`.
- **Navigation:** 4 items only — **Dashboard · Customers · Overdue · Monthly Report** (sidebar on desktop, bottom tab bar on mobile).
- **Customer page layout:**
  ```
  Customer: Ali Traders                     [Payment Pending]
  ┌───────────────────┐ ┌───────────────────┐
  │ Total Credit Sale │ │ Payment Received  │
  │ Rs. 300,000       │ │ Rs. 100,000 (grn) │
  └───────────────────┘ └───────────────────┘
  ┌───────────────────┐ ┌───────────────────┐
  │ Outstanding       │ │ Credit Due Date   │
  │ Rs. 200,000       │ │ 31 Oct 2026       │
  └───────────────────┘ └───────────────────┘
  [+ Add Sale]  [+ Add Payment]
  ── Ledger table (date-wise) ──
  ```
- **Forms:** max 6 fields, credit days as tap-buttons **30 | 60 | 90**, today's date pre-filled, big Save button.
- **Language:** UI labels in English (optionally Roman Urdu helper text later, as in your screenshot descriptions).
- **Empty states:** friendly message + one button ("No sales yet — Add first sale").

---

## 6. Build Plan (small, step by step)

| Phase | Tasks | Est. time |
|-------|-------|-----------|
| **0. Setup** | Create Supabase project, run SQL (tables, views, function), disable sign-ups, create your user. `npx create-next-app`, install Tailwind, shadcn/ui, supabase packages | 0.5 day |
| **1. Auth** | Login page, middleware guard, Supabase server/browser clients | 0.5 day |
| **2. Customers** | List cards, add/edit customer | 0.5 day |
| **3. Sales & Payments** | Add Sale form (30/60/90 buttons), Add Payment form, server actions | 1 day |
| **4. Customer Ledger** | Summary cards + date-wise ledger with running balance | 1 day |
| **5. Dashboard** | Totals, aging chart, top customers, current month | 1 day |
| **6. Overdue Report** | Customer-wise buckets, 30/60/90 filter | 0.5 day |
| **7. Monthly Report** | Month picker, totals, customer-wise table | 0.5 day |
| **8. Polish & Deploy** | Mobile layout, empty states, CSV export, deploy to Vercel | 1 day |

**Total:** roughly 6–7 working days for a solo developer (or less using AI-assisted coding).

---

## 7. Example Business Logic

- **Due date** = `sale_date + credit_days` (e.g., sold 01 Oct with 30 days → due 31 Oct 2026).
- **Overdue** = a sale with outstanding > 0 and `due_date < today`.
- **Days overdue** = `today − due_date`.
- **Status** per customer:
  - `Paid` → outstanding = 0
  - `Overdue` → any unpaid sale past due date
  - `Payment Pending` → unpaid but not yet due
- **Example (from screenshot):** Ali Traders — Total Credit Sale Rs. 300,000, Received Rs. 100,000 → Outstanding Rs. 200,000, due 31 Oct 2026, status *Payment Pending* until 31 Oct, then *Overdue*.

---

## 8. Future Ideas (optional, not in first version)

- WhatsApp reminder link: pre-filled message "Your payment of Rs. X was due on DD Mon"
- Print / PDF statement per customer
- Advance payment / credit-note handling
- Backup export (CSV of all tables)
- Urdu / Roman Urdu language toggle

---

## 9. Quick Start Commands

```bash
npx create-next-app@latest credit-sale-app --typescript --tailwind --app
cd credit-sale-app
npm i @supabase/supabase-js @supabase/ssr recharts react-hook-form zod @hookform/resolvers date-fns
npx shadcn@latest init
npx shadcn@latest add button card badge table input select tabs

# Generate DB types after creating tables
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
```

`.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```
