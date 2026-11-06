import createAfsChainReader from '../../blocklet/providers/didmail-http/source/api/src/libs/afs-chain-reader';

const root = '/dev/chain/beta';
const record = (kind: string, address: string, fields = {}) => ({
  path: `${root}/${kind}/${address}`,
  meta: {
    kind: `ocap:${{ factories: 'factory', assets: 'asset', accounts: 'account', stakes: 'stake', tokens: 'token' }[kind]}`,
    provenance: { provider: 'ocap' },
  },
  content: { address, ...fields },
});
const capabilities = {
  data: {
    meta: { provenance: { provider: 'ocap' } },
    content: { operations: { read: true, list: { supported: true } } },
  },
};
const missing = () => Object.assign(new Error('not found'), { code: 'AFS_CHAIN_NOT_FOUND' });
const asset = (id: string, date: string, owner = 'node') =>
  record('assets', id, { owner, parent: 'factory', genesisTime: date, data: { value: '{"name":"Template"}' } });
function fixture() {
  const handler = jest.fn();
  const rpc = jest.fn((method, path, options) =>
    path.endsWith('/.meta/.capabilities') ? Promise.resolve(capabilities) : handler(method, path, options),
  );
  return { handler, rpc, reader: createAfsChainReader(rpc, root) };
}
test('factory and NFT reads unwrap content, preserve SVG and restore SDK context', async () => {
  const { handler, reader, rpc } = fixture();
  const display = { type: 'svg', content: '<svg>{{ctx.id}}</svg>' };
  handler.mockResolvedValue({
    data: record('factories', 'factory', { output: { display }, genesisTime: 'created', renaissanceTime: 'updated' }),
  });
  expect((await reader.getFactoryState({ address: 'factory' })).state).toMatchObject({
    output: { display },
    context: { genesisTime: 'created', renaissanceTime: 'updated' },
  });
  expect(rpc).toHaveBeenLastCalledWith('read', `${root}/factories/factory`);
  handler.mockResolvedValue({ data: record('assets', 'asset', { genesisTime: 'created' }) });
  expect((await reader.getAssetState({ address: 'asset' })).state.address).toBe('asset');
  expect(rpc.mock.calls.filter((call) => call[1].endsWith('.capabilities'))).toHaveLength(1);
});
test('account token balances retain arbitrary integer precision and become REST value fields', async () => {
  const { handler, reader } = fixture();
  handler.mockImplementation((method) =>
    Promise.resolve(
      method === 'read'
        ? { data: record('accounts', 'node', { nonce: '99' }) }
        : { data: [record('tokens', 'token', { balance: '9007199254740993123456789', decimal: 18, symbol: 'TBA' })] },
    ),
  );
  expect((await reader.getAccountState({ address: 'node' })).state.tokens).toEqual([
    expect.objectContaining({ value: '9007199254740993123456789', decimal: 18 }),
  ]);
});
test('an absent account is distinct from a failed read or an absent mount', async () => {
  const { handler, reader } = fixture();
  handler.mockRejectedValue(missing());
  expect(await reader.getAccountState({ address: 'node' })).toEqual({ state: null });
  handler.mockRejectedValue(new Error('network unavailable'));
  await expect(reader.getAccountState({ address: 'node' })).rejects.toThrow('network unavailable');
  const unavailable = createAfsChainReader(() => Promise.reject(missing()), root);
  await expect(unavailable.getAccountState({ address: 'node' })).rejects.toThrow('not found');
});
test('NFT filtering is pushed down, short server pages are followed, and sorting spans pages', async () => {
  const { handler, reader } = fixture();
  const first = asset('older', '2024-01-01');
  const second = asset('newer', '2025-01-01');
  handler.mockImplementation((_method, _path, options) =>
    Promise.resolve({ data: options.offset === 0 ? [first] : [second], total: 2 }),
  );
  const input = {
    ownerAddress: 'node',
    factoryAddress: 'factory',
    paging: { cursor: '0', size: 1, order: [{ field: 'genesisTime', type: 'desc' }] },
  };
  const page = await reader.listAssets(input);
  expect(page.assets.map((item: any) => item.address)).toEqual(['newer']);
  expect(page.page).toEqual({ cursor: '0', total: 2, next: true });
  expect(handler).toHaveBeenCalledWith('list', `${root}/assets`, {
    limit: 10,
    offset: 1,
    where: { ownerAddress: 'node', factoryAddress: 'factory' },
  });
  expect((await reader.listAssets({ ...input, paging: { ...input.paging, cursor: '1' } })).assets[0].address).toBe(
    'older',
  );
});
test('unpaged node NFT reads include every matching asset and reject ignored filters', async () => {
  const { handler, reader } = fixture();
  handler.mockResolvedValue({ data: [asset('one', '2024-01-01'), asset('two', '2025-01-01')], total: 2 });
  expect((await reader.listAssets({ ownerAddress: 'node', factoryAddress: 'factory' })).assets).toHaveLength(2);
  handler.mockResolvedValue({ data: [asset('wrong-owner', '2025-01-01', 'other')], total: 1 });
  await expect(reader.listAssets({ ownerAddress: 'node', factoryAddress: 'factory' })).rejects.toThrow('filters');
});
test('repeated pages, invalid totals and incomplete enumeration are errors, not empty snapshots', async () => {
  const { handler, reader } = fixture();
  handler.mockResolvedValue({ data: [asset('one', '2024-01-01')], total: 2 });
  await expect(reader.listAssets({ ownerAddress: 'node' })).rejects.toThrow('repeated');
  handler.mockResolvedValue({ data: [], total: 2 });
  await expect(reader.listAssets({ ownerAddress: 'node' })).rejects.toThrow('before the declared total');
  handler.mockResolvedValue({ data: [], total: '2' });
  await expect(reader.listAssets({ ownerAddress: 'node' })).rejects.toThrow('invalid total');
});
test('wrong-network records, malformed entities and resource traversal are rejected', async () => {
  const { handler, reader } = fixture();
  handler.mockResolvedValue({ data: { ...record('stakes', 'stake'), path: '/dev/chain/main/stakes/stake' } });
  await expect(reader.getStakeState({ address: 'stake' })).rejects.toThrow('Invalid OCAP');
  await expect(reader.getAssetState({ address: '../wallet' })).rejects.toThrow('Invalid chain resource');
  expect(() => createAfsChainReader(jest.fn(), '/work/private')).toThrow('Invalid ARC chain mount');
  handler.mockResolvedValue({ data: record('accounts', 'node') });
  await expect(reader.getFactoryState({ address: 'node' })).rejects.toThrow('Invalid OCAP');
});
test('stake token and revoked asset arrays are preserved in the SDK-compatible state', async () => {
  const { handler, reader } = fixture();
  const fields = {
    assets: ['asset'],
    revokedAssets: ['old'],
    tokens: [{ address: 'token', value: '1000000000000000000' }],
    revokedTokens: [],
  };
  handler.mockResolvedValue({ data: record('stakes', 'stake', fields) });
  expect((await reader.getStakeState({ address: 'stake' })).state).toMatchObject(fields);
});

test('complete live account token balances avoid a duplicate collection query and retain exact precision', async () => {
  const { handler, reader } = fixture();
  const token = { address: 'token', symbol: 'TBA', decimal: 18, value: '9007199254740993123456789' };
  handler.mockResolvedValue({ data: record('accounts', 'node', { tokens: [token] }) });
  expect((await reader.getAccountState({ address: 'node' })).state.tokens).toEqual([token]);
  expect(handler).toHaveBeenCalledTimes(1);
  handler.mockResolvedValue({ data: record('accounts', 'node', { tokens: [{ ...token, value: '-1' }] }) });
  await expect(reader.getAccountState({ address: 'node' })).rejects.toThrow('Invalid OCAP account token amount');
});

test('stake withdrawal history follows all related pages and validates provenance and transaction identity', async () => {
  const { handler, reader } = fixture();
  const hash = 'A'.repeat(64);
  const transaction = {
    path: `${root}/transactions/${hash}`,
    meta: { kind: 'ocap:transaction:revoke_stake', provenance: { provider: 'ocap' } },
    content: { hash, type: 'revoke_stake', valid: true, code: 'OK' },
  };
  handler.mockResolvedValue({ data: [transaction], total: 1 });
  const input = { stakeFilter: { stakes: ['stake'] }, validityFilter: { validity: 'VALID' } };
  expect((await reader.listTransactions(input)).transactions).toEqual([transaction.content]);
  expect(handler).toHaveBeenCalledWith('list', `${root}/stakes/stake/transactions`, { limit: 10, offset: 0 });
  handler.mockResolvedValue({
    data: [{ ...transaction, meta: { ...transaction.meta, provenance: { provider: 'foreign' } } }],
    total: 1,
  });
  await expect(reader.listTransactions(input)).rejects.toThrow('Invalid OCAP stake transaction');
  await expect(reader.listTransactions({ ...input, stakeFilter: { stakes: ['a', 'b'] } })).rejects.toThrow(
    'single stake',
  );
});
