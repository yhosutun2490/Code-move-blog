import { defineConfig } from 'vitest/config'

// 測試只看 build 產出（dist/），由 `npm test` 先跑 astro build 再執行。
// 限定在 tests/，避免掃到 .claude/worktrees 之類的其他副本。
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
