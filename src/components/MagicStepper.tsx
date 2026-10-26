import { useCallback, useState, type KeyboardEvent } from 'react'
import { ShikiMagicMovePrecompiled } from 'shiki-magic-move/react'
import type { KeyedTokensInfo } from 'shiki-magic-move/types'
import 'shiki-magic-move/dist/style.css'

interface Props {
  steps: KeyedTokensInfo[]
  meta: { title: string; note: string }[]
}

export default function MagicStepper({ steps, meta }: Props) {
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

  return (
    <figure className="stepper" tabIndex={0} onKeyDown={onKeyDown}>
      <ol className="stepper-tabs" aria-label="步驟">
        {meta.map((m, i) => (
          <li key={m.title}>
            <button
              type="button"
              aria-current={i === step ? 'step' : undefined}
              onClick={() => go(i)}
            >
              <span className="stepper-num">{i + 1}</span>
              <span className="stepper-label">{m.title}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="stepper-code">
        <ShikiMagicMovePrecompiled
          steps={steps}
          step={step}
          options={{ duration: 650 }}
        />
      </div>

      <figcaption className="stepper-footer">
        <p className="stepper-note" aria-live="polite">
          <strong>{current.title}</strong>
          {current.note}
        </p>
        <div className="stepper-nav">
          <button type="button" onClick={() => go(step - 1)} disabled={step === 0}>
            ← 上一步
          </button>
          <span className="stepper-count">
            {step + 1} / {steps.length}
          </span>
          <button type="button" onClick={() => go(step + 1)} disabled={step === last}>
            下一步 →
          </button>
        </div>
      </figcaption>
    </figure>
  )
}
