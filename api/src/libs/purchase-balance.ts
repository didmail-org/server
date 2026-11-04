// Compare integer base units only; no rounding through JavaScript numbers.
export default function assertPurchaseBalance(tokens: any[], cost: any) {
  if (!cost || !/^\d+$/.test(String(cost.value)) || !cost.symbol || !Number.isInteger(cost.decimal ?? 18))
    throw Object.assign(new Error('Purchase price could not be verified.'), { status: 503 });
  const balance = tokens?.find(
    (token) =>
      (cost.address ? token.address === cost.address : token.symbol === cost.symbol) &&
      token.symbol === cost.symbol &&
      (token.decimal ?? 18) === (cost.decimal ?? 18),
  );
  if (balance && !/^\d+$/.test(String(balance.value)))
    throw Object.assign(new Error('Node balance could not be verified.'), { status: 503 });
  if (BigInt(balance?.value || '0') < BigInt(cost.value))
    throw Object.assign(new Error('Insufficient balance. Recharge the node first.'), { status: 402 });
}
