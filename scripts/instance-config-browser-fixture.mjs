// Browser regression fixture only. The production client always talks to ARC.
export async function fixtureInstanceConfig(context, { session, read, update, policy, policyMissing = () => false, initializePolicy }) {
  const fallback = { revision: 1, accessSource: 'arc', policy: { accessMode: 'public', ordinary: { enabled: false, baseFee: '0', retentionDays: 10, attachmentPricePerBytePerDay: '0' }, attachments: { enabled: true, maxCount: 20, maxFileBytes: 33554432, maxTotalBytes: 62914560 }, maxMessageCiphertextBytes: 67108864 } };
  await context.routeWebSocket(url => url.searchParams.get('blocklet') === 'didmail-server', socket => {
    socket.onMessage(async raw => {
      const message = JSON.parse(String(raw));
      if (message.type === 'join_session') { socket.send(JSON.stringify({ type: 'session', sessionId: 'config-fixture' })); return; }
      if (!message.type?.startsWith('afs_')) return;
      try {
        let data;
        if (message.type === 'afs_read' && message.path === '/didmail-native/session.json') data = { content: JSON.stringify(await session()) };
        else if (message.type === 'afs_read' && message.path === '/didmail-native/attachment-config.json') data = await read();
        else if (message.type === 'afs_exec' && ['/didmail-native/.actions/update-attachment-config', '/didmail-native/.actions/initialize-attachment-config'].includes(message.path)) data = await update(message.args);
        else if (policy) data = await policy(message);
        else if (message.type === 'afs_read' && message.path === '/didmail-native/mail-policy.json') {
          if (policyMissing()) throw Object.assign(new Error('Not initialized'), { code: 'AFS_NOT_FOUND' });
          data = { content: JSON.stringify(fallback) };
        }
        else if (message.path.endsWith('/initialize-mail-policy') && initializePolicy) data = await initializePolicy(message.args);
        else if (message.path.endsWith('/list-access-entries')) data = { revision: fallback.revision, entries: [], nextCursor: null, kind: message.args.kind };
        else throw Object.assign(new Error('Unknown fixture AFS operation'), { code: 'AFS_NOT_FOUND' });
        socket.send(JSON.stringify({ type: 'afs_result', reqId: message.reqId, data }));
      } catch (error) {
        socket.send(JSON.stringify({ type: 'afs_error', reqId: message.reqId, code: error.code || 'AFS_VALIDATION_ERROR', error: error.message }));
      }
    });
  });
}
