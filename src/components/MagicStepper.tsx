import { useCallback, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { ShikiMagicMovePrecompiled } from 'shiki-magic-move/react'
import type { KeyedTokensInfo } from 'shiki-magic-move/types'
import 'shiki-magic-move/dist/style.css'

interface Props {
  steps: KeyedTokensInfo[]
  meta: { title: string; note: string }[]
  /** 每一步相對於上一步新增 / 改過的行號（build 時由 MagicSteps.astro 算好） */
  changed: number[][]
}

// 版型（樣式在 global.css 的 .stepper）：
// - 寬螢幕：左邊直的步驟軌道，目前步驟底下展開說明；右邊程式碼。
// - 窄螢幕：軌道改成橫排編號，說明移到程式碼上方，按鈕在程式碼下方。
// 說明在兩處各畫一份（軌道裡、程式碼上方），CSS 依螢幕寬度只顯示其中一份（另一份 display: none，輔助科技也不會讀到）。
export default function MagicStepper({ steps, meta, changed }: Props) {
  const [step, setStep] = useState(0)
  const last = steps.length - 1

  const go = useCallback(
    (next: number) => setStep(Math.min(Math.max(next, 0), last)),
    [last],
  )

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') go(step + 1)
    if (e.key === 'ArrowLeft') go(step - 1)
  }

  const current = meta[step]
  const lines = changed[step]
  const badge = lines.length > 0 && <span className="stepper-badge">+{lines.length} 行</span>

  return (
    <figure className="stepper" tabIndex={0} onKeyDown={onKeyDown}>
      <ol
        className="stepper-rail"
        aria-label="步驟"
        // 窄螢幕橫排時的進度線長度：0 = 第一步，1 = 最後一步
        style={{ '--progress': last > 0 ? step / last : 0 } as CSSProperties}
      >
        {meta.map((m, i) => (
          <li key={m.title} data-state={i < step ? 'done' : i === step ? 'current' : 'todo'}>
            <button
              type="button"
              aria-current={i === step ? 'step' : undefined}
              aria-label={`步驟 ${i + 1}：${m.title}`}
              onClick={() => go(i)}
            >
              <span className="stepper-num">{i + 1}</span>
              <span className="stepper-label">{m.title}</span>
            </button>
            {i === step && (
              <p className="stepper-note stepper-note-rail" aria-live="polite">
                {badge}
                {m.note}
              </p>
            )}
          </li>
        ))}
      </ol>

      <p className="stepper-note stepper-note-top" aria-live="polite">
        <span className="stepper-count">
          步驟 {step + 1} / {steps.length}
          {badge}
        </span>
        <strong>{current.title}</strong>
        {current.note}
      </p>

      <div className="stepper-code">
        <ShikiMagicMovePrecompiled steps={steps} step={step} options={{ duration: 650 }} />
        {/* 變更行標示疊在程式碼上；key={step} 讓換步驟時重新淡入（等動畫跑完） */}
        <div className="stepper-marks" key={step} aria-hidden="true">
          {lines.map((line) => (
            <span key={line} style={{ '--line': line } as CSSProperties} />
          ))}
        </div>
      </div>

      <div className="stepper-nav">
        <button type="button" onClick={() => go(step - 1)} disabled={step === 0}>
          ← 上一步
        </button>
        <button type="button" onClick={() => go(step + 1)} disabled={step === last}>
          下一步 →
        </button>
      </div>
    </figure>
  )
}
