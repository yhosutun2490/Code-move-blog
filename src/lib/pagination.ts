// 上一篇 / 下一篇：只在「目前頁面所在的頂層側欄群組」裡取前後項。
//
// 側欄由主題設定產生，每個主題一個頂層群組，所以這就是「只在同一個主題內串連」。
// Starlight 預設把整個側欄攤平後取前後項，會跨過主題群組。
// 側欄是導覽的唯一來源：順序、草稿（production 已從側欄移除）都跟著側欄走，不另查集合。
//
// 純函式，不依賴 astro:content，route middleware 和測試都直接用。
import type { StarlightRouteData } from '@astrojs/starlight/route-data'

type Entry = StarlightRouteData['sidebar'][number]
type Pagination = StarlightRouteData['pagination']
type Link = Extract<Entry, { type: 'link' }>
type Group = Extract<Entry, { type: 'group' }>

const linksIn = (entries: Entry[]): Link[] =>
  entries.flatMap((entry) => (entry.type === 'link' ? [entry] : linksIn(entry.entries)))

/**
 * 首頁、404 這類不在側欄裡的頁面找不到目前項目，上下篇都是空的；
 * 目前頁面若是不屬於任何群組的頂層連結，也沒有上下篇。
 */
export function paginationWithinGroup(sidebar: Entry[]): Pagination {
  const group = sidebar.find(
    (entry): entry is Group =>
      entry.type === 'group' && linksIn(entry.entries).some((l) => l.isCurrent),
  )
  if (!group) return { prev: undefined, next: undefined }
  const links = linksIn(group.entries)
  const i = links.findIndex((l) => l.isCurrent)
  return { prev: links[i - 1], next: links[i + 1] }
}
