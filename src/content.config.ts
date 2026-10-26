import { defineCollection } from 'astro:content'
import { z } from 'astro/zod'
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders'
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema'

// 一篇文章 = 一個資料夾（docs/mobx/<篇章>/index.mdx + 它自己的 demos/）
// docs loader 只收 .md / .mdx，demos 裡的程式檔不會變成頁面。
// draft 沿用 Starlight 內建的欄位（預設 false）。
const docs = docsSchema({
  extend: z.object({
    description: z.string(),
    order: z.number(),
  }),
})

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    // order 同時當側欄順序，作者只寫一個欄位
    schema: (context) =>
      docs(context).transform((data) => ({
        ...data,
        sidebar: { ...data.sidebar, order: data.sidebar.order ?? data.order },
      })),
  }),
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
}
