import { defineConfig, devices } from '@playwright/test'

// 互動測試：在真的瀏覽器裡操作 build 出來的站（astro preview）。
// `npm run test:e2e` 會先 astro build；這裡只負責起 preview server。
// 測試放在 e2e/（*.spec.ts），不會被 Vitest 的 tests/**/*.test.ts 掃到。
const PORT = 4399

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // --ignore-lock：一律在前景跑（Astro 偵測到 AI agent 時會自動丟到背景，
    // Playwright 會以為 server 掛了），也不寫 lock file，不會擋到別人的 preview。
    command: `astro preview --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}/`,
    // 不重用別人開著的 server，避免測到別份 build
    reuseExistingServer: false,
  },
})
