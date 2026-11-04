import { describe, test, expect } from '@jest/globals';
import { fromTokenToUnit } from '@ocap/util';

import { calculateAttachmentStorageCost, calculatePaymentWei } from '../attachment-pricing';

describe('attachment-pricing', () => {
  test('zero size and pricePerBytePerDay yields storage cost 0', () => {
    expect(calculateAttachmentStorageCost(0, 30, '0')).toBe('0');
    expect(calculateAttachmentStorageCost(0, 30, '100')).toBe('0');
    expect(calculateAttachmentStorageCost(1024, 7, '0')).toBe('0');
  });

  test('multiplies size × days × price with exact BN math', () => {
    expect(calculateAttachmentStorageCost(2, 3, '5')).toBe('30');
    expect(calculateAttachmentStorageCost(1024, 7, '10')).toBe('71680');
  });

  test('calculatePaymentWei with envelope 1 token + storage 0 matches fromTokenToUnit', () => {
    const envelopePrice = 1;
    const mailPrice = 0.0001;
    const { paymentWei, creditWei, dividendWei, assetFeeWei } = calculatePaymentWei(envelopePrice, '0', mailPrice);

    const expectedPayment = fromTokenToUnit(envelopePrice, 18).toString();
    const expectedAssetFee = fromTokenToUnit(mailPrice, 18).toString();
    expect(paymentWei).toBe(expectedPayment);
    expect(assetFeeWei).toBe(expectedAssetFee);

    // dividend = (payment - assetFee) / 10; credit = payment - dividend
    const paymentBn = BigInt(paymentWei);
    const assetBn = BigInt(assetFeeWei);
    const dividendBn = (paymentBn - assetBn) / BigInt(10);
    const creditBn = paymentBn - dividendBn;
    expect(dividendWei).toBe(dividendBn.toString());
    expect(creditWei).toBe(creditBn.toString());
  });

  test('calculatePaymentWei throws when paymentWei < assetFeeWei', () => {
    expect(() => calculatePaymentWei(0, '0', 1)).toThrow('Payment less than asset fee');
  });
});

test('preserves the final wei in a decimal envelope price', () => {
  expect(calculatePaymentWei('0.001000000000000001', '2', '0.0001').paymentWei).toBe('1000000000000003');
});
