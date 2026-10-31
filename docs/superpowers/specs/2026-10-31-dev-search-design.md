# 開發時也能用搜尋（astro dev）

日期：2026-10-31
Branch：`feat/dev-search`（從 `feat/multi-topic` 開出，PR base 設為 `feat/multi-topic`，#18 merge 後改成 `main`）

## 問題

Starlight 的搜尋（Pagefind）在 `astro dev` 底下不能用，原因有兩個：

1. **元件擋掉了**：Starlight 0.42.7 的 `Search.astro` 在畫面和 script 都判斷 `import.meta.env.DEV`。dev 時只顯示「正式版本才能使用搜尋功能」，也不載入 Pagefind。
2. **沒有索引**：Pagefind 索引是 `astro build` 結束後掃 `dist/` 的 HTML 才產生的，dev server 上沒有 `/pagefind/`。

寫文章時想用搜尋確認用詞、找舊段落，現在只能先 build 再 preview。

## 目標

- `astro dev` 時，頁首的搜尋框可以打開、輸入、看到結果，外觀和正式版相同（同一個 Starlight 元件）。
- 搜尋結果跟著編輯即時更新：存檔後重新整理頁面，就搜得到剛改的內容。
- dev 時搜得到草稿，和 dev 顯示草稿的行為一致。
- `astro build` 的輸出完全不變：正式版索引仍由 Starlight 產生，仍然不含草稿。

## 不做的事

- 不改搜尋框的外觀、翻譯或 Pagefind 設定。
- 不做搜尋結果依主題篩選。
- 不在 dev 時把索引寫到磁碟。

## 設計

### 1. dev 搜尋 integration（只在 `astro dev` 生效）

新增一個 Astro integration，在 `astro.config.mjs` 註冊。它只掛在 dev 的 hook 上（`astro:config:setup` 時判斷 `command === 'dev'`，以及 `astro:server:setup`），`astro build` 不會執行任何部分。

它做兩件事：

**a. 解除元件的 dev 判斷**

加一個 Vite plugin（`apply: 'serve'`、`enforce: 'pre'`），只轉換 Starlight 的 `components/Search.astro` 原始檔（不帶 query 的那個 module id）：把其中的 `import.meta.env.DEV` 換成 `false`。必須在 Astro 編譯 `.astro` 之前執行，畫面和 `<script>`（Astro 從編譯結果拆出的 `?astro&type=script` module）才都會吃到改寫；實作時要確認兩者都生效。

- 比對不到 `import.meta.env.DEV` 時直接丟錯，訊息說明這是為了 dev 搜尋而改寫 Starlight 元件、升級後要更新這個 plugin。不會默默失效。
- 不複製 Starlight 的元件，樣式、翻譯、`pagefindUserConfig` 都沿用原本的。

**b. 在 dev server 提供 `/pagefind/*`**

在 `astro:server:setup` 註冊 Vite middleware，處理 `/pagefind/` 底下的請求，回傳記憶體裡的索引檔（Pagefind Node API 的 `getFiles()`），並依副檔名設定 Content-Type。

### 2. 建索引

- **延後到第一次請求**：第一次請求 `/pagefind/` 時才建，不拖慢 `astro dev` 啟動。建索引期間的其他請求等同一個 Promise，不重複建。
- **抓頁面**：從首頁 `/` 開始，沿著同站、不含副檔名或以 `/` 結尾的 `<a href>` 做廣度優先抓取（去掉 `#` 與 `?`），向 dev server 自己請求渲染後的 HTML。首頁有完整側欄，所以不需要另外維護網址清單。只收 `Content-Type` 是 HTML 且狀態 200 的回應。
- **建立**：每頁用 `index.addHTMLFile({ url, content })` 加入。索引範圍和正式版一樣由頁面上的 Pagefind 標記決定（Starlight 標的 `data-pagefind-body`）。
- **語系**：頁面 `<html lang>` 是 `zh-Hant-TW`，Pagefind 依此分語系，和正式版一致。

### 3. 重建

- 監看 dev server 的 watcher：`src/content/` 底下有新增、修改、刪除時，把索引標成過期（丟掉舊的 Pagefind index）。
- 下一次請求 `/pagefind/` 時重建。Vite 在內容變動後本來就會重新整理頁面，讀者重新整理後載入的就是新索引。
- 重建前呼叫舊 index 的 `deleteIndex()` 釋放資源；dev server 關閉時呼叫 `pagefind.close()`。

### 4. 錯誤處理

- 建索引失敗（抓頁失敗、Pagefind 回報錯誤）：該次 `/pagefind/` 請求回 500，用 Astro logger 印出原因；下一次請求會重試。dev server 不會掛掉。
- 請求的檔案不在索引裡：回 404。

### 5. 依賴

程式直接匯入 `pagefind`，所以把它加進 `devDependencies`，版本範圍和 Starlight 宣告的一致（`^1.5.2`）。

### 6. 測試

沿用現有原則：只測外部行為。

**Playwright（對 `astro dev`）**：新增一個 Playwright project，用另一個 port 起 `astro dev`，只跑 dev 搜尋的 spec：

- 打開第一篇已發布文章，開啟搜尋，輸入該文 frontmatter 標題裡的詞，結果列表裡有連到這篇的結果。
- 輸入草稿測試主題的辨識文字，結果裡有它。這證明用的是 dev 即時建的索引，不是 `dist/` 的舊索引（正式版索引沒有草稿）。

預期值從原始碼取得（沿用 `e2e/helpers.ts` 的方式），不寫死字串。

**單元測試（vitest）**：索引的「過期 → 下次請求重建」邏輯抽成不依賴 Vite 的小模組，用假的 fetch 和假的 Pagefind 驗證：

- 第一次請求建索引；連續兩次請求只建一次。
- 標成過期後，下一次請求會重建，且舊 index 被 `deleteIndex()`。
- 建索引失敗時回報錯誤，下一次請求會重試。

這和 `tests/pagination.test.ts`、`tests/content-layout.test.ts` 一樣是「只測 build 產出」原則的刻意例外：dev 行為在 `dist/` 看不到。README 的測試例外說明要補上這一項。

**既有測試**：`npm test` 與正式版的搜尋、草稿檢查不變，用來保證 build 輸出不受影響。

### 7. 文件

- README「本機啟動」：註明 dev 時也能搜尋（含草稿）；第一次搜尋要先建索引，會慢一點；存檔後重新整理即可搜到新內容。
- README 結構說明：列出新的 integration 模組。
- README 測試例外：補上 dev 搜尋的單元測試。
- `package.json` 的 `test:e2e` 說明若有變動，一併更新。

## 驗收條件

- [ ] `npm run dev` 後打開任一頁，搜尋框可以開啟並顯示結果（Playwright）
- [ ] dev 時搜得到草稿測試主題的文字（Playwright）
- [ ] 修改文章後重新整理，搜得到新內容（單元測試驗證重建邏輯；手動驗證一次）
- [ ] 建索引失敗時 dev server 不會掛掉，下一次請求會重試（單元測試）
- [ ] Starlight 搜尋元件裡找不到 `import.meta.env.DEV` 時，dev 啟動會報出清楚的錯誤
- [ ] `npm test`、`npm run test:e2e`、`tsc --noEmit` 全部通過，正式版索引仍不含草稿
- [ ] README 已更新
