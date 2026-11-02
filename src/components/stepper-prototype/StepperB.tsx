// PROTOTYPE — B：步驟軌道。左邊一條直的步驟軌道（全部標題一直看得到，目前步驟展開說明），右邊是程式碼。
// 和 A 的差別：說明在程式碼「旁邊」而不是下面，整條路線一直攤開，讀者知道自己在哪、還剩什麼。
import { ShikiMagicMovePrecompiled } from 'shiki-magic-move/react'
import 'shiki-magic-move/dist/style.css'
import './stepper-prototype.css'
import { useStep, type StepperProps } from './shared'

export default function StepperB({ steps, meta }: StepperProps) {
  const { step, go, onKeyDown, last } = useStep(steps.length)

  return (
    <figure className="sp-b" tabIndex={0} onKeyDown={onKeyDown}>
      <ol className="sp-b-rail" aria-label="步驟">
        {meta.map((m, i) => (
          <li key={m.title} data-state={i < step ? 'done' : i === step ? 'current' : 'todo'}>
            <button type="button" onClick={() => go(i)} aria-current={i === step ? 'step' : undefined}>
              <span className="sp-b-num">{i + 1}</span>
              <span className="sp-b-title">{m.title}</span>
            </button>
            {i === step && (
              <p className="sp-b-note" aria-live="polite">
                {m.note}
              </p>
            )}
          </li>
        ))}
        <li className="sp-b-nav">
          <button type="button" onClick={() => go(step - 1)} disabled={step === 0}>
            ←
          </button>
          <button type="button" onClick={() => go(step + 1)} disabled={step === last}>
            下一步 →
          </button>
        </li>
      </ol>
      <div className="sp-code">
        <ShikiMagicMovePrecompiled steps={steps} step={step} options={{ duration: 650 }} />
      </div>
    </figure>
  )
}
