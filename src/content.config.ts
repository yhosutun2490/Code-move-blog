import { defineCollection } from 'astro:content'
import { z } from 'astro/zod'
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders'
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema'

// 一篇文章 = 一個資料夾：src/content/docs/<主題>/<資料夾>/index.mdx + 它自己的 demos/
// 網址是 /<主題>/<資料夾>/（主題登記在 src/lib/topics.ts）。docs loader 只收 .md / .mdx，demos 裡的程式檔不會變成頁面
// （demos 裡若要放說明檔，檔名用底線開頭，例如 _README.md）。
const docs = defineCollection({
  loader: docsLoader(),
  schema: (ctx) =>
    docsSchema({
      extend: z.object({
        description: z.string(), // Starlight 預設選填，這裡改成必填
        order: z.number(),
      }),
    })(ctx)
      // order 是主題內的順序，同時決定側欄與上下篇順序，作者不用另外寫 sidebar.order。
      // （transform 不能放進 extend，否則 Starlight 的欄位會被整個蓋掉）
      .transform((data) => ({
        ...data,
        sidebar: { ...data.sidebar, order: data.sidebar.order ?? data.order },
      })),
})

const i18n = defineCollection({ loader: i18nLoader(), schema: i18nSchema() })

export const collections = { docs, i18n }
