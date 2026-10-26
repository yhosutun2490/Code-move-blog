let activeEffect = null

function observable(target) {
  const obj = {}
  for (const key of Object.keys(target)) {
    let value = target[key]
    const subscribers = new Set()

    Object.defineProperty(obj, key, {
      get() {
        if (activeEffect) subscribers.add(activeEffect)
        return value
      },
      set(next) {
        value = next
        subscribers.forEach((fn) => fn())
      },
    })
  }
  return obj
}

function autorun(fn) {
  const effect = () => {
    activeEffect = effect
    fn()
    activeEffect = null
  }
  effect()
}

const cart = observable({ price: 100, qty: 2, note: '' })

autorun(() => {
  console.log(`總計：${cart.price * cart.qty}`)
})

cart.qty = 3      // → 自動印出「總計：300」
cart.note = '送禮' // → 什麼都不會發生，autorun 沒讀過 note
