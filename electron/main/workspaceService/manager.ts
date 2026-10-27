import { spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { verifyWorkspaceService } from './verify';

type WorkspacePaths = {
  python: string;
  redis: string;
  serverDir: string;
  stateDir: string;
  pythonPath?: string;
};

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Cannot allocate local port'));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

function isRunning(child: ChildProcess): boolean {
  return (
    child.exitCode === null &&
    child.signalCode === null &&
    child.pid !== undefined
  );
}

async function canConnect(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function stopChild(child: ChildProcess | null): Promise<void> {
  if (!child || !isRunning(child)) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (isRunning(child)) child.kill('SIGKILL');
      resolve();
    }, 3000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

export class WorkspaceServiceManager {
  private capability = crypto.randomBytes(32).toString('hex');
  private redis: ChildProcess | null = null;
  private service: ChildProcess | null = null;
  private endpoint = '';
  private redisConfig = '';
  private starting: Promise<void> | null = null;
  private disposed = false;

  constructor(private readonly paths: WorkspacePaths) {}

  async start(): Promise<void> {
    if (this.disposed) throw new Error('Local workspace is shutting down');
    if (this.starting) return this.starting;
    if (
      this.endpoint &&
      this.service &&
      isRunning(this.service) &&
      this.redis &&
      isRunning(this.redis)
    )
      return;
    this.starting = this.startInternal().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  private async startInternal(): Promise<void> {
    await this.stop();
    await Promise.all([
      fs.access(this.paths.python),
      fs.access(this.paths.redis),
      fs.access(path.join(this.paths.serverDir, 'modex_local.py')),
    ]);
    await fs.mkdir(this.paths.stateDir, { recursive: true, mode: 0o700 });
    const redisPort = await freePort();
    let servicePort = await freePort();
    while (servicePort === redisPort) servicePort = await freePort();
    const redisPassword = crypto.randomBytes(32).toString('hex');
    this.redisConfig = path.join(
      this.paths.stateDir,
      `.redis-${crypto.randomBytes(12).toString('hex')}.conf`
    );
    await fs.writeFile(
      this.redisConfig,
      `bind 127.0.0.1\nport ${redisPort}\nprotected-mode yes\nsave ""\nappendonly no\nrequirepass ${redisPassword}\n`,
      { mode: 0o600, flag: 'wx' }
    );
    try {
      const redis = spawn(this.paths.redis, [this.redisConfig], {
        stdio: 'ignore',
        env: { PATH: process.env.PATH || '' } as NodeJS.ProcessEnv,
      });
      this.redis = redis;
      redis.on('error', () => {});
      const redisDeadline = Date.now() + 15000;
      while (
        Date.now() < redisDeadline &&
        isRunning(redis) &&
        !(await canConnect(redisPort))
      ) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!isRunning(redis) || !(await canConnect(redisPort)))
        throw new Error('Local Redis failed to start');
      const service = spawn(this.paths.python, ['modex_local.py'], {
        cwd: this.paths.serverDir,
        stdio: 'ignore',
        env: {
          ...process.env,
          PYTHONPATH: this.paths.pythonPath || '',
          MODEX_WORKSPACE_DATA_DIR: this.paths.stateDir,
          MODEX_WORKSPACE_PORT: String(servicePort),
          MODEX_WORKSPACE_REDIS_URL: `redis://:${redisPassword}@127.0.0.1:${redisPort}/0`,
          MODEX_WORKSPACE_CAPABILITY: this.capability,
        },
      });
      this.service = service;
      service.on('error', () => {});
      const deadline = Date.now() + 60000;
      while (Date.now() < deadline && isRunning(service) && isRunning(redis)) {
        if (await verifyWorkspaceService(servicePort, this.capability)) {
          this.endpoint = `http://127.0.0.1:${servicePort}`;
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      throw new Error('Local workspace failed to start');
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async getConnection(): Promise<{ endpoint: string; capability: string }> {
    await this.start();
    const url = new URL(this.endpoint);
    if (
      !this.service ||
      !isRunning(this.service) ||
      !this.redis ||
      !isRunning(this.redis) ||
      !(await verifyWorkspaceService(Number(url.port), this.capability))
    ) {
      throw new Error('Local workspace identity could not be verified');
    }
    return { endpoint: this.endpoint, capability: this.capability };
  }

  async stop(): Promise<void> {
    this.endpoint = '';
    await stopChild(this.service);
    await stopChild(this.redis);
    this.service = null;
    this.redis = null;
    if (this.redisConfig) {
      await fs.unlink(this.redisConfig).catch(() => {});
      this.redisConfig = '';
    }
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    if (this.starting) await this.starting.catch(() => {});
    await this.stop();
  }
}
