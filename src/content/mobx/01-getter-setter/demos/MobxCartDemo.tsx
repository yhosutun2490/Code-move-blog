import { useRef, useState } from 'react'
import { makeAutoObservable } from 'mobx'
import { observer } from 'mobx-react-lite'

// 跟手寫版同一個 cart，只是換成 MobX：
// 欄位 → observable、getter → computed、方法 → action
class Cart {
  price = 100
  qty = 2
  note = ''

  constructor() {
    makeAutoObservable(this)
  }

  get total() {
    return this.price * this.qty
  }

  raisePrice() {
    this.price += 10
  }

  addQty() {
    this.qty += 1
  }

  setNote(note: string) {
    this.note = note
  }
}

// 每次 render 都 +1，用來觀察元件到底有沒有重新渲染
function useRenderCount() {
  const count = useRef(0)
  count.current += 1
  return count.current
}

const TotalView = observer(function TotalView({ cart }: { cart: Cart }) {
  const renders = useRenderCount()
  return (
    <div className="demo-card">
      <span className="demo-card-label">TotalView 只讀 cart.total</span>
      <output>{cart.total}</output>
      <span className="render-count">render × {renders}</span>
    </div>
  )
})

const NoteView = observer(function NoteView({ cart }: { cart: Cart }) {
  const renders = useRenderCount()
  return (
    <div className="demo-card">
      <span className="demo-card-label">NoteView 只讀 cart.note</span>
      <output>{cart.note || '（空）'}</output>
      <span className="render-count">render × {renders}</span>
    </div>
  )
})

const NOTES = ['送禮', '急件', '']

export default function MobxCartDemo() {
  // 每個 demo 實例各自 new 一個 store
  const [cart] = useState(() => new Cart())
  const noteIndex = useRef(0)

  return (
    <div className="demo">
      <div className="demo-head">
        <span className="demo-tag mobx">MobX 版</span>
      </div>

      <div className="demo-actions">
        <button type="button" onClick={() => cart.raisePrice()}>
          price + 10
        </button>
        <button type="button" onClick={() => cart.addQty()}>
          qty + 1
        </button>
        <button type="button" onClick={() => cart.setNote(NOTES[noteIndex.current++ % NOTES.length])}>
          改 note
        </button>
      </div>

      <div className="demo-cards">
        <TotalView cart={cart} />
        <NoteView cart={cart} />
      </div>
    </div>
  )
}
