export function resolveProxyBaseUrl(options: {
  development: boolean;
  local: boolean;
  proxyUrl?: string;
  baseUrl?: string;
  managedLocalUrl?: string;
}): string {
  if (options.development) return '';
  const value = options.local
    ? options.managedLocalUrl
    : options.proxyUrl || options.baseUrl;
  if (!value) throw new Error('Local workspace service URL is not configured');
  if (options.local) {
    const url = new URL(value);
    if (
      url.protocol !== 'http:' ||
      url.hostname !== '127.0.0.1' ||
      !url.port ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    ) {
      throw new Error('Invalid managed workspace service URL');
    }
  }
  return value.replace(/\/$/, '');
}
