/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { gunzipSync } from 'node:zlib'
import type { HTMLElement } from 'node-html-parser'
import { describe, expect, it } from 'vitest'
import {
  articles,
  clientScripts,
  DIST,
  distFiles,
  loadPage,
  pageExists,
  published,
  text,
  type Article,
} from './site'

describe('文章網址', () => {
  it('找得到文章原稿', () => {
    expect(published.map((a) => a.folder)).toContain('01-getter-setter')
  })

  it.each(published)('$url 打得開，而且是這篇文章', (article) => {
    expect(pageExists(article.url)).toBe(true)
    const page = loadPage(article.url)
    expect(text(page.querySelector('h1'))).toBe(article.title)
    // 導言要出現在頁面上，不能只在 <meta>
    expect(text(page.querySelector('body'))).toContain(article.description)
  })

  it('有一篇草稿可以拿來驗證草稿會被隱藏', () => {
    // 沒有草稿的話，下面所有和草稿有關的測試都會空轉
    expect(articles.filter((a) => a.draft).map((a) => a.folder)).toContain('00-draft-fixture')
  })

  it('草稿沒有頁面', () => {
    for (const draft of articles.filter((a) => a.draft)) {
      expect(pageExists(draft.url), draft.url).toBe(false)
    }
  })
})

describe('首頁', () => {
  // 只看主內容區，避免把側欄或頁首的連結也算進來
  const main = () => loadPage('/').querySelector('main')!
  const articleLinks = () =>
    main()
      .querySelectorAll('a')
      .filter((a) => articles.some((article) => article.url === a.getAttribute('href')))

  it('依篇章順序列出所有非草稿文章', () => {
    const hrefs = [...new Set(articleLinks().map((a) => a.getAttribute('href')))]
    expect(hrefs).toEqual(published.map((a) => a.url))
  })

  it.each(published)('$url 在列表裡有編號、標題和簡介', (article) => {
    const link = articleLinks().find((a) => a.getAttribute('href') === article.url)!
    const item = text(link.closest('li') ?? link)
    expect(item).toContain(String(article.order).padStart(2, '0'))
    expect(item).toContain(article.title)
    expect(item).toContain(article.description)
  })
})

describe('互動元件', () => {
  const islands = (url: string) =>
    loadPage(url)
      .querySelectorAll('astro-island')
      .map((el) => ({
        name: JSON.parse(el.getAttribute('opts') ?? '{}').name as string,
        props: el.getAttribute('props') ?? '',
      }))

  // 原稿裡寫了 <XxxDemo client:visible /> 的 demo
  const demosIn = (article: Article) =>
    [...article.source.matchAll(/<([A-Z]\w*)\b[^>]*\bclient:\w+/g)].map((m) => m[1])
  const magicStepsIn = (article: Article) =>
    article.source.match(/<MagicSteps\b/g)?.length ?? 0

  const withDemos = published.filter((a) => demosIn(a).length > 0)
  const withMagicSteps = published.filter((a) => magicStepsIn(a) > 0)

  it('至少有一篇文章帶 demo 和程式碼動畫', () => {
    expect(withDemos.map((a) => a.folder)).toContain('01-getter-setter')
    expect(withMagicSteps.map((a) => a.folder)).toContain('01-getter-setter')
  })

  it.each(withDemos)('$url 的每個 demo 都輸出成互動元件', (article) => {
    const names = islands(article.url).map((i) => i.name)
    for (const demo of demosIn(article)) expect(names).toContain(demo)
  })

  it.each(withMagicSteps)('$url 的程式碼動畫帶著 build 時算好的高亮', (article) => {
    // 已上色的 token 會帶著主題顏色，直接放在 island 的 props 裡
    const highlighted = islands(article.url).filter((i) => /#[0-9a-f]{6}/i.test(i.props))
    expect(highlighted).toHaveLength(magicStepsIn(article))
  })
})

describe('瀏覽器端', () => {
  it('不需要下載語法高亮引擎', () => {
    // Shiki 的語法檔都有 scopeName，底層 vscode-textmate 一定有 tokenizeLine
    const withShiki = clientScripts().filter((file) =>
      /scopeName|tokenizeLine/.test(readFileSync(file, 'utf8')),
    )
    expect(withShiki).toEqual([])
  })
})

describe('靜態輸出', () => {
  it('build 產出的是純靜態檔，沒有伺服器程式', () => {
    expect(pageExists('/')).toBe(true)
    expect(existsSync(join(DIST, 'server'))).toBe(false)
    const serverEntries = distFiles().filter((f) => /[\\/](entry\.mjs|_worker\.js)$/.test(f))
    expect(serverEntries).toEqual([])
  })

  it('demos 裡的程式檔不會變成頁面', () => {
    const demoPages = distFiles().filter((f) => /[\\/]demos[\\/].*\.html$/.test(f))
    expect(demoPages).toEqual([])
  })

  it('網站只有首頁、404 和文章頁，沒有多出來的頁面', () => {
    const pages = distFiles()
      .filter((f) => f.endsWith('.html'))
      .map((f) => '/' + relative(DIST, f).replaceAll('\\', '/'))
      .sort()
    const expected = ['/index.html', '/404.html', ...published.map((a) => `${a.url}index.html`)]
    expect(pages).toEqual(expected.sort())
  })
})

describe('文章頁導覽', () => {
  // 側欄 = 標出「目前這頁」的那個導覽區
  const sidebar = (url: string) =>
    loadPage(url)
      .querySelectorAll('nav')
      .find((nav) => nav.querySelector('a[aria-current="page"]'))

  it.each(published)('$url 的側欄依篇章順序列出整個系列，並標出目前篇章', (article) => {
    const nav = sidebar(article.url)
    expect(nav, '找不到側欄').toBeTruthy()
    const hrefs = nav!
      .querySelectorAll('a')
      .map((a) => a.getAttribute('href'))
      .filter((href) => articles.some((a) => a.url === href))
    expect(hrefs).toEqual(published.map((a) => a.url))
    expect(nav!.querySelector('a[aria-current="page"]')!.getAttribute('href')).toBe(article.url)
  })

  // 原稿裡的 ## 小標
  const headingsIn = (article: Article) =>
    [...article.source.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim())

  it.each(published)('$url 有本頁目錄，列出文章的每個小標', (article) => {
    const tocs = loadPage(article.url)
      .querySelectorAll('nav')
      .filter((nav) => nav.querySelector('a[href^="#"]'))
    expect(tocs.length, '找不到本頁目錄').toBeGreaterThan(0)
    for (const toc of tocs) {
      const items = toc.querySelectorAll('a[href^="#"]').map((a) => text(a))
      expect(items).toEqual(expect.arrayContaining(headingsIn(article)))
    }
  })

  it.each(published)('$url 有全站搜尋', (article) => {
    expect(loadPage(article.url).querySelector('button[aria-label="搜尋"]')).toBeTruthy()
  })

  it('搜尋索引收錄每一篇文章，而且只有文章', () => {
    const entry = JSON.parse(readFileSync(join(DIST, 'pagefind/pagefind-entry.json'), 'utf8'))
    const indexed = Object.values(entry.languages as Record<string, { page_count: number }>)
      .reduce((sum, lang) => sum + lang.page_count, 0)
    expect(indexed).toBe(published.length)
  })

  it.each(published.map((article, i) => ({ ...article, i })))(
    '$url 底部的上一篇 / 下一篇依篇章順序，第一篇沒有上一篇、最後一篇沒有下一篇',
    ({ url, i }) => {
      const page = loadPage(url)
      const prev = page.querySelector('a[rel="prev"]')
      const next = page.querySelector('a[rel="next"]')
      expect(prev?.getAttribute('href')).toBe(published[i - 1]?.url)
      expect(next?.getAttribute('href')).toBe(published[i + 1]?.url)
      if (prev) expect(text(prev)).toContain(`上一篇 ${published[i - 1].title}`)
      if (next) expect(text(next)).toContain(`下一篇 ${published[i + 1].title}`)
    },
  )
})

describe('草稿', () => {
  const drafts = articles.filter((a) => a.draft)

  // dist 裡每個檔案的內容；Pagefind 的索引是 gzip，先解開
  const distContents = () =>
    distFiles().map((file) => {
      const raw = readFileSync(file)
      const body = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw
      return { file: relative(DIST, file), body: body.toString('utf8') }
    })

  it.each(drafts)('$url 的標題、網址和內文都不在網站任何地方（頁面、側欄、首頁、搜尋索引）', (draft) => {
    // 內文裡獨一無二的記號，只可能從這篇草稿來
    const marker = draft.source.match(/\bdraftmarker\w+/)?.[0]
    expect(marker, '草稿內文要放一個 draftmarker 記號').toBeTruthy()
    const leaks = distContents()
      .filter(({ body }) => [draft.title, draft.url, marker!].some((s) => body.includes(s)))
      .map(({ file }) => file)
    expect(leaks).toEqual([])
  })
})

describe('語言', () => {
  it.each(['/', ...published.map((a) => a.url)])('%s 的頁面語言是繁體中文', (url) => {
    expect(loadPage(url).querySelector('html')!.getAttribute('lang')).toMatch(/^zh-(TW|Hant)/)
  })

  // 讀者看得到或螢幕閱讀器念得出來的介面文字（不含 script 內容）
  const uiText = (url: string) => {
    const page = loadPage(url)
    page.querySelectorAll('script, style, template').forEach((el) => el.remove())
    const labels = page.querySelectorAll('[aria-label]').map((el) => el.getAttribute('aria-label'))
    return [text(page.querySelector('body')), ...labels].join('\n')
  }

  it.each(published)('$url 的介面字串是中文', (article) => {
    const ui = uiText(article.url)
    for (const label of ['跳到內容', '搜尋', '本頁內容', '深色', '淺色']) {
      expect(ui).toContain(label)
    }
    // Starlight 的英文預設字串，或沒翻到而直接露出的字串 key
    const english = /Skip to content|On this page|Overview|Section titled|Select theme|\bPrevious\b|\bNext\b|\bSearch\b|\bMenu\b/
    expect(ui).not.toMatch(english)
    expect(ui).not.toMatch(/\b(skipLink|search|tableOfContents|themeSelect|page|heading|menuButton|sidebarNav)\.[a-zA-Z]+/)
  })
})

describe('系列辨識', () => {
  // 標題前後緊鄰的元素：上方是系列位置，下方是導言
  const besideTitle = (url: string) => {
    const h1 = loadPage(url).querySelector('h1')!
    const siblings = h1.parentNode.childNodes.filter((n) => n.nodeType === 1)
    const i = siblings.indexOf(h1)
    return { before: siblings[i - 1], after: siblings[i + 1] } as {
      before?: HTMLElement
      after?: HTMLElement
    }
  }

  it.each(published)('$url 標題上方寫著這是系列的第幾篇、共幾篇', (article) => {
    expect(text(besideTitle(article.url).before)).toBe(
      `MobX 拆解 · 第 ${article.order} 篇 / 共 ${published.length} 篇`,
    )
  })

  it.each(published)('$url 標題正下方是這篇的導言', (article) => {
    expect(text(besideTitle(article.url).after)).toBe(article.description)
  })

  it.each(published)('$url 頁首有 mobx/motion 字標，點了回首頁', (article) => {
    const mark = loadPage(article.url)
      .querySelectorAll('header a')
      .find((a) => text(a) === 'mobx/motion')
    expect(mark, '找不到字標').toBeTruthy()
    expect(mark!.getAttribute('href')).toBe('/')
    // 斜線要單獨包起來才能上 MobX 橘
    expect(mark!.querySelectorAll('*').some((el) => text(el) === '/')).toBe(true)
  })

  it.each(published)('$url 頁尾寫著用什麼打造', (article) => {
    // 頁尾 = 主內容區最後讀到的文字（排在上一篇 / 下一篇之後）
    const main = loadPage(article.url).querySelector('main')!
    main.querySelectorAll('script, style, template').forEach((el) => el.remove())
    expect(text(main)).toMatch(/用 Astro、shiki-magic-move 與 MobX 打造$/)
  })
})
