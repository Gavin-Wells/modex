import crypto from 'node:crypto';
import http from 'node:http';

export async function verifyWorkspaceService(
  port: number,
  capability: string
): Promise<boolean> {
  if (
    !Number.isInteger(port) ||
    port < 1024 ||
    port > 65535 ||
    capability.length < 32
  ) {
    return false;
  }
  const nonce = crypto.randomBytes(32).toString('hex');
  const expected = crypto
    .createHmac('sha256', capability)
    .update(`modex-workspace:${nonce}`)
    .digest();
  return new Promise((resolve) => {
    const request = http.get(
      {
        hostname: '127.0.0.1',
        port,
        path: `/modex-local/ready/${nonce}`,
        timeout: 2000,
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          body += chunk;
          if (body.length > 1024) request.destroy();
        });
        response.on('end', () => {
          try {
            const proof = JSON.parse(body).proof;
            if (
              response.statusCode !== 200 ||
              typeof proof !== 'string' ||
              !/^[0-9a-f]{64}$/.test(proof)
            ) {
              resolve(false);
              return;
            }
            resolve(
              crypto.timingSafeEqual(expected, Buffer.from(proof, 'hex'))
            );
          } catch {
            resolve(false);
          }
        });
        response.on('error', () => resolve(false));
      }
    );
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
  });
}
