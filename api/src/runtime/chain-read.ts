// Legacy Node reference runtime. The Worker build replaces this module with
// an ARC AFS reader; transaction clients are never replaced.
export default function chainReads<T>(client: T): T {
  return client;
}
