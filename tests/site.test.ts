import { describe, expect, it } from 'vitest'
import {
  allPosts,
  clientScriptsOf,
  islandsOf,
  loadPage,
  pageExists,
  postUrl,
  publishedPosts,
  textOf,
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
