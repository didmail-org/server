import {
  contactQuoteFromChain,
  ContactQuoteUnavailable,
} from '../../blocklet/providers/didmail-http/source/protocol/contact/contact-quote';

const f = require('../fixtures/namecard-payment.json');

const policy = {
  endpoint: f.endpoint,
  chainEndpoint: 'https://beta.abtnetwork.io/api/',
  chainId: f.policy.chainId,
  tokenAddress: f.policy.tokenAddress,
  servicePayee: f.serviceId.replace(/^did:abt:/, ''),
  developerPayee: f.policy.developerPayee,
  namecardFactory: f.policy.namecardFactory,
  contactFactory: f.policy.contactFactory,
  confirmationPolicy: 'arcblock-committed' as const,
};
const input = {
  preparationId: f.preparationId,
  sender: f.sender,
  receiver: f.receiver,
  namecard: f.namecard,
  ciphertext: f.encrypted,
};
const fees = {
  getChainInfo: {
    code: 'OK',
    info: { network: 'beta', synced: true, blockHeight: '123', consensusVersion: 'tendermint' },
  },
  getForgeState: {
    code: 'OK',
    state: {
      txConfig: {
        txFee: [
          { typeUrl: 'fg:t:transfer_v3', fee: '7' },
          { typeUrl: 'fg:t:acquire_asset_v3', fee: '3' },
        ],
      },
    },
  },
};
const evidence = () =>
  structuredClone({ asset: f.assetResult, factory: f.factoryResult, recipient: f.recipientResult, fees });

test('node quote matches independent client golden amounts without losing an odd wei', () => {
  const snapshot = contactQuoteFromChain(policy, input, evidence());
  expect(snapshot.binding).toMatchObject({
    contentHash: f.contentHash,
    totalAmount: f.terms.totalAmount,
    serviceAmount: f.terms.serviceAmount,
    developerAmount: f.terms.developerAmount,
    chainFee: f.terms.chainFee,
  });
  expect(snapshot.policy).toMatchObject({
    mintAmount: f.terms.mintAmount,
    mintChainFee: '3',
    confirmationPolicy: 'arcblock-committed',
  });
  expect(Object.isFrozen(snapshot)).toBe(true);
  expect(Object.isFrozen(snapshot.binding)).toBe(true);
  expect(Object.isFrozen(snapshot.policy)).toBe(true);
});
test.each(f.mutations as Array<{ name: string; target: string; path: string[]; value: unknown }>)(
  'rejects the client cross-runtime adversarial vector: $name',
  (mutation: any) => {
    const data = { ...evidence(), policy: structuredClone(policy) } as any;
    const target = (
      { assetResult: 'asset', factoryResult: 'factory', recipientResult: 'recipient', policy: 'policy' } as Record<
        string,
        string
      >
    )[mutation.target as string];
    const last = mutation.path.at(-1);
    const parent = mutation.path.slice(0, -1).reduce((p: any, key: string) => p[key], data[target!]);
    parent[last] = mutation.value;
    expect(() => contactQuoteFromChain(data.policy, input, data)).toThrow(ContactQuoteUnavailable);
  },
);
const feeMutations: Array<[string, (data: any) => unknown]> = [
  [
    'wrong network',
    (d: any) => {
      d.fees.getChainInfo.info.network = 'main';
    },
  ],
  [
    'unsynced chain',
    (d: any) => {
      d.fees.getChainInfo.info.synced = false;
    },
  ],
  [
    'missing block',
    (d: any) => {
      d.fees.getChainInfo.info.blockHeight = '0';
    },
  ],
  [
    'unsafe numeric height',
    (d: any) => {
      d.fees.getChainInfo.info.blockHeight = 123;
    },
  ],
  [
    'unknown backend type',
    (d: any) => {
      d.fees.getChainInfo.info.consensusVersion = {};
    },
  ],
  [
    'dolt on block policy',
    (d: any) => {
      d.fees.getChainInfo.info.consensusVersion = '@ocap/statedb-dolt v1.20.2';
    },
  ],
  [
    'failed chain read',
    (d: any) => {
      d.fees.getChainInfo.code = 'ERROR';
    },
  ],
  [
    'failed fee read',
    (d: any) => {
      d.fees.getForgeState.code = 'ERROR';
    },
  ],
  ['missing fee table', (d: any) => delete d.fees.getForgeState.state.txConfig],
  [
    'duplicate payment fee',
    (d: any) => d.fees.getForgeState.state.txConfig.txFee.push({ typeUrl: 'fg:t:transfer_v3', fee: '0' }),
  ],
  [
    'duplicate mint fee',
    (d: any) => d.fees.getForgeState.state.txConfig.txFee.push({ typeUrl: 'fg:t:acquire_asset_v3', fee: '0' }),
  ],
  [
    'numeric fee',
    (d: any) => {
      d.fees.getForgeState.state.txConfig.txFee[0].fee = 7;
    },
  ],
  [
    'unbounded fee',
    (d: any) => {
      d.fees.getForgeState.state.txConfig.txFee[1].fee = (2n ** 256n).toString();
    },
  ],
  [
    'numeric NFT price',
    (d: any) => {
      d.asset.state.data.value = '{"price":0.1}';
    },
  ],
  [
    'unbounded NFT price',
    (d: any) => {
      d.asset.state.data.value = `{"price":"${'9'.repeat(80)}"}`;
    },
  ],
  [
    'recipient key of another DID',
    (d: any) => {
      d.recipient.state.pk = `0x${'11'.repeat(32)}`;
    },
  ],
  ['unexpected token outputs', (d: any) => d.factory.state.input.tokens.push(d.factory.state.input.tokens[0])],
];
test.each(feeMutations)('rejects %s', (_, change) => {
  const data = evidence();
  change(data);
  expect(() => contactQuoteFromChain(policy, input, data)).toThrow(ContactQuoteUnavailable);
});
test('dolt policy requires the exact supported backend and zero block convention', () => {
  const data = evidence();
  const doltPolicy = { ...policy, confirmationPolicy: 'arcblock-dolt-ledger/1' as const };
  data.fees.getChainInfo.info.consensusVersion = '@ocap/statedb-dolt v1.20.2';
  data.fees.getChainInfo.info.blockHeight = '0';
  expect(contactQuoteFromChain(doltPolicy, input, data).policy.confirmationPolicy).toBe('arcblock-dolt-ledger/1');
  for (const backend of ['@ocap/statedb-dolt v1.20.1', 'tendermint']) {
    data.fees.getChainInfo.info.consensusVersion = backend;
    expect(() => contactQuoteFromChain(doltPolicy, input, data)).toThrow(ContactQuoteUnavailable);
  }
});
test('DID payees preserve case while Ethereum hex payees accept equivalent casing', () => {
  const data = evidence();
  data.factory.state.owner = policy.developerPayee.toLowerCase();
  expect(contactQuoteFromChain(policy, input, data).binding.developerPayee).toBe(policy.developerPayee);
  const didPolicy = { ...policy, developerPayee: f.sender };
  data.factory.state.owner = f.sender;
  expect(contactQuoteFromChain(didPolicy, input, data).binding.developerPayee).toBe(f.sender);
  data.factory.state.owner = f.sender.slice(0, 2) + f.sender[2].toUpperCase() + f.sender.slice(3);
  expect(() => contactQuoteFromChain(didPolicy, input, data)).toThrow(ContactQuoteUnavailable);
});
