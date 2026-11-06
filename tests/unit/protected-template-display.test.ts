import { beforeEach, expect, test } from '@jest/globals';

// Synthetic chain return values only. The actual route handler and its registered
// middleware are inspected without HTTP, ARC identity, a wallet or a database.
jest.mock('../support/node/libs/env', () => ({
  __esModule: true,
  default: { chainHost: 'https://public-fixture.invalid' },
}));
jest.mock('../support/node/runtime/env', () => ({
  __esModule: true,
  default: { arcUrl: 'https://public-fixture.invalid', appUrl: 'https://public-fixture.invalid' },
}));
jest.mock('@ocap/client', () => jest.fn(() => ({ getAssetState: jest.fn() })));
jest.mock('../support/node/libs/sqlite', () => ({ Envelope: {}, Namecard: {} }));
jest.mock('../../blocklet/providers/didmail-http/source/api/src/libs/mail-service-policy', () => ({
  getDefaultEnvelope: jest.fn(),
  publicMailPolicy: jest.fn(),
}));
jest.mock('../../blocklet/providers/didmail-http/source/api/src/libs/alias-domain', () => ({
  listPublicDomains: jest.fn(),
}));
jest.mock('../../blocklet/providers/didmail-http/source/api/src/libs/forge', () => ({
  getPublicForgeState: jest.fn(),
}));
jest.mock('../../blocklet/providers/didmail-http/source/api/src/libs/logger', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../blocklet/providers/didmail-http/source/api/src/nft/templates/server-node', () => ({
  __esModule: true,
  default: jest.fn(),
  getCredentialList: jest.fn(),
}));
jest.mock('../../blocklet/providers/didmail-http/source/api/src/routes/stake', () => ({
  __esModule: true,
  default: jest.requireActual('express').Router(),
}));
jest.mock('../../blocklet/providers/didmail-http/source/api/src/routes/servers', () => ({
  __esModule: true,
  default: jest.requireActual('express').Router(),
}));
jest.mock('../../blocklet/providers/didmail-http/source/api/src/routes/account', () => ({
  __esModule: true,
  default: jest.requireActual('express').Router(),
}));
jest.mock('../../blocklet/providers/didmail-http/source/api/src/routes/envelope', () => ({
  __esModule: true,
  default: jest.requireActual('express').Router(),
}));
jest.mock('../../blocklet/providers/didmail-http/source/api/src/routes/namecard', () => ({
  __esModule: true,
  default: jest.requireActual('express').Router(),
}));
jest.mock('../../blocklet/providers/didmail-http/source/api/src/routes/storage', () => ({
  __esModule: true,
  default: jest.requireActual('express').Router(),
}));
jest.mock('../../blocklet/providers/didmail-http/source/api/src/routes/mail', () => ({
  __esModule: true,
  default: jest.requireActual('express').Router(),
}));
jest.mock('../../blocklet/providers/didmail-http/source/api/src/routes/contact', () => ({
  __esModule: true,
  default: jest.requireActual('express').Router(),
}));
jest.mock('../../blocklet/providers/didmail-http/source/api/src/routes/alias', () => ({
  __esModule: true,
  default: jest.requireActual('express').Router(),
}));
jest.mock('../../blocklet/providers/didmail-http/source/api/src/routes/admin', () => ({
  __esModule: true,
  default: jest.requireActual('express').Router(),
}));
jest.mock('../../blocklet/providers/didmail-http/source/api/src/routes/domains', () => ({
  __esModule: true,
  default: jest.requireActual('express').Router(),
}));

// eslint-disable-next-line import/first
import router from '../../blocklet/providers/didmail-http/source/api/src/routes/index';
// eslint-disable-next-line import/first
import { arcUser } from '../support/node/runtime/session';
// eslint-disable-next-line import/first
import checkAuthAndRole from '../../blocklet/providers/didmail-http/source/api/src/middleware/auth-middleware';

const GraphQLClient = require('@ocap/client');

const client = GraphQLClient.mock.results[0].value;
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><text>中文 {{mail.subject}}</text></svg>';
const legacy = '<svg xmlns="http://www.w3.org/2000/svg"><text>Legacy</text></svg>';
const { route } = (router as any).stack.find((entry: any) => entry.route?.path === '/display/:address');
async function display(state: unknown) {
  client.getAssetState.mockResolvedValue({ state });
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    contentType: '',
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    set(headers: Record<string, string>) {
      Object.assign(this.headers, headers);
      return this;
    },
    type(value: string) {
      this.contentType = value;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    send(body: unknown) {
      this.body = body;
      return this;
    },
  };
  await route.stack.at(-1).handle({ params: { address: 'public-fixture-asset' } }, response);
  expect(client.getAssetState).toHaveBeenCalledWith(
    { address: 'public-fixture-asset' },
    { ignoreFields: ['state.context'] },
  );
  return response;
}
beforeEach(() => client.getAssetState.mockReset());

test('protected SVG preview retains the genuine session and privileged-role middleware order', () => {
  expect(route.stack).toHaveLength(3);
  expect(route.stack[0].handle).toBe(arcUser);
  expect(route.stack[1].handle).toBe(checkAuthAndRole);
});
for (const encoding of ['object', 'json']) {
  test(`updated template SVG is returned verbatim from ${encoding} data.value with restrictive headers`, async () => {
    const value = { name: 'Public template', display: svg };
    const response = await display({
      data: { value: encoding === 'json' ? JSON.stringify(value) : value },
      display: null,
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(svg);
    expect(response.contentType).toBe('svg');
    expect(response.headers).toEqual({
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    });
  });
}
test('current template data takes precedence over stale mint-time legacy display', async () => {
  const response = await display({ data: { value: JSON.stringify({ display: svg }) }, display: { content: legacy } });
  expect(response.body).toBe(svg);
});
for (const value of [
  undefined,
  null,
  '{invalid',
  'null',
  '[]',
  '"scalar"',
  {},
  { display: '' },
  { display: '   ' },
  { display: 42 },
  { display: {} },
]) {
  test(`legacy raw SVG remains compatible when current template data is unavailable: ${JSON.stringify(value)}`, async () => {
    const response = await display({ data: { value }, display: { content: legacy } });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(legacy);
    expect(response.contentType).toBe('svg');
  });
}
for (const state of [
  undefined,
  null,
  {},
  { data: { value: '{invalid' } },
  { data: { value: { display: '' } }, display: {} },
  { data: { value: { display: {} } }, display: { content: 42 } },
  { data: { value: '[]' }, display: { content: '  ' } },
]) {
  test(`missing or malformed SVG fails safely as JSON: ${JSON.stringify(state)}`, async () => {
    const response = await display(state);
    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ message: state ? 'Asset display not found' : 'Asset not found' });
    expect(response.contentType).toBe('');
  });
}
