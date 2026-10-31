import { defineRouteMiddleware, type StarlightRouteData } from '@astrojs/starlight/route-data'
import { paginationWithinGroup } from './lib/pagination'

type Entry = StarlightRouteData['sidebar'][number]

// 每篇是 <資料夾>/index.mdx，autogenerate 會替每篇包一個「只含一個連結的群組」。
// 把這種群組攤平成單一連結，側欄就是每個主題群組底下一排篇章。
const unwrapSingleLinkGroups = (entries: Entry[]): Entry[] =>
  entries.map((entry) => {
    if (entry.type !== 'group') return entry
    const [only] = entry.entries
    if (entry.entries.length === 1 && only.type === 'link') return only
    return { ...entry, entries: unwrapSingleLinkGroups(entry.entries) }
  })

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute
  route.sidebar = unwrapSingleLinkGroups(route.sidebar)
  // 上一篇 / 下一篇只在同一個主題（目前頁面所在的頂層群組）內串連，要在整理完側欄之後算。
  // 這會蓋掉 Starlight 的預設分頁，文章 frontmatter 的 prev / next 也不再生效（目前沒有文章用到）。
  route.pagination = paginationWithinGroup(route.sidebar)
})
