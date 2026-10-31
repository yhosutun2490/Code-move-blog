/**
 * dev 搜尋的索引快取（src/lib/dev-search/index-cache.ts）。
 *
 * 刻意例外：這是 astro dev 才有的行為，dist/ 裡看不到，所以直接測函式，用假的 build 代替 Pagefind。
 */
import { describe, expect, test } from 'vitest'
import { createIndexCache, type BuiltIndex } from '../src/lib/dev-search/index-cache'

/** 假的建索引函式：每次呼叫產生一份新索引，記錄建了幾次、哪幾份被釋放 */
function fakeBuild() {
  let builds = 0
  const disposed: number[] = []
  const build = async (): Promise<BuiltIndex> => {
    const id = ++builds
    return {
      files: new Map([['/pagefind/pagefind.js', new TextEncoder().encode(`build ${id}`)]]),
      dispose: async () => {
        disposed.push(id)
      },
    }
  }
  return { build, disposed, builds: () => builds }
}

const text = (files: Map<string, Uint8Array>) =>
  new TextDecoder().decode(files.get('/pagefind/pagefind.js'))

describe('dev 搜尋：索引快取', () => {
  test('第一次 get 才建索引；之後的 get（含同時發出的）都用同一份', async () => {
    const fake = fakeBuild()
    const cache = createIndexCache(fake.build)
    expect(fake.builds()).toBe(0)
    const [a, b] = await Promise.all([cache.get(), cache.get()])
    expect(fake.builds()).toBe(1)
    expect(await cache.get()).toBe(a)
    expect(b).toBe(a)
  })

  test('invalidate 之後，下一次 get 重建，舊的那份被釋放', async () => {
    const fake = fakeBuild()
    const cache = createIndexCache(fake.build)
    expect(text(await cache.get())).toBe('build 1')
    cache.invalidate()
    expect(fake.builds()).toBe(1) // 不會馬上重建
    expect(text(await cache.get())).toBe('build 2')
    expect(fake.disposed).toEqual([1])
  })

  test('建立中途 invalidate：進行中的 get 拿到舊的那份，下一次 get 重建', async () => {
    const fake = fakeBuild()
    const cache = createIndexCache(fake.build)
    const pending = cache.get()
    cache.invalidate()
    expect(text(await pending)).toBe('build 1')
    expect(text(await cache.get())).toBe('build 2')
    await Promise.resolve()
    expect(fake.disposed).toEqual([1])
  })

  test('建立失敗時 get 丟出錯誤，下一次 get 會重試', async () => {
    let attempts = 0
    const cache = createIndexCache(async () => {
      attempts++
      if (attempts === 1) throw new Error('Pagefind 壞了')
      return { files: new Map(), dispose: async () => {} }
    })
    await expect(cache.get()).rejects.toThrow('Pagefind 壞了')
    await expect(cache.get()).resolves.toBeInstanceOf(Map)
    expect(attempts).toBe(2)
  })

  test('close 釋放目前那份；之後再 get 會重建', async () => {
    const fake = fakeBuild()
    const cache = createIndexCache(fake.build)
    await cache.get()
    await cache.close()
    expect(fake.disposed).toEqual([1])
    expect(text(await cache.get())).toBe('build 2')
  })
})
