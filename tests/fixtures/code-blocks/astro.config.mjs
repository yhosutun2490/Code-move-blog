// 測試用：同一份網站設定，只把文章換成程式碼區塊的樣本頁。
// 輸出到這個資料夾的 dist，不會混進正式網站。
// 用法（在專案根目錄）：astro build --config tests/fixtures/code-blocks/astro.config.mjs
import { rmSync } from 'node:fs'
import site from '../../../astro.config.mjs'

const here = './tests/fixtures/code-blocks'
const cacheDir = `${here}/.astro/cache`

// 內容快取不會因為改了 Expressive Code 設定而失效，每次都從頭 build 才測得到新設定
rmSync(cacheDir, { recursive: true, force: true })

export default {
  ...site,
  srcDir: `${here}/src`,
  outDir: `${here}/dist`,
  // 快取和正式網站分開，避免樣本頁被帶進正式 build
  cacheDir,
}
