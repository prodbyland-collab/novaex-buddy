# Balance payments for bot plans

Run the complete `supabase/migrations/20261004180000_balance_plan_purchases.sql` file in Lovable Cloud's SQL editor, after the existing secure accounting and member tools migrations. Then republish the app in Lovable.

Members can purchase Pro for $250 or Elite for $400 using their available USD cash balance. This charges the full price, including an upgrade from Pro to Elite. Crypto payments remain available. Balance purchases activate the plan immediately and show in plan payment history.

The server uses the verified member's identity. Database row locks keep the deduction and activation atomic, and request IDs make retries safe. Insufficient funds, already-owned tiers and downgrades are rejected without a charge. These purchases do not create deposits or referral qualification.
