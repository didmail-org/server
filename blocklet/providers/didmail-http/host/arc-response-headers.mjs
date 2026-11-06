// A service binding is a new HTTP hop. Never relay ARC/proxy connection state.
export function arcResponseHeaders(source) {
  const connection = source.connection;
  const named = (Array.isArray(connection) ? connection.join(',') : connection || '')
    .split(',')
    .map((name) => name.trim().toLowerCase());
  const excluded = new Set([
    ...named,
    'connection',
    'proxy-connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'content-length',
  ]);
  const result = new Headers();
  for (const [name, value] of Object.entries(source)) {
    if (excluded.has(name.toLowerCase())) continue;
    for (const item of Array.isArray(value) ? value : value == null ? [] : [value]) result.append(name, item);
  }
  return result;
}
