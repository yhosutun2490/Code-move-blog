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
