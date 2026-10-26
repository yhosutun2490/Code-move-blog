/**
 * 文章裡手寫的迷你響應式系統，加上兩個 hook 讓 demo 能把「讀」「寫」印成 log。
 * 演算法和步驟 5 完全一樣，只多了 dispose 和型別。
 */
type Effect = () => void

export interface Hooks {
  onGet?: (key: string, tracked: boolean) => void
  onSet?: (key: string, value: unknown, subscriberCount: number) => void
}

let activeEffect: Effect | null = null

export function observable<T extends Record<string, unknown>>(target: T, hooks: Hooks = {}): T {
  const obj = {} as T

  for (const key of Object.keys(target)) {
    let value = target[key]
    const subscribers = new Set<Effect>()

    Object.defineProperty(obj, key, {
      enumerable: true,
      get() {
        if (activeEffect) subscribers.add(activeEffect)
        hooks.onGet?.(key, activeEffect !== null)
        return value
      },
      set(next) {
        if (Object.is(next, value)) return
        value = next
        hooks.onSet?.(key, next, subscribers.size)
        // 複製一份再跑：effect 執行時可能又把自己加回 Set
        ;[...subscribers].forEach((fn) => fn())
      },
    })
  }

  return obj
}

export function autorun(fn: () => void) {
  let disposed = false

  const effect = () => {
    if (disposed) return
    const prev = activeEffect
    activeEffect = effect
    try {
      fn()
    } finally {
      activeEffect = prev
    }
  }

  effect()
  return () => {
    disposed = true
  }
}
