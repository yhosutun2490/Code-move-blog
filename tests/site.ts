/**
 * 測試只透過「build 出來的網站」觀察行為：
 * - 文章清單從原始碼的 frontmatter 讀出（作為預期值的來源）
 * - 實際結果一律從 dist/ 的 HTML 與 JS 讀出
 *
 * 文章原始檔目前在 src/content/mobx/，遷移到 Starlight 後會在
 * src/content/docs/mobx/；兩個位置都會被找到，所以測試不用跟著改。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { parse as parseHtml, type HTMLElement } from 'node-html-parser'
import { parse as parseYaml } from 'yaml'

export const ROOT = resolve(import.meta.dirname, '..')
export const DIST = join(ROOT, 'dist')
const CONTENT = join(ROOT, 'src/content')

export interface Post {
  /** 篇章資料夾名稱，也是網址的一段：/mobx/<folder>/ */
  folder: string
  title: string
  description: string
  order: number
  draft: boolean
  /** MDX 內文（不含 frontmatter），用來推算頁面上該有哪些互動元件 */
  body: string
}

function findMobxDirs(dir: string): string[] {
  const found: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (!statSync(full).isDirectory()) continue
    if (name === 'mobx') found.push(full)
    else found.push(...findMobxDirs(full))
  }
  return found
}

/** 所有篇章（含草稿），依 order 排序 */
export function allPosts(): Post[] {
  const posts: Post[] = []
  for (const mobxDir of findMobxDirs(CONTENT)) {
    for (const folder of readdirSync(mobxDir)) {
      const file = ['index.mdx', 'index.md']
        .map((f) => join(mobxDir, folder, f))
        .find((f) => existsSync(f))
      if (!file) continue
      const source = readFileSync(file, 'utf8')
      const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
      if (!match) throw new Error(`${file} 沒有 frontmatter`)
      const data = parseYaml(match[1])
      posts.push({
        folder,
        title: data.title,
        description: data.description,
        order: data.order,
        draft: data.draft ?? false,
        body: match[2],
      })
    }
  }
  return posts.sort((a, b) => a.order - b.order)
}

/** 讀者看得到的篇章：非草稿，依 order 排序 */
export function publishedPosts(): Post[] {
  return allPosts().filter((p) => !p.draft)
}

export function postUrl(post: Pick<Post, 'folder'>): string {
  return `/mobx/${post.folder}/`
}

/** 網址對應到 dist 裡的檔案（靜態主機的解析方式） */
export function distFileFor(url: string): string {
  const clean = url.split(/[?#]/)[0]
  return clean.endsWith('/') ? join(DIST, clean, 'index.html') : join(DIST, clean)
}

export function pageExists(url: string): boolean {
  return existsSync(distFileFor(url))
}

export function loadPage(url: string): HTMLElement {
  const file = distFileFor(url)
  if (!existsSync(file)) throw new Error(`${url} 沒有頁面（找不到 ${file}）`)
  return parseHtml(readFileSync(file, 'utf8'), { comment: false })
}

/** 正規化後的可見文字 */
export function textOf(el: HTMLElement): string {
  return el.textContent.replace(/\s+/g, ' ').trim()
}

export interface Island {
  componentUrl: string
  rendererUrl: string
  /** 已解碼的 props 字串（Astro 序列化後的 JSON） */
  props: string
  /** 已解碼的 opts 字串（含元件名稱） */
  opts: string
}

/** 頁面上所有 client island（Astro 的 <astro-island> 標記） */
export function islandsOf(page: HTMLElement): Island[] {
  return page.querySelectorAll('astro-island').map((el) => ({
    componentUrl: el.getAttribute('component-url') ?? '',
    rendererUrl: el.getAttribute('renderer-url') ?? '',
    props: el.getAttribute('props') ?? '',
    opts: el.getAttribute('opts') ?? '',
  }))
}

/** JS 檔裡的靜態 / 動態 import 路徑 */
function importsIn(code: string): string[] {
  const specs = [
    ...code.matchAll(/\bfrom\s*["']([^"']+)["']/g),
    ...code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
    ...code.matchAll(/\bimport\s*["']([^"']+)["']/g),
  ].map((m) => m[1])
  return specs.filter((s) => s.startsWith('/') || s.startsWith('.'))
}

/**
 * 讀者打開 pageUrl 時瀏覽器可能下載的所有 JS（網址 → 原始碼）：
 * <script src>、inline module script 的 import、island 的元件與 renderer，
 * 以及它們遞迴 import 的 chunk。只算同站的檔案。
 */
export function clientScriptsOf(pageUrl: string): Map<string, string> {
  const page = loadPage(pageUrl)
  const base = new URL(pageUrl, 'http://site.test')
  const queue: string[] = []
  const enqueue = (spec: string, from: URL) => {
    const url = new URL(spec, from)
    if (url.origin === base.origin) queue.push(url.pathname)
  }

  for (const script of page.querySelectorAll('script')) {
    const src = script.getAttribute('src')
    if (src) enqueue(src, base)
    else for (const spec of importsIn(script.textContent)) enqueue(spec, base)
  }
  for (const island of islandsOf(page)) {
    if (island.componentUrl) enqueue(island.componentUrl, base)
    if (island.rendererUrl) enqueue(island.rendererUrl, base)
  }

  const seen = new Map<string, string>()
  while (queue.length) {
    const path = queue.shift()!
    if (seen.has(path)) continue
    const file = distFileFor(path)
    if (!existsSync(file)) throw new Error(`${pageUrl} 引用了不存在的 ${path}`)
    const code = readFileSync(file, 'utf8')
    seen.set(path, code)
    const from = new URL(path, base)
    for (const spec of importsIn(code)) enqueue(spec, from)
  }
  return seen
}

/** dist 底下所有檔案（相對路徑，以 / 分隔） */
export function distFiles(dir = DIST, prefix = ''): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const rel = prefix ? `${prefix}/${name}` : name
    if (statSync(full).isDirectory()) out.push(...distFiles(full, rel))
    else out.push(rel)
  }
  return out
}

/** 文章原始碼裡的 ## 小節標題（略過程式碼區塊） */
export function sectionHeadings(post: Pick<Post, 'body'>): string[] {
  const prose = post.body.replace(/^```[\s\S]*?^```/gm, '')
  return [...prose.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1])
}

export interface Toc {
  /** 目錄標題（例如「本頁內容」） */
  label: string
  links: { href: string; text: string }[]
}

/**
 * 本頁目錄：以標題命名（aria-labelledby）、而且只連到本頁錨點的導覽區塊。
 * 同一份目錄在寬螢幕和手機各有一份，回傳第一份。
 */
export function tocOf(page: HTMLElement): Toc | undefined {
  for (const nav of page.querySelectorAll('nav[aria-labelledby]')) {
    const links = nav
      .querySelectorAll('a[href]')
      .map((a) => ({ href: a.getAttribute('href')!, text: textOf(a) }))
    if (links.length === 0 || !links.every((l) => l.href.startsWith('#'))) continue
    const labelEl = page.getElementById(nav.getAttribute('aria-labelledby')!)
    return { label: labelEl ? textOf(labelEl) : '', links }
  }
  return undefined
}

export interface SearchRecord {
  url: string
  title: string
  content: string
}

/** build 時產生的全站搜尋索引（Pagefind），每頁一筆 */
export function searchIndex(): SearchRecord[] {
  const dir = join(DIST, 'pagefind/fragment')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.pf_fragment'))
    .map((f) => {
      const raw = gunzipSync(readFileSync(join(dir, f))).toString('utf8')
      const data = JSON.parse(raw.slice(raw.indexOf('{')))
      // Pagefind 會在中文詞之間插入零寬空白
      const clean = (s: string) => s.replace(/​/g, '')
      return { url: data.url, title: clean(data.meta?.title ?? ''), content: clean(data.content) }
    })
}

export interface NavLink {
  href: string
  text: string
  /** aria-current="page"：讀者目前所在的頁面 */
  current: boolean
}

/**
 * 側欄：標出「目前所在頁面」（aria-current="page"）的那個導覽區塊，
 * 回傳其中所有連結，依畫面上的順序。找不到時回傳 undefined。
 */
export function sidebarOf(page: HTMLElement): NavLink[] | undefined {
  const nav = page
    .querySelectorAll('nav')
    .find((n) => n.querySelector('a[aria-current="page"]'))
  return nav?.querySelectorAll('a[href]').map((a) => ({
    href: a.getAttribute('href')!,
    text: textOf(a),
    current: a.getAttribute('aria-current') === 'page',
  }))
}

/** 頁面引用的所有外部資源網址（<link href>、<script src>、<img src> 等），原樣回傳 */
export function resourceUrlsOf(page: HTMLElement): string[] {
  const urls: string[] = []
  for (const el of page.querySelectorAll('link[href]')) urls.push(el.getAttribute('href')!)
  for (const el of page.querySelectorAll('[src]')) urls.push(el.getAttribute('src')!)
  return urls
}

/** 是否指向別的網站（含 //cdn.example 這種省略 scheme 的寫法） */
export function isCrossOrigin(url: string): boolean {
  return new URL(url, 'http://site.test').origin !== 'http://site.test'
}

// dist 在測試期間不會變，讀過的 CSS 檔留著重用
const cssCache = new Map<string, string>()
function readCss(file: string): string {
  let css = cssCache.get(file)
  if (css === undefined) {
    css = readFileSync(file, 'utf8')
    cssCache.set(file, css)
  }
  return css
}

let allSheets: Map<string, string> | undefined
/** dist/_astro 裡 build 出來的所有 CSS 檔（檔名 → 內容），不管哪一頁有沒有引用 */
export function distStylesheets(): Map<string, string> {
  const dir = join(DIST, '_astro')
  allSheets ??= new Map(
    readdirSync(dir)
      .filter((f) => f.endsWith('.css'))
      .map((f) => [f, readCss(join(dir, f))]),
  )
  return allSheets
}

let allCss: string | undefined
/** distStylesheets() 全部接成一份 */
export function allDistCss(): string {
  allCss ??= [...distStylesheets().values()].join('\n')
  return allCss
}

/**
 * 讀者打開 pageUrl 時會載入的 CSS（網址 → 內容）：
 * 同站的 <link rel="stylesheet">、inline <style>，以及它們 @import 的同站檔案。
 * 站外的樣式表不讀，只列在網址裡（內容為空字串）。
 */
export function stylesheetsOf(pageUrl: string): Map<string, string> {
  const page = loadPage(pageUrl)
  const base = new URL(pageUrl, 'http://site.test')
  const out = new Map<string, string>()
  const visit = (href: string, from: URL) => {
    const url = new URL(href, from)
    const key = url.origin === base.origin ? url.pathname : url.href
    if (out.has(key)) return
    if (url.origin !== base.origin) {
      out.set(key, '')
      return
    }
    const css = readCss(distFileFor(url.pathname))
    out.set(key, css)
    for (const m of css.matchAll(/@import\s+(?:url\()?\s*["']?([^"')\s;]+)/g)) visit(m[1], url)
  }
  for (const link of page.querySelectorAll('link[rel~="stylesheet"][href]')) {
    visit(link.getAttribute('href')!, base)
  }
  page.querySelectorAll('style').forEach((style, i) => {
    out.set(`${pageUrl}#style-${i}`, style.textContent)
  })
  return out
}

export interface FontFace {
  family: string
  weight: string
  /** 字型檔網址（已依 CSS 檔位置解析成絕對網址） */
  src: string[]
}

/** CSS 裡宣告的 @font-face */
export function fontFacesIn(css: string, cssUrl: string): FontFace[] {
  const base = new URL(cssUrl, 'http://site.test')
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body]) => {
    const prop = (name: string) =>
      body.match(new RegExp(`(?:^|;|\\s)${name}\\s*:\\s*([^;]+)`))?.[1].trim() ?? ''
    return {
      family: prop('font-family').replace(/^["']|["']$/g, ''),
      weight: prop('font-weight'),
      src: [...prop('src').matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map(
        (m) => new URL(m[1], base).href,
      ),
    }
  })
}
