import { expect, test, type Locator } from '@playwright/test'
import { GETTER_SETTER_POST, hydrated, stepper } from './helpers'

// 目前步驟 = 步驟清單裡 aria-current="step" 的那個按鈕
const currentStep = (s: Locator) => s.getByRole('list', { name: '步驟' }).locator('[aria-current="step"]')
// 變更行標示：動畫跑完後淡入的那幾條（只算看得到的）
const marks = (s: Locator) => s.locator('.stepper-marks > *')
// 說明在軌道裡和程式碼上方各有一份，依寬度只顯示其中一份：只找看得到的那份
const visibleText = (s: Locator, text: string | RegExp, exact = false) =>
  s.getByText(text, { exact }).filter({ visible: true })

test.describe('程式碼動畫', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GETTER_SETTER_POST)
    await hydrated(stepper(page))
  })

  test('點「下一步」切到下一個步驟', async ({ page }) => {
    const s = stepper(page)
    await expect(currentStep(s)).toHaveText(/手動 render/)
    await expect(s.getByRole('button', { name: '上一步' })).toBeDisabled()

    await s.getByRole('button', { name: '下一步' }).click()

    await expect(currentStep(s)).toHaveText(/getter \/ setter/)
    await expect(s.getByRole('button', { name: '上一步' })).toBeEnabled()
  })

  test('點步驟清單裡的步驟直接跳過去', async ({ page }) => {
    const s = stepper(page)
    await s.getByRole('button', { name: /訂閱者清單/ }).click()
    await expect(currentStep(s)).toHaveText(/訂閱者清單/)
  })

  test('聚焦程式碼區塊後，← → 鍵切換步驟', async ({ page }) => {
    const s = stepper(page)
    await s.focus()

    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(currentStep(s)).toHaveText(/訂閱者清單/)

    await page.keyboard.press('ArrowLeft')
    await expect(currentStep(s)).toHaveText(/getter \/ setter/)
  })

  test('目前步驟的說明看得到', async ({ page }) => {
    const s = stepper(page)
    await expect(visibleText(s, '資料和畫面之間沒有連結')).toBeVisible()
    await s.getByRole('button', { name: '下一步' }).click()
    await expect(visibleText(s, '用 Object.defineProperty 攔截讀和寫')).toBeVisible()
  })

  test('第一步不標變更行；之後標出這一步新增 / 改過的行，「+N 行」和標示的行數一致', async ({ page }) => {
    const s = stepper(page)
    await expect(marks(s)).toHaveCount(0)
    await expect(visibleText(s, /^\+\d+ 行$/)).toHaveCount(0)

    // 第 4 步只在第 3 步上加了幾行（activeEffect、getter 裡的收集、autorun）
    await s.getByRole('button', { name: /autorun 與依賴收集/ }).click()
    const count = await marks(s).count()
    expect(count).toBeGreaterThan(0)
    await expect(visibleText(s, `+${count} 行`, true)).toBeVisible()
    await expect(marks(s).first()).toBeVisible()
  })
})

test.describe('手機寬度的程式碼動畫', () => {
  test.use({ viewport: { width: 375, height: 800 } })

  test.beforeEach(async ({ page }) => {
    await page.goto(GETTER_SETTER_POST)
    await hydrated(stepper(page))
  })

  test('步驟清單橫排成一列；說明在程式碼上方，「下一步」在程式碼下方', async ({ page }) => {
    const s = stepper(page)
    const steps = await s.getByRole('list', { name: '步驟' }).getByRole('button').all()
    expect(steps.length).toBe(5)
    const tops = await Promise.all(steps.map(async (b) => (await b.boundingBox())!.y))
    expect(Math.max(...tops) - Math.min(...tops), '步驟按鈕不在同一列').toBeLessThan(2)

    const note = (await visibleText(s, '資料和畫面之間沒有連結').boundingBox())!
    const code = (await s.locator('.stepper-code').boundingBox())!
    const next = (await s.getByRole('button', { name: '下一步' }).boundingBox())!
    expect(note.y + note.height).toBeLessThanOrEqual(code.y)
    expect(next.y).toBeGreaterThanOrEqual(code.y + code.height)
  })

  test('目前步驟寫著「步驟 N / M」', async ({ page }) => {
    const s = stepper(page)
    await expect(visibleText(s, '步驟 1 / 5')).toBeVisible()
    await s.getByRole('button', { name: '下一步' }).click()
    await expect(visibleText(s, '步驟 2 / 5')).toBeVisible()
  })
})
