import { expect, test } from '@playwright/test'

// 首頁版型：頁首 + 左側欄 + 右側內容。靜態 HTML 看不出位置，所以在瀏覽器裡量 bounding box。
// 手機寬度的行為（沒有水平捲動、側欄選單可以開關）在 mobile.spec.ts。
test.describe('大螢幕的首頁', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('側欄和內容區同時可見，側欄在內容區左邊，頁首的搜尋入口可見', async ({ page }) => {
    await page.goto('/')
    const sidebar = page.getByRole('navigation', { name: '主要' })
    const content = page.getByRole('main')

    // <nav> 本身是橫跨整頁的外框（裡面還有手機選單按鈕），看得到的側欄是它裡面的連結
    const links = await sidebar.getByRole('link').all()
    expect(links.length).toBeGreaterThan(0)
    await expect(content).toBeInViewport()
    const main = (await content.boundingBox())!
    expect(main.width).toBeGreaterThan(0)

    for (const link of links) {
      await expect(link).toBeInViewport()
      const box = (await link.boundingBox())!
      expect(box.x + box.width, `${await link.textContent()} 和內容區重疊`).toBeLessThanOrEqual(
        main.x,
      )
    }

    await expect(page.getByRole('banner').getByRole('button', { name: '搜尋' })).toBeVisible()
  })
})
