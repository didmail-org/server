import { bindings, value } from '../runtime/bindings';
import { createArcTransport } from '../api/src/runtime/arc-transport';

const transport = () => createArcTransport({ binding: bindings.ARC, origin: value('ARC_ORIGIN') });

export function hasArc() {
  return transport().available;
}

export async function arcFetch(request: Request): Promise<Response> {
  return transport().fetch(request);
}
