import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/tests',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5174',
    headless: true,
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm start',
    port: 5174,
    reuseExistingServer: true,
    timeout: 30_000
  }
})
