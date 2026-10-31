// 主題設定：主題 = src/content/docs/ 底下的一個頂層資料夾（例如 mobx/），
// 文章網址是 /<主題>/<篇章資料夾>/。
//
// 純資料模組，不依賴 astro:content：astro.config.mjs（側欄）、元件、系列查詢和測試都讀這一份。
// 新增主題：開資料夾，再在這裡登記一筆。內容目錄裡有沒登記的資料夾時 build 會失敗；
// 登記了但還沒有資料夾的主題不會報錯，只是沒有文章。

export interface TopicConfig {
  /** 資料夾名稱，也是網址的第一段 */
  slug: string
  /** 顯示名稱：側欄群組標題、文章 eyebrow */
  name: string
  /** 主題簡介 */
  description: string
  /** 主題之間的排序（小的在前） */
  order: number
}

export const TOPICS = [
  {
    slug: 'mobx',
    name: 'MobX 拆解',
    description:
      '從最基本的 getter / setter 開始，一步一步疊出依賴追蹤、computed、action 與 observer。每篇都有程式碼動畫和可以直接玩的 demo。',
    order: 1,
  },
  // 測試夾具：只含草稿的主題（src/content/docs/draft-topic/），永遠不該出現在網站上。
  // 用來驗證空主題不出現、非 MobX 主題的草稿全站隱藏，並證明測試掃到 mobx 以外的主題。請不要刪除。
  {
    slug: 'draft-topic',
    name: '草稿測試主題（永遠不該出現在網站上）',
    description: '只含草稿的測試用主題，用來確認沒有已發布文章的主題不會出現在側欄和首頁。',
    order: 99,
  },
] as const satisfies readonly TopicConfig[]

/** 已登記的主題 slug（字面值聯集） */
export type TopicSlug = (typeof TOPICS)[number]['slug']

/** 依主題 order 排序的主題設定 */
export const sortedTopics = (): TopicConfig[] => [...TOPICS].sort((a, b) => a.order - b.order)

export function isTopicSlug(slug: string): slug is TopicSlug {
  return TOPICS.some((t) => t.slug === slug)
}

export function topicConfig(slug: TopicSlug): TopicConfig {
  return TOPICS.find((t) => t.slug === slug)!
}

/**
 * 內容目錄的頂層資料夾都要登記在 TOPICS，否則丟出錯誤（讓 build 失敗），
 * 避免沒有名稱的主題被默默發布。登記了但沒有資料夾的主題不算錯。
 */
export function assertTopicFoldersRegistered(folders: readonly string[]): void {
  const unknown = folders.filter((name) => !isTopicSlug(name))
  if (unknown.length === 0) return
  throw new Error(
    `src/content/docs/ 底下有沒登記的主題資料夾：${unknown.join('、')}。` +
      `請在 src/lib/topics.ts 的 TOPICS 登記一筆（slug、name、description、order），或移除該資料夾。`,
  )
}
