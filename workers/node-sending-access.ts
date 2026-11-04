import { isPublicMailNode } from '@didmail/protocol';
import { toStakeAddress } from '@arcblock/did-util';
import chainReads from './chain-read';
import wallet from './wallet';
import { value } from './bindings';

// Fresh authoritative reads, never an admin flag, token stake, or discovery cache.
export async function readNodeSendingAccess(): Promise<boolean> {
  try {
    const sender = wallet().address,
      receiver = value('FACTORY_OWNER'),
      factory = value('SERVER_NODE_FACTORY');
    if (!receiver || !factory) throw Error('Missing node factory configuration');
    const normalize = (s: string) => (/^0x[0-9a-f]{40}$/i.test(s) ? s.toLowerCase() : s);
    const reader = chainReads(
      {} as {
        getStakeState(input: {
          address: string;
        }): Promise<{ state: null | { sender: string; receiver: string; assets: string[]; revokedAssets: string[] } }>;
        getAssetState(input: { address: string }): Promise<{ state: null | { address: string; parent: string } }>;
      },
    );
    const { state } = await reader.getStakeState({ address: toStakeAddress(sender, receiver) });
    if (!state) return false;
    if (state.sender !== sender || normalize(state.receiver) !== normalize(receiver) || state.assets.length > 128)
      throw Error('Invalid node stake');
    for (const assetId of state.assets) {
      if (typeof assetId !== 'string') throw Error('Invalid node asset');
      if (!isPublicMailNode(assetId, [state], receiver)) continue;
      const { state: asset } = await reader.getAssetState({ address: assetId });
      if (!asset || typeof asset.parent !== 'string') throw Error('Invalid node asset provenance');
      if (asset.parent === factory) return true;
    }
    return false;
  } catch {
    throw Object.assign(new Error('Node NFT stake could not be verified'), {
      status: 503,
      code: 'NODE_NFT_STATE_UNAVAILABLE',
      recoveryAction: 'query_status',
    });
  }
}
