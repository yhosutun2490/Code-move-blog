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
