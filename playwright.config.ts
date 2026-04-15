import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/tests',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://localhost:5174',
    headless: true,
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm start',
    port: 5174,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
})
