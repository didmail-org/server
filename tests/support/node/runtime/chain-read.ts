// Node regression port: use the isolated test client directly. Native ARC uses
// the package's AFS chain reader; transaction clients are never replaced.
export default function chainReads<T>(client: T): T {
  return client;
}
