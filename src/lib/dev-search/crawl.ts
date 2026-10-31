// dev 搜尋：從 dev server 抓渲染後的頁面，交給 Pagefind 建索引（見 integration.ts）。
//
// 從首頁開始沿著同站連結走。首頁有完整側欄（dev 時含草稿），所以不用另外維護網址清單。
// 只走「頁面」：沒有副檔名的路徑；靜態檔（.woff2、.svg…）和 dev server 內部路徑（/@vite、/_astro…）都跳過。

export interface CrawledPage {
  /** 頁面網址（路徑），例如 /mobx/01-getter-setter/ */
  url: string
  /** dev server 渲染出來的 HTML */
  html: string
}

type FetchPage = (input: string | URL | Request) => Promise<Response>

const LINK = /<a\b[^>]*?\bhref="([^"]*)"/gi

/** 頁面裡所有同站頁面連結的路徑（去掉 # 和 ?） */
function pageLinksIn(html: string, pageUrl: URL): string[] {
  const paths: string[] = []
  for (const [, href] of html.matchAll(LINK)) {
    let url: URL
    try {
      url = new URL(href, pageUrl)
    } catch {
      continue
    }
    if (url.origin !== pageUrl.origin) continue
    const path = url.pathname
    if (/^\/[@_]/.test(path)) continue // /@vite/client、/_astro/… 這類 dev server 內部路徑
    if (/\.[a-z0-9]+$/i.test(path)) continue // 靜態檔
    paths.push(path)
  }
  return paths
}

/** 從 start（預設首頁）開始，廣度優先抓所有同站頁面；只收 200 且是 HTML 的回應 */
export async function crawlPages(
  origin: string,
  fetchPage: FetchPage = fetch,
  start = '/',
): Promise<CrawledPage[]> {
  const pages: CrawledPage[] = []
  const seen = new Set([start])
  const queue = [start]
  while (queue.length > 0) {
    const path = queue.shift()!
    const url = new URL(path, origin)
    const response = await fetchPage(url)
    const isHtml = response.headers.get('content-type')?.includes('text/html') ?? false
    if (response.status !== 200 || !isHtml) {
      await response.body?.cancel()
      if (path === start) throw new Error(`dev 搜尋：抓不到 ${path}（HTTP ${response.status}）`)
      continue
    }
    const html = await response.text()
    pages.push({ url: path, html })
    for (const link of pageLinksIn(html, url)) {
      if (seen.has(link)) continue
      seen.add(link)
      queue.push(link)
    }
  }
  return pages
}
