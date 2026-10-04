import assert from "node:assert/strict";
import { test } from "node:test";
import { depositPrincipal, portfolioProfit, profitPercentage } from "../src/lib/portfolio-math.js";

test("new deposits update return percentage without treating principal as profit", () => {
  assert.deepEqual(portfolioProfit(500, 500, 0), { netInvested: 500, changeUsd: 0, changePct: 0 });
  assert.equal(portfolioProfit(520, 500, 0).changePct, 4);
  assert.deepEqual(portfolioProfit(1020, 1000, 0), {
    netInvested: 1000,
    changeUsd: 20,
    changePct: 2,
  });
  assert.deepEqual(portfolioProfit(1010, 1000, 0), {
    netInvested: 1000,
    changeUsd: 10,
    changePct: 1,
  });
});

test("withdrawals preserve lifetime profit and cannot cause a fabricated 100 percent return", () => {
  assert.deepEqual(portfolioProfit(420, 500, 100), {
    netInvested: 400,
    changeUsd: 20,
    changePct: 4,
  });
  assert.deepEqual(portfolioProfit(20, 500, 500), { netInvested: 0, changeUsd: 20, changePct: 4 });
  assert.equal(portfolioProfit(50, 500, 600).changePct, 30);
  assert.equal(portfolioProfit(500, 0, 0).changePct, null);
  assert.equal(profitPercentage(null), "—");
  assert.equal(profitPercentage(2), "+2.00%");
  assert.equal(profitPercentage(-2), "-2.00%");
});

test("principal includes credited balance deposits only and matches database cent rounding", () => {
  const paid = {
    purpose: "balance",
    credited_at: "2026-10-04",
    price_amount: 500,
    pay_amount: 2,
    actually_paid: 2,
  };
  assert.equal(
    depositPrincipal([paid, { ...paid, purpose: "plan" }, { ...paid, credited_at: null }]),
    500,
  );
  assert.equal(depositPrincipal([{ ...paid, actually_paid: 1 }]), 250);
  assert.equal(depositPrincipal([{ ...paid, actually_paid: 3 }]), 500);
  assert.equal(depositPrincipal([{ ...paid, price_amount: 501, actually_paid: 0.3333 }]), 83.49);
});
