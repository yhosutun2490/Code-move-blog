import { expect, test, type Page } from '@playwright/test'
import { POST, hydrated } from './helpers'

test.use({ viewport: { width: 375, height: 800 } })

/** 頁面比視窗寬多少 px（> 0 就代表可以左右捲動） */
const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

/** 把每個 client:visible 的 island 捲進畫面載入，量的才是互動元件真正的寬度 */
async function loadWholePage(page: Page) {
  for (const island of await page.locator('astro-island').all()) await hydrated(island)
}

for (const path of ['/', POST]) {
  test(`${path} 在手機寬度沒有水平捲動`, async ({ page }) => {
    await page.goto(path)
    await loadWholePage(page)
    expect(await overflowX(page)).toBe(0)
  })
}

test('文章頁的側欄選單可以開關', async ({ page }) => {
  await page.goto(POST)
  const menu = page.getByRole('button', { name: '選單' })
  const sidebar = page.getByRole('navigation', { name: '主要' })
  const postLink = sidebar.getByRole('link', { name: '從 getter / setter 到迷你 autorun' })

  await expect(postLink).toBeHidden()

  await menu.click()
  await expect(postLink).toBeVisible()
  // 窄螢幕時主題切換收在選單裡
  await expect(sidebar.getByRole('combobox', { name: '選擇佈景主題' })).toBeVisible()

  await menu.click()
  await expect(postLink).toBeHidden()

  await menu.click()
  await expect(postLink).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(postLink).toBeHidden()
})
