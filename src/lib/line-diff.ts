// 程式碼動畫的「這一步改了哪幾行」：MagicSteps.astro 在 build 時對每一步算一次，
// island 只拿到行號，把那幾行標成新增 / 改過（對應文章裡「注意每一步多出來的那幾行」）。
//
// 純函式，不依賴 Astro，元件和測試都直接用。

/**
 * next 相對於 prev「新增或改過」的行號（0 起算，依序）。
 *
 * 用最長共同子序列比對整行，比對時忽略每行前後的空白（只改縮排不算改過）；
 * 沒對上的非空白行就是變更行。prev 是 undefined（第一步）時回傳空陣列：沒有上一步可比，不標任何行。
 */
export function changedLines(prev: string | undefined, next: string): number[] {
  if (prev === undefined) return []
  const a = linesOf(prev)
  const b = linesOf(next)

  // lcs[i][j] = a[i..] 和 b[j..] 的最長共同子序列長度
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const kept = new Set<number>()
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] === b[j]) {
      kept.add(j)
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      i++
    } else {
      j++
    }
  }
  return b.flatMap((line, j) => (!kept.has(j) && line !== '' ? [j] : []))
}

const linesOf = (code: string) =>
  code
    .trimEnd()
    .split('\n')
    .map((line) => line.trim())
