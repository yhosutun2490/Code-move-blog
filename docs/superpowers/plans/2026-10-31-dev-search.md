# 開發時也能用搜尋 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `astro dev` 時頁首的 Starlight 搜尋可以用，索引跟著編輯即時更新（含草稿），`astro build` 完全不受影響。

**Architecture:** 一個只在 dev 掛上的 Astro integration，注入一組 Vite plugin：(1) 把 Starlight `Search.astro` 的元件與瀏覽器端 script 裡的 `import.meta.env.DEV` 換成 `false`；(2) 用 middleware 提供 `/pagefind/*`，內容是從 dev server 自己抓頁面、交給 Pagefind Node API 建在記憶體裡的索引。索引延後到第一次請求才建，`src/content/` 有變動就標成過期，下次請求重建。

**Tech Stack:** Astro 7、Starlight 0.42.7、Pagefind 1.5.2（Node API：`createIndex` / `addHTMLFile` / `getFiles` / `deleteIndex` / `close`）、Vite 8、Vitest、Playwright。

**Spec:** `docs/superpowers/specs/2026-10-31-dev-search-design.md`

---

## 環境（每個 task 都適用）

- Branch：`feat/dev-search`（從 `feat/multi-topic` 開出）。
- 預設的 Node v22.16.0 太舊（Astro 要 ≥ 22.23.4）。所有 npm / npx 指令前面加：
  `export PATH=/Users/rafael/.nvm/versions/node/v26.13.0/bin:$PATH`
- 使用者可能已經在 4321 開著自己的 `astro dev`，**不要停掉它**。自己起 dev server 一律用別的 port 加 `--ignore-lock`。
- 程式碼註解、測試敘述、commit 訊息都用繁體中文，風格比照現有檔案（例如 `src/lib/content-layout.ts`）。
- Commit 訊息結尾加：`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## 檔案結構

| 檔案 | 責任 |
|---|---|
| Create `src/lib/dev-search/crawl.ts` | 從首頁沿著同站連結抓頁面，回傳每頁的網址與 HTML。純邏輯，fetch 可注入。 |
| Create `src/lib/dev-search/index-cache.ts` | 「延後建立、過期後下次重建、失敗後重試」的快取。純邏輯，不知道 Pagefind 或 Vite。 |
| Create `src/lib/dev-search/pagefind-index.ts` | 把抓到的頁面交給 Pagefind，回傳記憶體裡的索引檔與釋放函式。唯一匯入 `pagefind` 的地方。 |
| Create `src/lib/dev-search/integration.ts` | Astro integration + Vite plugin：改寫 Search 元件、提供 `/pagefind/*`、監看內容變動。 |
| Create `tests/dev-search-crawl.test.ts` | crawl 的單元測試（刻意例外）。 |
| Create `tests/dev-search-cache.test.ts` | index-cache 的單元測試（刻意例外）。 |
| Create `e2e/dev-search.spec.ts` | 對 `astro dev` 的瀏覽器測試。 |
| Modify `astro.config.mjs` | 註冊 `devSearch()`。 |
| Modify `playwright.config.ts` | 加一個 dev project 與第二個 webServer。 |
| Modify `package.json` / `package-lock.json` | `pagefind` 加進 devDependencies。 |
| Modify `README.md` | 本機啟動、結構、測試例外。 |

---

### Task 1: `pagefind` 加進 devDependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: 安裝**

```bash
export PATH=/Users/rafael/.nvm/versions/node/v26.13.0/bin:$PATH
npm install -D pagefind@^1.5.2
```

- [ ] **Step 2: 確認版本和 Starlight 用的是同一份**

Run: `node -p "require('./node_modules/pagefind/package.json').version" && grep -n '"pagefind"' package.json`
Expected: `1.5.2`，`package.json` 的 devDependencies 有 `"pagefind": "^1.5.2"`。`node_modules/@astrojs/starlight/node_modules/pagefind` 不存在（沒有裝成第二份）。

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "$(printf 'dev 搜尋：pagefind 加進 devDependencies\n\n程式會直接匯入 pagefind 的 Node API，不再只靠 Starlight 的間接依賴。\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>')"
```

---

### Task 2: 抓頁面（crawl）

**Files:**
- Create: `src/lib/dev-search/crawl.ts`
- Test: `tests/dev-search-crawl.test.ts`

- [ ] **Step 1: 寫失敗的測試**

`tests/dev-search-crawl.test.ts`：

```ts
/**
 * dev 搜尋的抓頁邏輯（src/lib/dev-search/crawl.ts）。
 *
 * 刻意例外：這是 astro dev 才有的行為，dist/ 裡看不到，所以直接測函式，用假的 fetch 代替 dev server。
 */
import { describe, expect, test } from 'vitest'
import { crawlPages } from '../src/lib/dev-search/crawl'

const ORIGIN = 'http://localhost:4321'

/** 假的 dev server：網址 → [狀態碼, Content-Type, 內容] */
function fakeFetch(routes: Record<string, [number, string, string]>) {
  const requested: string[] = []
  const fetchPage = async (input: string | URL | Request) => {
    const url = new URL(String(input))
    requested.push(url.pathname)
    const [status, type, body] = routes[url.pathname] ?? [404, 'text/html', 'not found']
    return new Response(body, { status, headers: { 'Content-Type': type } })
  }
  return { fetchPage, requested }
}

const html = (...hrefs: string[]) =>
  `<html><body>${hrefs.map((h) => `<a href="${h}">x</a>`).join('')}</body></html>`

describe('dev 搜尋：從首頁抓頁面', () => {
  test('從首頁開始，沿著同站連結抓到每一頁，每頁只抓一次', async () => {
    const { fetchPage, requested } = fakeFetch({
      '/': [200, 'text/html; charset=utf-8', html('/a/1/', '/b/1/')],
      '/a/1/': [200, 'text/html', html('/', '/b/1/')],
      '/b/1/': [200, 'text/html', html('/a/1/')],
    })
    const pages = await crawlPages(ORIGIN, fetchPage)
    expect(pages.map((p) => p.url).sort()).toEqual(['/', '/a/1/', '/b/1/'])
    expect(requested.sort()).toEqual(['/', '/a/1/', '/b/1/'])
    expect(pages.find((p) => p.url === '/a/1/')?.html).toContain('href="/b/1/"')
  })

  test('不抓外站、靜態檔和 dev server 內部路徑；網址去掉 # 和 ?', async () => {
    const { fetchPage, requested } = fakeFetch({
      '/': [
        200,
        'text/html',
        html(
          'https://example.com/',
          '//cdn.example.com/x/',
          '/_astro/font.woff2',
          '/favicon.svg',
          '/@vite/client',
          '/a/1/#section',
          '/a/1/?q=1',
          '#top',
          'mailto:me@example.com',
        ),
      ],
      '/a/1/': [200, 'text/html', html()],
    })
    const pages = await crawlPages(ORIGIN, fetchPage)
    expect(pages.map((p) => p.url).sort()).toEqual(['/', '/a/1/'])
    expect(requested.sort()).toEqual(['/', '/a/1/'])
  })

  test('相對連結以所在頁面為基準解析；&amp; 會先解碼', async () => {
    const { fetchPage } = fakeFetch({
      '/a/': [200, 'text/html', html('1/', '../b/?x=1&amp;y=2')],
      '/a/1/': [200, 'text/html', html()],
      '/b/': [200, 'text/html', html()],
    })
    const pages = await crawlPages(ORIGIN, fetchPage, '/a/')
    expect(pages.map((p) => p.url).sort()).toEqual(['/a/', '/a/1/', '/b/'])
  })

  test('非 200 或不是 HTML 的回應不收進結果', async () => {
    const { fetchPage } = fakeFetch({
      '/': [200, 'text/html', html('/missing/', '/feed/')],
      '/feed/': [200, 'application/xml', '<rss/>'],
    })
    const pages = await crawlPages(ORIGIN, fetchPage)
    expect(pages.map((p) => p.url)).toEqual(['/'])
  })

  test('首頁本身抓不到時丟出錯誤（dev server 有問題，不該建出空索引）', async () => {
    const { fetchPage } = fakeFetch({ '/': [500, 'text/html', 'boom'] })
    await expect(crawlPages(ORIGIN, fetchPage)).rejects.toThrow('/')
  })
})
```

- [ ] **Step 2: 跑測試，確認失敗**

Run: `export PATH=/Users/rafael/.nvm/versions/node/v26.13.0/bin:$PATH && npx vitest run tests/dev-search-crawl.test.ts`
Expected: FAIL，找不到 `../src/lib/dev-search/crawl`。

- [ ] **Step 3: 實作**

`src/lib/dev-search/crawl.ts`：

```ts
// dev 搜尋：從 dev server 抓渲染後的頁面，交給 Pagefind 建索引（見 integration.ts）。
//
// 從首頁開始沿著同站連結走。首頁有完整側欄（dev 時含草稿），所以不用另外維護網址清單。
// 只走「頁面」：沒有副檔名的路徑；靜態檔（.woff2、.svg…）和 dev server 內部路徑（/@vite、/_astro…）都跳過。

export interface CrawledPage {
  /** 頁面網址（路徑），例如 /mobx/01-getter-setter/ */
  url: string
  /** dev server 渲染出來的 HTML */
  html: string
}

type FetchPage = (input: string | URL | Request) => Promise<Response>

const LINK = /<a\b[^>]*?\bhref="([^"]*)"/gi

/** 頁面裡所有同站頁面連結的路徑（去掉 # 和 ?） */
function pageLinksIn(html: string, pageUrl: URL): string[] {
  const paths: string[] = []
  for (const [, raw] of html.matchAll(LINK)) {
    const href = raw.replaceAll('&amp;', '&')
    let url: URL
    try {
      url = new URL(href, pageUrl)
    } catch {
      continue
    }
    if (url.origin !== pageUrl.origin) continue
    const path = url.pathname
    if (/^\/[@_]/.test(path)) continue // /@vite/client、/_astro/… 這類 dev server 內部路徑
    if (/\.[a-z0-9]+$/i.test(path)) continue // 靜態檔
    paths.push(path)
  }
  return paths
}

/** 從 start（預設首頁）開始，廣度優先抓所有同站頁面；只收 200 且是 HTML 的回應 */
export async function crawlPages(
  origin: string,
  fetchPage: FetchPage = fetch,
  start = '/',
): Promise<CrawledPage[]> {
  const pages: CrawledPage[] = []
  const seen = new Set([start])
  const queue = [start]
  while (queue.length > 0) {
    const path = queue.shift()!
    const url = new URL(path, origin)
    const response = await fetchPage(url)
    const isHtml = response.headers.get('content-type')?.includes('text/html') ?? false
    if (response.status !== 200 || !isHtml) {
      if (path === start) throw new Error(`dev 搜尋：抓不到 ${path}（HTTP ${response.status}）`)
      continue
    }
    const html = await response.text()
    pages.push({ url: path, html })
    for (const link of pageLinksIn(html, url)) {
      if (seen.has(link)) continue
      seen.add(link)
      queue.push(link)
    }
  }
  return pages
}
```

- [ ] **Step 4: 跑測試，確認通過**

Run: `export PATH=/Users/rafael/.nvm/versions/node/v26.13.0/bin:$PATH && npx vitest run tests/dev-search-crawl.test.ts`
Expected: 5 passed。

- [ ] **Step 5: Commit**

```bash
git add src/lib/dev-search/crawl.ts tests/dev-search-crawl.test.ts
git commit -m "$(printf 'dev 搜尋：從首頁沿著同站連結抓頁面\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>')"
```

---

### Task 3: 索引快取（延後建立、過期重建、失敗重試）

**Files:**
- Create: `src/lib/dev-search/index-cache.ts`
- Test: `tests/dev-search-cache.test.ts`

- [ ] **Step 1: 寫失敗的測試**

`tests/dev-search-cache.test.ts`：

```ts
/**
 * dev 搜尋的索引快取（src/lib/dev-search/index-cache.ts）。
 *
 * 刻意例外：這是 astro dev 才有的行為，dist/ 裡看不到，所以直接測函式，用假的 build 代替 Pagefind。
 */
import { describe, expect, test } from 'vitest'
import { createIndexCache, type BuiltIndex } from '../src/lib/dev-search/index-cache'

/** 假的建索引函式：每次呼叫產生一份新索引，記錄建了幾次、哪幾份被釋放 */
function fakeBuild() {
  let builds = 0
  const disposed: number[] = []
  const build = async (): Promise<BuiltIndex> => {
    const id = ++builds
    return {
      files: new Map([['/pagefind/pagefind.js', new TextEncoder().encode(`build ${id}`)]]),
      dispose: async () => {
        disposed.push(id)
      },
    }
  }
  return { build, disposed, builds: () => builds }
}

const text = (files: Map<string, Uint8Array>) =>
  new TextDecoder().decode(files.get('/pagefind/pagefind.js'))

describe('dev 搜尋：索引快取', () => {
  test('第一次 get 才建索引；之後的 get（含同時發出的）都用同一份', async () => {
    const fake = fakeBuild()
    const cache = createIndexCache(fake.build)
    expect(fake.builds()).toBe(0)
    const [a, b] = await Promise.all([cache.get(), cache.get()])
    expect(fake.builds()).toBe(1)
    expect(await cache.get()).toBe(a)
    expect(b).toBe(a)
  })

  test('invalidate 之後，下一次 get 重建，舊的那份被釋放', async () => {
    const fake = fakeBuild()
    const cache = createIndexCache(fake.build)
    expect(text(await cache.get())).toBe('build 1')
    cache.invalidate()
    expect(fake.builds()).toBe(1) // 不會馬上重建
    expect(text(await cache.get())).toBe('build 2')
    expect(fake.disposed).toEqual([1])
  })

  test('建立中途 invalidate：進行中的 get 拿到舊的那份，下一次 get 重建', async () => {
    const fake = fakeBuild()
    const cache = createIndexCache(fake.build)
    const pending = cache.get()
    cache.invalidate()
    expect(text(await pending)).toBe('build 1')
    expect(text(await cache.get())).toBe('build 2')
    await Promise.resolve()
    expect(fake.disposed).toEqual([1])
  })

  test('建立失敗時 get 丟出錯誤，下一次 get 會重試', async () => {
    let attempts = 0
    const cache = createIndexCache(async () => {
      attempts++
      if (attempts === 1) throw new Error('Pagefind 壞了')
      return { files: new Map(), dispose: async () => {} }
    })
    await expect(cache.get()).rejects.toThrow('Pagefind 壞了')
    await expect(cache.get()).resolves.toBeInstanceOf(Map)
    expect(attempts).toBe(2)
  })

  test('close 釋放目前那份；之後再 get 會重建', async () => {
    const fake = fakeBuild()
    const cache = createIndexCache(fake.build)
    await cache.get()
    await cache.close()
    expect(fake.disposed).toEqual([1])
    expect(text(await cache.get())).toBe('build 2')
  })
})
```

- [ ] **Step 2: 跑測試，確認失敗**

Run: `export PATH=/Users/rafael/.nvm/versions/node/v26.13.0/bin:$PATH && npx vitest run tests/dev-search-cache.test.ts`
Expected: FAIL，找不到 `../src/lib/dev-search/index-cache`。

- [ ] **Step 3: 實作**

`src/lib/dev-search/index-cache.ts`：

```ts
// dev 搜尋的索引快取：第一次有人要索引時才建（不拖慢 astro dev 啟動），
// 內容變動時標成過期、下次要的時候重建；建立失敗就丟掉，下次再試。

export interface BuiltIndex {
  /** 網址路徑（例如 /pagefind/pagefind.js）→ 檔案內容 */
  files: Map<string, Uint8Array>
  /** 釋放這份索引佔用的資源（Pagefind 的 deleteIndex） */
  dispose(): Promise<void>
}

export interface IndexCache {
  /** 目前的索引檔；沒有或已過期就建一份（同時呼叫只會建一次） */
  get(): Promise<Map<string, Uint8Array>>
  /** 標成過期：下一次 get 重建，舊的那份建好後釋放 */
  invalidate(): void
  /** 釋放目前那份（dev server 關閉時用） */
  close(): Promise<void>
}

export function createIndexCache(build: () => Promise<BuiltIndex>): IndexCache {
  let current: Promise<BuiltIndex> | undefined

  const release = (old: Promise<BuiltIndex> | undefined) =>
    old?.then(
      (built) => built.dispose(),
      () => {}, // 建失敗的那份沒有東西要釋放
    )

  return {
    get() {
      if (!current) {
        const building: Promise<BuiltIndex> = build().catch((error: unknown) => {
          if (current === building) current = undefined
          throw error
        })
        current = building
      }
      return current.then((built) => built.files)
    },
    invalidate() {
      const old = current
      current = undefined
      void release(old)
    },
    async close() {
      const old = current
      current = undefined
      await release(old)
    },
  }
}
```

- [ ] **Step 4: 跑測試，確認通過**

Run: `export PATH=/Users/rafael/.nvm/versions/node/v26.13.0/bin:$PATH && npx vitest run tests/dev-search-cache.test.ts`
Expected: 5 passed。

- [ ] **Step 5: Commit**

```bash
git add src/lib/dev-search/index-cache.ts tests/dev-search-cache.test.ts
git commit -m "$(printf 'dev 搜尋：索引快取（延後建立、過期重建、失敗重試）\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>')"
```

---

### Task 4: 用 Pagefind 建記憶體索引

**Files:**
- Create: `src/lib/dev-search/pagefind-index.ts`

這個模組只是 Pagefind Node API 的薄包裝，沒有自己的邏輯可單元測試；它由 Task 6 的瀏覽器測試涵蓋。

- [ ] **Step 1: 實作**

`src/lib/dev-search/pagefind-index.ts`：

```ts
// dev 搜尋：把抓到的頁面交給 Pagefind，索引檔留在記憶體（不寫進 dist/ 或 public/）。
// 正式版的索引仍由 Starlight 在 astro build 結束後產生，這裡只給 astro dev 用。
import * as pagefind from 'pagefind'
import type { CrawledPage } from './crawl'
import type { BuiltIndex } from './index-cache'

function assertNoErrors(errors: string[], step: string): void {
  if (errors.length > 0) throw new Error(`Pagefind ${step}失敗：${errors.join('；')}`)
}

/** 建一份索引：索引範圍和正式版一樣由頁面上的 data-pagefind-body 決定 */
export async function buildPagefindIndex(pages: CrawledPage[]): Promise<BuiltIndex> {
  const { index, errors } = await pagefind.createIndex()
  assertNoErrors(errors, '建立索引')
  if (!index) throw new Error('Pagefind 建立索引失敗：沒有回傳索引')
  try {
    for (const page of pages) {
      const added = await index.addHTMLFile({ url: page.url, content: page.html })
      assertNoErrors(added.errors, `加入 ${page.url} `)
    }
    const { files, errors: fileErrors } = await index.getFiles()
    assertNoErrors(fileErrors, '輸出索引檔')
    return {
      files: new Map(files.map((file) => [`/pagefind/${file.path.replace(/^\/+/, '')}`, file.content])),
      dispose: async () => {
        await index.deleteIndex()
      },
    }
  } catch (error) {
    await index.deleteIndex()
    throw error
  }
}

/** 關掉 Pagefind 的背景服務（dev server 關閉時用） */
export async function closePagefind(): Promise<void> {
  await pagefind.close()
}
```

- [ ] **Step 2: 型別檢查**

Run: `export PATH=/Users/rafael/.nvm/versions/node/v26.13.0/bin:$PATH && npx tsc --noEmit`
Expected: 沒有錯誤。

- [ ] **Step 3: Commit**

```bash
git add src/lib/dev-search/pagefind-index.ts
git commit -m "$(printf 'dev 搜尋：用 Pagefind 建記憶體索引\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>')"
```

---

### Task 5: dev 搜尋 integration（改寫 Search 元件、提供 /pagefind/*、監看內容）

**Files:**
- Create: `src/lib/dev-search/integration.ts`
- Modify: `astro.config.mjs`

- [ ] **Step 1: 實作 integration**

`src/lib/dev-search/integration.ts`：

```ts
// dev 搜尋：讓 Starlight 的搜尋在 astro dev 也能用（astro build 完全不受影響）。
//
// Starlight 的 Search.astro 在 dev 時刻意關掉搜尋：畫面只放「正式版本才能使用搜尋功能」，
// 瀏覽器端的 script 也直接 return。這裡做兩件事：
// 1. 改寫 Search.astro 的元件本身和瀏覽器端 script，把 import.meta.env.DEV 換成 false。
//    Astro 是從磁碟上的原始檔拆出 <script>，所以兩個 module 都要改。
// 2. 在 dev server 提供 /pagefind/*：從 dev server 自己抓頁面建索引，放在記憶體；
//    src/content/ 有變動就標成過期，下次請求重建（讀者重新整理頁面就會載入新索引）。
import { join, sep } from 'node:path'
import type { AstroIntegration, AstroIntegrationLogger } from 'astro'
import type { Plugin } from 'vite'
import { crawlPages } from './crawl'
import { createIndexCache } from './index-cache'
import { buildPagefindIndex, closePagefind } from './pagefind-index'

const SEARCH_COMPONENT = /\/@astrojs\/starlight\/dist\/components\/Search\.astro$/
const DEV_GATE = 'import.meta.env.DEV'

/** 把 Starlight 搜尋元件裡的 dev 判斷拿掉 */
function unlockSearchComponent(): Plugin {
  return {
    name: 'dev-search:unlock-search-component',
    apply: 'serve',
    enforce: 'pre',
    transform(code, id) {
      const [path, query = ''] = id.split('?')
      if (!SEARCH_COMPONENT.test(path)) return
      const isComponent = query === ''
      const isClientScript = query.includes('type=script')
      if (!isComponent && !isClientScript) return
      if (code.includes(DEV_GATE)) return code.replaceAll(DEV_GATE, 'false')
      // SSR 那份 script module 是空的佔位內容，本來就沒有這個判斷
      if (isComponent) {
        throw new Error(
          `dev 搜尋：在 Starlight 的 Search.astro 裡找不到 ${DEV_GATE}。` +
            `Starlight 可能改了 dev 時關閉搜尋的寫法，請更新 src/lib/dev-search/integration.ts。`,
        )
      }
    },
  }
}

const CONTENT_TYPES: Record<string, string> = {
  js: 'text/javascript',
  css: 'text/css',
  json: 'application/json',
}

function contentTypeOf(path: string): string {
  const extension = path.split('.').pop() ?? ''
  return CONTENT_TYPES[extension] ?? 'application/octet-stream'
}

/** 在 dev server 提供 /pagefind/*，內容變動時讓索引過期 */
function serveDevIndex(logger: AstroIntegrationLogger): Plugin {
  return {
    name: 'dev-search:serve-index',
    apply: 'serve',
    configureServer(server) {
      // 抓頁面用的網址：取自第一個 /pagefind/ 請求的 Host（dev server 的實際 port）
      let origin = ''
      const cache = createIndexCache(async () => {
        const started = performance.now()
        const pages = await crawlPages(origin)
        const built = await buildPagefindIndex(pages)
        logger.info(`dev 搜尋索引：${pages.length} 頁，${Math.round(performance.now() - started)}ms`)
        return built
      })

      const contentDir = join(server.config.root, 'src', 'content') + sep
      server.watcher.on('all', (_event, file) => {
        if (file.startsWith(contentDir)) cache.invalidate()
      })
      server.httpServer?.once('close', () => {
        void cache.close().then(closePagefind)
      })

      // 直接 use（不 return 函式）：排在 Vite 內建 middleware 之前，
      // Vite 才不會把 /pagefind/pagefind.js 當成要轉換的模組。
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0] ?? ''
        if (!path.startsWith('/pagefind/')) return next()
        origin = `http://${req.headers.host}`
        try {
          const body = (await cache.get()).get(path)
          if (!body) {
            res.statusCode = 404
            res.end()
            return
          }
          res.setHeader('Content-Type', contentTypeOf(path))
          res.setHeader('Cache-Control', 'no-store')
          res.end(Buffer.from(body))
        } catch (error) {
          logger.error(`dev 搜尋索引建立失敗：${error instanceof Error ? error.message : String(error)}`)
          res.statusCode = 500
          res.end()
        }
      })
    },
  }
}

/** 只在 astro dev 掛上；astro build 時什麼都不做 */
export function devSearch(): AstroIntegration {
  return {
    name: 'dev-search',
    hooks: {
      'astro:config:setup': ({ command, updateConfig, logger }) => {
        if (command !== 'dev') return
        updateConfig({ vite: { plugins: [unlockSearchComponent(), serveDevIndex(logger)] } })
      },
    },
  }
}
```

- [ ] **Step 2: 在 `astro.config.mjs` 註冊**

在 import 區加一行（放在 `import { assertContentLayout } ...` 上面，維持字母順序）：

```js
import { devSearch } from './src/lib/dev-search/integration'
```

`integrations` 陣列最後加上 `devSearch()`，並加註解：

```js
    react(),
    // astro dev 時也能用搜尋（索引在記憶體、跟著內容即時重建）；astro build 不受影響
    devSearch(),
  ],
```

- [ ] **Step 3: 型別檢查**

Run: `export PATH=/Users/rafael/.nvm/versions/node/v26.13.0/bin:$PATH && npx tsc --noEmit`
Expected: 沒有錯誤。

- [ ] **Step 4: 手動驗證 dev server**

```bash
export PATH=/Users/rafael/.nvm/versions/node/v26.13.0/bin:$PATH
(npx astro dev --port 4397 --ignore-lock > /tmp/dev-search-4397.log 2>&1 &)
for i in $(seq 1 60); do curl -s -o /dev/null http://localhost:4397/ && break; sleep 0.5; done
curl -s http://localhost:4397/mobx/01-getter-setter/ | grep -c 'starlight__search'
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://localhost:4397/pagefind/pagefind.js
curl -s 'http://localhost:4397/node_modules/@astrojs/starlight/dist/components/Search.astro?astro&type=script&index=0&lang.ts' | grep -c 'import.meta.env.DEV'
grep 'dev 搜尋' /tmp/dev-search-4397.log
pkill -f 'astro dev --port 4397'
```

Expected：
- 第一個 `grep -c` 大於 0（頁面上有搜尋容器，不是 dev 提示）。
- `pagefind.js` 回 `200 text/javascript`。
- script module 裡 `import.meta.env.DEV` 的次數是 `0`。（若這個網址回的是 SSR 佔位內容，改從頁面 HTML 找 `Search.astro?v=` 開頭的 script 網址再查。）
- log 有「dev 搜尋索引：N 頁」，N ≥ 3（首頁、MobX 文章、草稿測試主題的草稿）。

- [ ] **Step 5: 確認 build 不受影響**

Run: `export PATH=/Users/rafael/.nvm/versions/node/v26.13.0/bin:$PATH && npm test`
Expected: 全部通過（含既有的「搜尋索引沒有草稿」檢查）。

- [ ] **Step 6: Commit**

```bash
git add src/lib/dev-search/integration.ts astro.config.mjs
git commit -m "$(printf 'dev 搜尋：astro dev 時解除 Starlight 搜尋的 dev 限制並提供即時索引\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>')"
```

---

### Task 6: 對 `astro dev` 的瀏覽器測試

**Files:**
- Create: `e2e/dev-search.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: 寫測試**

`e2e/dev-search.spec.ts`：

```ts
import { expect, test, type Page } from '@playwright/test'
import { allPosts, postUrl, publishedPosts, sectionHeadings } from '../tests/site'
import { POST } from './helpers'

// 對 astro dev 跑（playwright.config.ts 的 dev project）：搜尋框可以用，而且用的是 dev 即時建的索引。
// 第一次搜尋要先建索引（抓頁面 + Pagefind），所以等結果的時間放寬。
const FIRST_SEARCH = { timeout: 30_000 }

const firstPost = publishedPosts()[0]
// 只含草稿的主題裡的草稿：正式版索引沒有它，dev 搜得到它就代表用的是 dev 即時建的索引
const draftOnlyTopicPost = allPosts().find(
  (post) => post.draft && !publishedPosts().some((p) => p.topic === post.topic),
)
if (!draftOnlyTopicPost) throw new Error('找不到只含草稿的測試用主題')

async function search(page: Page, query: string) {
  await page.getByRole('banner').getByRole('button', { name: '搜尋' }).click()
  const input = page.getByRole('dialog', { name: '搜尋' }).getByRole('textbox')
  await input.fill(query)
}

/** 搜尋結果裡連到 url 的那一筆（只看頁面連結，不看小節錨點） */
const resultLink = (page: Page, url: string) =>
  page.locator(`#starlight__search a.pagefind-ui__result-link[href="${url}"]`)

test.describe('dev 時的搜尋', () => {
  test('搜尋文章標題，結果裡有那篇文章', async ({ page }) => {
    await page.goto(POST)
    await search(page, firstPost.title)
    await expect(resultLink(page, postUrl(firstPost))).toBeVisible(FIRST_SEARCH)
  })

  test('搜得到草稿（dev 顯示草稿，索引也包含草稿）', async ({ page }) => {
    const [heading] = sectionHeadings(draftOnlyTopicPost)
    expect(heading, '草稿測試主題的篇章要有 ## 小節').toBeTruthy()
    await page.goto('/')
    await search(page, heading)
    await expect(resultLink(page, postUrl(draftOnlyTopicPost))).toBeVisible(FIRST_SEARCH)
  })
})
```

- [ ] **Step 2: 改 `playwright.config.ts`**

整個檔案改成：

```ts
import { defineConfig, devices } from '@playwright/test'

// 互動測試：
// - chromium：在真的瀏覽器裡操作 build 出來的站（astro preview）。`npm run test:e2e` 會先 astro build。
// - dev：對 astro dev 跑，只測 dev 才有的行為（dev-search.spec.ts）。
// 測試放在 e2e/（*.spec.ts），不會被 Vitest 的 tests/**/*.test.ts 掃到。
const PREVIEW_PORT = 4399
const DEV_PORT = 4398
const DEV_ONLY = /dev-search\.spec\.ts/

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: DEV_ONLY,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${PREVIEW_PORT}` },
    },
    {
      name: 'dev',
      testMatch: DEV_ONLY,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${DEV_PORT}` },
    },
  ],
  // --ignore-lock：一律在前景跑（Astro 偵測到 AI agent 時會自動丟到背景，
  // Playwright 會以為 server 掛了），也不寫 lock file，不會擋到別人的 preview / dev。
  // 不重用別人開著的 server，避免測到別份 build 或別人的 dev server。
  webServer: [
    {
      command: `astro preview --port ${PREVIEW_PORT} --ignore-lock`,
      url: `http://localhost:${PREVIEW_PORT}/`,
      reuseExistingServer: false,
    },
    {
      command: `astro dev --port ${DEV_PORT} --ignore-lock`,
      url: `http://localhost:${DEV_PORT}/`,
      reuseExistingServer: false,
    },
  ],
})
```

- [ ] **Step 3: 跑 dev 測試**

Run: `export PATH=/Users/rafael/.nvm/versions/node/v26.13.0/bin:$PATH && npx playwright test --project=dev`
Expected: 2 passed。

如果 `getByRole('textbox')` 找不到 Pagefind 的輸入框，先用 `npx playwright test --project=dev --debug` 看實際的 role，改成對應的 role（例如 `searchbox`），不要退回 CSS 選擇器。

- [ ] **Step 4: 確認測試真的會擋**

暫時把 `astro.config.mjs` 的 `devSearch()` 註解掉，再跑 `npx playwright test --project=dev`。
Expected: 2 failed（dialog 裡只有 dev 提示、沒有輸入框）。確認後還原，`git diff astro.config.mjs` 應為空。

- [ ] **Step 5: 跑完整 e2e**

Run: `export PATH=/Users/rafael/.nvm/versions/node/v26.13.0/bin:$PATH && npm run test:e2e`
Expected: 原本 11 個 + 新的 2 個，全部通過。

- [ ] **Step 6: Commit**

```bash
git add e2e/dev-search.spec.ts playwright.config.ts
git commit -m "$(printf 'dev 搜尋：對 astro dev 的瀏覽器測試\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>')"
```

---

### Task 7: README 與最終驗證

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 本機啟動段落**

把 `npm run dev` 那行改成：

```
npm run dev        # http://localhost:4321（搜尋也能用，含草稿；見下方說明）
```

把 `npm run test:e2e` 那行改成：

```
npm run test:e2e   # build 後用 Playwright 在瀏覽器操作 preview：程式碼動畫、兩個 demo、主題切換、首頁版型、手機版面與選單；另外起 astro dev 測 dev 搜尋
```

在「需要 Node 22.23.4 以上」那一行前面加一段：

```markdown
`astro dev` 時頁首的搜尋也能用：第一次搜尋時才建索引（從 dev server 抓所有頁面，會慢幾秒），
之後改了 `src/content/` 底下的檔案，重新整理頁面就搜得到新內容。dev 的索引包含草稿（和 dev 顯示草稿一致）；
正式版的索引由 `npm run build` 產生，不含草稿。
```

- [ ] **Step 2: 結構說明**

在 `├── lib/` 底下、`pagination.ts` 那行之前加：

```
│   ├── dev-search/            # astro dev 時的搜尋：解除 Starlight 的 dev 限制、抓頁面建記憶體索引、內容變動時重建
```

在 `tests/` 底下 `content-layout.test.ts` 那行之後加：

```
├── dev-search-*.test.ts       # dev 搜尋的抓頁與索引快取（刻意例外：直接測函式，見設計備註）
```

在 `e2e/` 底下 `home.spec.ts` 那行之後加：

```
├── dev-search.spec.ts         # 對 astro dev：搜尋框可用、搜得到草稿（playwright.config.ts 的 dev project）
```

`playwright.config.ts` 那行改成：

```
playwright.config.ts           # npm run test:e2e：起 astro preview 和 astro dev，跑 e2e/*.spec.ts
```

- [ ] **Step 3: 設計備註的測試例外**

把「**測試只看 build 產出，有兩個刻意的例外**」改成「**測試只看 build 產出，有三個刻意的例外**」，並在 `content-layout.test.ts` 那一項之後加：

```markdown
  - `tests/dev-search-crawl.test.ts`、`tests/dev-search-cache.test.ts` 直接測 dev 搜尋的抓頁與索引快取（`src/lib/dev-search/`）。
    那是 `astro dev` 才有的行為，`dist/` 裡看不到；瀏覽器端的行為另由 `e2e/dev-search.spec.ts` 對 dev server 驗證。
```

- [ ] **Step 4: 最終驗證**

```bash
export PATH=/Users/rafael/.nvm/versions/node/v26.13.0/bin:$PATH
npx tsc --noEmit && npm test && npm run test:e2e
```

Expected: 型別檢查沒有錯誤；`npm test` 全部通過（原本 112 個 + 新的 10 個）；`npm run test:e2e` 全部通過（13 個）。

- [ ] **Step 5: 手動驗證即時重建（一次）**

```bash
export PATH=/Users/rafael/.nvm/versions/node/v26.13.0/bin:$PATH
(npx astro dev --port 4397 --ignore-lock > /tmp/dev-search-4397.log 2>&1 &)
for i in $(seq 1 60); do curl -s -o /dev/null http://localhost:4397/ && break; sleep 0.5; done
curl -s -o /dev/null http://localhost:4397/pagefind/pagefind-entry.json
echo '' >> src/content/docs/mobx/01-getter-setter/index.mdx
sleep 1
curl -s -o /dev/null http://localhost:4397/pagefind/pagefind-entry.json
git checkout src/content/docs/mobx/01-getter-setter/index.mdx
grep -c 'dev 搜尋索引' /tmp/dev-search-4397.log
pkill -f 'astro dev --port 4397'
```

Expected: log 裡「dev 搜尋索引」出現 2 次（第一次建立、改檔後重建）。`git status` 乾淨。

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "$(printf 'README：dev 搜尋的用法、結構與測試例外\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>')"
```
