import { expect, test } from '@jest/globals';
import assertPurchaseBalance from '../../blocklet/providers/didmail-http/source/api/src/libs/purchase-balance';

const cost = { address: 'tba-token', symbol: 'TBA', decimal: 18, value: '9007199254740993000000000' };
test('purchase compares exact base units and accepts the exact price', () => {
  expect(() => assertPurchaseBalance([{ ...cost }], cost)).not.toThrow();
  expect(() => assertPurchaseBalance([{ ...cost, value: String(BigInt(cost.value) - 1n) }], cost)).toThrow(
    'Insufficient balance',
  );
});
test('missing funds and a different token cannot pay for the purchase', () => {
  for (const tokens of [[], [{ ...cost, address: 'other' }], [{ ...cost, decimal: 8 }]])
    expect(() => assertPurchaseBalance(tokens, cost)).toThrow('Insufficient balance');
});
test('unverified prices or malformed balances cannot authorize a transaction', () => {
  expect(() => assertPurchaseBalance([cost], { ...cost, value: '-1' })).toThrow('price could not be verified');
  expect(() => assertPurchaseBalance([{ ...cost, value: '1.1' }], cost)).toThrow('balance could not be verified');
});
