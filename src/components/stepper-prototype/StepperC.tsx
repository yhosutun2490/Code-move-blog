// PROTOTYPE — C：捲動驅動。程式碼黏在畫面上方，說明一段一段排在下面；捲到哪段，程式碼就變到哪一步。
// 沒有按鈕要按，閱讀節奏跟著捲動走（點某段說明也會跳到那一步）。
import { useEffect, useRef, useState } from 'react'
import { ShikiMagicMovePrecompiled } from 'shiki-magic-move/react'
import 'shiki-magic-move/dist/style.css'
import './stepper-prototype.css'
import type { StepperProps } from './shared'

export default function StepperC({ steps, meta }: StepperProps) {
  const [step, setStep] = useState(0)
  const notes = useRef<(HTMLLIElement | null)[]>([])

  useEffect(() => {
    // 判定帶：視窗高度 60%～65% 那一條，說明段落跨過它就成為目前步驟
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setStep(Number((entry.target as HTMLElement).dataset.step))
        }
      },
      { rootMargin: '-60% 0px -35% 0px' },
    )
    notes.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [])

  const jump = (i: number) => {
    setStep(i)
    notes.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <figure className="sp-c">
      <div className="sp-c-sticky">
        <div className="sp-c-bar">
          <span>
            {step + 1} / {steps.length} · {meta[step].title}
          </span>
          <span className="sp-c-hint">往下捲動 ↓</span>
        </div>
        <div className="sp-code">
          <ShikiMagicMovePrecompiled steps={steps} step={step} options={{ duration: 650 }} />
        </div>
      </div>
      <ol className="sp-c-notes">
        {meta.map((m, i) => (
          <li
            key={m.title}
            ref={(el) => {
              notes.current[i] = el
            }}
            data-step={i}
            data-current={i === step || undefined}
            onClick={() => jump(i)}
          >
            <span className="sp-c-num">{String(i + 1).padStart(2, '0')}</span>
            <strong>{m.title}</strong>
            <p>{m.note}</p>
          </li>
        ))}
      </ol>
    </figure>
  )
}
