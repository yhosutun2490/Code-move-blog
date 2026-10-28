import type { Locator, Page } from '@playwright/test'

export const POST = '/mobx/01-getter-setter/'

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
