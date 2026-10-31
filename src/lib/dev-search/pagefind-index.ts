// dev 搜尋：把抓到的頁面交給 Pagefind，索引檔留在記憶體（不寫進 dist/ 或 public/）。
// 正式版的索引仍由 Starlight 在 astro build 結束後產生，這裡只給 astro dev 用。
import * as pagefind from 'pagefind'
import type { CrawledPage } from './crawl'
import type { BuiltIndex } from './index-cache'

function assertNoErrors(errors: string[], step: string): void {
  if (errors.length > 0) throw new Error(`Pagefind ${step}失敗：${errors.join('；')}`)
}

/** 建一份索引：索引範圍和正式版一樣由頁面上的 data-pagefind-body 決定 */
export async function buildPagefindIndex(pages: CrawledPage[]): Promise<BuiltIndex> {
  const { index, errors } = await pagefind.createIndex()
  assertNoErrors(errors, '建立索引')
  if (!index) throw new Error('Pagefind 建立索引失敗：沒有回傳索引')
  try {
    for (const page of pages) {
      const added = await index.addHTMLFile({ url: page.url, content: page.html })
      assertNoErrors(added.errors, `加入 ${page.url} `)
    }
    const { files, errors: fileErrors } = await index.getFiles()
    assertNoErrors(fileErrors, '輸出索引檔')
    return {
      files: new Map(files.map((file) => [`/pagefind/${file.path.replace(/^\/+/, '')}`, file.content])),
      dispose: async () => {
        await index.deleteIndex()
      },
    }
  } catch (error) {
    // 釋放失敗不蓋掉原本的錯誤
    await index.deleteIndex().catch(() => {})
    throw error
  }
}

/** 關掉 Pagefind 的背景服務（dev server 關閉時用） */
export async function closePagefind(): Promise<void> {
  await pagefind.close()
}
