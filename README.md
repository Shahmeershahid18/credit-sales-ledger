# Credit Sale Ledger

Single-user app to track material given on credit, payments received and overdue amounts customer-wise.
Built with Next.js (App Router), Supabase (Postgres + Auth) and Tailwind CSS. See
`credit-sale-monitoring-plan.md` for the full plan.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Without Supabase keys the app runs in **demo mode**: sample data is kept in server memory, there is no
login, and anything you add is lost when the server restarts. A banner in the app reminds you of this.

## Connect Supabase (saves data, enables login)

1. Create a project at https://supabase.com.
2. In the SQL Editor, run these files in order:
   1. `supabase/migrations/20261026000000_credit_sale_schema.sql`
   2. `supabase/migrations/20261026010000_views_security_timezone_advance.sql`
   3. `supabase/migrations/20261026020000_materials_and_payment_sale.sql` (saved material pills,
      payments linked to a sale; safe to run more than once)
   4. Optional sample data: `supabase/seed.sql` (safe to run more than once)
3. Authentication → Providers → Email: keep email sign-in on and turn **off** "Allow new users to sign up".
4. Authentication → Users → **Add user**: create your owner email and password.
5. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API).
6. Restart `npm run dev` and sign in at `/login`.

## Timezone

"Today" (due dates, overdue days, current month) uses the business timezone, `Asia/Karachi` by default.
To change it, set `NEXT_PUBLIC_APP_TIMEZONE` **and** update `app_today()` in the second migration to
the same zone.

## Project layout

- `app/(app)/` – pages: dashboard, customers, ledger, overdue, monthly report
- `app/actions/` – Server Actions (customers, sales, payments, auth)
- `lib/queries.ts` – all reads and writes (Supabase views + `monthly_report` RPC, or the demo store)
- `lib/store.ts` – calculations shared by demo mode; they mirror the SQL views
- `lib/supabase/` – Supabase clients and session refresh used by `proxy.ts`
- `types/database.ts` – database types; regenerate with
  `npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts`
