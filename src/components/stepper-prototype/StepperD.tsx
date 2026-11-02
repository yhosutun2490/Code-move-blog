// PROTOTYPE — D：變更聚焦。先讀說明、再看程式碼：說明放在程式碼上方當「這一步要看什麼」，
// 動畫結束後把這一步新增 / 改過的行打上底色和 + 號（對應文章裡「注意每一步多出來的那幾行」）。
// 進度用一條可點的分段列，按鈕在底部。
import { ShikiMagicMovePrecompiled } from 'shiki-magic-move/react'
import 'shiki-magic-move/dist/style.css'
import './stepper-prototype.css'
import { changedLines, useStep, type StepperProps } from './shared'

export default function StepperD({ steps, meta, codes }: StepperProps) {
  const { step, go, onKeyDown, last } = useStep(steps.length)
  const changed = changedLines(codes[step - 1], codes[step])

  return (
    <figure className="sp-d" tabIndex={0} onKeyDown={onKeyDown}>
      <header className="sp-d-head">
        <ol className="sp-d-progress" aria-label="步驟">
          {meta.map((m, i) => (
            <li key={m.title}>
              <button
                type="button"
                title={m.title}
                aria-label={`步驟 ${i + 1}：${m.title}`}
                aria-current={i === step ? 'step' : undefined}
                data-done={i < step || undefined}
                onClick={() => go(i)}
              />
            </li>
          ))}
        </ol>
        <p className="sp-d-note" aria-live="polite">
          <span className="sp-d-kicker">
            步驟 {step + 1} / {steps.length}
            {changed.length > 0 && <span className="sp-d-badge">+{changed.length} 行</span>}
          </span>
          <strong>{meta[step].title}</strong>
          {meta[step].note}
        </p>
      </header>
      <div className="sp-code sp-d-code">
        <ShikiMagicMovePrecompiled steps={steps} step={step} options={{ duration: 650 }} />
        {/* 疊在程式碼上面的半透明標示；key={step}：換步驟時重建，讓標示重新淡入（等動畫跑完） */}
        <div className="sp-d-marks" key={step} aria-hidden="true">
          {changed.map((line) => (
            <span key={line} style={{ top: `calc(1.25rem + ${line} * 1.386rem)` }} />
          ))}
        </div>
      </div>
      <footer className="sp-d-nav">
        <button type="button" onClick={() => go(step - 1)} disabled={step === 0}>
          ← 上一步
        </button>
        <button type="button" onClick={() => go(step + 1)} disabled={step === last}>
          下一步 →
        </button>
      </footer>
    </figure>
  )
}
