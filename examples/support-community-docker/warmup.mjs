import { readFileSync } from 'node:fs';

const { id, instance } = JSON.parse(readFileSync('/opt/demo-config.json', 'utf8'));
const socket = new WebSocket('ws://127.0.0.1:8081/?blocklet=' + id);
const childEnv = { ...process.env };
delete childEnv.BUN_BE_BUN;
let rendered = false;
const ready = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('AUP application warmup timed out')), 25000);
  socket.addEventListener('open', () =>
    socket.send(
      JSON.stringify({
        type: 'join_session',
        blocklet: id,
        page: 'support',
        locale: 'en',
      }),
    ),
  );
  socket.addEventListener('message', async (event) => {
    let message;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (rendered || message.type !== 'aup' || !JSON.stringify(message.root ?? message).includes('Support knowledge'))
      return;
    rendered = true;
    try {
      for (let attempt = 0; attempt < 15; attempt++) {
        const child = Bun.spawn(
          ['/opt/arc/arc', 'afs', 'stat', `/blocklets/${id}/instance`, '--instance', instance, '--json'],
          { env: childEnv, stdout: 'ignore', stderr: 'ignore' },
        );
        if ((await child.exited) === 0) {
          clearTimeout(timeout);
          resolve();
          return;
        }
        await Bun.sleep(250);
      }
      throw new Error('Application instance was not activated');
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
  socket.addEventListener('error', () => {
    clearTimeout(timeout);
    reject(new Error('AUP warmup connection failed'));
  });
});
try {
  await ready;
  console.log('Support application and local host binding are ready.');
} finally {
  socket.close();
}
