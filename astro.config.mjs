// @ts-check
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import mdx from '@astrojs/mdx'

// 靜態輸出：build 完就是純 HTML + 少量 island JS，丟到任何靜態主機都能跑。
// 之後要接 Void / Cloudflare 時，只需要在這裡加 adapter。
export default defineConfig({
  integrations: [react(), mdx()],
  markdown: {
    shikiConfig: {
      // 一般 ```js 程式碼區塊（不是 magic move 的那些）也用同一個主題
      theme: 'vitesse-dark',
    },
  },
})
