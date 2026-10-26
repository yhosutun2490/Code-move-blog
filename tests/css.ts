/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DIST, loadPage } from './site'

// 讀者瀏覽器會拿到的樣式：依頁面上出現的順序收集 <link> 和 <style>
// 只做測試需要的最小 CSS 解析，不是完整的 CSS 引擎

const ORIGIN = 'http://site.local'

export interface Stylesheet {
  href: string // 用來解析 url() 的基準網址
  css: string
}

export function pageStylesheets(url: string): Stylesheet[] {
  return loadPage(url)
    .querySelectorAll('link[rel="stylesheet"], style')
    .map((el) => {
      if (el.tagName === 'STYLE') return { href: url, css: el.textContent }
      const href = el.getAttribute('href')!
      const local = new URL(href, ORIGIN + url)
      if (local.origin !== ORIGIN) return { href, css: '' }
      return { href: local.pathname, css: readFileSync(join(DIST, local.pathname), 'utf8') }
    })
}

// 頁面引用的外部網址（字型 CDN 之類）
export function externalUrls(url: string): string[] {
  const page = loadPage(url)
  const fromLinks = page
    .querySelectorAll('link[href]')
    .map((el) => el.getAttribute('href')!)
    .filter((href) => new URL(href, ORIGIN + url).origin !== ORIGIN)
  const fromCss = pageStylesheets(url).flatMap((sheet) =>
    [...sheet.css.matchAll(/(?:url\(\s*['"]?|@import\s+['"])(https?:)?\/\/[^'")\s]+/g)].map((m) => m[0]),
  )
  return [...fromLinks, ...fromCss]
}

export interface Rule {
  selectors: string[]
  decls: [string, string][]
  atRules: string[] // 外層的 @layer / @media 等
  sheet: Stylesheet
}

// 依括號、引號切開，不在 url(...) 或字串裡切
function splitTop(text: string, sep: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote = ''
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = ''
    } else if (c === '"' || c === "'") quote = c
    else if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === sep && depth === 0) {
      parts.push(text.slice(start, i))
      start = i + 1
    }
  }
  parts.push(text.slice(start))
  return parts.map((p) => p.trim()).filter(Boolean)
}

function parseDecls(text: string): [string, string][] {
  return splitTop(text, ';').flatMap((d) => {
    const i = d.indexOf(':')
    return i > 0 ? [[d.slice(0, i).trim(), d.slice(i + 1).trim()] as [string, string]] : []
  })
}

export function parseRules(sheet: Stylesheet): Rule[] {
  const css = sheet.css.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: Rule[] = []
  const stack: { prelude: string; body: string }[] = [{ prelude: '', body: '' }]
  let buf = ''
  let quote = ''
  let depth = 0
  for (let i = 0; i < css.length; i++) {
    const c = css[i]
    if (quote) {
      buf += c
      if (c === '\\') buf += css[++i] ?? ''
      else if (c === quote) quote = ''
      continue
    }
    if (c === '"' || c === "'") quote = c
    if (c === '(') depth++
    if (c === ')') depth--
    if (c === '{' && depth === 0) {
      // buf 前段是外層的宣告，最後一個分號之後才是這個區塊的選擇器
      const parts = splitTop(buf, ';')
      const prelude = parts.pop() ?? ''
      stack.at(-1)!.body += parts.join(';') + ';'
      stack.push({ prelude, body: '' })
      buf = ''
    } else if (c === '}' && depth === 0) {
      const frame = stack.pop()!
      frame.body += buf
      buf = ''
      rules.push({
        selectors: frame.prelude.startsWith('@') ? [] : splitTop(frame.prelude, ','),
        decls: parseDecls(frame.body.replace(/^;+/, '')),
        atRules: [...stack.slice(1).map((f) => f.prelude), ...(frame.prelude.startsWith('@') ? [frame.prelude] : [])],
        sheet,
      })
    } else buf += c
  }
  return rules
}

export function pageRules(url: string): Rule[] {
  return pageStylesheets(url).flatMap(parseRules)
}

export interface FontFace {
  family: string
  weight: string
  files: string[] // 解析成 dist 裡的路徑；外部網址保留原樣
}

export function fontFaces(url: string): FontFace[] {
  return pageRules(url)
    .filter((r) => r.atRules.at(-1)?.startsWith('@font-face'))
    .map((r) => {
      const get = (name: string) => r.decls.find(([k]) => k === name)?.[1] ?? ''
      const files = [...get('src').matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)]
        .map((m) => m[2])
        .filter((u) => !u.startsWith('data:'))
        .map((u) => {
          const resolved = new URL(u, ORIGIN + r.sheet.href)
          return resolved.origin === ORIGIN ? join(DIST, decodeURIComponent(resolved.pathname)) : u
        })
      return { family: get('font-family').replace(/^['"]|['"]$/g, ''), weight: get('font-weight'), files }
    })
}

export function localFileExists(path: string) {
  return path.startsWith(DIST) && existsSync(path)
}

// 指定主題時 <html> 上的 CSS 自訂屬性最後算出來的值。
// 只看直接套在 <html> 上、沒有 @media 條件的規則，所以和讀者的系統設定無關。
type Theme = 'light' | 'dark'

function htmlSpecificity(selector: string, theme: Theme): number | null {
  const m = selector
    .replace(/\s+/g, '')
    .match(/^(html|:root)?(?:\[data-theme=(['"]?)(light|dark)\2\])?$/)
  if (!m || selector.trim() === '') return null
  if (m[3] && m[3] !== theme) return null
  // 只需要比較這幾種寫法：類別 / 屬性 / 偽類算 10，元素算 1
  return (m[1] === ':root' ? 10 : m[1] === 'html' ? 1 : 0) + (m[3] ? 10 : 0)
}

export function themeProperty(rules: Rule[], theme: Theme, prop: string): string | undefined {
  const winners = new Map<string, { rank: [number, number, number]; value: string }>()
  rules.forEach((rule, order) => {
    if (rule.atRules.some((a) => !a.startsWith('@layer'))) return
    const layered = rule.atRules.length > 0 ? 0 : 1
    for (const selector of rule.selectors) {
      const spec = htmlSpecificity(selector, theme)
      if (spec === null) continue
      for (const [name, value] of rule.decls) {
        if (!name.startsWith('--')) continue
        const rank: [number, number, number] = [layered, spec, order]
        const current = winners.get(name)
        const beats =
          !current ||
          rank[0] > current.rank[0] ||
          (rank[0] === current.rank[0] && (rank[1] > current.rank[1] || (rank[1] === current.rank[1] && rank[2] >= current.rank[2])))
        if (beats) winners.set(name, { rank, value })
      }
    }
  })

  const resolve = (value: string, seen: Set<string>): string =>
    value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g, (_, name, fallback) => {
      if (seen.has(name)) return ''
      const found = winners.get(name)?.value ?? fallback ?? ''
      return resolve(found, new Set([...seen, name]))
    })

  const raw = winners.get(prop)?.value
  return raw === undefined ? undefined : resolve(raw, new Set([prop])).trim()
}
