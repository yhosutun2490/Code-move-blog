// dev 搜尋：讓 Starlight 的搜尋在 astro dev 也能用（astro build 完全不受影響）。
//
// Starlight 的 Search.astro 在 dev 時刻意關掉搜尋：畫面只放「正式版本才能使用搜尋功能」，
// 瀏覽器端的 script 也直接 return。這裡做兩件事：
// 1. 改寫 Search.astro 的元件本身和瀏覽器端 script，把 import.meta.env.DEV 換成 false。
//    Astro 是從磁碟上的原始檔拆出 <script>，所以兩個 module 都要改。
// 2. 在 dev server 提供 /pagefind/*：從 dev server 自己抓頁面建索引，放在記憶體；
//    src/content/ 有變動就標成過期，下次請求重建（讀者重新整理頁面就會載入新索引）。
import { join, sep } from 'node:path'
import type { AstroIntegration, AstroIntegrationLogger } from 'astro'
import type { Plugin } from 'vite'
import { crawlPages } from './crawl'
import { createIndexCache } from './index-cache'
import { buildPagefindIndex, closePagefind } from './pagefind-index'

const SEARCH_COMPONENT = /\/@astrojs\/starlight\/dist\/components\/Search\.astro$/
const DEV_GATE = 'import.meta.env.DEV'

/** 把 Starlight 搜尋元件裡的 dev 判斷拿掉 */
function unlockSearchComponent(): Plugin {
  return {
    name: 'dev-search:unlock-search-component',
    apply: 'serve',
    enforce: 'pre',
    transform(code, id) {
      const [path, query = ''] = id.split('?')
      if (!SEARCH_COMPONENT.test(path)) return
      const isComponent = query === ''
      const isClientScript = query.includes('type=script')
      if (!isComponent && !isClientScript) return
      if (code.includes(DEV_GATE)) return code.replaceAll(DEV_GATE, 'false')
      // SSR 那份 script module 是空的佔位內容，本來就沒有這個判斷
      if (isComponent) {
        throw new Error(
          `dev 搜尋：在 Starlight 的 Search.astro 裡找不到 ${DEV_GATE}。` +
            `Starlight 可能改了 dev 時關閉搜尋的寫法，請更新 src/lib/dev-search/integration.ts。`,
        )
      }
    },
  }
}

const CONTENT_TYPES: Record<string, string> = {
  js: 'text/javascript',
  css: 'text/css',
  json: 'application/json',
}

function contentTypeOf(path: string): string {
  const extension = path.split('.').pop() ?? ''
  return CONTENT_TYPES[extension] ?? 'application/octet-stream'
}

/** 在 dev server 提供 /pagefind/*，內容變動時讓索引過期 */
function serveDevIndex(logger: AstroIntegrationLogger): Plugin {
  return {
    name: 'dev-search:serve-index',
    apply: 'serve',
    configureServer(server) {
      const cache = createIndexCache(async () => {
        const started = performance.now()
        // 從 dev server 自己的網址抓頁面（實際 port 在 server 啟動後才知道）
        const origin = server.resolvedUrls?.local[0]
        if (!origin) throw new Error('dev 搜尋：找不到 dev server 的網址')
        const pages = await crawlPages(origin)
        const built = await buildPagefindIndex(pages)
        logger.info(`dev 搜尋索引：${pages.length} 頁，${Math.round(performance.now() - started)}ms`)
        return built
      })

      const contentDir = join(server.config.root, 'src', 'content') + sep
      // 檔案事件比 Astro 內容層重新同步早一點：這瞬間的 /pagefind/ 請求可能存到舊內容，直到下次編輯（可接受）
      server.watcher.on('all', (_event, file) => {
        if (file.startsWith(contentDir)) cache.invalidate()
      })
      server.httpServer?.once('close', () => {
        // 不論釋放索引成不成功都關掉 Pagefind；關閉時的清理失敗不影響 dev server 結束
        void cache.close().finally(closePagefind).catch(() => {})
      })

      // 直接 use（不 return 函式）：排在 Vite 內建 middleware 之前，
      // Vite 才不會把 /pagefind/pagefind.js 當成要轉換的模組。
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0] ?? ''
        if (!path.startsWith('/pagefind/')) return next()
        try {
          const body = (await cache.get()).get(path)
          if (!body) {
            res.statusCode = 404
            res.end()
            return
          }
          res.setHeader('Content-Type', contentTypeOf(path))
          res.setHeader('Cache-Control', 'no-store')
          res.end(body)
        } catch (error) {
          logger.error(`dev 搜尋索引建立失敗：${error instanceof Error ? error.message : String(error)}`)
          res.statusCode = 500
          res.end()
        }
      })
    },
  }
}

/** 只在 astro dev 掛上；astro build 時什麼都不做 */
export function devSearch(): AstroIntegration {
  return {
    name: 'dev-search',
    hooks: {
      'astro:config:setup': ({ command, updateConfig, logger }) => {
        if (command !== 'dev') return
        updateConfig({ vite: { plugins: [unlockSearchComponent(), serveDevIndex(logger)] } })
      },
    },
  }
}
