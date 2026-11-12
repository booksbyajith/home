import { defineConfig, devices } from '@playwright/test';

export const BASE = 'http://127.0.0.1:4321/booksbyajith/';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE,
    trace: 'off',
    serviceWorkers: 'block',
    locale: 'si-LK',
    timezoneId: 'Asia/Colombo',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: 'node ../scripts/with-env.mjs ../.env.emulator pnpm --dir ../site preview',
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
