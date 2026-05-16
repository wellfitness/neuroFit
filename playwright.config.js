import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'off',
    headless: true
  },
  webServer: {
    command: 'python -m http.server 4174 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4174/index.html',
    reuseExistingServer: true,
    timeout: 15000
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
});
