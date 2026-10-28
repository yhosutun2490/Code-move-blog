const cart = { price: 100, qty: 2 }

function render() {
  console.log(`總計：${cart.price * cart.qty}`)
}

render()
cart.qty = 3
render() // 每次改完都要記得自己呼叫
