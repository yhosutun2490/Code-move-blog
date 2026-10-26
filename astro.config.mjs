// @ts-check
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import starlight from '@astrojs/starlight'
import { CODE_THEME } from './src/lib/highlighter'

// 靜態輸出：build 完就是純 HTML + 少量 island JS，丟到任何靜態主機都能跑。
// 之後要接 Void / Cloudflare 時，只需要在這裡加 adapter。
export default defineConfig({
  integrations: [
    // MDX 由 Starlight 自己註冊，這裡不再另外加 mdx()
    starlight({
      title: 'mobx/motion',
      // 用 zh-TW 才對得到 Starlight 內建的繁中介面字串
      locales: { root: { label: '繁體中文', lang: 'zh-TW' } },
      // 側欄順序來自每篇的 order（見 content.config.ts），作者不用維護這裡
      sidebar: [{ label: 'MobX 拆解', items: [{ autogenerate: { directory: 'mobx' } }] }],
      routeMiddleware: './src/routeData.ts',
      // 字體、token、排版和互動元件的樣式；首頁的舊版型樣式不進 Starlight
      customCss: [
        './src/styles/fonts.css',
        './src/styles/tokens.css',
        './src/styles/theme.css',
        './src/styles/islands.css',
      ],
      components: {
        PageTitle: './src/components/overrides/PageTitle.astro',
        SiteTitle: './src/components/overrides/SiteTitle.astro',
        Footer: './src/components/overrides/Footer.astro',
      },
      // 一般程式碼區塊和 MagicSteps 用同一個主題
      expressiveCode: {
        themes: [CODE_THEME],
        // 不替對比太低的 token 自動調色，顏色才會和 MagicSteps 一模一樣
        minSyntaxHighlightingColorContrast: 0,
        // 外框、圓角、字體和 MagicSteps 的程式碼區一致，值都來自 tokens.css
        styleOverrides: {
          borderRadius: '10px',
          borderColor: 'var(--rule)',
          codeBackground: 'var(--code-bg)',
          codeFontFamily: 'var(--font-mono)',
          codeFontSize: '0.84rem',
          codeLineHeight: '1.65',
          frames: {
            frameBoxShadowCssValue: 'none',
            editorActiveTabIndicatorTopColor: 'var(--accent)',
          },
        },
      },
    }),
    react(),
  ],
})
