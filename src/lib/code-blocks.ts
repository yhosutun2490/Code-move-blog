import type { StarlightExpressiveCodeOptions } from '@astrojs/starlight/expressive-code'
import { CODE_THEME } from './highlighter'

/**
 * 一般程式碼區塊（Starlight 的 Expressive Code）設定。
 *
 * 配色和程式碼動畫（MagicSteps）共用同一個 CODE_THEME，
 * 畫面上只會有一種程式碼風格。astro.config.mjs 和測試都讀這一份。
 */
export const expressiveCode = {
  // 單一主題：淺色、深色模式都用 vitesse-dark，和程式碼動畫一樣
  themes: [CODE_THEME],
  // Expressive Code 預設會把對比不足的 token 調亮（例如 vitesse-dark 的 `=` #666666），
  // 程式碼動畫用的是 Shiki 原色，關掉調整兩邊才會一模一樣
  minSyntaxHighlightingColorContrast: 0,
} satisfies StarlightExpressiveCodeOptions
