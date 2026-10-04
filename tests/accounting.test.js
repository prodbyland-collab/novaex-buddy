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

test("group read policy replaces open rules and requires a verified member for published posts", async () => {
  const member = await account();
  const news = randomUUID(),
    future = randomUUID(),
    expired = randomUUID();
  await query(
    "INSERT INTO public.group_announcements(id,kind,body) VALUES($1,'news','Published news')",
    [news],
  );
  await query(
    "INSERT INTO public.group_announcements(id,kind,body,created_at) VALUES($1,'news','Future news',now()+interval '1 day')",
    [future],
  );
  await query(
    "INSERT INTO public.group_announcements(id,kind,code,code_date,expires_at,created_at) VALUES($1,'code','ARCHIVED-CODE',current_date-100,now()-interval '1 day',now()-interval '2 days')",
    [expired],
  );
  const ids = [news, future, expired];
  const visible = () =>
    query("SELECT id FROM public.group_announcements WHERE id=ANY($1) ORDER BY id", [ids]);
  assert.deepEqual((await asUser(member, visible)).map((r) => r.id).sort(), [news, expired].sort());
  await query("INSERT INTO auth.mfa_factors(user_id,status) VALUES($1,'verified')", [member]);
  assert.equal((await asUser(member, visible)).length, 0);
  assert.equal((await asUser(member, visible, "aal2")).length, 2);
  assert.equal((await asUser("", visible)).length, 0);
  await db.exec("SET ROLE anon");
  try {
    await assert.rejects(visible(), /permission denied/);
  } finally {
    await db.exec("RESET ROLE");
  }
  await assert.rejects(
    asUser(
      member,
      () => query("INSERT INTO public.group_announcements(kind,body) VALUES('news','Forged news')"),
      "aal2",
    ),
    /permission denied/,
  );
  assert.equal((await service(visible)).length, 3);

  const migration = await readFile(
    new URL("20261004200000_group_read_policy.sql", migrationDirectory),
    "utf8",
  );
  assert.equal(
    migration,
    await readFile(
      new URL("../drizzle/migrations/0007_group_read_policy.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(migration);
  const policies = await query(
    "SELECT policyname,qual FROM pg_policies WHERE schemaname='public' AND tablename='group_announcements'",
  );
  assert.ok(policies.some((p) => p.policyname === "group_announcements_verified_read"));
  assert.ok(policies.every((p) => p.qual !== "true"));
  assert.ok(
    policies.every(
      (p) => !["Members read announcements", "group_announcements_select"].includes(p.policyname),
    ),
  );
});

const purchasePlan = (id, plan, requestId = randomUUID()) =>
  service(() => value("SELECT public.purchase_balance_plan($1,$2,$3)", [id, plan, requestId]));

test("balance plan purchases deduct fixed prices, activate immediately and safely replay", async () => {
  const id = await account(650);
  const request = randomUUID();
  const pro = await purchasePlan(id, "pro", request);
  assert.equal(Number(pro.price_amount), 250);
  assert.equal(await balance(id), 400);
  assert.equal(
    await value("SELECT plan_id FROM public.ai_trading_settings WHERE user_id=$1", [id]),
    "pro",
  );
  assert.deepEqual(await purchasePlan(id, "pro", request), pro);
  assert.equal(await balance(id), 400);
  await assert.rejects(purchasePlan(id, "elite", request), /Request already used/);
  await assert.rejects(purchasePlan(id, "pro"), /already active/);
  const elite = await purchasePlan(id, "elite");
  assert.equal(Number(elite.price_amount), 400);
  assert.equal(await balance(id), 0);
  const settings = (
    await query(
      "SELECT plan_id,plan_rate,enabled FROM public.ai_trading_settings WHERE user_id=$1",
      [id],
    )
  )[0];
  assert.equal(settings.plan_id, "elite");
  assert.equal(Number(settings.plan_rate), 0.05);
  assert.equal(settings.enabled, true);
  await assert.rejects(purchasePlan(id, "pro"), /already active/);
  assert.equal(
    Number(
      await value("SELECT count(*) FROM public.balance_plan_purchases WHERE user_id=$1", [id]),
    ),
    2,
  );
  assert.equal(
    Number(await value("SELECT count(*) FROM public.crypto_deposits WHERE user_id=$1", [id])),
    0,
  );
  assert.equal(
    Number(
      await value(
        "SELECT count(*) FROM public.member_notifications WHERE user_id=$1 AND kind='plan'",
        [id],
      ),
    ),
    2,
  );
});

test("failed balance purchases leave balances, plans and history unchanged", async () => {
  const id = await account(249.99);
  await assert.rejects(purchasePlan(id, "pro"), /Insufficient USD balance/);
  await assert.rejects(purchasePlan(id, "elite"), /Insufficient USD balance/);
  await assert.rejects(purchasePlan(id, "free"), /Unknown bot plan/);
  assert.equal(await balance(id), 249.99);
  assert.equal(
    await value("SELECT plan_id FROM public.ai_trading_settings WHERE user_id=$1", [id]),
    "free",
  );
  assert.equal(
    Number(
      await value("SELECT count(*) FROM public.balance_plan_purchases WHERE user_id=$1", [id]),
    ),
    0,
  );
});

test("a balance purchase failure after deduction rolls back the entire transaction", async () => {
  const id = await account(500);
  await db.exec(`
    CREATE FUNCTION public.reject_test_plan_purchase() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Test purchase failure'; END $$;
    CREATE TRIGGER reject_test_plan_purchase BEFORE INSERT ON public.balance_plan_purchases
      FOR EACH ROW EXECUTE FUNCTION public.reject_test_plan_purchase();
  `);
  try {
    await assert.rejects(purchasePlan(id, "pro"), /Test purchase failure/);
    assert.equal(await balance(id), 500);
    assert.equal(
      await value("SELECT plan_id FROM public.ai_trading_settings WHERE user_id=$1", [id]),
      "free",
    );
    assert.equal(
      Number(
        await value(
          "SELECT count(*) FROM public.member_notifications WHERE user_id=$1 AND kind='plan'",
          [id],
        ),
      ),
      0,
    );
  } finally {
    await db.exec(
      "DROP TRIGGER reject_test_plan_purchase ON public.balance_plan_purchases; DROP FUNCTION public.reject_test_plan_purchase()",
    );
  }
});

test("balance purchase history is owner-only and financial writes are service-only", async () => {
  const id = await account(500),
    other = await account();
  await purchasePlan(id, "pro");
  assert.equal(
    (await asUser(id, () => query("SELECT * FROM public.balance_plan_purchases"))).length,
    1,
  );
  assert.equal(
    (await asUser(other, () => query("SELECT * FROM public.balance_plan_purchases"))).length,
    0,
  );
  await assert.rejects(
    asUser(other, () =>
      query("SELECT public.purchase_balance_plan($1,'elite',$2)", [id, randomUUID()]),
    ),
    /permission denied/,
  );
  await assert.rejects(
    asUser(id, () => query("DELETE FROM public.balance_plan_purchases WHERE user_id=$1", [id])),
    /permission denied/,
  );
  assert.equal(await balance(id), 250);
});

test("audited administrator changes are atomic, service-only and preserve before/after values", async () => {
  const admin = await account(),
    member = await account();
  await query("INSERT INTO public.user_roles(user_id,role) VALUES($1,'admin')", [admin]);
  const act = (actor, action, target, details) =>
    service(() =>
      value("SELECT public.perform_admin_action($1,$2,$3,$4)", [actor, action, target, details]),
    );
  await assert.rejects(
    act(member, "balance.set", member, { symbol: "USD", value: 500 }),
    /Forbidden/,
  );
  await asUser(admin, () =>
    assert.rejects(
      query("SELECT public.perform_admin_action($1,'balance.set',$2,'{}')", [admin, member]),
      /permission denied/,
    ),
  );
  await act(admin, "balance.set", member, { symbol: "USD", value: 700 });
  assert.equal(await balance(member), 700);
  const audit = (
    await query(
      "SELECT * FROM public.admin_audit_log WHERE target_id=$1 AND action='balance.set'",
      [member],
    )
  )[0];
  assert.equal(audit.actor_id, admin);
  assert.equal(audit.details.before.amount, 1000);
  assert.equal(audit.details.result.amount, 700);
  await assert.rejects(
    act(admin, "balance.adjust", member, { symbol: "USD", value: -900 }),
    /balance|funds/i,
  );
  assert.equal(await balance(member), 700);
  assert.equal(
    Number(await value("SELECT count(*) FROM public.admin_audit_log WHERE target_id=$1", [member])),
    1,
  );
  await asUser(member, async () =>
    assert.equal(Number(await value("SELECT count(*) FROM public.admin_audit_log")), 0),
  );
  await act(admin, "plan.set", member, { plan: "pro", enabled: true });
  await act(admin, "boost.set", member, { grant: true });
  await act(admin, "role.set", member, { admin: true });
  await assert.rejects(act(admin, "role.set", admin, { admin: false }), /own admin/);
  assert.equal(
    await value("SELECT plan_id FROM public.ai_trading_settings WHERE user_id=$1", [member]),
    "pro",
  );
});

test("deposit and plan alerts are private, idempotent, and read receipts cannot be forged", async () => {
  const owner = await account(),
    stranger = await account(),
    payment = await deposit(owner);
  await credit(payment, 2);
  await credit(payment, 2);
  const rows = await query("SELECT * FROM public.member_notifications WHERE user_id=$1", [owner]);
  assert.equal(rows.filter((r) => r.kind === "deposit").length, 1);
  assert.equal(rows[0].details.amount, 1000);
  await asUser(stranger, async () => {
    assert.equal(
      Number(
        await value("SELECT count(*) FROM public.member_notifications WHERE user_id=$1", [owner]),
      ),
      0,
    );
    await query("SELECT public.mark_notifications_read($1)", [[rows[0].id]]);
    assert.equal(
      Number(
        await value("SELECT count(*) FROM public.notification_reads WHERE notification_id=$1", [
          rows[0].id,
        ]),
      ),
      0,
    );
    await assert.rejects(
      query("INSERT INTO public.member_notifications(kind,event_key) VALUES('code','forged')"),
      /permission denied/,
    );
  });
  await asUser(owner, () => query("SELECT public.mark_notifications_read($1)", [[rows[0].id]]));
  assert.equal(
    Number(
      await value("SELECT count(*) FROM public.notification_reads WHERE notification_id=$1", [
        rows[0].id,
      ]),
    ),
    1,
  );
  const planPayment = await deposit(owner, "plan", "pro");
  await credit(planPayment, 2);
  await credit(planPayment, 2);
  assert.equal(
    Number(
      await value(
        "SELECT count(*) FROM public.member_notifications WHERE user_id=$1 AND kind='plan'",
        [owner],
      ),
    ),
    1,
  );
});

test("global code alerts expire and rotations become unread again", async () => {
  const owner = await account();
  const id = randomUUID();
  await query(
    "INSERT INTO public.group_announcements(id,kind,body,code,code_date,expires_at) VALUES($1,'code','','TEST-CODE',current_date,now()+interval '10 minutes')",
    [id],
  );
  const notification = await value(
    "SELECT id FROM public.member_notifications WHERE event_key=$1",
    [`code:${id}`],
  );
  await asUser(owner, () => query("SELECT public.mark_notifications_read($1)", [[notification]]));
  await query("UPDATE public.group_announcements SET code='ROTATED-CODE' WHERE id=$1", [id]);
  assert.equal(
    Number(
      await value("SELECT count(*) FROM public.notification_reads WHERE notification_id=$1", [
        notification,
      ]),
    ),
    0,
  );
  assert.equal(
    await value("SELECT details->>'code' FROM public.member_notifications WHERE id=$1", [
      notification,
    ]),
    "ROTATED-CODE",
  );
  await query(
    "UPDATE public.group_announcements SET expires_at=now()-interval '1 second' WHERE id=$1",
    [id],
  );
  await asUser(owner, async () =>
    assert.equal(
      Number(
        await value("SELECT count(*) FROM public.member_notifications WHERE id=$1", [notification]),
      ),
      0,
    ),
  );
});

test("auth audit intents record failures and survive account deletion", async () => {
  const admin = await account(),
    member = await account();
  await query("INSERT INTO public.user_roles(user_id,role) VALUES($1,'admin')", [admin]);
  const id = await service(() =>
    value("SELECT public.begin_admin_auth_action($1,$2,'account.delete')", [admin, member]),
  );
  assert.equal(
    await value("SELECT outcome FROM public.admin_audit_log WHERE id=$1", [id]),
    "pending",
  );
  await service(() =>
    query("SELECT public.finish_admin_auth_action($1,false,'Provider refused')", [id]),
  );
  assert.equal(
    await value("SELECT outcome FROM public.admin_audit_log WHERE id=$1", [id]),
    "failed",
  );
  await query("DELETE FROM auth.users WHERE id=$1", [member]);
  assert.equal(
    await value("SELECT target_id FROM public.admin_audit_log WHERE id=$1", [id]),
    member,
  );
});

test("notification and audit reads require MFA and the migration safely reapplies", async () => {
  const admin = await account(),
    payment = await deposit(admin);
  await credit(payment, 2);
  await query("INSERT INTO public.user_roles(user_id,role) VALUES($1,'admin')", [admin]);
  await query("INSERT INTO auth.mfa_factors(user_id,status) VALUES($1,'verified')", [admin]);
  await asUser(admin, async () => {
    assert.equal(
      Number(
        await value("SELECT count(*) FROM public.member_notifications WHERE user_id=$1", [admin]),
      ),
      0,
    );
    assert.equal(Number(await value("SELECT count(*) FROM public.admin_audit_log")), 0);
    await assert.rejects(query("SELECT public.mark_notifications_read()"), /verification required/);
  });
  await asUser(
    admin,
    async () => {
      assert.equal(
        Number(
          await value("SELECT count(*) FROM public.member_notifications WHERE user_id=$1", [admin]),
        ),
        1,
      );
      await query("SELECT public.mark_notifications_read()");
    },
    "aal2",
  );
  await db.exec(
    await readFile(new URL("20261004160000_member_tools.sql", migrationDirectory), "utf8"),
  );
  assert.equal(
    Number(
      await value("SELECT count(*) FROM public.member_notifications WHERE user_id=$1", [admin]),
    ),
    1,
  );
});

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
test("test payments update the member balance and activate Pro and Elite at actual pack prices", async (context) => {
  const id = await account(0);
  const createPayment = async (amount, plan = null) => {
    const reservation = await service(() =>
      value("SELECT public.reserve_deposit($1,'btc',$2,$3)", [id, amount, plan]),
    );
    assert.equal(reservation.created, true);
    const payment = randomUUID(),
      quoted = amount / 100000;
    await service(() =>
      query(
        "UPDATE public.crypto_deposits SET payment_id=$1,pay_amount=$2,pay_address='synthetic-test-address',status='waiting' WHERE id=$3",
        [payment, quoted, reservation.deposit.id],
      ),
    );
    return { payment, quoted, id: reservation.deposit.id };
  };
  const memberState = () =>
    asUser(id, async () => ({
      balance: Number(
        await value("SELECT amount FROM public.holdings WHERE user_id=$1 AND symbol='USD'", [id]),
      ),
      ...(
        await query(
          "SELECT plan_id,plan_rate,enabled FROM public.ai_trading_settings WHERE user_id=$1",
          [id],
        )
      )[0],
    }));
  const depositPayment = await createPayment(500);
  await credit(depositPayment.payment, depositPayment.quoted, "confirmed");
  assert.equal((await memberState()).balance, 0);
  await credit(depositPayment.payment, depositPayment.quoted, "finished");
  await credit(depositPayment.payment, depositPayment.quoted, "finished");
  let state = await memberState();
  assert.equal(state.balance, 500);
  assert.equal(state.plan_id, "free");
  context.diagnostic(
    "Balance deposit $500: $0 → $500; duplicate confirmation remains $500; bot stays Free.",
  );
  for (const [plan, price, rate] of [
    ["pro", 250, 0.03],
    ["elite", 400, 0.05],
  ]) {
    const pack = await createPayment(price, plan),
      before = (await memberState()).plan_id;
    await credit(pack.payment, pack.quoted, "confirmed");
    assert.equal((await memberState()).plan_id, before);
    await credit(pack.payment, pack.quoted, "finished");
    await credit(pack.payment, pack.quoted, "finished");
    state = await memberState();
    assert.equal(state.plan_id, plan);
    assert.equal(Number(state.plan_rate), rate);
    assert.equal(state.enabled, true);
    assert.equal(state.balance, 500);
    assert.ok(await value("SELECT credited_at FROM public.crypto_deposits WHERE id=$1", [pack.id]));
    context.diagnostic(
      `${plan.toUpperCase()} pack $${price}: ${before} → ${plan}, AI enabled at ${rate * 100}%; wallet stays $500.`,
    );
  }
  const alerts = await asUser(id, () =>
    query("SELECT kind,details FROM public.member_notifications WHERE user_id=$1", [id]),
  );
  assert.equal(alerts.filter((a) => a.kind === "deposit").length, 1);
  assert.deepEqual(
    alerts
      .filter((a) => a.kind === "plan")
      .map((a) => a.details.plan)
      .sort(),
    ["elite", "pro"],
  );
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
      new URL("../drizzle/migrations/0003_secure_accounting.sql", import.meta.url),
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

test("group codes publish at 20:00 Tbilisi and expire on the server after ten minutes", async () => {
  const sql = await readFile(
    new URL("20261004140000_ten_minute_group_codes.sql", migrationDirectory),
    "utf8",
  );
  assert.equal(
    sql,
    await readFile(
      new URL("../drizzle/migrations/0004_ten_minute_group_codes.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(sql);
  assert.equal(
    await value("SELECT schedule FROM cron.job WHERE name='gng-site-daily-code'"),
    "0 16 * * *",
  );
  assert.equal(
    await value(
      "SELECT (timestamptz '2026-10-04 16:00:00+00' AT TIME ZONE 'Asia/Tbilisi')::time::text",
    ),
    "20:00:00",
  );
  const id = await account();
  const code = await service(() => value("SELECT public.rotate_daily_group_code()"));
  assert.equal(
    Number(
      await value(
        "SELECT extract(epoch FROM expires_at-created_at) FROM public.group_announcements WHERE code=$1",
        [code],
      ),
    ),
    600,
  );
  const redeem = () => asUser(id, () => value("SELECT public.redeem_ai_code($1)", [code]));
  assert.equal((await redeem()).ok, true);
  await query(
    "UPDATE public.daily_ai_codes SET sent_at=now()-interval '10 minutes' WHERE code=$1",
    [code],
  );
  assert.equal((await redeem()).ok, false);
  await query(
    "UPDATE public.daily_ai_codes SET sent_at=now()-interval '11 minutes' WHERE code=$1",
    [code],
  );
  assert.equal((await redeem()).ok, false);
});
