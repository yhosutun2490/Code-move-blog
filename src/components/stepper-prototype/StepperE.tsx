// PROTOTYPE — E：B 的步驟軌道 + D 的變更標示。
// 寬螢幕：左邊直的軌道（目前步驟展開說明與「+N 行」），右邊程式碼，動畫後標出新增 / 改過的行。
// 窄螢幕：軌道改成橫的一排編號（線連起來），說明移到編號下面、程式碼上面，按鈕在程式碼下面。
// 說明畫兩份（軌道裡一份、獨立一份），用 CSS 依螢幕寬度只顯示其中一份。
import type React from 'react'
import { ShikiMagicMovePrecompiled } from 'shiki-magic-move/react'
import 'shiki-magic-move/dist/style.css'
import './stepper-prototype.css'
import { changedLines, useStep, type StepperProps } from './shared'

export default function StepperE({ steps, meta, codes }: StepperProps) {
  const { step, go, onKeyDown, last } = useStep(steps.length)
  const changed = changedLines(codes[step - 1], codes[step])
  const badge = changed.length > 0 && <span className="sp-d-badge">+{changed.length} 行</span>

  const nav = (
    <div className="sp-e-nav">
      <button type="button" onClick={() => go(step - 1)} disabled={step === 0}>
        ← 上一步
      </button>
      <button type="button" onClick={() => go(step + 1)} disabled={step === last}>
        下一步 →
      </button>
    </div>
  )

  return (
    <figure className="sp-e" tabIndex={0} onKeyDown={onKeyDown}>
      <ol
        className="sp-e-rail"
        aria-label="步驟"
        style={{ '--progress': last > 0 ? step / last : 0 } as React.CSSProperties}
      >
        {meta.map((m, i) => (
          <li key={m.title} data-state={i < step ? 'done' : i === step ? 'current' : 'todo'}>
            <button
              type="button"
              onClick={() => go(i)}
              aria-current={i === step ? 'step' : undefined}
              aria-label={`步驟 ${i + 1}：${m.title}`}
            >
              <span className="sp-e-num">{i + 1}</span>
              <span className="sp-e-title">{m.title}</span>
            </button>
            {i === step && (
              <p className="sp-e-note sp-e-wide">
                {badge}
                {m.note}
              </p>
            )}
          </li>
        ))}
        <li className="sp-e-wide">{nav}</li>
      </ol>

      <p className="sp-e-note sp-e-narrow" aria-live="polite">
        <span className="sp-d-kicker">
          步驟 {step + 1} / {steps.length}
          {badge}
        </span>
        <strong>{meta[step].title}</strong>
        {meta[step].note}
      </p>

      <div className="sp-code sp-e-code">
        <ShikiMagicMovePrecompiled steps={steps} step={step} options={{ duration: 650 }} />
        <div className="sp-d-marks" key={step} aria-hidden="true">
          {changed.map((line) => (
            <span key={line} style={{ top: `calc(1.25rem + ${line} * 1.386rem)` }} />
          ))}
        </div>
      </div>

      <div className="sp-e-narrow">{nav}</div>
    </figure>
  )
}
