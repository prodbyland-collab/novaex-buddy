// Match the cents credited by credit_crypto_deposit, including partial settlement.
export function depositPrincipal(deposits) {
  return deposits.reduce((sum, deposit) => {
    if (!deposit.credited_at || deposit.purpose !== "balance") return sum;
    const quoted = Number(deposit.pay_amount);
    if (!(quoted > 0)) return sum;
    const settled = Math.min(Number(deposit.actually_paid ?? 0) / quoted, 1);
    return sum + Math.round(Number(deposit.price_amount) * settled * 100) / 100;
  }, 0);
}

export function portfolioProfit(total, deposited, withdrawn) {
  const netInvested = deposited - withdrawn;
  const changeUsd = total - netInvested;
  // Withdrawals do not reduce the original funding used to measure lifetime return.
  // Without credited capital there is no meaningful percentage denominator.
  const changePct = deposited > 0 ? (changeUsd / deposited) * 100 : null;
  return { netInvested, changeUsd, changePct };
}

export function profitPercentage(value) {
  return value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
