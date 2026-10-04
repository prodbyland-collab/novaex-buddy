import assert from "node:assert/strict";
import { test } from "node:test";
import { assertVerifiedSession } from "../src/integrations/supabase/session-verification.ts";

test("missing verification migration reports a deployment issue and never allows access", () => {
  for (const code of ["PGRST202", "42883"]) {
    assert.throws(
      () => assertVerifiedSession({ data: null, error: { code, message: "Missing function" } }),
      /deployment needs a database update/,
    );
  }
});
test("verification service failures are distinct from MFA failures and deny access", () => {
  assert.throws(
    () =>
      assertVerifiedSession({ data: true, error: { code: "42501", message: "Permission denied" } }),
    /temporarily unavailable/,
  );
  for (const data of [false, null])
    assert.throws(
      () => assertVerifiedSession({ data, error: null }),
      /Complete authentication verification/,
    );
});
test("verified sessions proceed only after a successful verification query", () => {
  assert.doesNotThrow(() => assertVerifiedSession({ data: true, error: null }));
});
