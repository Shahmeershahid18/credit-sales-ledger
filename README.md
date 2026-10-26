# Credit Sale Ledger

App to track material given on credit, payments received and overdue amounts customer-wise.
Each user has their own private ledger; admins manage users and can open any ledger.
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
2. Authentication → Providers → Email: keep email sign-in on and turn **off** "Allow new users to sign up".
3. Authentication → Users → **Add user**: create your own email and password. This first user is the admin.
4. In the SQL Editor, run these files in order (each is safe to run more than once):
   1. `supabase/migrations/20261026000000_credit_sale_schema.sql`
   2. `supabase/migrations/20261026010000_views_security_timezone_advance.sql`
   3. `supabase/migrations/20261026020000_materials_and_payment_sale.sql` (saved material pills,
      payments linked to a sale)
   4. `supabase/migrations/20261026030000_users_and_separate_ledgers.sql` (user roles and a separate
      ledger per user)
   5. Optional sample data: `supabase/seed.sql` (added to the first admin's ledger)
5. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API keys).
   The service role key is a secret used only on the server; never commit it.
6. Restart `npm run dev` and sign in at `/login`.

## Users and roles

- **Users** see and change only their own ledger. They change their password on the **Account** page.
- **Admins** have their own ledger too, and on the **Users** page they can add users, set their
  role, reset passwords, disable or delete accounts (deleting also deletes that user's ledger), and
  open any user's ledger to view or edit it. A banner shows whose ledger is open.
- Users who existed before the users migration became admins; new users start as users.
- Separation is enforced by Row Level Security in the database, not only by the app.

## Timezone

"Today" (due dates, overdue days, current month) uses the business timezone, `Asia/Karachi` by default.
To change it, set `NEXT_PUBLIC_APP_TIMEZONE` **and** update `app_today()` in the second migration to
the same zone.

## Project layout

- `app/page.tsx` – public landing page at `/` (signed-in users are sent to `/dashboard`)
- `app/(app)/` – signed-in pages: dashboard (`/dashboard`), customers, ledger, overdue, monthly report,
  account (`/account`) and users (`/users`, admins only)
- `app/actions/` – Server Actions (customers, sales, payments, materials, auth, account, users)
- `lib/auth.ts` – signed-in user, role and which ledger is open
- `lib/users.ts` – adding and managing users through the Supabase Auth admin API
- `lib/queries.ts` – all reads and writes (Supabase views + `monthly_report` RPC, or the demo store)
- `lib/store.ts` – calculations shared by demo mode; they mirror the SQL views
- `lib/supabase/` – Supabase clients and session refresh used by `proxy.ts`
- `types/database.ts` – database types; regenerate with
  `npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts`
