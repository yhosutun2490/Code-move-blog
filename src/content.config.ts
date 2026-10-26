import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

// 一篇文章 = 一個資料夾（index.mdx + 它自己的 demos/）
// 要搬走、刪掉一篇，就是整個資料夾處理。
const mobx = defineCollection({
  loader: glob({ pattern: '*/index.mdx', base: './src/content/mobx' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number(),
    draft: z.boolean().default(false),
  }),
})

export const collections = { mobx }
