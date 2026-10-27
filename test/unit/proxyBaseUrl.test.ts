import { resolveProxyBaseUrl } from '@/api/proxyBaseUrl';
import { describe, expect, it } from 'vitest';

describe('workspace service base URL', () => {
  it('uses the Vite proxy for development', () => {
    expect(resolveProxyBaseUrl({ development: true, local: true })).toBe('');
  });

  it('uses the absolute local service origin in packaged builds', () => {
    expect(
      resolveProxyBaseUrl({
        development: false,
        local: true,
        proxyUrl: 'http://127.0.0.1:3001/',
        baseUrl: '/api',
        managedLocalUrl: 'http://127.0.0.1:39123/',
      })
    ).toBe('http://127.0.0.1:39123');
  });

  it('fails closed if the local service origin is missing', () => {
    expect(() =>
      resolveProxyBaseUrl({ development: false, local: true, baseUrl: '/api' })
    ).toThrow();
  });

  it('rejects an unmanaged or non-loopback endpoint', () => {
    expect(() =>
      resolveProxyBaseUrl({
        development: false,
        local: true,
        proxyUrl: 'http://127.0.0.1:3001',
      })
    ).toThrow();
    expect(() =>
      resolveProxyBaseUrl({
        development: false,
        local: true,
        managedLocalUrl: 'https://example.com',
      })
    ).toThrow();
  });
});
