/**
 * dev 搜尋的索引快取（src/lib/dev-search/index-cache.ts）。
 *
 * 刻意例外：這是 astro dev 才有的行為，dist/ 裡看不到，所以直接測函式，用假的 build 代替 Pagefind。
 */
import { describe, expect, test, vi } from 'vitest'
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
        await new Promise((resolve) => setTimeout(resolve, 0))
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
    await vi.waitFor(() => expect(fake.disposed).toEqual([1]))
  })

  test('建立中途 invalidate：進行中的 get 拿到舊的那份，下一次 get 重建', async () => {
    const fake = fakeBuild()
    const cache = createIndexCache(fake.build)
    const pending = cache.get()
    cache.invalidate()
    expect(text(await pending)).toBe('build 1')
    expect(text(await cache.get())).toBe('build 2')
    await vi.waitFor(() => expect(fake.disposed).toEqual([1]))
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

  test('舊的建立晚一步失敗，不會清掉較新的那份', async () => {
    let builds = 0
    let rejectFirst!: (error: Error) => void
    const cache = createIndexCache(() => {
      const id = ++builds
      if (id === 1) {
        return new Promise<BuiltIndex>((_, reject) => {
          rejectFirst = reject
        })
      }
      return Promise.resolve({
        files: new Map([['/pagefind/pagefind.js', new TextEncoder().encode(`build ${id}`)]]),
        dispose: async () => {},
      })
    })
    const first = cache.get()
    const firstFails = expect(first).rejects.toThrow('第一份壞了')
    cache.invalidate()
    const second = cache.get()
    rejectFirst(new Error('第一份壞了'))
    await firstFails
    expect(text(await second)).toBe('build 2')
    expect(text(await cache.get())).toBe('build 2')
    expect(builds).toBe(2)
  })

  test('舊索引釋放失敗不會變成未處理的 rejection', async () => {
    let builds = 0
    const cache = createIndexCache(async () => {
      const id = ++builds
      return {
        files: new Map([['/pagefind/pagefind.js', new TextEncoder().encode(`build ${id}`)]]),
        dispose: async () => {
          throw new Error('釋放失敗')
        },
      }
    })
    await cache.get()
    cache.invalidate()
    expect(text(await cache.get())).toBe('build 2')
    await new Promise((resolve) => setTimeout(resolve, 10))
  })
})
