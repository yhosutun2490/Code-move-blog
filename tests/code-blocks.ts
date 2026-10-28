/**
 * 一般程式碼區塊（Expressive Code）與程式碼動畫（MagicSteps）的觀察工具。
 *
 * - 程式碼動畫：從 build 出來的 island props 讀出每一步的程式碼和 token 顏色
 * - 一般程式碼區塊：從 dist 裡的樣式表讀出實際生效的 CSS 變數
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRenderer } from '@astrojs/starlight/expressive-code'
import { toHtml } from '@astrojs/starlight/expressive-code/hast'
import { parse as parseHtml, type HTMLElement } from 'node-html-parser'
import { expressiveCode } from '../src/lib/code-blocks'
import { DIST, islandsOf } from './site'

/**
 * 用網站的 Expressive Code 設定渲染一個 Markdown 程式碼區塊。
 *
 * 目前文章裡沒有一般程式碼區塊（規格不新增文章內容），所以 build 出來的 HTML
 * 看不到它；改用同一份設定直接交給 Expressive Code 渲染。Starlight 在這之上
 * 只多加了 not-content class、介面翻譯和預設 styleOverrides，不影響這裡驗證的
 * 外框、複製按鈕、標記行和 token 顏色。
 */
export async function renderCodeBlock(code: string, language: string, meta = '') {
  const { ec } = await createRenderer(expressiveCode)
  const { renderedGroupAst } = await ec.render({ code, language, meta })
  // node-html-parser 預設把 <pre> 當純文字；這裡要看 <pre> 裡的每一行
  return parseHtml(toHtml(renderedGroupAst), {
    blockTextElements: { script: true, noscript: true, style: true },
  })
}

export interface MagicStep {
  code: string
  bg: string
  fg: string
  tokens: { content: string; color: string }[]
}

/**
 * Astro 序列化 island props 的格式：每個值都是 [型別, 值]，
 * 0 = 一般值或物件、1 = 陣列。這裡只還原這兩種。
 */
function revive(value: unknown): unknown {
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'number') return value
  const [type, inner] = value
  if (type === 1) return (inner as unknown[]).map(revive)
  if (type === 0 && inner && typeof inner === 'object') {
    return Object.fromEntries(Object.entries(inner).map(([k, v]) => [k, revive(v)]))
  }
  return inner
}

/** 頁面上每個程式碼動畫的每一步（build 時預先算好的 tokens） */
export function magicStepsOf(page: HTMLElement): MagicStep[][] {
  return islandsOf(page)
    .filter((i) => /"tokens"/.test(i.props))
    .map((i) => {
      const props = Object.fromEntries(
        Object.entries(JSON.parse(i.props)).map(([k, v]) => [k, revive(v)]),
      ) as { steps: MagicStep[] }
      return props.steps
    })
}

/** 逐字的顏色（略過空白），用來比對兩邊的語法高亮 */
export type CharColors = { char: string; color: string }[]

export function charColorsOfStep(step: MagicStep): CharColors {
  return step.tokens.flatMap((t) =>
    [...t.content].filter((c) => c.trim()).map((char) => ({ char, color: t.color.toLowerCase() })),
  )
}

/** 一般程式碼區塊每個字的顏色；沒有包 span 的字用 fallback（文字顏色） */
export function charColorsOfBlock(block: HTMLElement, fallback: string): CharColors {
  const out: CharColors = []
  const walk = (node: HTMLElement, color: string) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        for (const char of child.text) if (char.trim()) out.push({ char, color })
      } else {
        const el = child as HTMLElement
        const own = el.getAttribute('style')?.match(/--0:\s*(#[0-9a-fA-F]+)/)?.[1]
        walk(el, own ? own.toLowerCase() : color)
      }
    }
  }
  for (const line of block.querySelectorAll('.ec-line .code')) walk(line, fallback.toLowerCase())
  return out
}

/** dist 裡所有 CSS 檔（路徑 → 內容） */
function stylesheets(): Map<string, string> {
  const dir = join(DIST, '_astro')
  return new Map(
    readdirSync(dir)
      .filter((f) => f.endsWith('.css'))
      .map((f) => [f, readFileSync(join(dir, f), 'utf8')]),
  )
}

/** Expressive Code 產生的程式碼區塊樣式表 */
export function codeBlockStylesheet(): string {
  const found = [...stylesheets()].filter(([f]) => /^ec\./.test(f))
  if (found.length !== 1) throw new Error(`預期一份程式碼區塊樣式表，找到 ${found.length} 份`)
  return found[0][1]
}

/** 某個 CSS 自訂屬性在一段 CSS 裡出現過的所有值 */
export function declaredValues(css: string, prop: string): string[] {
  const re = new RegExp(`${prop.replace(/[-]/g, '\\-')}\\s*:\\s*([^;}]+)`, 'g')
  return [...css.matchAll(re)].map((m) => m[1].trim())
}

/**
 * 把 var(--x) 換成全站 CSS 裡 --x 宣告過的所有值（遞迴），
 * 回傳這個值在各種主題 / 情境下可能變成的實際值。
 */
export function resolveCssValue(value: string, depth = 0): string[] {
  const m = value.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/)
  if (!m || depth > 10) return [value]
  const allCss = [...stylesheets().values()].join('\n')
  const declared = declaredValues(allCss, m[1])
  const candidates = declared.length ? declared : m[2] ? [m[2]] : []
  return [...new Set(candidates.flatMap((v) => resolveCssValue(v, depth + 1)))]
}
