import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  outputDir: './node_modules/.playwright-test-results',
  use: {
    baseURL: 'http://127.0.0.1:4173',
  },
  webServer: process.env.CAMPUS_PULSE_E2E_EXTERNAL_SERVER === '1' ? undefined : {
    command: 'node e2e/start-frontend.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    gracefulShutdown: {
      signal: 'SIGINT',
      timeout: 5_000,
    },
  },
})
