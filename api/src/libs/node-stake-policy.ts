// Protocol-facing node stake policy, selected by chain rather than NODE_ENV.
// workerd uses NODE_ENV=production even when connected to the beta test chain.
export default function nodeStakeWaitingPeriod(chainId: string): number {
  return chainId === 'main' ? 7 * 24 * 60 * 60 : 120;
}
