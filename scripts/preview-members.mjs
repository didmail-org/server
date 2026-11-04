import createMembersForward from './arc-members-bridge.mjs';

// This credential belongs to the Node-side private bridge, never to workerd or
// the public configuration. Provision it separately from mailbox credentials.
export function previewMembersConfiguration({ bindings, arc, publicOrigin, fetcher }) {
  const { ARC_MEMBERS_TOKEN: token, ...workerBindings } = bindings;
  const serviceBindings = {};
  if (token) {
    serviceBindings.ARC_MEMBERS = createMembersForward({
      origin: arc,
      publicOrigin,
      instanceId: workerBindings.DIDMAIL_ARC_INSTANCE_ID,
      namespace: 'didmail-arc',
      token,
      fetcher,
    });
  }
  return { workerBindings, serviceBindings };
}
