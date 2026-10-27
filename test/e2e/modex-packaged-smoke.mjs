// Copyright ModelSwitch. Licensed under Apache-2.0.
import assert from 'node:assert/strict';
import { _electron as electron } from '@playwright/test';

const executablePath = process.env.MODEX_APP_EXECUTABLE;
if (!executablePath) throw new Error('MODEX_APP_EXECUTABLE is required');
const app = await electron.launch({ executablePath, timeout: 120000 });
try {
  const page = await app.firstWindow({ timeout: 120000 });
  const upstream = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const host = new URL(request.url()).hostname.toLowerCase();
    if (host === 'eigent.ai' || host.endsWith('.eigent.ai') || host.endsWith('.stack-auth.com')) upstream.push(host);
  });
  await page.getByLabel('账号').waitFor({ timeout: 120000 });
  await page.getByRole('button', { name: '登录', exact: true }).waitFor({ timeout: 120000 });
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === '登录');
    return button && (!button.disabled || document.querySelector('iframe[src*="challenges.cloudflare.com"]'));
  }, null, { timeout: 120000 });
  assert.deepEqual(errors, [], 'packaged client had a JavaScript error');
  assert.deepEqual(upstream, [], 'packaged login contacted the upstream account service');
  console.log('PASS: packaged Modex started its workspace and loaded login security configuration');
} finally {
  await app.close();
}
