/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
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
})
