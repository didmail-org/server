import { toBN } from '@ocap/util';
import { parseUnits } from 'ethers';

export function calculateAttachmentStorageCost(
  totalSize: number,
  retentionDays: number,
  pricePerBytePerDay: string,
): string {
  return toBN(totalSize).mul(toBN(retentionDays)).mul(toBN(pricePerBytePerDay)).toString();
}

export function calculatePaymentWei(
  envelopePrice: number | string,
  storageCostWei: string,
  mailPrice: number | string,
): { paymentWei: string; creditWei: string; dividendWei: string; assetFeeWei: string } {
  const envelopeFeeWei = toBN(parseUnits(String(envelopePrice), 18).toString());
  const storage = toBN(storageCostWei);
  const paymentWei = envelopeFeeWei.add(storage);
  const assetFeeWei = toBN(parseUnits(String(mailPrice), 18).toString());
  if (paymentWei.lt(assetFeeWei)) {
    throw new Error('Payment less than asset fee');
  }
  const dividendWei = paymentWei.sub(assetFeeWei).mul(toBN(1)).div(toBN(10));
  const creditWei = paymentWei.sub(dividendWei);
  return {
    paymentWei: paymentWei.toString(),
    creditWei: creditWei.toString(),
    dividendWei: dividendWei.toString(),
    assetFeeWei: assetFeeWei.toString(),
  };
}
