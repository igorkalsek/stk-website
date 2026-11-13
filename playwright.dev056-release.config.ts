import { defineConfig, devices } from '@playwright/test';

// Real production build switch and full reviewed index; frozen public API snapshot.
// Never publish the dist folder created with this alternate config.
export default defineConfig({
  testDir: './tests/browser',
  outputDir: './.cache/dev056-browser-results',
  testMatch: 'finder-nearby-release.spec.ts',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'dot' : 'list',
  use: { baseURL: 'http://127.0.0.1:4323', trace: 'on-first-retry', screenshot: 'only-on-failure' },
  webServer: {
    command: 'npm run build && npx astro preview --host 127.0.0.1 --port 4323',
    url: 'http://127.0.0.1:4323',
    env: {
      PUBLIC_STK_NEARBY_ENABLED: '1',
      PUBLIC_STK_TURNSTILE_SITE_KEY: '1x00000000000000000000AA'
    },
    reuseExistingServer: false,
    timeout: 180_000
  },
  projects: [{name: 'chromium', use: { ...devices['Desktop Chrome'] }}]
});
