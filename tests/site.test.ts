import { existsSync } from 'node:fs'
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

describe('首頁是系列封面', () => {
  const COVER_TITLE = '把 MobX 拆開來看'
  const COVER_LEDE =
    '從最基本的 getter / setter 開始，一步一步疊出依賴追蹤、computed、action 與 observer。每篇都有程式碼動畫和可以直接玩的 demo。'

  it('標題是封面標題，緊接著以導言樣式顯示導言', () => {
    const h1 = loadPage('/').querySelector('h1')!
    expect(textOf(h1)).toBe(COVER_TITLE)
    const below = h1.nextElementSibling
    expect(below && textOf(below)).toBe(COVER_LEDE)
    expect(below?.classList.contains('lede')).toBe(true)
  })

  it('標題上方以 eyebrow 樣式寫著「自我學習系列」', () => {
    const above = loadPage('/').querySelector('h1')!.previousElementSibling
    expect(above && textOf(above)).toBe('自我學習系列')
    expect(above?.classList.contains('eyebrow')).toBe(true)
  })

  it('沒有側欄和本頁目錄，內容是單欄', () => {
    const home = loadPage('/')
    const html = home.querySelector('html')!
    expect(html.hasAttribute('data-has-sidebar'), '首頁有側欄').toBe(false)
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

  it('瀏覽器分頁標題與摘要是封面標題與導言', () => {
    const head = loadPage('/').querySelector('head')!
    expect(textOf(head.querySelector('title')!)).toBe(`${COVER_TITLE} | mobx/motion`)
    expect(head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(COVER_LEDE)
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
    '%s 的頁首有 mobx/motion 字標，斜線單獨上色，連到首頁',
    (url) => {
      const mark = loadPage(url)
        .querySelectorAll('header a[href="/"]')
        .find((a) => textOf(a) === 'mobx/motion')
      expect(mark, `${url} 頁首沒有連到首頁的字標`).toBeDefined()
      // 斜線包在自己的元素裡，才能用 MobX 橘上色
      expect(mark!.querySelectorAll('*').map(textOf)).toContain('/')
    },
  )

  it.each(['/', ...posts.map(postUrl), '/404.html'])(
    '%s 的頁尾寫著打造說明，在內文之後',
    (url) => {
      const page = loadPage(url)
      const credit = page
        .querySelectorAll('main p')
        .find((p) => textOf(p) === '用 Astro、shiki-magic-move 與 MobX 打造')
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
      expect(sidebar, `${url} 沒有標出目前篇章的側欄`).toBeDefined()
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
