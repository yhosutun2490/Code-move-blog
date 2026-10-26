import { describe, expect, it } from 'vitest'
import { articles, loadPage, pageExists, published, text } from './site'

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
