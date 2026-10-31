import { expect, test, type Page } from '@playwright/test'
import { allPosts, postUrl, publishedPosts, sectionHeadings } from '../tests/site'
import { POST } from './helpers'

// 對 astro dev 跑（playwright.config.ts 的 dev project）：搜尋框可以用，而且用的是 dev 即時建的索引。
// 第一次搜尋要先建索引（抓頁面 + Pagefind），所以等結果的時間放寬。
const FIRST_SEARCH = { timeout: 30_000 }

const firstPost = publishedPosts()[0]
// 只含草稿的主題裡的草稿：正式版索引沒有它，dev 搜得到它就代表用的是 dev 即時建的索引
const draftOnlyTopicPost = allPosts().find(
  (post) => post.draft && !publishedPosts().some((p) => p.topic === post.topic),
)
if (!draftOnlyTopicPost) throw new Error('找不到只含草稿的測試用主題')

async function search(page: Page, query: string) {
  await page.getByRole('banner').getByRole('button', { name: '搜尋' }).click()
  const input = page.getByRole('dialog', { name: '搜尋' }).getByRole('textbox')
  await input.fill(query)
}

/** 搜尋結果裡連到 url 的那一筆（只看頁面連結，不看小節錨點） */
const resultLink = (page: Page, url: string) =>
  page.locator(`#starlight__search a.pagefind-ui__result-link[href="${url}"]`)

test.describe('dev 時的搜尋', () => {
  test('搜尋文章標題，結果裡有那篇文章', async ({ page }) => {
    await page.goto(POST)
    await search(page, firstPost.title)
    await expect(resultLink(page, postUrl(firstPost))).toBeVisible(FIRST_SEARCH)
  })

  test('搜得到草稿（dev 顯示草稿，索引也包含草稿）', async ({ page }) => {
    const [heading] = sectionHeadings(draftOnlyTopicPost)
    expect(heading, '草稿測試主題的篇章要有 ## 小節').toBeTruthy()
    await page.goto('/')
    await search(page, heading)
    await expect(resultLink(page, postUrl(draftOnlyTopicPost))).toBeVisible(FIRST_SEARCH)
  })
})
