export function generateOrderNo() {
  const date = new Date()
  const ymd = date.toISOString().slice(0, 10).replaceAll('-', '')
  return `LC${ymd}${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 900 + 100)}`
}
