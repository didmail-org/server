import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';

const directory = path.dirname(fileURLToPath(import.meta.url));
export const config = JSON.parse(fs.readFileSync(path.join(directory, 'config.json'), 'utf8'));
const home = path.resolve(directory, '../../artifacts/private/support-community-docker-local');

function privateDirectory(target) {
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink())
    throw new Error('Private directories cannot be symlinks');
  fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  fs.chmodSync(target, 0o700);
}

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

export function initializePrivateHome(target) {
  privateDirectory(target);
  for (const child of ['credentials', 'state', 'reports']) privateDirectory(path.join(target, child));
  const envFile = path.join(target, 'credentials/runtime.env');
  if (fs.existsSync(envFile) && fs.lstatSync(envFile).isSymbolicLink())
    throw new Error('Runtime key file cannot be a symlink');
  if (!fs.existsSync(envFile)) {
    if (fs.readdirSync(path.join(target, 'state')).length) {
      throw new Error(
        'Instance data exists without runtime keys. Restore the original keys; refusing to generate replacements.',
      );
    }
    const keys = ['AFS_VAULT_KEY', 'AFS_DID_SPACE_SNAPSHOT_SECRET'];
    const content = keys.map((key) => `${key}=${randomBytes(32).toString('hex')}\n`).join('');
    fs.writeFileSync(envFile, content, { mode: 0o600, flag: 'wx' });
  }
  const lines = fs.readFileSync(envFile, 'utf8').trim().split('\n');
  if (
    lines.length !== 2 ||
    !/^AFS_VAULT_KEY=[a-f0-9]{64}$/.test(lines[0]) ||
    !/^AFS_DID_SPACE_SNAPSHOT_SECRET=[a-f0-9]{64}$/.test(lines[1])
  ) {
    throw new Error('Runtime key file is invalid; restore it without changing the existing instance keys.');
  }
  fs.chmodSync(envFile, 0o600);
  return envFile;
}

export function assertOwned(labels, target) {
  if (labels?.['org.didmail.demo'] !== 'support-community' || labels?.['org.didmail.demo.home'] !== target) {
    throw new Error('Refusing to modify a container not owned by this demo checkout');
  }
}

function docker(args, { inherit = false, allowMissing = false } = {}) {
  const result = spawnSync('docker', args, { encoding: 'utf8', stdio: inherit ? 'inherit' : 'pipe' });
  if (result.error) throw new Error('Docker CLI is unavailable; install/start Docker or OrbStack');
  if (result.status !== 0) {
    if (allowMissing && /No such (?:object|container)/i.test(result.stderr ?? '')) return null;
    // Do not include arguments, environment or inspect output in exceptions.
    throw new Error(`Docker ${args[0]} failed; check Docker availability${inherit ? ' and the build output' : ''}`);
  }
  return result.stdout?.trim() ?? '';
}

export function createController() {
  const suffix = createHash('sha256').update(home).digest('hex').slice(0, 10);
  const container = `didmail-support-demo-${suffix}`;
  const image = `didmail-support-demo:${suffix}`;
  const portFile = path.join(home, 'port');
  const inspect = () => {
    const result = docker(['inspect', '--type', 'container', '--format', '{{json .Config.Labels}}', container], {
      allowMissing: true,
    });
    if (result === null) return null;
    const labels = JSON.parse(result);
    assertOwned(labels, home);
    return labels;
  };
  const url = () => {
    const port = fs.readFileSync(portFile, 'utf8').trim();
    if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('Invalid saved demo port');
    return `http://localhost:${port}/app?blocklet=${config.id}`;
  };
  const ready = async () => {
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(url(), { signal: AbortSignal.timeout(1500) });
        await response.body?.cancel();
        if (response.status === 200) return;
      } catch {
        /* ARC and its startup warmup may still be starting. */
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Demo did not become ready; inspect docker logs ${container}`);
  };
  return {
    home,
    container,
    image,
    url,
    build() {
      docker(['build', '--platform', 'linux/amd64', '--tag', image, directory], { inherit: true });
    },
    async start() {
      const envFile = initializePrivateHome(home);
      if (inspect()) {
        docker(['start', container]);
      } else {
        // Explicit HostPort is required: OrbStack may reassign Docker's empty
        // (dynamic) HostPort on restart, invalidating the saved browser origin.
        const port = fs.existsSync(portFile) ? new URL(url()).port : String(await availablePort());
        docker([
          'run',
          '--detach',
          '--init',
          '--pull=never',
          '--platform',
          'linux/amd64',
          '--name',
          container,
          '--hostname',
          'support-demo',
          '--label',
          'org.didmail.demo=support-community',
          '--label',
          `org.didmail.demo.home=${home}`,
          '--publish',
          `127.0.0.1:${port}:8080`,
          '--mount',
          `type=bind,source=${path.join(home, 'state')},target=/data`,
          '--env-file',
          envFile,
          image,
        ]);
        const binding = docker(['port', container, '8080/tcp']);
        const match = /^127\.0\.0\.1:(\d+)$/.exec(binding);
        if (!match) throw new Error('Unexpected Docker port binding; expected loopback only');
        fs.writeFileSync(portFile, match[1] + '\n', { mode: 0o600 });
      }
      await ready();
    },
    async restart() {
      initializePrivateHome(home);
      if (!inspect()) throw new Error('Start the demo first');
      docker(['restart', '--timeout', '30', container]);
      await ready();
    },
    async recreate() {
      initializePrivateHome(home);
      if (inspect()) {
        docker(['stop', '--timeout', '30', container]);
        docker(['rm', container]);
      }
      await this.start();
    },
    stop() {
      if (!inspect()) throw new Error('Demo container does not exist');
      docker(['stop', '--timeout', '30', container]);
    },
    status() {
      if (!inspect()) return 'Not created';
      return docker(['inspect', '--format', '{{.State.Status}}', container]);
    },
    readSetting() {
      if (!inspect()) throw new Error('Demo container does not exist');
      const result = JSON.parse(
        docker([
          'exec',
          container,
          'arc',
          'afs',
          'read',
          `/blocklets/${config.id}/instance/settings/settings-shell/app/instance-settings/support/identity/community-name.json`,
          '--instance',
          config.instance,
          '--json',
        ]),
      );
      return JSON.parse(result.data.content);
    },
    identity() {
      const result = JSON.parse(fs.readFileSync(path.join(home, 'state/service-start.json'), 'utf8'));
      return { id: result.id, name: result.name };
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const demo = createController();
    const command = process.argv[2];
    if (command === 'verify') {
      await demo.start();
      const { verifyDemo } = await import('./verify.mjs');
      await verifyDemo(demo);
    } else if (['build', 'start', 'restart', 'recreate', 'stop', 'status'].includes(command)) {
      const result = await demo[command]();
      if (command === 'status') console.log(result);
      if (['start', 'restart', 'recreate'].includes(command)) console.log(demo.url());
    } else {
      throw new Error(
        'Usage: node examples/support-community-docker/demo.mjs build|start|restart|recreate|stop|status|verify',
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
