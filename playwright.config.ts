import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/tests',
  timeout: 60_000,
  retries: 0,
  workers: process.env.CI ? 3 : undefined,
  // CI: only run the smoke test file to validate the setup works
  grep: process.env.CI ? /existing user.*full E2E/ : undefined,
  use: {
    baseURL: 'http://localhost:5174',
    headless: true,
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: process.env.CI ? 'npx vite preview --port 5174' : 'npm start',
    port: 5174,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
})
