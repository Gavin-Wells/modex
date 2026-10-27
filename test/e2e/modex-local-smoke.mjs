// Copyright ModelSwitch. Licensed under Apache-2.0.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const url = process.env.MODEX_PREVIEW_URL || 'http://127.0.0.1:5175/';
const executablePath = process.env.MODEX_CHROMIUM_PATH || undefined;
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage();
  const upstreamRequests = [];
  const errors = [];
  await page.route('**/api/v1/user/modelswitch-security-config', (route) =>
    route.fulfill({
      json: { turnstile_required: false, turnstile_site_key: '' },
    })
  );
  await page.route('**/api/v1/user/modelswitch-password-login', (route) =>
    route.fulfill({ status: 401, json: { detail: 'Invalid credentials' } })
  );
  page.on('request', (request) => {
    const hostname = new URL(request.url()).hostname.toLowerCase();
    if (
      hostname === 'eigent.ai' ||
      hostname.endsWith('.eigent.ai') ||
      hostname.endsWith('.stack-auth.com')
    ) {
      upstreamRequests.push(hostname);
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByText('Modex', { exact: true }).waitFor();
  await page.getByText('登录 ModelSwitch 账号').waitFor();
  await page.getByLabel('账号').fill('test-user');
  await page.getByLabel('密码').fill('test-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.getByRole('alert').waitFor();
  await page.unroute('**/api/v1/user/modelswitch-password-login');
  await page.route('**/api/v1/user/modelswitch-password-login', (route) =>
    route.fulfill({ json: { token: 'local-test-token', email: 'user@accounts.modelswitch.org', user_id: 42 } })
  );
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForFunction(() => {
    const saved = localStorage.getItem('auth-storage');
    return saved && JSON.parse(saved).state?.user_id === 42;
  });
  assert.deepEqual(errors, [], 'local login rendered with a JavaScript error');
  assert.deepEqual(
    upstreamRequests,
    [],
    'local login contacted the upstream cloud'
  );
  console.log('PASS: local login renders without upstream cloud requests');
} finally {
  await browser.close();
}
