/**
 * 上一篇 / 下一篇的計算（route middleware 用的純函式）。
 *
 * 現在只有一個已發布主題，build 產出看不到「跨主題」的情況，
 * 所以這裡直接餵多個主題群組的側欄，確認分頁不會跨過群組。
 * 主要的行為檢查仍在 site.test.ts（觀察 build 出來的網站）。
 */
import { describe, expect, it } from 'vitest'
import type { StarlightRouteData } from '@astrojs/starlight/route-data'
import { paginationWithinGroup } from '../src/lib/pagination'

type Entry = StarlightRouteData['sidebar'][number]

const link = (href: string, current = false): Entry => ({
  type: 'link',
  label: href,
  href,
  isCurrent: current,
  badge: undefined,
  attrs: {},
})

const group = (label: string, entries: Entry[]): Entry => ({
  type: 'group',
  label,
  entries,
  collapsed: false,
  badge: undefined,
})

/** 兩個主題群組的側欄，current 是目前頁面的網址 */
const sidebar = (current?: string): Entry[] => {
  const l = (href: string) => link(href, href === current)
  return [
    group('主題 A', [l('/a/1/'), l('/a/2/'), l('/a/3/')]),
    group('主題 B', [l('/b/1/'), l('/b/2/')]),
  ]
}

const hrefs = (p: ReturnType<typeof paginationWithinGroup>) => ({
  prev: p.prev?.href,
  next: p.next?.href,
})

describe('上一篇 / 下一篇只在目前頁面所在的群組內', () => {
  it('群組中間的篇章連到同群組的前後篇', () => {
    expect(hrefs(paginationWithinGroup(sidebar('/a/2/')))).toEqual({ prev: '/a/1/', next: '/a/3/' })
  })

  it('群組最後一篇沒有下一篇，不會連到下一個群組的第一篇', () => {
    expect(hrefs(paginationWithinGroup(sidebar('/a/3/')))).toEqual({ prev: '/a/2/', next: undefined })
  })

  it('群組第一篇沒有上一篇，不會連到上一個群組的最後一篇', () => {
    expect(hrefs(paginationWithinGroup(sidebar('/b/1/')))).toEqual({ prev: undefined, next: '/b/2/' })
  })

  it('群組裡只有一篇時，上下篇都沒有', () => {
    const entries = [group('主題 A', [link('/a/1/')]), group('主題 B', [link('/b/1/', true)])]
    expect(hrefs(paginationWithinGroup(entries))).toEqual({ prev: undefined, next: undefined })
  })

  it('群組裡還有子群組時（例如 astro dev 顯示的草稿），攤平後依側欄順序串連', () => {
    const entries = [
      group('主題 A', [link('/a/1/'), group('/a/draft/', [link('/a/draft/', true)]), link('/a/2/')]),
      group('主題 B', [link('/b/1/')]),
    ]
    expect(hrefs(paginationWithinGroup(entries))).toEqual({ prev: '/a/1/', next: '/a/2/' })
  })

  it('沒有任何項目是目前頁面時（首頁、404），上下篇都沒有', () => {
    expect(hrefs(paginationWithinGroup(sidebar()))).toEqual({ prev: undefined, next: undefined })
  })

  it('目前頁面不在任何群組裡時，上下篇都沒有', () => {
    const entries = [link('/x/', true), group('主題 A', [link('/a/1/'), link('/a/2/')])]
    expect(hrefs(paginationWithinGroup(entries))).toEqual({ prev: undefined, next: undefined })
  })
})
