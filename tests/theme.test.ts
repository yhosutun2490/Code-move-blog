import { describe, expect, it } from 'vitest'
import { externalUrls, fontFaces, localFileExists } from './css'
import { published } from './site'

describe('字體', () => {
  it.each(published)('$url 沒有任何外部字型或樣式連結', (article) => {
    expect(externalUrls(article.url)).toEqual([])
  })

  it.each(published)('$url 的內文、標題、程式碼字體都由網站自己提供', (article) => {
    const faces = fontFaces(article.url)
    for (const family of ['Noto Sans TC', 'Noto Serif TC', 'JetBrains Mono']) {
      const files = faces.filter((f) => f.family === family).flatMap((f) => f.files)
      expect(files.length, `${family} 沒有 @font-face`).toBeGreaterThan(0)
      expect(files.filter((f) => !localFileExists(f)), `${family} 有字型檔不在網站裡`).toEqual([])
    }
  })
})
