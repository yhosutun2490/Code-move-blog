import { useEffect, useRef, useState } from 'react'
import { autorun, observable } from './mini-reactive'

type Kind = 'get' | 'set' | 'run' | 'skip'
interface LogEntry {
  id: number
  kind: Kind
  text: string
}

const NOTES = ['送禮', '急件', '']

export default function MiniReactiveDemo() {
  const [log, setLog] = useState<LogEntry[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const cartRef = useRef<{ price: number; qty: number; note: string } | null>(null)
  const noteIndex = useRef(0)

  useEffect(() => {
    let id = 0
    const push = (kind: Kind, text: string) =>
      setLog((prev) => [{ id: id++, kind, text }, ...prev].slice(0, 14))

    // 每個 demo 自己建一份 store，不共用全域狀態
    const cart = observable(
      { price: 100, qty: 2, note: '' },
      {
        onGet: (key, tracked) => push('get', `讀取 ${key}${tracked ? '（記下訂閱）' : ''}`),
        onSet: (key, value, count) =>
          count > 0
            ? push('set', `寫入 ${key} = ${JSON.stringify(value)} → 通知 ${count} 個訂閱者`)
            : push('skip', `寫入 ${key} = ${JSON.stringify(value)} → 沒有訂閱者，什麼都不做`),
      },
    )
    cartRef.current = cart

    let runs = 0
    const dispose = autorun(() => {
      runs += 1
      push('run', `autorun 第 ${runs} 次執行`)
      setTotal(cart.price * cart.qty)
    })

    return dispose
  }, [])

  const cart = cartRef.current

  return (
    <div className="demo">
      <div className="demo-head">
        <span className="demo-tag">手寫版</span>
        <span className="demo-total">
          總計 <output>{total ?? '—'}</output>
        </span>
      </div>

      <div className="demo-actions">
        <button type="button" onClick={() => cart && (cart.price += 10)}>
          price + 10
        </button>
        <button type="button" onClick={() => cart && (cart.qty += 1)}>
          qty + 1
        </button>
        <button
          type="button"
          onClick={() => {
            if (!cart) return
            cart.note = NOTES[noteIndex.current++ % NOTES.length]
          }}
        >
          改 note
        </button>
        <button type="button" className="ghost" onClick={() => setLog([])}>
          清除 log
        </button>
      </div>

      <ol className="demo-log" aria-label="執行紀錄">
        {log.length === 0 && <li className="empty">按上面的按鈕看看會發生什麼</li>}
        {log.map((entry) => (
          <li key={entry.id} data-kind={entry.kind}>
            <span className="badge">{entry.kind}</span>
            {entry.text}
          </li>
        ))}
      </ol>
    </div>
  )
}
