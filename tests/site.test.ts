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
