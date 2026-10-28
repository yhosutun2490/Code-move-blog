# code move blog

最近發現Shiki move code animation 可以讓程式碼變成動畫，剛好工作上的工具也需要讀文件，玩玩Astro紀錄一下心得吧~!

### MobX 自我學習系列 (進行中)。

## 本機啟動

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # 靜態輸出到 dist/
npm run preview    # 預覽 build 結果
npm test           # build 後檢查 dist/ 的頁面（網址、首頁列表、island、無 Shiki、純靜態）
```

需要 Node 22 以上。

## 結構

```
src/
├── content.config.ts          # mobx collection：每篇 = 一個資料夾的 index.mdx
├── content/mobx/
│   └── 01-getter-setter/
│       ├── index.mdx          # 文章本體
│       └── demos/
│           ├── steps/*.js     # magic move 每一步的程式碼（獨立檔，有語法提示）
│           ├── steps.ts       # 步驟標題、說明 + 用 ?raw 匯入程式碼
│           ├── mini-reactive.ts
│           ├── MiniReactiveDemo.tsx
│           └── MobxCartDemo.tsx
├── components/
│   ├── MagicSteps.astro       # build 時用 Shiki 預編譯 token（client 不載 Shiki）
│   └── MagicStepper.tsx       # React island：上一步／下一步 + 動畫
├── lib/highlighter.ts         # 共用 Shiki highlighter 與主題
├── layouts/BaseLayout.astro
├── pages/
│   ├── index.astro            # 系列列表
│   └── mobx/[slug].astro      # 文章頁 + 上下篇導覽
└── styles/global.css          # 淺色／深色主題 token
```

## 新增一篇文章

1. 複製 `src/content/mobx/01-getter-setter/` 成新資料夾，例如 `02-proxy/`
2. 改 `index.mdx` 的 frontmatter（`title`、`description`、`order`）
3. 在 `demos/steps/` 放每一步的程式碼，`steps.ts` 寫標題和說明
4. 文章裡用 `<MagicSteps steps={steps} />` 放動畫，互動 demo 用 `client:visible` 載入

草稿可以在 frontmatter 加 `draft: true`，就不會出現在列表和路由裡。

## 設計備註

- **Magic move 在 build 時預編譯**：`MagicSteps.astro` 在伺服器端跑 Shiki，把每一步轉成 keyed tokens 的 JSON 傳給 island。瀏覽器只載入約 25KB 的動畫元件，不需要 Shiki 和語法檔。
- **每個 demo 自己建 store**：避免不同篇、不同 demo 互相影響。
- **改程式碼主題**：`src/lib/highlighter.ts` 的 `CODE_THEME` 和 `astro.config.mjs` 的 `shikiConfig.theme` 一起改，`global.css` 的 `--code-bg` 對齊背景色。
- **之後要部署到 Void / Cloudflare**：目前是純靜態輸出，在 `astro.config.mjs` 加 adapter 即可。
