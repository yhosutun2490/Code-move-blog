import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { i18nSchema } from '@astrojs/starlight/schema'
import { collections as site } from '../../../../src/content.config'

// 文章用網站的 schema，但從樣本資料夾讀；介面字串直接讀正式網站那份
export const collections = {
  docs: site.docs,
  i18n: defineCollection({
    loader: glob({ base: './src/content/i18n', pattern: '**/[^_]*.json' }),
    schema: i18nSchema(),
  }),
}
