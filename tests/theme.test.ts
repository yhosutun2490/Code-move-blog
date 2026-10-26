import { describe, expect, it } from 'vitest'
import { externalUrls, fontFaces, localFileExists, pageRules, themeProperty } from './css'
import { loadPage, published } from './site'

// 首頁（系列封面）和每篇文章套同一套字體和紙張主題
const pages = [{ url: '/' }, ...published]

describe('字體', () => {
  it.each(pages)('$url 沒有任何外部字型或樣式連結', (page) => {
    expect(externalUrls(page.url)).toEqual([])
  })

  it.each(pages)('$url 的內文、標題、程式碼字體都由網站自己提供', (page) => {
    const faces = fontFaces(page.url)
    for (const family of ['Noto Sans TC', 'Noto Serif TC', 'JetBrains Mono']) {
      const files = faces.filter((f) => f.family === family).flatMap((f) => f.files)
      expect(files.length, `${family} 沒有 @font-face`).toBeGreaterThan(0)
      expect(files.filter((f) => !localFileExists(f)), `${family} 有字型檔不在網站裡`).toEqual([])
    }
  })
})

describe('深淺色主題', () => {
  // 讀者在主題選單選的值，Starlight 會寫在 <html data-theme> 上
  const at = (url: string, theme: 'light' | 'dark', prop: string) =>
    themeProperty(pageRules(url), theme, prop)?.toLowerCase()

  it.each(pages)('$url 選淺色時是米色紙張配 MobX 橘', (page) => {
    expect(at(page.url, 'light', '--sl-color-bg')).toBe('#f6f1e7')
    expect(at(page.url, 'light', '--sl-color-accent')).toBe('#e8590c')
  })

  it.each(pages)('$url 選深色時是暖色深底配亮橘', (page) => {
    expect(at(page.url, 'dark', '--sl-color-bg')).toBe('#16130f')
    expect(at(page.url, 'dark', '--sl-color-accent')).toBe('#ff8a3d')
  })

  it.each(pages)('$url 介面和程式碼都用網站提供的字體', (page) => {
    for (const theme of ['light', 'dark'] as const) {
      expect(at(page.url, theme, '--__sl-font')).toMatch(/^['"]?noto sans tc/)
      expect(at(page.url, theme, '--__sl-font-mono')).toMatch(/^['"]?jetbrains mono/)
    }
  })

  it.each(pages)('$url 的主題選單有淺色、深色、跟隨系統三個選項', (page) => {
    // 桌面版和手機選單裡各有一個
    const pickers = loadPage(page.url).querySelectorAll('starlight-theme-select')
    expect(pickers.length).toBeGreaterThan(0)
    for (const picker of pickers) {
      const options = picker.querySelectorAll('option').map((o) => o.getAttribute('value'))
      expect(options.sort()).toEqual(['auto', 'dark', 'light'])
    }
  })
})
