import { existsSync } from 'node:fs'
import type { HTMLElement } from 'node-html-parser'
import { describe, expect, it } from 'vitest'
import {
  allPosts,
  clientScriptsOf,
  distFileFor,
  distFiles,
  fontFacesIn,
  isCrossOrigin,
  islandsOf,
  loadPage,
  pageExists,
  postUrl,
  publishedPosts,
  resourceUrlsOf,
  searchIndex,
  sectionHeadings,
  sidebarGroupsOf,
  sidebarOf,
  siteConfig,
  siteUiStrings,
  starlightUiStrings,
  stylesheetsOf,
  textOf,
  tocOf,
  topicDirs,
  topicOf,
  topics,
} from './site'

const posts = publishedPosts()

describe('文章網址', () => {
  it('至少找得到一篇已發布文章（避免測試空轉）', () => {
    expect(posts.length).toBeGreaterThan(0)
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
  // 文章網址在 dist 裡對應的檔案，例如 /<主題>/<資料夾>/ → <主題>/<資料夾>/index.html
  const htmlFileOf = (post: (typeof posts)[number]) => `${postUrl(post).slice(1)}index.html`

  it('首頁與每篇文章都是現成的 HTML 檔', () => {
    expect(files).toContain('index.html')
    for (const post of posts) {
      expect(files).toContain(htmlFileOf(post))
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

  it('任何主題的 demos 資料夾裡的程式檔都不會變成頁面', () => {
    const dirs = topicDirs()
    expect(dirs.length).toBeGreaterThan(0)
    const demoPages = files.filter((f) => {
      const [topic, , demos] = f.split('/')
      return dirs.includes(topic) && demos === 'demos'
    })
    expect(demoPages).toEqual([])
  })

  it('只產生首頁、文章頁與 404 頁，沒有多出來的頁面', () => {
    const htmlPages = files.filter((f) => f.endsWith('.html')).sort()
    const expected = [
      '404.html',
      'index.html',
      ...posts.map(htmlFileOf),
    ].sort()
    expect(htmlPages).toEqual(expected)
  })
})

describe('首頁是網站封面', () => {
  const { title: COVER_TITLE, lede: COVER_LEDE, eyebrow: COVER_EYEBROW } = siteConfig.cover

  it('標題是網站設定的封面標題，緊接著以導言樣式顯示導言', () => {
    const h1 = loadPage('/').querySelector('h1')!
    expect(textOf(h1)).toBe(COVER_TITLE)
    const below = h1.nextElementSibling
    expect(below && textOf(below)).toBe(COVER_LEDE)
    expect(below?.classList.contains('lede')).toBe(true)
  })

  it('標題上方以 eyebrow 樣式顯示網站設定的封面 eyebrow', () => {
    const above = loadPage('/').querySelector('h1')!.previousElementSibling
    expect(above && textOf(above)).toBe(COVER_EYEBROW)
    expect(above?.classList.contains('eyebrow')).toBe(true)
  })

  it('有側欄，沒有本頁目錄', () => {
    const home = loadPage('/')
    const html = home.querySelector('html')!
    expect(html.hasAttribute('data-has-sidebar'), '首頁沒有側欄').toBe(true)
    expect(html.hasAttribute('data-has-toc'), '首頁有本頁目錄').toBe(false)
    expect(tocOf(home)).toBeUndefined()
  })

  it('篇章列表在導言之後', () => {
    const html = loadPage('/').toString()
    const firstPost = html.indexOf(`href="${postUrl(posts[0])}"`, html.indexOf(COVER_LEDE))
    expect(html.indexOf(COVER_LEDE)).toBeGreaterThan(html.indexOf(COVER_TITLE))
    expect(firstPost).toBeGreaterThan(-1)
  })

  // 同一個頁首：字標、搜尋、主題切換，連標記都一模一樣。
  // 比對 dist 裡的每一頁，所以也證明沒有任何頁面還套著舊的手刻版型。
  const htmlPages = distFiles()
    .filter((f) => f.endsWith('.html'))
    .map((f) => '/' + f.replace(/(^|\/)index\.html$/, '$1'))
  it.each(htmlPages)('%s 的頁首和文章頁相同（字標、搜尋、主題切換）', (url) => {
    const headerOf = (u: string) => loadPage(u).querySelector('header')
    const header = headerOf(url)
    expect(header, `${url} 沒有頁首`).not.toBeNull()
    expect(header!.querySelector('a.site-mark[href="/"]')).not.toBeNull()
    expect(header!.querySelector('site-search')).not.toBeNull()
    expect(header!.querySelector('starlight-theme-select')).not.toBeNull()
    expect(header!.toString()).toBe(headerOf(postUrl(posts[0]))!.toString())
  })

  it('瀏覽器分頁標題是「封面標題 | 站名」，摘要是封面導言', () => {
    const head = loadPage('/').querySelector('head')!
    expect(textOf(head.querySelector('title')!)).toBe(`${COVER_TITLE} | ${siteConfig.name}`)
    expect(head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(COVER_LEDE)
  })
})

describe('首頁依主題分區的篇章列表', () => {
  const home = loadPage('/')
  // 有已發布文章的主題，依主題 order；每個主題的篇章依篇章 order
  const groups = topics()
    .map((topic) => ({ topic, posts: posts.filter((p) => p.topic === topic.slug) }))
    .filter((g) => g.posts.length > 0)

  // 主題分區 = 以標題命名（aria-labelledby）的 <section>，名稱就是那個標題的文字
  const sections = home.querySelectorAll('main section[aria-labelledby]').map((section) => {
    const heading = home.getElementById(section.getAttribute('aria-labelledby')!)
    return { section, heading, name: heading ? textOf(heading) : '' }
  })
  const sectionOf = (name: string) => sections.find((s) => s.name === name)

  // 分區裡「篇章列表」的項目：有序列表裡、連到文章的連結
  const entriesOf = (section: HTMLElement) =>
    section
      .querySelectorAll('ol > li a[href]')
      .map((a) => ({ href: a.getAttribute('href')!, text: textOf(a) }))

  it('至少有一個主題分區（避免測試空轉）', () => {
    expect(groups.length).toBeGreaterThan(0)
  })

  it('依主題 order 列出有已發布文章的主題，只含草稿的主題沒有分區', () => {
    expect(sections.map((s) => s.name)).toEqual(groups.map((g) => g.topic.name))
  })

  it.each(groups.map((g) => [g.topic.name, g] as const))(
    '「%s」分區的標題層級低於 h1，並寫著主題簡介',
    (name, { topic }) => {
      const { section, heading } = sectionOf(name)!
      expect(heading!.tagName).toMatch(/^H[2-6]$/)
      expect(section.querySelectorAll('*').includes(heading!), '分區標題不在分區裡').toBe(true)
      expect(textOf(section)).toContain(topic.description)
    },
  )

  it.each(groups.map((g) => [g.topic.name, g] as const))(
    '「%s」分區依篇章順序列出該主題所有已發布篇章',
    (name, group) => {
      const entries = entriesOf(sectionOf(name)!.section)
      expect(entries.map((e) => e.href)).toEqual(group.posts.map(postUrl))
    },
  )

  it.each(posts.map((p) => [postUrl(p), p] as const))(
    '%s 的項目有兩位數編號、標題與簡介',
    (url, post) => {
      const entry = entriesOf(sectionOf(topicOf(post.topic).name)!.section).find(
        (e) => e.href === url,
      )!
      const number = String(post.order).padStart(2, '0')
      expect(entry.text.startsWith(number)).toBe(true)
      expect(entry.text).toContain(post.title)
      expect(entry.text).toContain(post.description)
    },
  )

  it('不列出草稿', () => {
    for (const draft of allPosts().filter((p) => p.draft)) {
      expect(home.querySelector(`main a[href="${postUrl(draft)}"]`)).toBeNull()
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
    '%s 的標題上方寫著「<主題名稱> · 第 N 篇 / 共 M 篇」，M 只算同主題的已發布篇章',
    (url, post) => {
      const above = titleOf(url).previousElementSibling
      const total = posts.filter((p) => p.topic === post.topic).length
      expect(above && textOf(above)).toBe(
        `${topicOf(post.topic).name} · 第 ${post.order} 篇 / 共 ${total} 篇`,
      )
      expect(above?.classList.contains('eyebrow')).toBe(true)
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

  it.each(['/', ...posts.map(postUrl), '/404.html'])(
    '%s 的頁首有網站設定的字標，斜線單獨上色，連到首頁',
    (url) => {
      const { before, after } = siteConfig.mark
      const mark = loadPage(url)
        .querySelectorAll('header a[href="/"]')
        .find((a) => textOf(a) === `${before}/${after}`)
      expect(mark, `${url} 頁首沒有連到首頁的字標`).toBeDefined()
      // 斜線包在自己的元素裡，才能單獨上色
      expect(mark!.querySelectorAll('*').map(textOf)).toContain('/')
    },
  )

  it.each(['/', ...posts.map(postUrl), '/404.html'])(
    '%s 的頁尾寫著網站設定的打造說明，在內文之後',
    (url) => {
      const page = loadPage(url)
      const credit = page
        .querySelectorAll('main p')
        .find((p) => textOf(p) === siteConfig.credit)
      expect(credit, `${url} 沒有打造說明`).toBeDefined()
      // 在頁面最下方：內文（以及上一篇 / 下一篇）都在它之前
      const html = page.toString()
      const creditAt = html.indexOf(credit!.toString())
      expect(html.indexOf('<h1')).toBeLessThan(creditAt)
      for (const a of page.querySelectorAll('a[rel="prev"], a[rel="next"]')) {
        expect(html.indexOf(a.toString())).toBeLessThan(creditAt)
      }
    },
  )

  it('首頁沒有「第 N 篇」', () => {
    expect(textOf(loadPage('/'))).not.toMatch(/第\s*\d+\s*篇/)
  })
})

describe('文章頁側欄', () => {
  // 有已發布文章的主題，依主題 order；每個主題的篇章依篇章 order
  const groups = topics()
    .map((topic) => ({ topic, posts: posts.filter((p) => p.topic === topic.slug) }))
    .filter((g) => g.posts.length > 0)

  it('至少有一個主題有已發布文章（避免測試空轉）', () => {
    expect(groups.length).toBeGreaterThan(0)
  })

  it.each(posts.map((p) => [postUrl(p), p] as const))(
    '%s 的側欄依主題分組，群組標題是主題名稱，組內依篇章順序，並標出目前篇章',
    (url, post) => {
      const sidebar = sidebarGroupsOf(loadPage(url))
      expect(sidebar, `${url} 沒有側欄`).toBeDefined()
      expect(sidebar!.map((g) => g.label)).toEqual(groups.map((g) => g.topic.name))
      sidebar!.forEach((group, i) => {
        expect(group.links.map((l) => l.href)).toEqual(groups[i].posts.map(postUrl))
        expect(group.links.map((l) => l.text)).toEqual(groups[i].posts.map((p) => p.title))
      })
      const current = sidebar!.flatMap((g) => g.links).filter((l) => l.current)
      expect(current.map((l) => l.href)).toEqual([postUrl(post)])
    },
  )

  it.each(posts.map((p) => [postUrl(p), p] as const))(
    '%s 的側欄沒有群組以外的連結',
    (url) => {
      const page = loadPage(url)
      const grouped = sidebarGroupsOf(page)!.flatMap((g) => g.links.map((l) => l.href))
      expect(sidebarOf(page)!.map((l) => l.href)).toEqual(grouped)
    },
  )
})

describe('首頁側欄', () => {
  const home = loadPage('/')
  const withoutCurrent = (groups: ReturnType<typeof sidebarGroupsOf>) =>
    groups?.map((g) => ({ label: g.label, links: g.links.map(({ href, text }) => ({ href, text })) }))

  it('至少有一個群組（避免測試空轉）', () => {
    expect(sidebarGroupsOf(home)?.length).toBeGreaterThan(0)
  })

  it.each(posts.map(postUrl))('群組、連結與順序和 %s 的側欄相同', (url) => {
    expect(withoutCurrent(sidebarGroupsOf(home))).toEqual(
      withoutCurrent(sidebarGroupsOf(loadPage(url))),
    )
  })

  it('沒有任何項目被標為目前頁面', () => {
    const links = sidebarOf(home)!
    expect(links.length).toBeGreaterThan(0)
    expect(links.filter((l) => l.current)).toEqual([])
  })

  it('沒有群組以外的連結', () => {
    const grouped = sidebarGroupsOf(home)!.flatMap((g) => g.links.map((l) => l.href))
    expect(sidebarOf(home)!.map((l) => l.href)).toEqual(grouped)
  })
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

  // 上面的頁面檢查只看得到目前頁面用到的字串（例如只有一篇時看不到「下一篇」）。
  // 字典缺 key 時 Starlight 會直接輸出 key，所以直接比對字典，Starlight 升級新增字串也會抓到
  it('Starlight 的每一條介面字串都有繁中翻譯', async () => {
    const english = await starlightUiStrings()
    const ours = siteUiStrings()
    expect(Object.keys(english).length).toBeGreaterThan(0)
    // 鍵盤按鍵名稱本來就是英文
    const KEEP_ENGLISH = ['search.ctrlKey']
    const untranslated = Object.keys(english).filter(
      (key) => !KEEP_ENGLISH.includes(key) && (!ours[key] || ours[key] === english[key]),
    )
    expect(untranslated).toEqual([])
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

describe('草稿在全站隱藏', () => {
  const drafts = allPosts().filter((p) => p.draft)
  const htmlPages = distFiles().filter((f) => f.endsWith('.html'))

  it('至少有一篇草稿（避免測試空轉）', () => {
    expect(drafts.length).toBeGreaterThan(0)
  })

  // 只含草稿的測試用主題夾具在這裡派上用場：只掃到單一主題資料夾時這項會失敗，
  // 證明依文章清單展開的檢查（網址、側欄、搜尋、草稿）真的涵蓋了其他主題。
  it('測試工具掃到不只一個主題的篇章（避免只掃 mobx 而空轉）', () => {
    expect(new Set(allPosts().map((p) => p.topic)).size).toBeGreaterThan(1)
  })

  it.each(drafts.map((p) => [postUrl(p), p] as const))(
    '%s 沒有頁面，任何頁面（側欄、首頁、上下篇）都不連到它',
    (url) => {
      expect(pageExists(url)).toBe(false)
      for (const file of htmlPages) {
        const page = loadPage(`/${file}`)
        const linked = page
          .querySelectorAll('a[href]')
          .some((a) => a.getAttribute('href')!.split(/[?#]/)[0] === url)
        expect(linked, `${file} 連到草稿 ${url}`).toBe(false)
      }
    },
  )

  it.each(drafts.map((p) => [postUrl(p), p] as const))(
    '%s 的標題不出現在任何頁面上',
    (_url, draft) => {
      for (const file of htmlPages) {
        expect(textOf(loadPage(`/${file}`)), file).not.toContain(draft.title)
      }
    },
  )

  it.each(drafts.map((p) => [postUrl(p), p] as const))(
    '%s 不在搜尋索引裡',
    (url, draft) => {
      const index = searchIndex()
      expect(index.length, '搜尋索引是空的').toBeGreaterThan(0)
      expect(index.map((r) => r.url)).not.toContain(url)
      for (const record of index) {
        expect(record.title).not.toBe(draft.title)
        expect(record.content, record.url).not.toContain(draft.description)
        for (const heading of sectionHeadings(draft)) {
          expect(record.content, record.url).not.toContain(heading)
        }
      }
    },
  )
})

describe('只含草稿的主題不出現', () => {
  // 有篇章、但全部都是草稿的主題（例如測試用的 draft-topic 夾具）
  const draftOnlyTopics = topics().filter((topic) => {
    const ofTopic = allPosts().filter((p) => p.topic === topic.slug)
    return ofTopic.length > 0 && ofTopic.every((p) => p.draft)
  })
  const htmlPages = distFiles().filter((f) => f.endsWith('.html'))

  it('至少有一個只含草稿的主題（避免測試空轉）', () => {
    expect(draftOnlyTopics.length).toBeGreaterThan(0)
  })

  it.each(draftOnlyTopics.map((t) => [t.slug, t] as const))(
    '%s 的主題名稱與簡介不出現在任何頁面上（側欄、首頁、eyebrow）',
    (_slug, topic) => {
      expect(htmlPages.length).toBeGreaterThan(0)
      for (const file of htmlPages) {
        const text = textOf(loadPage(`/${file}`))
        expect(text.includes(topic.name), `${file} 出現「${topic.name}」`).toBe(false)
        expect(text.includes(topic.description), `${file} 出現主題簡介`).toBe(false)
      }
    },
  )

  it.each(draftOnlyTopics.map((t) => [t.slug, t] as const))(
    '首頁沒有 %s 的名稱、簡介或篇章連結',
    (slug, topic) => {
      const home = loadPage('/')
      expect(textOf(home)).not.toContain(topic.name)
      expect(textOf(home)).not.toContain(topic.description)
      const links = home.querySelectorAll('a[href]').map((a) => a.getAttribute('href')!)
      expect(links.filter((href) => href.startsWith(`/${slug}/`))).toEqual([])
    },
  )

  it.each(draftOnlyTopics.map((t) => [t.slug, t] as const))(
    '%s 的主題名稱與簡介不在搜尋索引裡',
    (_slug, topic) => {
      const index = searchIndex()
      expect(index.length, '搜尋索引是空的').toBeGreaterThan(0)
      for (const record of index) {
        expect(record.content, record.url).not.toContain(topic.name)
        expect(record.content, record.url).not.toContain(topic.description)
      }
    },
  )
})

describe('上一篇 / 下一篇', () => {
  const links = (url: string, rel: 'prev' | 'next') =>
    loadPage(url)
      .querySelectorAll(`a[rel="${rel}"]`)
      .map((a) => ({ href: a.getAttribute('href')!, text: textOf(a) }))

  // 有已發布文章的主題，依主題 order；每個主題的篇章依篇章 order（預期值來自 frontmatter 與主題設定）
  const groups = topics()
    .map((topic) => ({ topic, posts: posts.filter((p) => p.topic === topic.slug) }))
    .filter((g) => g.posts.length > 0)
  const inTopic = groups.flatMap((g) =>
    g.posts.map((post, i) => [postUrl(post), post, g.posts, i] as const),
  )

  it('至少有一個主題有已發布文章（避免測試空轉）', () => {
    expect(groups.length).toBeGreaterThan(0)
    expect(inTopic.length).toBe(posts.length)
  })

  it.each(groups.map((g) => [g.topic.name, g.posts] as const))(
    '「%s」的第一篇沒有上一篇，最後一篇沒有下一篇',
    (_name, topicPosts) => {
      expect(links(postUrl(topicPosts[0]), 'prev')).toEqual([])
      expect(links(postUrl(topicPosts.at(-1)!), 'next')).toEqual([])
    },
  )

  it.each(inTopic)('%s 依同主題的篇章順序連到前後篇', (url, _post, topicPosts, i) => {
    for (const [rel, neighbour] of [
      ['prev', topicPosts[i - 1]],
      ['next', topicPosts[i + 1]],
    ] as const) {
      const found = links(url, rel)
      if (!neighbour) {
        expect(found, `${url} 不該有 ${rel}`).toEqual([])
        continue
      }
      expect(found.map((l) => l.href)).toEqual([postUrl(neighbour)])
      expect(found[0].text).toContain(neighbour.title)
    }
  })

  it.each(inTopic)('%s 的上下篇只指向同主題的已發布篇章', (url, post) => {
    for (const rel of ['prev', 'next'] as const) {
      for (const { href } of links(url, rel)) {
        const target = allPosts().find((p) => postUrl(p) === href.split(/[?#]/)[0])
        expect(target, `${url} 的 ${rel} 連到不是文章的 ${href}`).toBeDefined()
        expect(target!.draft, `${url} 的 ${rel} 連到草稿 ${href}`).toBe(false)
        expect(target!.topic, `${url} 的 ${rel} 跨到別的主題 ${href}`).toBe(post.topic)
      }
    }
  })

  it.each(inTopic)('%s 的上下篇和側欄裡同主題群組的前後項相同', (url) => {
    const sidebar = sidebarGroupsOf(loadPage(url))
    expect(sidebar, `${url} 沒有標出目前篇章的側欄`).toBeDefined()
    const group = sidebar!.find((g) => g.links.some((l) => l.current))!
    const i = group.links.findIndex((l) => l.current)
    expect(links(url, 'prev').map((l) => l.href)).toEqual(
      group.links.slice(Math.max(i - 1, 0), i).map((l) => l.href),
    )
    expect(links(url, 'next').map((l) => l.href)).toEqual(
      group.links.slice(i + 1, i + 2).map((l) => l.href),
    )
  })

  it.each(['/', '/404.html'])('%s 沒有上一篇 / 下一篇', (url) => {
    expect(links(url, 'prev')).toEqual([])
    expect(links(url, 'next')).toEqual([])
  })
})

describe('深淺色主題', () => {
  const pages = ['/', ...posts.map(postUrl), '/404.html']

  // 窄螢幕的選單裡還有一份，每一份都要是這三個選項
  it.each(pages)('%s 的主題切換有深色、淺色、跟隨系統三個選項', (url) => {
    const selects = loadPage(url).querySelectorAll('starlight-theme-select select')
    expect(selects.length).toBeGreaterThan(0)
    for (const select of selects) {
      const options = select
        .querySelectorAll('option')
        .map((o) => ({ value: o.getAttribute('value'), text: textOf(o) }))
      expect(options).toEqual([
        { value: 'dark', text: '深色' },
        { value: 'light', text: '淺色' },
        { value: 'auto', text: '自動' },
      ])
    }
  })

  // 換頁後保留：<head> 裡在畫面出來前就讀回上次的選擇（實際切換行為留給瀏覽器測試）
  it.each(pages)('%s 在載入時讀回讀者上次選的主題', (url) => {
    const head = loadPage(url).querySelector('head')!
    const restores = head
      .querySelectorAll('script')
      .some((s) => !s.getAttribute('src') && /localStorage/.test(s.textContent) && /data-theme|dataset\.theme/.test(s.textContent))
    expect(restores).toBe(true)
  })
})

describe('字體', () => {
  const pages = ['/', ...posts.map(postUrl), '/404.html']
  // 內文 / 標題 / 程式碼，以及原本設計用到的字重
  const FONTS = [
    { family: 'Noto Sans TC', weights: ['400', '500', '700'] },
    { family: 'Noto Serif TC', weights: ['600', '900'] },
    { family: 'JetBrains Mono', weights: ['400', '600'] },
  ]

  // 可變字體（@fontsource-variable）的字族名稱會多一個 " Variable"
  const isFamily = (face: { family: string }, family: string) =>
    face.family === family || face.family === `${family} Variable`
  // font-weight 可能是單一值（400）或範圍（100 900）
  const covers = (face: { weight: string }, weight: string) => {
    const [lo, hi = lo] = face.weight.split(/\s+/).map(Number)
    return lo <= Number(weight) && Number(weight) <= hi
  }

  it.each(pages)('%s 的內文、標題、程式碼字體由網站自己提供', (url) => {
    const faces = [...stylesheetsOf(url)].flatMap(([cssUrl, css]) => fontFacesIn(css, cssUrl))
    for (const { family, weights } of FONTS) {
      const own = faces.filter((f) => isFamily(f, family))
      for (const weight of weights) {
        expect(own.some((f) => covers(f, weight)), `${family} 缺少字重 ${weight}`).toBe(true)
      }
      for (const src of own.flatMap((f) => f.src)) {
        expect(isCrossOrigin(src), `${family} 從站外載入：${src}`).toBe(false)
        expect(existsSync(distFileFor(new URL(src).pathname)), `${src} 不存在`).toBe(true)
      }
    }
  })

  it.each(pages)('%s 的樣式實際用到網站提供的這三套字體', (url) => {
    const sheets = [...stylesheetsOf(url)]
    const faces = sheets.flatMap(([cssUrl, css]) => fontFacesIn(css, cssUrl))
    const css = sheets
      .map(([, text]) => text)
      .join('\n')
      .replace(/@font-face\s*\{[^}]*\}/g, '')
    for (const { family } of FONTS) {
      const provided = [...new Set(faces.filter((f) => isFamily(f, family)).map((f) => f.family))]
      const used = provided.some((name) =>
        new RegExp(`(?:^|[\\s:,])["']?${name}["']?\\s*[,;}]`).test(css),
      )
      expect(used, `${family}（${provided.join('、')}）沒有被任何樣式使用`).toBe(true)
    }
  })

  it.each(pages)('%s 沒有任何站外的字型或樣式連結', (url) => {
    const external = resourceUrlsOf(loadPage(url)).filter(isCrossOrigin)
    const cssExternal = [...stylesheetsOf(url).values()]
      .flatMap((css) => [...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1]))
      .filter((u) => !u.startsWith('data:') && isCrossOrigin(u))
    expect([...external, ...cssExternal]).toEqual([])
  })
})
