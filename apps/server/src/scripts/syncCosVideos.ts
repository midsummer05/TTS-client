import fs from 'node:fs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type CsvRow = {
  fileName: string
  url: string
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"' && quoted && next === '"') {
      cell += '"'
      index++
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index++
      row.push(cell)
      if (row.some(Boolean)) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  row.push(cell)
  if (row.some(Boolean)) rows.push(row)
  return rows
}

function cleanCosUrl(url: string) {
  return url.trim().split('?')[0]
}

function stem(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '')
}

function matchesAsset(target: { title: string; videoUrl?: string | null }, row: CsvRow) {
  const decodedUrl = decodeURIComponent(target.videoUrl ?? '')
  if (decodedUrl.endsWith(row.fileName)) return true

  const parts = stem(row.fileName).split('_').filter(Boolean)
  return parts.length > 0 && parts.every((part) => target.title.includes(part))
}

function readCosRows(csvPath: string): CsvRow[] {
  const text = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '')
  const [headers, ...records] = parseCsv(text)
  const nameIndex = headers.indexOf('文件名')
  const urlIndex = headers.indexOf('文件URL')

  if (nameIndex < 0 || urlIndex < 0) {
    throw new Error('CSV 需要包含“文件名”和“文件URL”两列')
  }

  return records
    .map((record) => ({ fileName: record[nameIndex]?.trim(), url: cleanCosUrl(record[urlIndex] ?? '') }))
    .filter((row) => row.fileName && row.url && row.fileName.toLowerCase().endsWith('.mp4'))
}

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    throw new Error('请传入 COS 对象列表 CSV 路径，例如：npm run sync:cos -- C:\\path\\cos.csv')
  }

  const rows = readCosRows(csvPath)
  let videoUpdates = 0
  let liveRoomUpdates = 0

  const videos = await prisma.video.findMany({ select: { id: true, title: true, videoUrl: true } })
  for (const video of videos) {
    const row = rows.find((item) => matchesAsset(video, item))
    if (!row || video.videoUrl === row.url) continue
    await prisma.video.update({ where: { id: video.id }, data: { videoUrl: row.url } })
    videoUpdates++
  }

  const liveRooms = await prisma.liveRoom.findMany({ select: { id: true, title: true, videoUrl: true } })
  for (const room of liveRooms) {
    const row = rows.find((item) => matchesAsset(room, item))
    if (!row || room.videoUrl === row.url) continue
    await prisma.liveRoom.update({ where: { id: room.id }, data: { videoUrl: row.url } })
    liveRoomUpdates++
  }

  console.log(`COS video sync completed. rows=${rows.length}, videos=${videoUpdates}, liveRooms=${liveRoomUpdates}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
