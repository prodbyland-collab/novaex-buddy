import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const migrationDirectory = new URL("../supabase/migrations/", import.meta.url);
const latest = "20261004120000_secure_accounting.sql";
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
const value = async (sql, args = []) => Object.values((await query(sql, args))[0])[0];
async function asUser(id, fn, aal = "aal1") {
  await query(
    "SELECT set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claims',$2,false)",
    [id, JSON.stringify({ aal })],
  );
  await db.exec("SET ROLE authenticated");
  try {
    return await fn();
  } finally {
    await db.exec("RESET ROLE");
  }
}
async function service(fn) {
  await db.exec("SET ROLE service_role");
  try {
    return await fn();
  } finally {
    await db.exec("RESET ROLE");
  }
}
async function account(balance = 1000) {
  const id = randomUUID();
  await query("INSERT INTO auth.users(id,raw_user_meta_data) VALUES($1,$2)", [
    id,
    { legal_accepted: true, terms_version: "2026-10-03", privacy_version: "2026-10-03" },
  ]);
  await asUser(id, () => query("SELECT public.ensure_my_account()"));
  await service(() => query("SELECT public.admin_change_balance($1,'USD',$2,true)", [id, balance]));
  return id;
}
const balance = (id, symbol = "USD") =>
  value("SELECT amount FROM public.holdings WHERE user_id=$1 AND symbol=$2", [id, symbol]).then(
    Number,
  );
const withdraw = (
  id,
  requestId = randomUUID(),
  amount = 100,
  address = "approved-wallet-address",
) =>
  service(() =>
    value("SELECT to_jsonb(public.record_withdrawal($1,'USD',$2,$3,1,$4))", [
      id,
      amount,
      address,
      requestId,
    ]),
  );
async function deposit(id, purpose = "balance", plan = null) {
  const payment = randomUUID();
  await query(
    "INSERT INTO public.crypto_deposits(user_id,payment_id,pay_currency,price_amount,pay_amount,purpose,plan_id,status) VALUES($1,$2,'btc',1000,2,$3,$4,'finished')",
    [id, payment, purpose, plan],
  );
  return payment;
}
const credit = (payment, paid, status = "finished") =>
  service(() => query("SELECT public.credit_crypto_deposit($1,$2,$3)", [payment, status, paid]));

before(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA cron;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, raw_user_meta_data jsonb DEFAULT '{}');
    CREATE TABLE auth.mfa_factors(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, status text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    CREATE TABLE cron.job(name text PRIMARY KEY, schedule text, command text);
    CREATE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE sql AS $$ INSERT INTO cron.job VALUES($1,$2,$3) ON CONFLICT(name) DO UPDATE SET schedule=$2,command=$3 RETURNING 1::bigint $$;
  `);
  for (const file of (await readdir(migrationDirectory)).filter((f) => f.endsWith(".sql")).sort()) {
    // Supabase's cron/network services are mocked; every accounting function,
    // constraint, privilege and RLS policy runs in real embedded PostgreSQL.
    const sql = (await readFile(new URL(file, migrationDirectory), "utf8")).replace(
      /CREATE EXTENSION IF NOT EXISTS pg_(?:cron|net);/g,
      "",
    );
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`Migration ${file}: ${error.message}`, { cause: error });
    }
  }
});
after(() => db.close());

test("authenticated users cannot forge balances, payouts, withdrawals or orders", async () => {
  const id = await account();
  await asUser(id, async () => {
    for (const sql of [
      "UPDATE public.holdings SET amount=99999",
      "UPDATE public.ai_trading_settings SET plan_rate=99",
      "INSERT INTO public.withdrawals(symbol,amount,address) VALUES('USD',1,'address')",
      "DELETE FROM public.orders",
      "UPDATE public.security_settings SET withdrawal_whitelist=false",
      "INSERT INTO public.recurring_buys(symbol,amount_usd,frequency) VALUES('BTC',10,'daily')",
      "SELECT public.record_withdrawal(auth.uid(),'USD',1,'wallet-address',1,gen_random_uuid())",
    ]) {
      await assert.rejects(query(sql), /permission denied/);
    }
    await query("SELECT public.set_my_trading_mode(true)");
  });
  assert.equal(await balance(id), 1000);
});
test("RLS isolates accounts and enforces MFA even on direct database access", async () => {
  const id = await account();
  const other = await account();
  await asUser(id, async () =>
    assert.equal(
      (await query("SELECT * FROM public.holdings WHERE user_id=$1", [other])).length,
      0,
    ),
  );
  await query("INSERT INTO auth.mfa_factors(user_id,status) VALUES($1,'verified')", [id]);
  await asUser(id, async () => {
    assert.equal((await query("SELECT * FROM public.holdings")).length, 0);
    await assert.rejects(query("SELECT public.ensure_my_account()"), /verification required/);
    await assert.rejects(query("SELECT public.claim_referral('INVITE')"), /verification required/);
  });
  await asUser(
    id,
    async () => assert.equal((await query("SELECT * FROM public.holdings")).length, 1),
    "aal2",
  );
});
test("withdrawal retries debit once and preserve completed status", async () => {
  const id = await account();
  const request = randomUUID();
  const first = await withdraw(id, request);
  assert.equal(first.status, "completed");
  assert.equal(Number(first.net_amount), 80);
  assert.equal((await withdraw(id, request)).id, first.id);
  assert.equal(await balance(id), 900);
  await assert.rejects(withdraw(id, request, 101), /already used/);
  await assert.rejects(withdraw(id, randomUUID(), 1001), /Insufficient/);
  assert.equal(await balance(id), 900);
});
test("withdrawal whitelist is enforced by the transaction", async () => {
  const id = await account();
  await asUser(id, () =>
    query("SELECT public.configure_my_security(true,ARRAY['approved-wallet-address'])"),
  );
  await assert.rejects(withdraw(id, randomUUID(), 100, "unapproved-wallet-address"), /whitelist/);
  assert.equal(await balance(id), 1000);
  await withdraw(id);
  assert.equal(await balance(id), 900);
});
test("an insert failure rolls back the withdrawal debit", async () => {
  const id = await account();
  await db.exec(
    "CREATE FUNCTION public.test_reject_withdrawal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test insert failure'; END $$; CREATE TRIGGER test_reject BEFORE INSERT ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.test_reject_withdrawal();",
  );
  try {
    await assert.rejects(withdraw(id), /test insert failure/);
  } finally {
    await db.exec(
      "DROP TRIGGER test_reject ON public.withdrawals; DROP FUNCTION public.test_reject_withdrawal()",
    );
  }
  assert.equal(await balance(id), 1000);
});
test("failed withdrawals refund exactly once and cannot be reopened", async () => {
  const id = await account();
  const row = await withdraw(id);
  const status = (s) =>
    service(() => query("SELECT public.admin_change_withdrawal($1,$2)", [row.id, s]));
  await status("failed");
  await status("failed");
  assert.equal(await balance(id), 1000);
  await assert.rejects(status("completed"), /cannot be reopened/);
});
test("market orders move both balances atomically and retry once", async () => {
  const id = await account();
  const request = randomUUID();
  const order = (side, amount, req = request) =>
    service(() =>
      value("SELECT to_jsonb(public.record_market_order($1,'BTC',$2,$3,100,$4))", [
        id,
        side,
        amount,
        req,
      ]),
    );
  await order("buy", 2);
  await order("buy", 2);
  assert.equal(await balance(id), 800);
  assert.equal(await balance(id, "BTC"), 2);
  await assert.rejects(order("sell", 3, randomUUID()), /Insufficient/);
  assert.equal(await balance(id, "BTC"), 2);
  await order("sell", 1, randomUUID());
  assert.equal(await balance(id), 900);
  assert.equal(await balance(id, "BTC"), 1);
});
test("deposit reuse matches amount and plan and recovers abandoned drafts", async () => {
  const id = await account();
  const reserve = (amount, plan = null) =>
    service(() => value("SELECT public.reserve_deposit($1,'btc',$2,$3)", [id, amount, plan]));
  const first = await reserve(1000);
  assert.equal((await reserve(1000)).deposit.id, first.deposit.id);
  assert.equal((await reserve(500)).created, true);
  assert.equal((await reserve(1000, "pro")).created, true);
  await query(
    "UPDATE public.crypto_deposits SET created_at=now()-interval '3 minutes' WHERE id=$1",
    [first.deposit.id],
  );
  assert.equal((await reserve(1000)).created, true);
  assert.equal(
    await value("SELECT status FROM public.crypto_deposits WHERE id=$1", [first.deposit.id]),
    "creation_failed",
  );
});
test("finished deposits credit settled proportion once and callbacks cannot rewrite them", async () => {
  const id = await account(0);
  const payment = await deposit(id);
  await credit(payment, 1, "confirmed");
  assert.equal(await balance(id), 0);
  await credit(payment, 1);
  await credit(payment, 2);
  await credit(payment, 0, "refunded");
  assert.equal(await balance(id), 500);
  assert.equal(
    await value("SELECT status FROM public.crypto_deposits WHERE payment_id=$1", [payment]),
    "finished",
  );
  await assert.rejects(credit("unknown", 2), /not found/);
});
test("underpaid plans are not granted and paid plans cannot downgrade", async () => {
  const id = await account(0);
  const pro = await deposit(id, "plan", "pro");
  await credit(pro, 1);
  assert.equal(
    await value("SELECT plan_id FROM public.ai_trading_settings WHERE user_id=$1", [id]),
    "free",
  );
  const elite = await deposit(id, "plan", "elite");
  await credit(elite, 2);
  await credit(pro, 2);
  assert.equal(
    await value("SELECT plan_id FROM public.ai_trading_settings WHERE user_id=$1", [id]),
    "elite",
  );
  assert.equal(await balance(id), 0);
});
test("referral eligibility, capped bonus and daily payout agree", async () => {
  const id = await account();
  for (let i = 0; i < 4; i++) {
    const child = await account(0);
    await query("INSERT INTO public.referrals(referrer_id,referee_id,code) VALUES($1,$2,'TEST')", [
      id,
      child,
    ]);
    if (i < 3) await credit(await deposit(child), 2);
  }
  const info = await asUser(id, () => value("SELECT public.get_my_referral_info()"));
  assert.equal(info.active_referrals, 3);
  assert.equal(info.bonus_rate, 0.01);
  await asUser(id, () => query("SELECT public.set_my_trading_mode(true)"));
  await query(
    "UPDATE public.ai_trading_settings SET boost_date=(now() AT TIME ZONE 'utc')::date WHERE user_id=$1",
    [id],
  );
  await service(() => query("SELECT public.run_daily_ai_trading_payout()"));
  assert.equal(await balance(id), 1030);
  await service(() => query("SELECT public.run_daily_ai_trading_payout()"));
  assert.equal(await balance(id), 1030);
  assert.equal(await value("SELECT side FROM public.ai_trades WHERE user_id=$1", [id]), "credit");
  assert.equal(
    await value("SELECT schedule FROM cron.job WHERE name='gng-daily-payout'"),
    "55 23 * * *",
  );
});
test("Supabase and Drizzle fixes match and reapplication preserves trusted addresses", async () => {
  const sql = await readFile(new URL(latest, migrationDirectory), "utf8");
  assert.equal(
    sql,
    await readFile(
      new URL("../drizzle/migrations/0002_secure_accounting.sql", import.meta.url),
      "utf8",
    ),
  );
  const id = await account();
  await asUser(id, () =>
    query("SELECT public.configure_my_security(true,ARRAY['approved-wallet-address'])"),
  );
  await db.exec(sql);
  assert.deepEqual(
    await value("SELECT approved_addresses FROM public.security_settings WHERE user_id=$1", [id]),
    ["approved-wallet-address"],
  );
});
