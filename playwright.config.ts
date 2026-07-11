import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/tests',
  timeout: 60_000,
  retries: 0,
  workers: process.env.CI ? 3 : undefined,
  use: {
    baseURL: 'http://localhost:5174',
    headless: true,
    screenshot: 'only-on-failure'
  },
  webServer: process.env.SKIP_WEBSERVER
    ? undefined
    : {
        command: process.env.CI ? 'npx vite preview --port 5174 --base /auth' : 'npm start',
        port: 5174,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000
      },
  // Real-auth specs run against the dev deployment so HTTP traffic to the live
  // auth-server (decentraland.zone/auth) is same-origin and CORS-clean. The
  // request-types specs need the real /v2/requests/{id} backend so they don't
  // mock the auth-server.
  projects: [
    {
      name: 'local',
      testIgnore: /(request-types-.*|magic-google-real-oauth)\.spec\.ts$/
    },
    {
      name: 'real-auth',
      testMatch: /request-types-.*\.spec\.ts$/,
      use: { baseURL: 'https://decentraland.zone' }
    },
    {
      name: 'real-oauth',
      testMatch: /magic-google-real-oauth\.spec\.ts$/,
      use: { baseURL: 'https://decentraland.zone' }
    }
  ]
})
