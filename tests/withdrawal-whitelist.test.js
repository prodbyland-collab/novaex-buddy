import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWhitelist, checkWithdrawalWhitelist } from '../src/lib/withdrawal-whitelist.js';

test('addresses are trimmed and deduplicated, preserving case', () => {
  assert.deepEqual(parseWhitelist('  abcdefABCDEF123 \r\nabcdefABCDEF123\nABCDEFabcdef123\n'), ['abcdefABCDEF123', 'ABCDEFabcdef123']);
});
test('invalid and oversized address lists are rejected', () => {
  for (const input of ['short', 'abcdef ghijklmno', 'x'.repeat(257), Array.from({ length: 51 }, (_, index) => 'abcdefABCDEF' + index).join('\n')]) assert.throws(() => parseWhitelist(input));
});
test('enabled whitelist blocks unknown addresses and missing lists', () => {
  for (const addresses of [undefined, [], ['abcdefABCDEF123']]) assert.throws(() => checkWithdrawalWhitelist(true, addresses, 'abcdefABCDEF999'));
  assert.throws(() => checkWithdrawalWhitelist(true, ['abcdefABCDEF123'], 'ABCDEFabcdef123'));
  assert.doesNotThrow(() => checkWithdrawalWhitelist(true, ['abcdefABCDEF123'], ' abcdefABCDEF123 '));
});
test('disabled whitelist allows unlisted destinations', () => {
  assert.doesNotThrow(() => checkWithdrawalWhitelist(false, [], 'abcdefABCDEF999'));
});
