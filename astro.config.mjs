// @ts-check
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import react from '@astrojs/react'

// 靜態輸出：build 完就是純 HTML + 少量 island JS，丟到任何靜態主機都能跑。
// 之後要接 Void / Cloudflare 時，只需要在這裡加 adapter。
//
// MDX 由 Starlight 自帶（optimize: true），不要再另外註冊 mdx()。
export default defineConfig({
  integrations: [
    starlight({
      title: 'mobx/motion',
      // 單一語系。zh-Hant-TW 對不到 Starlight 內建的 zh-TW 翻譯，
      // 介面字串由 src/content/i18n/zh-Hant-TW.json 提供。
      locales: { root: { label: '繁體中文', lang: 'zh-Hant-TW' } },
      // 側欄順序來自每篇 frontmatter 的 order（見 content.config.ts）
      sidebar: [{ label: 'MobX 拆解', items: [{ autogenerate: { directory: 'mobx' } }] }],
      // 暫時沿用原本的全域樣式（stepper、demo、首頁）；主題 token 會在之後整理
      customCss: ['./src/styles/global.css'],
      routeMiddleware: './src/routeData.ts',
      components: {
        PageTitle: './src/components/starlight/PageTitle.astro',
        SiteTitle: './src/components/starlight/SiteTitle.astro',
      },
    }),
    react(),
  ],
})
