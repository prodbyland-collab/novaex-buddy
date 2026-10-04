# Deploying the accounting and security fixes

Apply database changes and deploy the matching application together. The browser
now has read access to financial records; mutations require the authenticated
server functions and restricted database RPCs.

## Database

`supabase/migrations` is the canonical migration history. Apply pending migrations
in filename order, including `20261004120000_secure_accounting.sql`, using your
Supabase deployment workflow. Do not replay the old referral migrations afterward.
For an existing database managed by Drizzle, `0003_secure_accounting.sql` contains
the identical final definitions. Drizzle's history is incremental over the existing
Supabase schema; it does not create a fresh database. Choose one migration runner.

The migration restricts financial writes, adds trusted withdrawal addresses and
request IDs, enforces MFA, reconciles referral eligibility, and schedules payouts.
Existing balances and completed withdrawal statuses remain. Existing metadata
withdrawal addresses are imported once. Users previously marked as having 2FA
must enroll an actual authenticator; the old flag did not protect sign-in.

Verify these Supabase Cron jobs are enabled and successful after deployment:

| Job                   | UTC   | Tbilisi                 | Action                                           |
| --------------------- | ----- | ----------------------- | ------------------------------------------------ |
| `gng-site-daily-code` | 16:00 | 20:00                   | Publish the daily code, valid for one hour       |
| `gng-daily-payout`    | 23:55 | 03:55 next calendar day | Credit the preceding UTC day's programmed payout |

Payout eligibility and daily boosts use UTC dates. Payouts are idempotent per UTC
day. A manual early payout prevents a later boost from affecting that day's credit.
Referrals qualify after a credited **balance** deposit; plan payments do not count.
The referral bonus is 0.5 percentage points per qualifying friend, capped at one
percentage point. Daily codes add one percentage point.

Withdrawals intentionally remain simulated and recorded as `completed`. No payout
provider has been added. Marking a withdrawal failed refunds its original asset
amount once; a refunded withdrawal cannot be reopened. Previously failed records
are not automatically refunded because their historical accounting is ambiguous.

## Application configuration

Configure the same Supabase project for the browser and server:

| Variable                        | Where            | Purpose                                         |
| ------------------------------- | ---------------- | ----------------------------------------------- |
| `VITE_SUPABASE_URL`             | Build            | Browser Supabase endpoint                       |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Build            | Public browser API key                          |
| `SUPABASE_URL`                  | Server           | Supabase endpoint                               |
| `SUPABASE_PUBLISHABLE_KEY`      | Server           | Public key for authenticated server requests    |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server only      | Trusted financial and administrator RPCs        |
| `NOWPAYMENTS_API_KEY`           | Server only      | Payment creation and reconciliation             |
| `NOWPAYMENTS_IPN_SECRET`        | Server only      | Verify payment callbacks                        |
| `PUBLIC_SITE_URL`               | Server           | Public HTTPS origin receiving callbacks         |
| `LOVABLE_CRON_SECRET`           | Server, optional | Authenticate the fallback code-publication hook |

Enable TOTP MFA in Supabase Auth. Keep service and payment secrets out of `VITE_*`
variables. NOWPayments must reach `/api/public/nowpayments-webhook`. Only finished
payments credit balances, in proportion to actual payment and capped at the quote;
plans require full payment. Login email alerts display as unavailable until an
email delivery integration exists. Limit and recurring order entry points remain
unavailable because the project has no execution workers for them.

## Verification

Use Node 24 or newer for the test runner's TypeScript support. Bun's checked-in
lockfile includes the embedded PostgreSQL test dependency.

```sh
bun install --frozen-lockfile
npm test
npm run typecheck
npm run lint
npm run build
```

The accounting suite executes the full Supabase migration history in embedded
PostgreSQL, with only Supabase Auth fixtures and Cron/network services mocked. It
tests privileges, RLS/MFA, atomic rollback, retry IDs, whitelist enforcement,
refunds, deposits, plan settlement, referral rules and daily payouts. It does not
make real payments or change the live database. After deployment, verify MFA with
a test account and payment creation/settlement in the provider's test environment.
