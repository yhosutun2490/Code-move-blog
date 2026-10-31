// dev 搜尋的索引快取：第一次有人要索引時才建（不拖慢 astro dev 啟動），
// 內容變動時標成過期、下次要的時候重建；建立失敗就丟掉，下次再試。

export interface BuiltIndex {
  /** 網址路徑（例如 /pagefind/pagefind.js）→ 檔案內容 */
  files: Map<string, Uint8Array>
  /** 釋放這份索引佔用的資源（Pagefind 的 deleteIndex） */
  dispose(): Promise<void>
}

export interface IndexCache {
  /** 目前的索引檔；沒有或已過期就建一份（同時呼叫只會建一次） */
  get(): Promise<Map<string, Uint8Array>>
  /** 標成過期：下一次 get 重建，舊的那份建好後釋放 */
  invalidate(): void
  /** 釋放目前那份（dev server 關閉時用） */
  close(): Promise<void>
}

export function createIndexCache(build: () => Promise<BuiltIndex>): IndexCache {
  let current: Promise<BuiltIndex> | undefined

  const release = (old: Promise<BuiltIndex> | undefined) =>
    old?.then(
      (built) => built.dispose(),
      () => {}, // 建失敗的那份沒有東西要釋放
    )

  return {
    get() {
      if (!current) {
        const building: Promise<BuiltIndex> = build().catch((error: unknown) => {
          if (current === building) current = undefined
          throw error
        })
        current = building
      }
      return current.then((built) => built.files)
    },
    invalidate() {
      const old = current
      current = undefined
      void release(old)
    },
    async close() {
      const old = current
      current = undefined
      await release(old)
    },
  }
}
