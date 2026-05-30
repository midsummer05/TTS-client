import http from 'node:http'
import { app } from './app.js'
import { attachLiveSocket } from './socket.js'

const port = Number(process.env.PORT || 4000)
const server = http.createServer(app)
const liveIo = attachLiveSocket(server)

app.set('liveIo', liveIo)

server.listen(port, () => {
  console.log(`server listening on http://localhost:${port}`)
})
