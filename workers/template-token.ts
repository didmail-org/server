import chainReads from './chain-read';
import env from './env';
import readServerFactory from '../api/src/libs/server-factory';

export default async function templateToken() {
  const reader: any = chainReads({});
  // The node factory's immutable payment token already carries the native
  // token address, symbol and precision. Reuse its D1/R2 metadata snapshot.
  if (env.serverNodeFactory) {
    const factory = await readServerFactory(reader, env.chainHost, env.serverNodeFactory);
    if (factory.token?.address === env.tokenId && Number.isInteger(factory.token.decimal)) return factory.token;
  }
  const { state } = await reader.getTokenState({ address: env.tokenId });
  return state;
}
