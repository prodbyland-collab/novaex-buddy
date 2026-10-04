import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { nextDailyTime, countdown } from "../src/lib/member-time.js";
import { auditAuthAction } from "../src/lib/admin-audit.server.ts";

test("code and payout countdowns match Georgian schedules across midnight", () => {
  const now = Date.parse("2026-10-04T15:59:59Z");
  assert.equal(countdown(nextDailyTime(now, 16), now), "00:00:01");
  assert.equal(new Date(nextDailyTime(now + 1000, 16)).toISOString(), "2026-10-05T16:00:00.000Z");
  assert.equal(
    new Date(nextDailyTime(Date.parse("2026-10-04T23:56:00Z"), 23, 55)).toISOString(),
    "2026-10-05T23:55:00.000Z",
  );
  assert.equal(countdown(now - 1, now), "00:00:00");
});

test("auth mutations fail closed without an audit intent and finalize provider outcomes", async () => {
  let changed = false;
  const calls = [];
  const unavailable = {
    rpc: async () => ({ data: null, error: { message: "Audit unavailable" } }),
  };
  await assert.rejects(
    auditAuthAction(unavailable, "admin", "member", "account.delete", async () => {
      changed = true;
    }),
    /Audit unavailable/,
  );
  assert.equal(changed, false);
  const admin = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: name === "begin_admin_auth_action" ? "intent" : null, error: null };
    },
  };
  await auditAuthAction(admin, "admin", "member", "account.suspend", async () => {
    changed = true;
  });
  assert.equal(changed, true);
  assert.equal(calls[1].args.p_success, true);
  await assert.rejects(
    auditAuthAction(admin, "admin", "member", "account.delete", async () => {
      throw new Error("Provider failed");
    }),
    /Provider failed/,
  );
  assert.equal(calls[3].args.p_success, false);
  assert.equal(calls[3].args.p_error, "Provider failed");
});

test("member tools migration has an identical Drizzle mirror", async () => {
  assert.equal(
    await readFile(
      new URL("../supabase/migrations/20261004160000_member_tools.sql", import.meta.url),
      "utf8",
    ),
    await readFile(new URL("../drizzle/migrations/0005_member_tools.sql", import.meta.url), "utf8"),
  );
});
