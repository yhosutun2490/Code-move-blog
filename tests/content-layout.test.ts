/**
 * 內容目錄的版面檢查（astro.config.mjs 載入時執行，失敗就讓 build 失敗）。
 *
 * 「只測 build 產出」原則的刻意例外：build 失敗沒有 dist/ 可以觀察，
 * 又不能為了測試在真的內容目錄裡放壞掉的檔案，所以對暫存的內容目錄直接呼叫同一個檢查。
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { assertContentLayout } from '../src/lib/content-layout'

let docs: string | undefined

/** 建一個暫存的內容目錄，放進指定的檔案（相對路徑） */
function docsWith(files: string[]): string {
  docs = mkdtempSync(join(tmpdir(), 'docs-'))
  for (const file of files) {
    mkdirSync(dirname(join(docs, file)), { recursive: true })
    writeFileSync(join(docs, file), '---\ntitle: x\n---\n')
  }
  return docs
}

afterEach(() => {
  if (docs) rmSync(docs, { recursive: true, force: true })
  docs = undefined
})

describe('內容目錄版面', () => {
  it('篇章都在 <主題>/<資料夾>/index.mdx 時通過', () => {
    const dir = docsWith(['mobx/01-a/index.mdx', 'mobx/02-b/index.md', 'mobx/01-a/demos/steps.ts'])
    expect(() => assertContentLayout(dir)).not.toThrow()
  })

  it('主題資料夾底下直接放 .md / .mdx 時失敗，列出檔案並說明該放哪裡', () => {
    const dir = docsWith(['mobx/01-a/index.mdx', 'mobx/index.mdx', 'mobx/intro.md'])
    expect(() => assertContentLayout(dir)).toThrow(/mobx\/index\.mdx/)
    expect(() => assertContentLayout(dir)).toThrow(/mobx\/intro\.md/)
    expect(() => assertContentLayout(dir)).toThrow(/<主題>\/<資料夾>\/index\.mdx/)
  })

  it('有沒登記的主題資料夾時失敗，列出資料夾名稱', () => {
    const dir = docsWith(['not-a-topic/01-a/index.mdx'])
    expect(() => assertContentLayout(dir)).toThrow(/not-a-topic/)
  })
})
