// @ts-check
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import react from '@astrojs/react'
import { expressiveCode } from './src/lib/code-blocks'
import { assertContentLayout } from './src/lib/content-layout'
import { devSearch } from './src/lib/dev-search/integration'
import { siteConfig } from './src/lib/site-config'
import { sortedTopics } from './src/lib/topics'

// 主題 = src/content/docs/ 底下的頂層資料夾，篇章 = 主題底下的 <資料夾>/index.mdx。
// 沒登記在主題設定的資料夾、直接放在主題資料夾底下的 .md / .mdx 都讓 build 直接失敗。
assertContentLayout(new URL('./src/content/docs/', import.meta.url))

// 靜態輸出：build 完就是純 HTML + 少量 island JS，丟到任何靜態主機都能跑。
// 之後要接 Void / Cloudflare 時，只需要在這裡加 adapter。
//
// MDX 由 Starlight 自帶（optimize: true），不要再另外註冊 mdx()。
export default defineConfig({
  integrations: [
    starlight({
      // 站名來自網站設定（也是瀏覽器分頁標題的後綴）
      title: siteConfig.name,
      // 單一語系。zh-Hant-TW 對不到 Starlight 內建的 zh-TW 翻譯，
      // 介面字串由 src/content/i18n/zh-Hant-TW.json 提供。
      locales: { root: { label: '繁體中文', lang: 'zh-Hant-TW' } },
      // 側欄由主題設定產生：每個主題一個群組，依主題 order 排列。
      // 組內順序來自每篇 frontmatter 的 order（見 content.config.ts）
      sidebar: sortedTopics().map((topic) => ({
        label: topic.name,
        items: [{ autogenerate: { directory: topic.slug } }],
      })),
      // theme.css：字體、顏色、版心寬度的唯一來源（含 Starlight 深淺色對應）
      // global.css：網站自己的元件樣式（eyebrow / lede、首頁、stepper、demo），只用 theme.css 的 token
      customCss: ['./src/styles/theme.css', './src/styles/global.css'],
      routeMiddleware: './src/routeData.ts',
      components: {
        PageTitle: './src/components/starlight/PageTitle.astro',
        SiteTitle: './src/components/starlight/SiteTitle.astro',
        Footer: './src/components/starlight/Footer.astro',
      },
      // 一般程式碼區塊：和程式碼動畫共用 CODE_THEME（見 src/lib/code-blocks.ts）
      expressiveCode,
    }),
    react(),
    // astro dev 時也能用搜尋（索引在記憶體、跟著內容即時重建）；astro build 不受影響
    devSearch(),
  ],
})
