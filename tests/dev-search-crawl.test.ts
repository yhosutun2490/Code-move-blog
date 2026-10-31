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

  test('相對連結以所在頁面為基準解析', async () => {
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
    await expect(crawlPages(ORIGIN, fetchPage)).rejects.toThrow('抓不到 /（HTTP 500）')
  })
})
