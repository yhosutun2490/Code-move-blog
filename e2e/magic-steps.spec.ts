import { expect, test } from '@playwright/test'
import { POST, hydrated, stepper } from './helpers'

test.describe('程式碼動畫', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(POST)
    await hydrated(stepper(page))
  })

  test('點「下一步」切到下一個步驟', async ({ page }) => {
    const s = stepper(page)
    await expect(s).toContainText('1 / 5')
    await expect(s.locator('[aria-current="step"]')).toHaveText(/手動 render/)

    await s.getByRole('button', { name: '下一步' }).click()

    await expect(s).toContainText('2 / 5')
    await expect(s.locator('[aria-current="step"]')).toHaveText(/getter \/ setter/)
    await expect(s.getByRole('button', { name: '上一步' })).toBeEnabled()
  })

  test('聚焦程式碼區塊後，← → 鍵切換步驟', async ({ page }) => {
    const s = stepper(page)
    await s.focus()

    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(s).toContainText('3 / 5')
    await expect(s.locator('[aria-current="step"]')).toHaveText(/訂閱者清單/)

    await page.keyboard.press('ArrowLeft')
    await expect(s).toContainText('2 / 5')
    await expect(s.locator('[aria-current="step"]')).toHaveText(/getter \/ setter/)
  })
})
