import { defineRouteMiddleware } from '@astrojs/starlight/route-data'

type SidebarEntry = App.Locals['starlightRoute']['sidebar'][number]

// 每篇是「資料夾/index.mdx」，自動側欄會把每篇包成一個只有一個連結的群組。
// 把這種群組攤平，側欄就是一串篇章連結。
function flatten(entries: SidebarEntry[]): SidebarEntry[] {
  return entries.map((entry) => {
    if (entry.type !== 'group') return entry
    const [only] = entry.entries
    if (entry.entries.length === 1 && only.type === 'link') return only
    return { ...entry, entries: flatten(entry.entries) }
  })
}

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute
  route.sidebar = flatten(route.sidebar)
})
