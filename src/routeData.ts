import { defineRouteMiddleware, type StarlightRouteData } from '@astrojs/starlight/route-data'

type Entry = StarlightRouteData['sidebar'][number]

// 每篇是 <資料夾>/index.mdx，autogenerate 會替每篇包一個「只含一個連結的群組」。
// 把這種群組攤平成單一連結，側欄就是「MobX 拆解」底下一排篇章。
const flatten = (entries: Entry[]): Entry[] =>
  entries.map((entry) => {
    if (entry.type !== 'group') return entry
    const [only] = entry.entries
    if (entry.entries.length === 1 && only.type === 'link') return only
    return { ...entry, entries: flatten(entry.entries) }
  })

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute
  route.sidebar = flatten(route.sidebar)
})
