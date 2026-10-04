import assert from "node:assert/strict";
import { test } from "node:test";
import { getCallbackUrl, paymentAddressSchema, paymentSchema } from "../src/lib/payment.ts";
import { fetchAllRows } from "../src/lib/pagination.ts";

test("payment validation rejects invalid status, nonfinite and negative payment amounts", () => {
  for (const amount of [-1, "NaN", Infinity])
    assert.equal(
      paymentSchema.safeParse({
        payment_id: 123,
        payment_status: "finished",
        actually_paid: amount,
      }).success,
      false,
    );
  assert.equal(
    paymentSchema.safeParse({ payment_id: 1, payment_status: "completed" }).success,
    false,
  );
  assert.equal(
    paymentAddressSchema.safeParse({
      payment_id: 1,
      payment_status: "waiting",
      pay_address: "address",
      pay_amount: 0,
    }).success,
    false,
  );
  assert.equal(
    paymentSchema.parse({ payment_id: 123, payment_status: "finished", actually_paid: "2.5" })
      .payment_id,
    "123",
  );
});
test("webhook callback uses configured deployment or actual request origin", () => {
  assert.equal(
    getCallbackUrl(undefined, "https://example.org/_server/function"),
    "https://example.org/api/public/nowpayments-webhook",
  );
  assert.equal(
    getCallbackUrl("https://production.example/subpath", "https://preview.example"),
    "https://production.example/api/public/nowpayments-webhook",
  );
  assert.throws(
    () => getCallbackUrl("http://production.example", "https://preview.example"),
    /HTTPS/,
  );
});
test("admin pagination includes every page and surfaces errors", async () => {
  const rows = Array.from({ length: 1203 }, (_, i) => i);
  assert.deepEqual(
    await fetchAllRows(async (from, to) => ({ data: rows.slice(from, to + 1), error: null })),
    rows,
  );
  await assert.rejects(
    fetchAllRows(async () => ({ data: null, error: { message: "database failed" } })),
    /database failed/,
  );
  await assert.rejects(
    fetchAllRows(async () => ({ data: null, error: null })),
    /Missing/,
  );
});
