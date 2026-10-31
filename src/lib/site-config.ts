/**
 * 網站設定：站名、頁首字標、首頁封面與頁尾的字樣，全站只有這一份。
 *
 * 純資料模組（不依賴 astro:content），astro.config.mjs、元件和測試都直接匯入它。
 * 之後要換站名，只改這裡。
 */
export const siteConfig = {
  /** Starlight 的 title，也是瀏覽器分頁標題的後綴（「<頁面標題> | <站名>」） */
  name: 'mobx/motion',
  /** 頁首字標：「前段/後段」，中間的斜線單獨上色 */
  mark: { before: 'mobx', after: 'motion' },
  /** 首頁封面；導言同時是首頁的 meta description */
  cover: {
    eyebrow: '程式碼拆解筆記',
    title: '把程式拆開來看',
    lede: '從最小的例子開始，一步一步拆解函式庫與語言特性背後的運作方式。每篇都有程式碼動畫和可以直接玩的 demo。',
  },
  /** 頁尾的打造說明 */
  credit: '用 Astro 與 shiki-magic-move 打造',
} as const
