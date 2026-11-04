import { contactPreparationCommitment } from '../contact-preparation';
import { verifyContactPayment } from '../contact-payment-evidence';

const source = require('../../../../tests/fixtures/contact-recovery-record.json');

const cases = source.cases as Array<{
  confirmationPolicy: string;
  serviceRole: string;
  preparationSha256: string;
  record: any;
}>;
const { publicKey } = require('../../../../tests/fixtures/namecard-payment.json');

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
test.each(cases)('whole original preparation is signed for $serviceRole / $confirmationPolicy', async (vector) => {
  const p = vector.record.recovery;
  expect(contactPreparationCommitment(p)).toBe(vector.preparationSha256);
  const verified = await verifyContactPayment(
    vector.record.signedOrigin,
    p.snapshot.binding,
    new Uint8Array(publicKey),
    vector.preparationSha256,
  );
  expect(verified.transactionId).toBe(vector.record.id);
});
test('a recovery-profile payment cannot be verified without its expected preparation commitment', async () => {
  const vector = cases[0]!;
  await expect(
    verifyContactPayment(
      vector.record.signedOrigin,
      vector.record.recovery.snapshot.binding,
      new Uint8Array(publicKey),
    ),
  ).rejects.toThrow();
});
test.each(['chainEndpoint', 'mintChainFee', 'confirmationPolicy', 'expiresAt'])(
  'unchanged valid financial signatures reject changed original %s',
  async (field) => {
    const vector = cases[0]!;
    const p = clone<any>(vector.record.recovery);
    if (field === 'expiresAt') p.expiresAt++;
    else
      p.snapshot.policy[field] = {
        chainEndpoint: 'https://foreign.test/api/',
        mintChainFee: '4',
        confirmationPolicy: 'arcblock-dolt-ledger/1',
      }[field];
    await expect(
      verifyContactPayment(
        vector.record.signedOrigin,
        p.snapshot.binding,
        new Uint8Array(publicKey),
        contactPreparationCommitment(p),
      ),
    ).rejects.toThrow();
  },
);
