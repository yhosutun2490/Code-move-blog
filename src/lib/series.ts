import { getCollection } from 'astro:content'

/** 系列文章都放在 src/content/docs/mobx/ 底下，entry id 是「mobx/<資料夾>」 */
const SERIES_PREFIX = 'mobx/'

/** 這個 docs entry 是不是系列裡的一篇 */
export function isSeriesPost(id: string): boolean {
  return id.startsWith(SERIES_PREFIX)
}

/**
 * 讀者看得到的篇章：不含草稿，依 order 排序。
 *
 * production build 會替草稿拿掉頁面，但 getCollection 不會濾草稿，
 * 所以首頁列表、「共 M 篇」這類自己查集合的地方都要用這個函式。
 */
export async function publishedSeriesPosts() {
  const posts = await getCollection('docs', ({ id, data }) => isSeriesPost(id) && !data.draft)
  return posts.sort((a, b) => a.data.order - b.data.order)
}
