/**
 * 程式碼動畫的變更行計算（MagicSteps.astro 在 build 時用的純函式）。
 * 頁面上的標示由 site / e2e 測試從 build 結果觀察，這裡只確認比對規則本身。
 */
import { describe, expect, it } from 'vitest'
import { changedLines } from '../src/lib/line-diff'

const code = (...lines: string[]) => lines.join('\n')

describe('changedLines：這一步新增或改過的行', () => {
  it('第一步沒有上一步可比，不標任何行', () => {
    expect(changedLines(undefined, code('a', 'b'))).toEqual([])
  })

  it('內容相同時沒有變更行', () => {
    expect(changedLines(code('a', 'b'), code('a', 'b'))).toEqual([])
  })

  it('在中間插入的行被標出，前後原有的行不標', () => {
    expect(changedLines(code('a', 'c'), code('a', 'b1', 'b2', 'c'))).toEqual([1, 2])
  })

  it('改過內容的行被標出', () => {
    expect(changedLines(code('a', 'b', 'c'), code('a', 'B', 'c'))).toEqual([1])
  })

  it('只改縮排不算改過', () => {
    expect(changedLines(code('if (x) {', 'run()', '}'), code('if (x) {', '  run()', '}'))).toEqual([])
  })

  it('新增的空白行不標', () => {
    expect(changedLines(code('a', 'b'), code('a', '', 'b'))).toEqual([])
  })

  it('只刪除行時沒有變更行', () => {
    expect(changedLines(code('a', 'b', 'c'), code('a', 'c'))).toEqual([])
  })

  it('結尾的換行不影響行號', () => {
    expect(changedLines('a\n', 'a\nb\n')).toEqual([1])
  })
})
