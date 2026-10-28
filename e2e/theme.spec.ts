import { expect, test, type Page } from '@playwright/test'
import { POST } from './helpers'

const picker = (page: Page) =>
  page.getByRole('banner').getByRole('combobox', { name: '選擇佈景主題' })

const background = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor)

test('切換主題會改變頁面配色，換頁後仍保留', async ({ page }) => {
  await page.goto('/')
  await picker(page).selectOption({ label: '深色' })
  const dark = await background(page)
  await picker(page).selectOption({ label: '淺色' })
  await expect.poll(() => background(page)).not.toBe(dark)
  const light = await background(page)

  // 從首頁的篇章列表點進文章
  await page.getByRole('link', { name: /從 getter \/ setter 到迷你 autorun/ }).first().click()
  await expect(page).toHaveURL(POST)
  await expect(picker(page)).toHaveValue('light')
  expect(await background(page)).toBe(light)

  await picker(page).selectOption({ label: '深色' })
  await page.goto('/404.html')
  await expect(picker(page)).toHaveValue('dark')
  expect(await background(page)).toBe(dark)
})

test.describe('手機寬度', () => {
  test.use({ viewport: { width: 375, height: 800 } })

  for (const path of ['/', '/404.html']) {
    test(`${path} 的頁首有主題切換`, async ({ page }) => {
      await page.goto(path)
      await expect(picker(page)).toBeVisible()
      await picker(page).selectOption({ label: '淺色' })
      await expect(picker(page)).toHaveValue('light')
    })
  }
})
