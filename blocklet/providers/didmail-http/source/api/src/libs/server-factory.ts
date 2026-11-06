import { createHash } from 'crypto';
import { fromUnitToToken } from '@ocap/util';
import { readTemplateCache, templateCacheGeneration, writeTemplateCache } from '../../../storage/template-cache-store';

interface FactoryMetadata {
  address: string;
  description: string;
  limit: number | string;
  name: string;
  owner: string;
  price: string;
  token: { address: string; value: string; symbol: string; decimal: number };
  created_at: string | number;
  minted?: number;
  updated_at?: string | number;
  display?: string;
}

// Persist immutable display metadata through the AFS database/object ports. Live counters and the SVG are read
// only when details are requested; transaction preparation always uses the chain.
export default async function readServerFactory(client: any, chainHost: string, address: string, refresh = false): Promise<FactoryMetadata> {
  const scope = createHash('sha256')
    .update(JSON.stringify(['server-factory-v1', chainHost, address]))
    .digest('hex');
  if (!refresh) {
    const cached = await readTemplateCache<FactoryMetadata>(scope, 'metadata');
    if (cached) return cached;
  }
  const { state } = await client.getFactoryState({ address });
  if (!state) throw new Error('Factory not found');
  const token = state.input.tokens.find((item: any) => item.symbol === 'TBA' || item.symbol === 'ABT');
  if (!token) throw new Error('Factory not set input token');
  const metadata = {
    address: state.address,
    description: state.description,
    limit: state.limit === 0 ? '∞' : state.limit,
    name: state.name,
    owner: state.owner,
    price: `${fromUnitToToken(token.value)}  ${token.symbol}`,
    token,
    created_at: state.context.genesisTime,
  };
  const generation = await templateCacheGeneration(scope);
  await writeTemplateCache(scope, 'metadata', metadata, generation);
  let { output } = state;
  if (typeof output === 'string') {
    try {
      output = JSON.parse(output);
    } catch {
      output = undefined;
    }
  }
  const display = output?.display || state.display;
  return refresh
    ? {
        ...metadata,
        minted: state.numMinted,
        updated_at: state.context.renaissanceTime,
        display: typeof display === 'string' ? display : display?.content,
      }
    : metadata;
}
