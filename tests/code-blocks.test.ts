import { describe, expect, it } from 'vitest'
import {
  charColorsOfBlock,
  charColorsOfStep,
  codeBlockStylesheet,
  declaredValues,
  magicStepsOf,
  renderCodeBlock,
  resolveCssValue,
  ruleValue,
} from './code-blocks'
import { loadPage, postUrl, publishedPosts, textOf } from './site'

describe('一般程式碼區塊', () => {
  const code = 'const cart = { qty: 1 }\ncart.qty = 2\ncart.qty = 3\nrender()'

  it('有複製按鈕，複製的是整段程式碼', async () => {
    const block = await renderCodeBlock(code, 'js')
    const copy = block.querySelector('.copy button')
    expect(copy, '沒有複製按鈕').not.toBeNull()
    const copied = copy!.getAttribute('data-code')!.replace(/\u007f/g, '\n')
    expect(copied).toBe(code)
  })

  it('可以顯示檔名標題', async () => {
    const block = await renderCodeBlock(code, 'js', 'title="cart.js"')
    const title = block.querySelector('figure .title')
    expect(title && textOf(title)).toBe('cart.js')
  })

  it('可以標出重點行、新增的行和刪除的行', async () => {
    const block = await renderCodeBlock(code, 'js', '{4} ins={3} del={2}')
    const lines = block.querySelectorAll('.ec-line')
    expect(lines).toHaveLength(4)
    const marks = lines.map((l) =>
      ['mark', 'ins', 'del'].filter((c) => l.classList.contains(c)),
    )
    expect(marks).toEqual([[], ['del'], ['ins'], ['mark']])
  })
})

describe('程式碼動畫不受文章排版樣式影響', () => {
  // Starlight 的文章樣式全部寫成 :not(:where(.not-content *))，
  // 放在 .not-content 裡的元素就不會被套到 ol / p / pre / button 的間距和字型
  it.each(withMagicSteps.map((p) => [postUrl(p)] as const))(
    '%s 的每個程式碼動畫都在 not-content 區塊裡',
    (url) => {
      const islands = loadPage(url)
        .querySelectorAll('astro-island')
        .filter((el) => /"tokens"/.test(el.getAttribute('props') ?? ''))
      expect(islands.length).toBeGreaterThan(0)
      for (const island of islands) {
        expect(island.closest('.not-content'), `${url} 的程式碼動畫沒有包在 not-content 裡`).not.toBeNull()
      }
    },
  )
})

describe('一般程式碼區塊融入紙張風格（和程式碼動畫同一套外框與字體）', () => {
  // 預期值來自 build 出來的程式碼動畫樣式；兩邊都解析到實際值再比
  const resolved = (value: string) => new Set(resolveCssValue(value))
  const ecValue = (prop: string) => {
    const values = declaredValues(codeBlockStylesheet(), prop)
    expect(values.length, `程式碼區塊樣式沒有 ${prop}`).toBeGreaterThan(0)
    return new Set(values.flatMap((v) => resolveCssValue(v)))
  }

  it('圓角相同', () => {
    expect(ecValue('--ec-brdRad')).toEqual(resolved(ruleValue('.stepper', 'border-radius')))
  })

  it('外框顏色相同', () => {
    const border = ruleValue('.stepper', 'border')
    const color = border.match(/var\([^)]*\)|#[0-9a-fA-F]+$/)![0]
    expect(ecValue('--ec-brdCol')).toEqual(resolved(color))
  })

  it('等寬字體相同', () => {
    const font = ruleValue('.stepper-code .shiki-magic-move-container', 'font-family')
    expect(ecValue('--ec-codeFontFml')).toEqual(resolved(font))
  })
})

const posts = publishedPosts()
const withMagicSteps = posts.filter((p) => /<MagicSteps\b/.test(p.body))
// 程式碼動畫的配色是預期值的來源：一般程式碼區塊要和它一致
const magicSteps = withMagicSteps.flatMap((p) => magicStepsOf(loadPage(postUrl(p)))).flat()

describe('一般程式碼區塊和程式碼動畫配色一致', () => {
  it('找得到程式碼動畫的配色（避免測試空轉）', () => {
    expect(magicSteps.length).toBeGreaterThan(0)
  })

  it('程式碼區塊的文字顏色和程式碼動畫相同', () => {
    const fgs = new Set(magicSteps.map((s) => s.fg.toLowerCase()))
    const ecFgs = declaredValues(codeBlockStylesheet(), '--ec-codeFg')
      .flatMap((v) => resolveCssValue(v))
      .map((v) => v.toLowerCase())
    expect(ecFgs.length).toBeGreaterThan(0)
    expect(new Set(ecFgs)).toEqual(fgs)
  })

  it('程式碼區塊的背景在每種主題下都和程式碼動畫相同', () => {
    const bgs = new Set(magicSteps.map((s) => s.bg.toLowerCase()))
    const ecBgs = declaredValues(codeBlockStylesheet(), '--ec-codeBg')
      .flatMap((v) => resolveCssValue(v))
      .map((v) => v.toLowerCase())
    expect(ecBgs.length).toBeGreaterThan(0)
    expect(new Set(ecBgs)).toEqual(bgs)
  })

  it('同一段程式碼，每個字的語法顏色都和程式碼動畫相同', async () => {
    for (const step of magicSteps) {
      const block = await renderCodeBlock(step.code, 'js')
      const ec = charColorsOfBlock(block, step.fg)
      const motion = charColorsOfStep(step)
      expect(ec.map((c) => c.char).join('')).toBe(motion.map((c) => c.char).join(''))
      const diff = ec.findIndex((c, i) => c.color !== motion[i].color)
      if (diff !== -1) {
        const line = step.code.split('\n').find((l) => l.includes(ec[diff].char)) ?? ''
        expect.fail(
          `「${ec[diff].char}」（${line.trim()}）在程式碼區塊是 ${ec[diff].color}，在程式碼動畫是 ${motion[diff].color}`,
        )
      }
    }
  })
})
