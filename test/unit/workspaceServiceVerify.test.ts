import crypto from 'node:crypto';
import http from 'node:http';
import { describe, expect, it } from 'vitest';
import { verifyWorkspaceService } from '../../electron/main/workspaceService/verify';

describe('workspace service authentication', () => {
  it('accepts only a service proving knowledge of the capability', async () => {
    const capability = 'test-capability-at-least-32-bytes-long';
    const server = http.createServer((request, response) => {
      const nonce = request.url?.split('/').at(-1);
      const proof = crypto
        .createHmac('sha256', capability)
        .update(`modex-workspace:${nonce}`)
        .digest('hex');
      response.end(JSON.stringify({ proof }));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    try {
      const address = server.address();
      if (!address || typeof address === 'string')
        throw new Error('missing port');
      expect(await verifyWorkspaceService(address.port, capability)).toBe(true);
      expect(
        await verifyWorkspaceService(
          address.port,
          'incorrect-capability-at-least-32-bytes'
        )
      ).toBe(false);
      expect(await verifyWorkspaceService(address.port, 'short')).toBe(false);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
});
