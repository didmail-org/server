// Local maintenance helper: no chain operations, identity access or message decryption.
export async function purgeRetiredVc(db, blobs) {
  const messages = Number((await db.prepare('SELECT count(*) AS n FROM ordinary_messages').first()).n);
  const chunks = await db.prepare('SELECT object_key FROM ordinary_chunks').all();
  // Never allow a corrupt historical reference to erase an NFT or other object.
  if (chunks.results.some(row => !row.object_key.startsWith('ordinary/')))
    throw Error('Unexpected retired VC object namespace; nothing deleted');
  let objects = 0;
  // Always restart at the first page after deletion: no skipped keys on a mutating list.
  for (;;) {
    const page = await blobs.list({ prefix: 'ordinary/', limit: 100 });
    if (!page.objects.length) break;
    await blobs.delete(page.objects.map(row => row.key));
    objects += page.objects.length;
  }
  await db.batch([
    db.prepare('DELETE FROM ordinary_chunks'),
    db.prepare('DELETE FROM ordinary_messages'),
    db.prepare('DELETE FROM ordinary_orphan_tombstones'),
    db.prepare("UPDATE ordinary_sweep_state SET cursor='' WHERE id=1"),
    db.prepare("UPDATE mail_service_policy SET policy_json=json_set(policy_json,'$.ordinary.enabled',json('false')),revision=revision+1 WHERE id=1 AND json_extract(policy_json,'$.ordinary.enabled')=1"),
  ]);
  return { messages, chunks: chunks.results.length, objects };
}
