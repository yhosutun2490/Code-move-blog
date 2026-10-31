import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertTopicFoldersRegistered } from './topics'

// 內容目錄的版面檢查：astro.config.mjs 載入時對 src/content/docs/ 執行，不符合就丟出錯誤讓 build 失敗。
//
// 篇章一定是 <主題>/<資料夾>/index.mdx。直接放在主題資料夾底下的 .md / .mdx（例如 mobx/index.mdx）
// 會被 Starlight 當成頁面、出現在側欄，卻不算篇章（首頁列表、eyebrow 都看不到它），所以直接擋下。

/** 檢查內容目錄：每個頂層資料夾都是登記過的主題，主題資料夾底下沒有直接放 .md / .mdx */
export function assertContentLayout(docsDir: string | URL): void {
  const dir = docsDir instanceof URL ? fileURLToPath(docsDir) : docsDir
  const topicFolders = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
  assertTopicFoldersRegistered(topicFolders)

  const looseFiles = topicFolders.flatMap((topic) =>
    readdirSync(join(dir, topic), { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.mdx?$/i.test(entry.name))
      .map((entry) => `${topic}/${entry.name}`),
  )
  if (looseFiles.length === 0) return
  throw new Error(
    `src/content/docs/ 的主題資料夾底下直接放了文章檔：${looseFiles.join('、')}。` +
      `篇章要放在自己的資料夾裡：src/content/docs/<主題>/<資料夾>/index.mdx（例如 mobx/02-proxy/index.mdx），` +
      `網址是 /<主題>/<資料夾>/。`,
  )
}
