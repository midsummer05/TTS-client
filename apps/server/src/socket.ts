import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import { prisma } from './prisma.js'

const roomUsers = new Map<string, Set<string>>()

export function attachLiveSocket(server: HttpServer) {
  const io = new Server(server, { cors: { origin: '*' } })
  const liveIo = io.of('/live')

  liveIo.on('connection', (socket) => {
    socket.on('live:join', async ({ liveRoomId, userId }) => {
      socket.join(liveRoomId)
      const users = roomUsers.get(liveRoomId) || new Set<string>()
      users.add(userId || socket.id)
      roomUsers.set(liveRoomId, users)
      const onlineCount = users.size + 1200
      const heat = onlineCount * 7
      await prisma.liveRoom.update({ where: { id: liveRoomId }, data: { onlineCount, heat } }).catch(() => null)
      liveIo.to(liveRoomId).emit('live:online:update', { liveRoomId, onlineCount, heat })
    })

    socket.on('live:leave', ({ liveRoomId, userId }) => {
      const users = roomUsers.get(liveRoomId)
      users?.delete(userId || socket.id)
      socket.leave(liveRoomId)
      liveIo.to(liveRoomId).emit('live:online:update', {
        liveRoomId,
        onlineCount: (users?.size || 0) + 1200,
        heat: ((users?.size || 0) + 1200) * 7,
      })
    })

    socket.on('live:comment:send', async ({ liveRoomId, userId, content }) => {
      const comment = await prisma.comment.create({
        data: { liveRoomId, userId, content },
        include: { user: true },
      })
      liveIo.to(liveRoomId).emit('live:comment:new', comment)
    })

    socket.on('live:like', ({ liveRoomId }) => {
      liveIo.to(liveRoomId).emit('live:online:update', {
        liveRoomId,
        onlineCount: (roomUsers.get(liveRoomId)?.size || 0) + 1200,
        heat: ((roomUsers.get(liveRoomId)?.size || 0) + 1200) * 7 + Math.floor(Math.random() * 100),
      })
    })
  })

  return liveIo
}
