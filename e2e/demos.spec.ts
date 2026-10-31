import { expect, test, type Locator, type Page } from '@playwright/test'
import { GETTER_SETTER_POST, hydrated } from './helpers'

/** 文章裡標著 tag（「手寫版」/「MobX 版」）的那個 demo */
async function demo(page: Page, tag: string): Promise<Locator> {
  return hydrated(page.locator('astro-island', { hasText: tag }))
}

/** MobX demo 裡的一張卡片：標籤、目前的值、render 次數 */
function card(demo: Locator, label: string): Locator {
  return demo.getByText(label).locator('..')
}

test.beforeEach(async ({ page }) => {
  await page.goto(GETTER_SETTER_POST)
})

test('手寫版：改 qty 會重算總計，改 note 不會觸發 autorun', async ({ page }) => {
  const d = await demo(page, '手寫版')
  const total = d.getByRole('status')
  const log = d.getByRole('list', { name: '執行紀錄' })
  await expect(total).toHaveText('200')

  await d.getByRole('button', { name: 'qty + 1' }).click()
  await expect(total).toHaveText('300')
  await expect(log).toContainText('通知 1 個訂閱者')
  await expect(log).toContainText('autorun 第 2 次執行')

  await d.getByRole('button', { name: '改 note' }).click()
  await expect(log).toContainText('沒有訂閱者，什麼都不做')
  await expect(log).not.toContainText('autorun 第 3 次執行')
  await expect(total).toHaveText('300')
})

test('MobX 版：只有讀到被改欄位的元件會重新渲染', async ({ page }) => {
  const d = await demo(page, 'MobX 版')
  const totalCard = card(d, 'TotalView 只讀 cart.total')
  const noteCard = card(d, 'NoteView 只讀 cart.note')
  await expect(totalCard.getByRole('status')).toHaveText('200')
  await expect(totalCard).toContainText('render × 1')
  await expect(noteCard).toContainText('render × 1')

  await d.getByRole('button', { name: 'price + 10' }).click()
  await expect(totalCard.getByRole('status')).toHaveText('220')
  await expect(totalCard).toContainText('render × 2')
  await expect(noteCard).toContainText('render × 1')

  await d.getByRole('button', { name: '改 note' }).click()
  await expect(noteCard.getByRole('status')).toHaveText('送禮')
  await expect(noteCard).toContainText('render × 2')
  await expect(totalCard).toContainText('render × 2')
})
