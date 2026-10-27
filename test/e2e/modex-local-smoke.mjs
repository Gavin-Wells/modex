// Copyright ModelSwitch. Licensed under Apache-2.0.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

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
  page.on('request', (request) => {
    const hostname = new URL(request.url()).hostname.toLowerCase();
    if (hostname === 'eigent.ai' || hostname.endsWith('.eigent.ai')) {
      upstreamRequests.push(hostname);
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByText('Modex', { exact: true }).waitFor();
  await page.waitForTimeout(1500);
  assert.deepEqual(errors, [], 'local login rendered with a JavaScript error');
  assert.deepEqual(upstreamRequests, [], 'local login contacted the upstream cloud');
  console.log('PASS: local login renders without upstream cloud requests');
} finally {
  await browser.close();
}
