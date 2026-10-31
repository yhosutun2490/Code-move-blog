import { defineRouteMiddleware, type StarlightRouteData } from '@astrojs/starlight/route-data'

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

// production build 會把草稿從側欄拿掉，只含草稿的主題（或篇章資料夾）就剩下空群組。
// 讀者不該看到空的主題，所以把沒有任何連結的群組（含巢狀）整個拿掉。
const dropEmptyGroups = (entries: Entry[]): Entry[] =>
  entries.flatMap((entry) => {
    if (entry.type !== 'group') return [entry]
    const children = dropEmptyGroups(entry.entries)
    return children.length > 0 ? [{ ...entry, entries: children }] : []
  })

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute
  route.sidebar = unwrapSingleLinkGroups(route.sidebar)
  route.sidebar = dropEmptyGroups(route.sidebar)
})
