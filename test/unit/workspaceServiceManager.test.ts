import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WorkspaceServiceManager } from '../../electron/main/workspaceService/manager';

const python = process.env.MODEX_TEST_WORKSPACE_PYTHON;
const serverDir = process.env.MODEX_TEST_WORKSPACE_SERVER;
const redis = process.env.MODEX_TEST_WORKSPACE_REDIS;
const pythonPath = process.env.MODEX_TEST_WORKSPACE_SITE_PACKAGES;

describe('workspace service manager', () => {
  it('fails closed when bundled services are unavailable', async () => {
    const manager = new WorkspaceServiceManager({
      python: '/nonexistent/modex-python',
      redis: '/nonexistent/modex-redis',
      serverDir: '/nonexistent/modex-server',
      stateDir: os.tmpdir(),
    });
    await expect(manager.getConnection()).rejects.toThrow();
    await manager.stop();
  });

  it.skipIf(!python || !serverDir || !redis)(
    'starts an isolated workspace and validates its identity',
    async () => {
      const stateDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'modex-manager-test-')
      );
      const manager = new WorkspaceServiceManager({
        python: python!,
        pythonPath,
        serverDir: serverDir!,
        redis: redis!,
        stateDir,
      });
      try {
        const connection = await manager.getConnection();
        expect(connection.endpoint).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
        const denied = await fetch(
          `${connection.endpoint}/api/v1/user/modelswitch-security-config`
        );
        expect(denied.status).toBe(403);
        const allowed = await fetch(
          `${connection.endpoint}/api/v1/user/modelswitch-security-config`,
          {
            headers: { 'X-Modex-Workspace-Capability': connection.capability },
          }
        );
        expect(allowed.status).toBe(200);
        expect(
          (await fs.stat(path.join(stateDir, 'workspace.sqlite3'))).isFile()
        ).toBe(true);
      } finally {
        await manager.stop();
        await fs.rm(stateDir, { recursive: true, force: true });
      }
    },
    90000
  );
});
