import nextPaymentNonce from '../support/node/runtime/payment-nonce';
import sequelize from '../support/node/libs/sqlite';

beforeAll(() => {
  (sequelize as any).options.logging = false;
});
afterAll(async () => {
  await sequelize.close();
});
test('SQLite nonce allocations remain unique with a frozen or backwards clock and a new allocator import', async () => {
  const now = 1793400000000;
  const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
  try {
    const values = await Promise.all(Array.from({ length: 16 }, () => nextPaymentNonce()));
    expect([...values].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => now + i));
    clock.mockReturnValue(now - 1000);
    expect(await nextPaymentNonce()).toBe(now + 16);
    await sequelize.query('UPDATE legacy_payment_nonce SET last_nonce=9007199254740991');
    await expect(nextPaymentNonce()).rejects.toThrow('Payment nonce exhausted');
  } finally {
    clock.mockRestore();
  }
});
