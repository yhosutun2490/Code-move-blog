const cart = {}
let price = 100

Object.defineProperty(cart, 'price', {
  get() {
    console.log('有人讀了 price')
    return price
  },
  set(next) {
    console.log('有人改了 price')
    price = next
  },
})
