import { defineConfig } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

/**
 * E2E config for the deployed funnel (Preview or Production). There is no
 * webServer block on purpose: `npm run e2e` walks a real deployment, which is
 * the only place the Stripe webhook, Vercel Blob and Resend all exist.
 *
 *   BASE_URL=https://mindscale-echo.vercel.app npm run e2e
 *   BASE_URL=https://mindscale-echo-git-v1-merge-oglow.vercel.app npm run e2e
 *
 * Secrets come from the gitignored .env.local (the local mirror of the Vercel
 * values). Nothing is printed; the test only logs ids, statuses and counts.
 */
function loadEnvLocal() {
  const file = new URL('./.env.local', import.meta.url);
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (!match) continue;
    const key = match[1];
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    if (!value) continue;
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvLocal();

const baseURL = process.env.BASE_URL || 'https://mindscale-echo.vercel.app';
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '';
// Preview deployments sit behind Vercel Authentication; the production alias is
// public. `x-vercel-set-bypass-cookie` makes the bypass survive the redirects
// back from Stripe Checkout.
const protectedHost = !/^https:\/\/mindscale-echo\.vercel\.app/.test(baseURL);
const extraHTTPHeaders =
  bypass && protectedHost
    ? { 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'true' }
    : {};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 15 * 60 * 1000,
  expect: { timeout: 20 * 1000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    // Chromium from the Playwright CDN is not downloaded on this machine; the
    // installed Google Chrome is.
    channel: 'chrome',
    headless: true,
    viewport: { width: 1366, height: 950 },
    extraHTTPHeaders,
    actionTimeout: 45 * 1000,
    navigationTimeout: 90 * 1000,
    trace: 'retain-on-failure',
    video: 'on',
    screenshot: 'only-on-failure',
  },
});
