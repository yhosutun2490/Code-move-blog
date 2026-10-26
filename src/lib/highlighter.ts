import { createHighlighter, type Highlighter } from 'shiki'

export const CODE_THEME = 'vitesse-dark'

// build 時共用一個 highlighter，避免每個 <MagicSteps> 都重新載入語法和主題
let instance: Promise<Highlighter> | undefined

export function getHighlighter() {
  instance ??= createHighlighter({
    themes: [CODE_THEME],
    langs: ['javascript', 'typescript', 'tsx'],
  })
  return instance
}
