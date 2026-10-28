import { describe, expect, it } from 'vitest'
import {
  allPosts,
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
