/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { clientScripts, CODE_BLOCKS_DIST, loadPage, text } from './site'

// 文章目前沒有一般程式碼區塊（只有 MagicSteps），所以用樣本頁測：
// tests/fixtures/code-blocks 用同一份網站設定 build，輸出不會進正式網站。
const SAMPLE = '/mobx/code-blocks/'
const sample = () => loadPage(SAMPLE, CODE_BLOCKS_DIST)
const codeBlocks = () => sample().querySelectorAll('figure').filter((f) => f.querySelector('pre'))

describe('一般程式碼區塊', () => {
  it('每個區塊都有中文的複製按鈕，複製的是整段程式碼', () => {
    const blocks = codeBlocks()
    expect(blocks.length).toBeGreaterThan(0)
    for (const block of blocks) {
      const button = block.querySelector('button')
      expect(button, '找不到複製按鈕').toBeTruthy()
      expect(button!.getAttribute('title')).toBe('複製到剪貼簿')
      expect(button!.getAttribute('data-copied')).toMatch(/^[^A-Za-z]*[一-鿿][^A-Za-z]*$/)
      // 只比對非空白字元：複製內容和畫面上的程式碼一致
      const visible = (s: string) => s.replace(/[\s\u007f]+/g, '')
      expect(visible(button!.getAttribute('data-code')!)).toBe(
        visible(block.querySelector('pre')!.textContent),
      )
    }
  })

  it('可以標出檔名、重點行、新增和刪除的行', () => {
    // 樣本：```js title="cart.js" {2} ins={3} del={4}
    const block = codeBlocks().find((b) => text(b.querySelector('figcaption')) === 'cart.js')
    expect(block, '找不到標題為 cart.js 的區塊').toBeTruthy()
    // 每一行的標記只能從 class 看出來（Expressive Code 用 mark / ins / del）
    const marks = block!
      .querySelectorAll('pre code > *')
      .map((line) => ['mark', 'ins', 'del'].find((m) => line.classList.contains(m)) ?? '')
    expect(marks).toEqual(['', 'mark', 'ins', 'del'])
  })

  it('和程式碼動畫用同一套配色：同樣的 token 是同樣的顏色', () => {
    const stepper = magicStepperTokens()
    // 第一個樣本區塊沒有任何標記，顏色不會因為底色不同而被調整
    const spans = codeBlocks()[0].querySelectorAll('pre span[style]')
    const compared = spans
      .map((span) => ({
        token: span.textContent.trim(),
        color: span.getAttribute('style')!.match(/#[0-9a-f]+/i)![0].toLowerCase(),
      }))
      .filter(({ token }) => stepper.get(token)?.size === 1)
    expect(compared.length).toBeGreaterThan(10)
    for (const { token, color } of compared) {
      expect(color, `「${token}」的顏色`).toBe([...stepper.get(token)!][0])
    }
  })
})

describe('有一般程式碼區塊的頁面，瀏覽器端', () => {
  it('不需要下載語法高亮引擎，只多了複製按鈕的小程式', () => {
    const scripts = clientScripts(CODE_BLOCKS_DIST)
    expect(scripts.length).toBeGreaterThan(0)
    // 和 site.test.ts 同一個判斷：Shiki 的語法檔有 scopeName，vscode-textmate 有 tokenizeLine
    const withShiki = scripts.filter((file) => /scopeName|tokenizeLine/.test(readFileSync(file, 'utf8')))
    expect(withShiki).toEqual([])
  })
})

// 正式網站裡 MagicSteps 的 token → 顏色（island props 是 Astro 的序列化格式：[型別, 值]）
function magicStepperTokens() {
  const decode = (value: unknown): unknown => {
    const [type, raw] = value as [number, unknown]
    if (type === 1) return (raw as unknown[]).map(decode)
    if (raw && typeof raw === 'object') {
      return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, decode(v)]))
    }
    return raw
  }
  const colors = new Map<string, Set<string>>()
  for (const island of loadPage('/mobx/01-getter-setter/').querySelectorAll('astro-island')) {
    if (JSON.parse(island.getAttribute('opts')!).name !== 'MagicStepper') continue
    const props = decode([0, JSON.parse(island.getAttribute('props')!)]) as {
      steps: { tokens: { content: string; color?: string }[] }[]
    }
    for (const { content, color } of props.steps.flatMap((s) => s.tokens)) {
      const token = content.trim()
      if (!token || !color) continue
      if (!colors.has(token)) colors.set(token, new Set())
      colors.get(token)!.add(color.toLowerCase())
    }
  }
  return colors
}
