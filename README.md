# code move blog

最近發現Shiki move code animation 可以讓程式碼變成動畫，剛好工作上的工具也需要讀文件，玩玩Astro紀錄一下心得吧~!

### MobX 自我學習系列 (進行中)。

## 本機啟動

```bash
npm install
npm run dev        # http://localhost:4321（搜尋也能用，含草稿；見下方說明）
npm run build      # 靜態輸出到 dist/
npm run preview    # 預覽 build 結果
npm test           # build 後檢查 dist/ 的頁面（網址、首頁封面與列表、側欄、目錄、搜尋、上下篇、草稿、繁中介面、字體、island、無 Shiki、程式碼區塊）
npm run test:e2e   # build 後用 Playwright 在瀏覽器操作 preview：程式碼動畫、兩個 demo、主題切換、首頁版型、手機版面與選單；另外起 astro dev 測 dev 搜尋
```

`test:e2e` 的測試在 `e2e/`，第一次跑之前要下載瀏覽器：

```bash
npx playwright install chromium
```

`astro dev` 時頁首的搜尋也能用：第一次搜尋時才建索引（從 dev server 抓所有頁面，會慢幾秒），
之後改了 `src/content/` 底下的檔案，重新整理頁面就搜得到新內容。dev 的索引包含草稿（和 dev 顯示草稿一致）；
正式版的索引由 `npm run build` 產生，不含草稿。

需要 Node 22.23.4 以上（Astro 7 的要求）。

## 結構

```
astro.config.mjs               # Starlight 設定：語系、側欄（由主題設定產生）、customCss、元件覆寫、Expressive Code、dev 搜尋
vitest.config.ts               # npm test：只跑 tests/**/*.test.ts
playwright.config.ts           # npm run test:e2e：起 astro preview 和 astro dev，跑 e2e/*.spec.ts
src/
├── content.config.ts          # Starlight docs collection：每篇 = 一個資料夾的 index.mdx
├── routeData.ts               # 把側欄攤平成每個主題群組底下一排篇章，並拿掉只含草稿的空群組
├── content/i18n/zh-Hant-TW.json  # Starlight 介面字串（繁中，見設計備註）
├── content/docs/              # 每個頂層資料夾是一個主題，網址是 /<主題>/<篇章資料夾>/
│   ├── mobx/                  # 主題「MobX 拆解」（登記在 src/lib/topics.ts）
│   │   ├── 01-getter-setter/
│   │   │   ├── index.mdx      # 文章本體
│   │   │   └── demos/
│   │   │       ├── steps/*.js # magic move 每一步的程式碼（獨立檔，有語法提示）
│   │   │       ├── steps.ts   # 步驟標題、說明 + 用 ?raw 匯入程式碼
│   │   │       ├── mini-reactive.ts
│   │   │       ├── MiniReactiveDemo.tsx
│   │   │       └── MobxCartDemo.tsx
│   │   └── draft-fixture/index.mdx   # 測試用草稿（見「草稿」），不是文章
│   └── draft-topic/           # 只含草稿的測試用主題（見「草稿」），不要刪除
│       └── draft-fixture/index.mdx
├── components/
│   ├── MagicSteps.astro       # build 時用 Shiki 預編譯 token（client 不載 Shiki）
│   ├── MagicStepper.tsx       # React island：上一步／下一步 + 動畫
│   └── starlight/             # 覆寫 Starlight 元件
│       ├── PageTitle.astro    # 標題區：eyebrow（文章頁：<主題名稱> · 第 N 篇 / 共 M 篇；首頁：網站設定的封面 eyebrow）+ 標題 + 導言
│       ├── SiteTitle.astro    # 頁首字標「前段/後段」（字樣來自網站設定 site-config.ts，斜線用強調色）
│       └── Footer.astro       # 上下篇之後加上打造說明
├── lib/
│   ├── highlighter.ts         # 共用 Shiki highlighter 與 CODE_THEME
│   ├── code-blocks.ts         # 一般程式碼區塊（Expressive Code）設定
│   ├── site-config.ts         # 網站設定：站名、頁首字標、首頁封面、頁尾打造說明（純資料，Astro 設定、元件、測試共用）
│   ├── topics.ts              # 主題設定：每個主題的 slug、名稱、簡介、排序（純資料，Astro 設定、元件、測試共用）
│   ├── content-layout.ts      # 內容目錄檢查（載入 Astro 設定時執行）：資料夾都要登記成主題、篇章都要在子資料夾裡
│   ├── series.ts              # 以主題為單位的篇章查詢（不含草稿、依 order 排序）
│   ├── dev-search/            # astro dev 時的搜尋：解除 Starlight 的 dev 限制、抓頁面建記憶體索引、內容變動時重建
│   └── pagination.ts          # 上一篇 / 下一篇：只在目前主題的側欄群組內串連（routeData.ts 用）
├── pages/index.astro          # 首頁：側欄 + 網站封面 + 依主題分區的篇章列表（列表由 series.ts 的 publishedTopics 產生）
└── styles/
    ├── theme.css              # 字體、顏色 token、版心寬度的唯一來源，含 Starlight --sl-* 對應
    └── global.css             # 網站自己的元件樣式（eyebrow / lede、首頁列表、stepper、demo），只用 theme.css 的 token
tests/                         # npm test：檢查 build 出來的 dist/
├── site.test.ts               # 網址、封面、側欄、目錄、搜尋、草稿、繁中介面、主題、字體
├── code-blocks.test.ts        # 一般程式碼區塊和程式碼動畫的外框、字體、配色一致
├── pagination.test.ts         # 上下篇不跨主題（刻意例外：直接測純函式，見設計備註）
├── content-layout.test.ts     # 內容目錄檢查讓 build 失敗的情況（刻意例外：直接測檢查函式，見設計備註）
├── dev-search-*.test.ts       # dev 搜尋的抓頁與索引快取（刻意例外：直接測函式，見設計備註）
└── site.ts / code-blocks.ts   # 讀 dist 的觀察工具
e2e/                           # npm run test:e2e：Playwright 瀏覽器測試
├── magic-steps.spec.ts        # 程式碼動畫
├── demos.spec.ts              # 兩個互動 demo
├── theme.spec.ts              # 主題切換與保留
├── mobile.spec.ts             # 手機版面、首頁與文章頁的側欄選單
├── home.spec.ts               # 大螢幕首頁：側欄在內容區左邊、搜尋入口可見
├── dev-search.spec.ts         # 對 astro dev：搜尋框可用、搜得到草稿（playwright.config.ts 的 dev project）
└── helpers.ts                 # 測試用文章等共用工具：通用測試用「第一個主題的第一篇」（從原始碼讀出），
                               # 程式碼動畫和 demo 的測試明確指定 mobx/01-getter-setter（驗的是那篇特有的內容）
```

## 新增一篇文章

文章放在所屬主題的資料夾裡：`src/content/docs/<主題>/<篇章資料夾>/index.mdx`，網址是 `/<主題>/<篇章資料夾>/`。

篇章**一定要放在自己的子資料夾裡**。直接放在主題資料夾底下的 `.md` / `.mdx`（例如 `src/content/docs/mobx/index.mdx`、`mobx/intro.md`）
會被 Starlight 當成頁面放進側欄，卻不算篇章（首頁列表、「第 N 篇」都看不到它），所以 `npm run build` 會直接失敗，錯誤訊息會列出這些檔案。

1. 複製一篇現有文章（例如 `src/content/docs/mobx/01-getter-setter/`）到同主題底下的新資料夾，例如 `src/content/docs/mobx/02-proxy/`
2. 改 `index.mdx` 的 frontmatter（`title`、`description`、`order` 都必填，少了 build 會失敗）。`order` 是**主題內**的順序，同時決定首頁、側欄和上下篇的順序；不同主題可以各自從 1 開始。
   Starlight 的 frontmatter `prev` / `next` **不會生效**：上一篇 / 下一篇一律依同主題內的 `order` 串連（由 `src/routeData.ts` 覆寫），要調整請改 `order`
3. 在 `demos/steps/` 放每一步的程式碼，`steps.ts` 寫標題和說明
4. 文章裡用 `<MagicSteps steps={steps} />` 放動畫，互動 demo 用 `client:visible` 載入，外面包 `<div class="not-content">`，避免套到文章排版樣式

`demos/` 裡的 `.md` / `.mdx` 會被 Starlight 當成頁面；說明檔請用底線開頭（例如 `_README.md`）。

## 新增一個主題

主題是 `src/content/docs/` 底下的一個頂層資料夾。側欄群組、文章 eyebrow 的名稱都來自主題設定，元件和測試都不用改。

1. 開資料夾：`src/content/docs/<主題 slug>/`（slug 會是網址的第一段，例如 `src/content/docs/react/` → `/react/...`）
2. 在 `src/lib/topics.ts` 的 `TOPICS` 登記一筆：`slug`（和資料夾同名）、`name`（顯示名稱）、`description`（主題簡介）、`order`（主題之間的排序）
3. 放第一篇文章：`src/content/docs/<主題 slug>/01-xxx/index.mdx`，照「新增一篇文章」的步驟

`src/content/docs/` 底下有沒登記的資料夾時，`npm run build` 會直接失敗，錯誤訊息會列出資料夾名稱（檢查在 `src/lib/content-layout.ts`）。登記了但還沒有資料夾的主題不會報錯。

### 草稿

草稿可以在 frontmatter 加 `draft: true`。`npm run build` 出來的網站裡，草稿沒有頁面，也不會出現在首頁列表、側欄、上下篇和搜尋裡。
`npm run dev` 時 Starlight 會照樣顯示草稿（頁面上方有草稿提示），方便預覽，這是正常的。

自己用 `getCollection` 查文章時，Starlight 不會幫你濾掉草稿，請用 `src/lib/series.ts` 的 `publishedPostsOf(主題)`（某主題的已發布篇章）或 `publishedTopics()`（有已發布文章的主題，各附篇章）。

`src/content/docs/mobx/draft-fixture/` 是**測試用的草稿**：`npm test` 會確認它的標題、簡介和小節標題不出現在任何頁面或搜尋索引裡。
請不要刪掉它、不要把它改成 `draft: false`，也不要把它的文字用在別的地方（否則測試會失敗）。開發時在 `astro dev` 的側欄看到它是預期中的。

`src/content/docs/draft-topic/` 是**只含草稿的測試用主題**（登記在 `src/lib/topics.ts`，裡面只有一篇 `draft: true` 的篇章）。`npm test` 用它確認：

- 沒有已發布文章的主題不出現在側欄和首頁，主題名稱與簡介也不在任何頁面或搜尋索引裡
- `mobx` 以外的主題，草稿同樣在全站隱藏，也不算進任何主題的「共 M 篇」
- 測試工具確實掃到了 `mobx` 以外的主題資料夾（只掃到一個主題時測試會失敗）

請不要刪掉這個資料夾或它在主題設定的登記，也不要把裡面的篇章改成 `draft: false`。`astro dev` 時側欄看得到這個主題和草稿提示，這是預期中的。

## 設計備註

- **Magic move 在 build 時預編譯**：`MagicSteps.astro` 在伺服器端跑 Shiki，把每一步轉成 keyed tokens 的 JSON 傳給 island。瀏覽器只載入約 25KB 的動畫元件，不需要 Shiki 和語法檔。
- **每個 demo 自己建 store**：避免不同篇、不同 demo 互相影響。
- **改程式碼主題**：程式碼動畫（MagicSteps）和一般程式碼區塊（Starlight 的 Expressive Code）共用 `src/lib/highlighter.ts` 的 `CODE_THEME`。
  Expressive Code 的設定在 `src/lib/code-blocks.ts`（`astro.config.mjs` 和測試都讀這一份）。換主題時，`src/styles/theme.css` 的 `--code-bg` 也要改成新主題的背景色；`npm test` 會檢查兩邊配色是否一致。
- **介面語系是 `zh-Hant-TW`，介面字串自己提供**：規格要求 `<html lang="zh-Hant-TW">`，但 Starlight 內建的繁中翻譯只對得到 `zh-TW`
  （它去掉地區碼的規則會把 `zh-Hant-TW` 變成對不到的 `zhnt-TW`），對不到時會直接在頁面上輸出 `search.label` 這類 key。
  所以 `src/content/i18n/zh-Hant-TW.json` 是一份完整的繁中字典（從 Starlight 內建的 zh-TW 複製，再補上仍是英文的幾條、把上下篇改成「上一篇／下一篇」），**取代**內建翻譯。
  代價是升級 Starlight 時，新加的介面字串不會自動有翻譯；`npm test` 會比對 Starlight 的英文字典，缺哪一條就會失敗，照著補上即可。
- **字體自己打包（@fontsource），每套字體選實際下載量較小的版本**：在 light 主題、1280 寬、無快取下量測首頁和文章頁實際下載的 woff2，加上 render-blocking CSS 裡該字體的 `@font-face`（gzip 後）：

  | 字體 | 可變字體（首頁 / 文章頁 / 首頁→文章頁） | 靜態字重（首頁 / 文章頁 / 首頁→文章頁） | 採用 |
  |---|---|---|---|
  | Noto Sans TC（400 / 500 / 700） | 865+45 / 937+45 / 937+45 KB | 461+164 / 799+164 / 799+164 KB | 靜態 |
  | Noto Serif TC（600 / 900） | 540+42 / 441+42 / 540+42 KB | 379+113 / 423+113 / 527+113 KB | 可變 |
  | JetBrains Mono（400 / 600） | 40+3 / 40+3 / 40+3 KB | 43+14 / 43+14 / 43+14 KB | 可變 |

  內文的 Noto Sans TC 每種情境都是靜態字重較小（首頁少約 285 KB）；可變字體一組切片涵蓋所有字重，但每片都比較大。
  標題的 Noto Serif TC 用字少、只在大標用到兩個字重，連續看兩頁時可變字體較小，就留著可變字體。
  代價是 render-blocking CSS 變大：全站 CSS gzip 後從約 105 KB 變成約 223 KB（靜態字重每個字重都要一整組 `@font-face`）。
  字型檔本身用 `font-display: swap`，不會擋住畫面。
- **測試只看 build 產出，有三個刻意的例外**：`tests/` 的測試原則上只觀察 `npm run build` 產出的 `dist/`（預期值來自原始碼和設定），不碰內部實作。
  - `tests/pagination.test.ts` 直接測上下篇的純函式（`src/lib/pagination.ts`）。現在只有一個已發布的主題，build 產出裡看不到「跨主題」的情況，
    觀察 `dist/` 證明不了上下篇不會跨過主題邊界，所以直接餵多個主題群組的側欄。之後有第二個已發布主題時，`site.test.ts` 的上下篇測試也會涵蓋到。
  - `tests/content-layout.test.ts` 直接測內容目錄檢查（`src/lib/content-layout.ts`）。它負責讓 build 失敗，失敗時沒有 `dist/` 可看，
    也不能在真的內容目錄裡放壞掉的檔案，所以對暫存的內容目錄呼叫同一個檢查。
  - `tests/dev-search-crawl.test.ts`、`tests/dev-search-cache.test.ts` 直接測 dev 搜尋的抓頁與索引快取（`src/lib/dev-search/`）。
    那是 `astro dev` 才有的行為，`dist/` 裡看不到；瀏覽器端的行為另由 `e2e/dev-search.spec.ts` 對 dev server 驗證。
- **dev 搜尋改寫了 Starlight 的搜尋元件**：Starlight 在 dev 時刻意關掉搜尋（`Search.astro` 判斷 `import.meta.env.DEV`），
  `src/lib/dev-search/integration.ts` 在 dev 時把它換成 `false`（元件和瀏覽器端 script 兩份都要改）。升級 Starlight 後若元件裡找不到這個判斷，
  dev 會直接報錯；若只有 script 那份改了寫法，`e2e/dev-search.spec.ts` 會失敗。`astro build` 不受影響。
- **之後要部署到 Void / Cloudflare**：目前是純靜態輸出，在 `astro.config.mjs` 加 adapter 即可。
