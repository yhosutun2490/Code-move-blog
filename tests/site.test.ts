import { describe, expect, it } from 'vitest'
import {
  allPosts,
  clientScriptsOf,
  distFiles,
  islandsOf,
  loadPage,
  pageExists,
  postUrl,
  publishedPosts,
  searchIndex,
  sectionHeadings,
  sidebarOf,
  textOf,
  tocOf,
} from './site'

const posts = publishedPosts()

describe('文章網址', () => {
  it('至少找得到第一篇文章（避免測試空轉）', () => {
    expect(posts.map((p) => p.folder)).toContain('01-getter-setter')
  })

  it.each(posts.map((p) => [postUrl(p), p] as const))(
    '%s 打得開，標題是文章標題',
    (url, post) => {
      const page = loadPage(url)
      const h1 = page.querySelector('h1')
      expect(h1 && textOf(h1)).toBe(post.title)
    },
  )

  it('草稿沒有頁面', () => {
    for (const draft of allPosts().filter((p) => p.draft)) {
      expect(pageExists(postUrl(draft)), postUrl(draft)).toBe(false)
    }
  })
})

describe('純靜態輸出', () => {
  const files = distFiles()

  it('首頁與每篇文章都是現成的 HTML 檔', () => {
    expect(files).toContain('index.html')
    for (const post of posts) {
      expect(files).toContain(`mobx/${post.folder}/index.html`)
    }
  })

  it('沒有伺服器端程式', () => {
    const serverFiles = files.filter(
      (f) =>
        /\.(mjs|cjs)$/.test(f) ||
        f.startsWith('server/') ||
        f.startsWith('_worker.js') ||
        f === '_routes.json',
    )
    expect(serverFiles).toEqual([])
  })

  it('demos 資料夾裡的程式檔不會變成頁面', () => {
    const demoPages = files.filter((f) => /^mobx\/[^/]+\/demos\//.test(f))
    expect(demoPages).toEqual([])
  })

  it('只產生首頁、文章頁與 404 頁，沒有多出來的頁面', () => {
    const htmlPages = files.filter((f) => f.endsWith('.html')).sort()
    const expected = [
      '404.html',
      'index.html',
      ...posts.map((p) => `mobx/${p.folder}/index.html`),
    ].sort()
    expect(htmlPages).toEqual(expected)
  })
})

describe('首頁篇章列表', () => {
  // 首頁上「篇章列表」的項目 = 連到文章、而且連結文字含簡介的那些連結。
  // （側欄或其他導覽也會連到文章，但不會附上簡介。）
  function listEntries() {
    const home = loadPage('/')
    const published = new Map(posts.map((p) => [postUrl(p), p]))
    return home
      .querySelectorAll('a[href]')
      .map((a) => ({ href: a.getAttribute('href')!, text: textOf(a) }))
      .filter(({ href, text }) => {
        const post = published.get(href)
        return post !== undefined && text.includes(post.description)
      })
  }

  it('依篇章順序列出所有非草稿篇章', () => {
    expect(listEntries().map((e) => e.href)).toEqual(posts.map(postUrl))
  })

  it.each(posts.map((p) => [postUrl(p), p] as const))(
    '%s 的項目有兩位數編號、標題與簡介',
    (url, post) => {
      const entry = listEntries().find((e) => e.href === url)!
      const number = String(post.order).padStart(2, '0')
      expect(entry.text.startsWith(number)).toBe(true)
      expect(entry.text).toContain(post.title)
      expect(entry.text).toContain(post.description)
    },
  )

  it('不列出草稿', () => {
    const home = loadPage('/')
    for (const draft of allPosts().filter((p) => p.draft)) {
      expect(home.querySelector(`a[href="${postUrl(draft)}"]`)).toBeNull()
    }
  })
})

describe('程式碼動畫與互動 demo', () => {
  // 預期值從文章原始碼推得：每個 <MagicSteps> 一個動畫，每個 client:* 元件一個 demo
  const withMagicSteps = posts.filter((p) => /<MagicSteps\b/.test(p.body))
  const demoNames = (p: (typeof posts)[number]) =>
    [...p.body.matchAll(/<([A-Z]\w*)\b[^>]*\bclient:\w+/g)].map((m) => m[1])

  // 預先算好的 keyed tokens：每個 token 有內容、顏色和動畫用的 key
  const hasPrecomputedTokens = (island: { props: string }) =>
    /"tokens"/.test(island.props) &&
    /"content"/.test(island.props) &&
    /"color"\s*:\s*\[\s*0\s*,\s*"#[0-9a-fA-F]{3,8}"/.test(island.props) &&
    /"key"/.test(island.props)

  it('至少有一篇含程式碼動畫和 demo（避免測試空轉）', () => {
    expect(withMagicSteps.length).toBeGreaterThan(0)
    expect(posts.some((p) => demoNames(p).length > 0)).toBe(true)
  })

  it.each(posts.map((p) => [postUrl(p), p] as const))(
    '%s 的每個程式碼動畫都是 island，且帶著 build 時算好的 tokens',
    (url, post) => {
      const expected = post.body.match(/<MagicSteps\b/g)?.length ?? 0
      const islands = islandsOf(loadPage(url)).filter(hasPrecomputedTokens)
      expect(islands).toHaveLength(expected)
    },
  )

  it.each(posts.map((p) => [postUrl(p), p] as const))(
    '%s 的每個互動 demo 都是 island',
    (url, post) => {
      const islands = islandsOf(loadPage(url))
      for (const name of demoNames(post)) {
        const found = islands.some(
          (i) => i.opts.includes(`"${name}"`) || i.componentUrl.includes(name),
        )
        expect(found, `${url} 缺少 ${name} island`).toBe(true)
      }
    },
  )

  // 語法高亮引擎打包後一定會留下的字串：TextMate 語法（scopeName）、
  // 主題（tokenColors）、Shiki 自己的錯誤類別與 WASM 載入器。
  const SHIKI_SIGNATURES = ['scopeName', 'tokenColors', 'ShikiError', 'loadWasm']

  it.each(['/', ...posts.map(postUrl)])(
    '%s 不需要下載語法高亮引擎',
    (url) => {
      for (const [path, code] of clientScriptsOf(url)) {
        for (const sig of SHIKI_SIGNATURES) {
          expect(code.includes(sig), `${path} 含有 ${sig}`).toBe(false)
        }
      }
    },
  )
})

describe('系列辨識元素', () => {
  const titleOf = (url: string) => loadPage(url).querySelector('h1')!

  it.each(posts.map((p) => [postUrl(p), p] as const))(
    '%s 的標題上方寫著「第 N 篇 / 共 M 篇」',
    (url, post) => {
      const above = titleOf(url).previousElementSibling
      expect(above && textOf(above)).toBe(
        `MobX 拆解 · 第 ${post.order} 篇 / 共 ${posts.length} 篇`,
      )
    },
  )

  it.each(posts.map((p) => [postUrl(p), p] as const))(
    '%s 的標題下方以導言樣式顯示簡介',
    (url, post) => {
      const below = titleOf(url).nextElementSibling
      expect(below && textOf(below)).toBe(post.description)
      expect(below?.classList.contains('lede')).toBe(true)
    },
  )

  it('首頁沒有「第 N 篇」', () => {
    expect(textOf(loadPage('/'))).not.toMatch(/第\s*\d+\s*篇/)
  })
})

describe('文章頁側欄', () => {
  it.each(posts.map((p) => [postUrl(p), p] as const))(
    '%s 的側欄依篇章順序列出所有篇章，並標出目前篇章',
    (url, post) => {
      const sidebar = sidebarOf(loadPage(url))
      expect(sidebar, `${url} 沒有標出目前篇章的側欄`).toBeDefined()
      const entries = sidebar!.filter((l) => l.href.startsWith('/mobx/'))
      expect(entries.map((l) => l.href)).toEqual(posts.map(postUrl))
      expect(entries.map((l) => l.text)).toEqual(posts.map((p) => p.title))
      expect(entries.filter((l) => l.current).map((l) => l.href)).toEqual([postUrl(post)])
    },
  )
})

describe('本頁目錄', () => {
  it('至少有一篇有小節標題（避免測試空轉）', () => {
    expect(posts.some((p) => sectionHeadings(p).length > 0)).toBe(true)
  })

  it.each(posts.map((p) => [postUrl(p), p] as const))(
    '%s 的本頁目錄列出每個小節，並連到該小節',
    (url, post) => {
      const page = loadPage(url)
      const toc = tocOf(page)
      expect(toc, `${url} 沒有本頁目錄`).toBeDefined()
      for (const heading of sectionHeadings(post)) {
        const link = toc!.links.find((l) => l.text === heading)
        expect(link, `目錄缺少「${heading}」`).toBeDefined()
        const target = page.getElementById(decodeURIComponent(link!.href.slice(1)))
        expect(target && textOf(target), `「${heading}」的錨點對不到標題`).toBe(heading)
      }
    },
  )
})

describe('全站搜尋', () => {
  it.each(posts.map((p) => [postUrl(p), p] as const))('%s 有搜尋入口', (url) => {
    expect(loadPage(url).querySelector('site-search')).not.toBeNull()
  })

  it.each(posts.map((p) => [postUrl(p), p] as const))(
    '%s 的標題和內文都收進搜尋索引',
    (url, post) => {
      const record = searchIndex().find((r) => r.url === url)
      expect(record, `${url} 不在搜尋索引`).toBeDefined()
      expect(record!.title).toBe(post.title)
      for (const heading of sectionHeadings(post)) {
        expect(record!.content).toContain(heading)
      }
    },
  )
})

describe('繁體中文介面', () => {
  const pages = ['/', ...posts.map(postUrl), '/404.html']
  const CJK = /[㐀-鿿]/

  it.each(pages)('%s 的頁面語言是繁體中文', (url) => {
    expect(loadPage(url).querySelector('html')?.getAttribute('lang')).toBe('zh-Hant-TW')
  })

  // 翻譯缺漏時 Starlight 會直接輸出字串的 key，例如 search.label、page.nextLink
  const UI_KEY =
    /\b(?:skipLink|search|themeSelect|languageSelect|menuButton|sidebarNav|tableOfContents|page|404|i18n|aside|expressiveCode|fileTree|builtWithStarlight|heading)\.[a-zA-Z]+/

  it.each(pages)('%s 沒有未翻譯的介面字串', (url) => {
    const page = loadPage(url)
    for (const el of page.querySelectorAll('script, style')) el.remove()
    expect(page.toString().match(UI_KEY)?.[0]).toBeUndefined()
  })

  it.each(pages)('%s 的無障礙標籤都是中文', (url) => {
    const labels = loadPage(url)
      .querySelectorAll('[aria-label]')
      .map((el) => el.getAttribute('aria-label')!)
    expect(labels.length).toBeGreaterThan(0)
    expect(labels.filter((l) => !CJK.test(l))).toEqual([])
  })

  it.each(posts.map(postUrl))('%s 的搜尋、本頁目錄、主題切換是中文', (url) => {
    const page = loadPage(url)
    const search = page.querySelector('site-search button')
    expect(search?.getAttribute('aria-label')).toBe('搜尋')
    expect(tocOf(page)?.label).toBe('本頁內容')
    const themes = page.querySelectorAll('starlight-theme-select option').map(textOf)
    expect(themes).toEqual(expect.arrayContaining(['深色', '淺色', '自動']))
  })
})

describe('上一篇 / 下一篇', () => {
  const links = (url: string, rel: 'prev' | 'next') =>
    loadPage(url)
      .querySelectorAll(`a[rel="${rel}"]`)
      .map((a) => ({ href: a.getAttribute('href'), text: textOf(a) }))

  it('第一篇沒有上一篇，最後一篇沒有下一篇', () => {
    expect(links(postUrl(posts[0]), 'prev')).toEqual([])
    expect(links(postUrl(posts.at(-1)!), 'next')).toEqual([])
  })

  it.each(posts.map((p, i) => [postUrl(p), i] as const))(
    '%s 依篇章順序連到前後篇',
    (url, i) => {
      for (const [rel, neighbour] of [
        ['prev', posts[i - 1]],
        ['next', posts[i + 1]],
      ] as const) {
        const found = links(url, rel)
        if (!neighbour) {
          expect(found, `${url} 不該有 ${rel}`).toEqual([])
          continue
        }
        expect(found.map((l) => l.href)).toEqual([postUrl(neighbour)])
        expect(found[0].text).toContain(neighbour.title)
      }
    },
  )
})
