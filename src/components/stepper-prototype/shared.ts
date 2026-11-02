// PROTOTYPE — 程式碼步驟版型原型的共用工具，丟掉即可（見 src/components/MagicSteps.astro 頂端說明）。
import { useCallback, useState, type KeyboardEvent } from 'react'
import type { KeyedTokensInfo } from 'shiki-magic-move/types'

export interface StepperProps {
  steps: KeyedTokensInfo[]
  meta: { title: string; note: string }[]
  /** 每一步的原始碼，用來算「這一步新增 / 改了哪幾行」 */
  codes: string[]
}

/** 目前步驟 + 夾在範圍內的 go() + 方向鍵處理（會 preventDefault，讓原型切換列不搶） */
export function useStep(count: number) {
  const [step, setStep] = useState(0)
  const go = useCallback((next: number) => setStep(Math.min(Math.max(next, 0), count - 1)), [count])
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    go(step + (e.key === 'ArrowRight' ? 1 : -1))
  }
  return { step, go, onKeyDown, last: count - 1 }
}

/**
 * 這一步相對於上一步「新增或改過」的行號（0 起算）。
 * 用最長共同子序列比對整行（忽略前後空白），沒對上的就是變更行；第一步沒有上一步，回傳空陣列。
 */
export function changedLines(prev: string | undefined, next: string): number[] {
  if (prev === undefined) return []
  const a = prev.trimEnd().split('\n').map((l) => l.trim())
  const b = next.trimEnd().split('\n').map((l) => l.trim())
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  const kept = new Set<number>()
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] === b[j]) {
      kept.add(j)
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++
    else j++
  }
  return b.map((_, j) => j).filter((j) => !kept.has(j) && b[j] !== '')
}
