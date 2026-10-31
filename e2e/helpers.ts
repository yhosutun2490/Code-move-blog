import type { Locator, Page } from '@playwright/test'
import { postUrl, publishedPosts } from '../tests/site'

// 版型、選單、主題切換這類「任何一篇都一樣」的測試用的文章：
// 預期值來自原始碼（和 build 產出測試同一套工具），是第一個主題的第一篇已發布文章。
// 換篇章順序或資料夾名稱時不用改這裡。
const firstPost = publishedPosts()[0]
if (!firstPost) throw new Error('找不到任何已發布文章')

/** 第一篇已發布文章的網址，例如 /<主題>/<資料夾>/（只給通用測試用） */
export const POST = postUrl(firstPost)
/** 第一篇已發布文章的標題（側欄、首頁列表的連結文字） */
export const POST_TITLE = firstPost.title

/**
 * 程式碼動畫與互動 demo 的測試驗的是這一篇特有的內容（步驟標題、demo 的按鈕和數字），
 * 所以明確指定它，而不是用「第一篇」：之後新增主題或調整順序，第一篇換成別篇時這些測試才不會跟著壞。
 * 改這篇的資料夾名稱、步驟或 demo 時，要一起更新 magic-steps.spec.ts 和 demos.spec.ts。
 */
export const GETTER_SETTER_POST = '/mobx/01-getter-setter/'

/**
 * React island 用 client:visible 載入：捲到畫面上之後才 hydrate。
 * 在那之前按鈕看得到、按了卻沒反應，所以先捲過去、等 island 接手
 * （Astro hydrate 完會拿掉 <astro-island> 的 ssr 屬性）。
 */
export async function hydrated(island: Locator): Promise<Locator> {
  await island.scrollIntoViewIfNeeded()
  await island
    .locator('xpath=ancestor-or-self::astro-island[1]')
    .and(island.page().locator('astro-island:not([ssr])'))
    .waitFor()
  return island
}

/** 文章裡的程式碼動畫（有「步驟」清單的那個 figure） */
export function stepper(page: Page): Locator {
  return page
    .getByRole('figure')
    .filter({ has: page.getByRole('list', { name: '步驟' }) })
}
