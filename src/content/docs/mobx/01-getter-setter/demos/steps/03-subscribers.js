function observable(target) {
  const obj = {}
  for (const key of Object.keys(target)) {
    let value = target[key]
    const subscribers = new Set()

    Object.defineProperty(obj, key, {
      get() {
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
