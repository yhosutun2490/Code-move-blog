import { defineConfig, devices } from '@playwright/test'

// 互動測試：
// - chromium：在真的瀏覽器裡操作 build 出來的站（astro preview）。`npm run test:e2e` 會先 astro build。
// - dev：對 astro dev 跑，只測 dev 才有的行為（dev-search.spec.ts）。
// 測試放在 e2e/（*.spec.ts），不會被 Vitest 的 tests/**/*.test.ts 掃到。
const PREVIEW_PORT = 4399
const DEV_PORT = 4398
const DEV_ONLY = /dev-search\.spec\.ts/

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: DEV_ONLY,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${PREVIEW_PORT}` },
    },
    {
      name: 'dev',
      testMatch: DEV_ONLY,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${DEV_PORT}` },
    },
  ],
  // --ignore-lock：一律在前景跑（Astro 偵測到 AI agent 時會自動丟到背景，
  // Playwright 會以為 server 掛了），也不寫 lock file，不會擋到別人的 preview / dev。
  // 不重用別人開著的 server，避免測到別份 build 或別人的 dev server。
  webServer: [
    {
      command: `astro preview --port ${PREVIEW_PORT} --ignore-lock`,
      url: `http://localhost:${PREVIEW_PORT}/`,
      reuseExistingServer: false,
    },
    {
      command: `astro dev --port ${DEV_PORT} --ignore-lock`,
      url: `http://localhost:${DEV_PORT}/`,
      reuseExistingServer: false,
    },
  ],
})
