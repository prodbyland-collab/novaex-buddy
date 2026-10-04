export function parseWhitelist(value) {
  const addresses = [
    ...new Set(
      String(value)
        .split(/\r?\n/)
        .map((address) => address.trim())
        .filter(Boolean),
    ),
  ];
  if (
    addresses.length > 50 ||
    addresses.some((address) => address.length < 12 || address.length > 256 || /\s/.test(address))
  ) {
    throw new Error(
      "Enter up to 50 addresses, one per line, with 12–256 characters and no spaces.",
    );
  }
  return addresses;
}

export function checkWithdrawalWhitelist(enabled, addresses, destination) {
  if (enabled && (!Array.isArray(addresses) || !addresses.includes(destination.trim()))) {
    throw new Error(
      "This address is not on your withdrawal whitelist. Add it on the Security page first.",
    );
  }
}
