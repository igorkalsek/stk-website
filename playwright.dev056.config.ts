import { defineConfig, devices } from '@playwright/test';

// Separate CI-only static build. Uses a private Vite transform instead of
// changing any production source gates. NEVER publish this temporary dist/.
export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'finder-nearby-integration.spec.ts',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'dot' : 'list',
  use: { baseURL: 'http://127.0.0.1:4322', trace: 'on-first-retry', screenshot: 'only-on-failure' },
  webServer: {
    command: 'npx astro build --config tests/dev056-private-astro.config.mjs && npx astro preview --host 127.0.0.1 --port 4322',
    url: 'http://127.0.0.1:4322',
    env: {
      DEV056_PRIVATE_BROWSER_TEST: '1',
      PUBLIC_STK_TURNSTILE_SITE_KEY: '1x00000000000000000000AA'
    },
    reuseExistingServer: false,
    timeout: 180_000
  },
  projects: [{name: 'chromium', use: { ...devices['Desktop Chrome'] }}]
});
