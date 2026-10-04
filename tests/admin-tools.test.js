import test from "node:test";
import assert from "node:assert/strict";
import { changeAccountAccess, toCsv } from "../src/lib/admin-tools.ts";

test("CSV escapes multiline fields, quotes and spreadsheet formulas", () => {
  const csv = toCsv([
    { email: '=HYPERLINK("malicious")', notes: 'line one,\n"line two"', balance: -5 },
  ]);
  assert.equal(
    csv,
    '\uFEFF"email","notes","balance"\r\n"\'=HYPERLINK(""malicious"")","line one,\n""line two""","-5"',
  );
  for (const value of [" +formula", "@formula", "-formula", "\t=formula"]) {
    assert.ok(toCsv([{ value }]).includes(`"'${value}"`));
  }
  assert.equal(toCsv([]), "");
});

test("suspension and restoration use the auth provider", async () => {
  const calls = [];
  const client = {
    auth: {
      admin: {
        updateUserById: async (...args) => {
          calls.push(args);
          return { error: null };
        },
      },
    },
  };
  await changeAccountAccess(client, "admin", "member", true);
  await changeAccountAccess(client, "admin", "member", false);
  assert.deepEqual(calls, [
    ["member", { ban_duration: "876000h" }],
    ["member", { ban_duration: "none" }],
  ]);
  await assert.rejects(changeAccountAccess(client, "admin", "admin", true), /own sign-in/);
  await assert.rejects(changeAccountAccess(client, "admin", "admin", false), /own sign-in/);
  assert.equal(calls.length, 2);
});

test("auth provider errors are surfaced to the administrator", async () => {
  const client = {
    auth: {
      admin: { updateUserById: async () => ({ error: { message: "Provider unavailable" } }) },
    },
  };
  await assert.rejects(
    changeAccountAccess(client, "admin", "member", true),
    /Provider unavailable/,
  );
});
