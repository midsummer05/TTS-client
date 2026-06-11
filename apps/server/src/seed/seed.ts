import { PrismaClient } from '@prisma/client'
import { cosVideoUrl } from './cosVideoUrls.js'

const prisma = new PrismaClient()

const assets = [
  {
    author: '与辉同行',
    username: 'yuhuitongxing',
    product: '德州扒鸡',
    file: '抖音录屏/与辉同行_德州扒鸡.mp4',
    category: '食品饮料',
    price: 6990,
    image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=900',
  },
  {
    author: '交个朋友',
    username: 'jiaogepengyou',
    product: 'FITOFITO燃咖啡',
    file: '抖音录屏/交个朋友_FITOFITO燃咖啡.mp4',
    category: '食品饮料',
    price: 8990,
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=900',
  },
  {
    author: '娄艺潇',
    username: 'louyixiao',
    product: '全棉时代洗脸巾',
    file: '抖音录屏/娄艺潇_全棉时代洗脸巾.mp4',
    category: '美妆个护',
    price: 4590,
    image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=900',
  },
  {
    author: '贾乃亮',
    username: 'jianailiang',
    product: '欧莱雅防晒',
    file: '抖音录屏/贾乃亮_欧莱雅防晒.mp4',
    category: '美妆个护',
    price: 12900,
    image: 'https://images.unsplash.com/photo-1556228724-4f9e8e145f59?w=900',
  },
  {
    author: '韩束官方直播间',
    username: 'hanshu',
    product: '红蛮腰大礼盒',
    file: '抖音录屏/韩束官方直播间_红蛮腰大礼盒.mp4',
    category: '美妆个护',
    price: 29900,
    image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=900',
  },
  {
    author: '毛峰直播间',
    username: 'maofengcha',
    product: '精品茶叶',
    file: '即梦生成/毛峰直播间_精品茶叶_.mp4',
    category: '食品饮料',
    price: 16800,
    image: 'https://images.unsplash.com/photo-1563911892437-1feda0179e1b?w=900',
  },
  {
    author: '景德镇',
    username: 'jingdezhen',
    product: '精美餐具',
    file: '即梦生成/景德镇_精美餐具.mp4',
    category: '家居生活',
    price: 18800,
    image: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=900',
  },
  {
    author: '小梦',
    username: 'xiaomeng',
    product: '体恤衫',
    file: '即梦生成/小梦_体恤衫.mp4',
    category: '服饰配件',
    price: 7900,
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900',
  },
  {
    author: 'apple旗舰店',
    username: 'applemall',
    product: 'iPhone17',
    file: '即梦生成/apple旗舰店_iPhone17.mp4',
    category: '手机数码',
    price: 699900,
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=900',
  },
]

function mediaUrl(file: string) {
  return cosVideoUrl(file) ?? `/media/${file.split('/').map(encodeURIComponent).join('/')}`
}

async function main() {
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.cartItem.deleteMany()
  await prisma.comment.deleteMany()
  await prisma.videoProduct.deleteMany()
  await prisma.liveRoomProduct.deleteMany()
  await prisma.video.deleteMany()
  await prisma.liveRoom.deleteMany()
  await prisma.coupon.deleteMany()
  await prisma.interaction.deleteMany()
  await prisma.behaviorEvent.deleteMany()
  await prisma.product.deleteMany()
  await prisma.user.deleteMany()

  const users = await Promise.all(
    [
      ...assets.map((item) => item.author),
      '移动端用户',
      '浅语',
      '大柚子',
      '风起云涌',
      '人间不值得',
    ].map((nickname, index) =>
      prisma.user.create({
        data: {
          username:
            index < assets.length ? assets[index].username : `user-${index}`,
          nickname,
          avatarUrl: `https://api.dicebear.com/9.x/thumbs/png?seed=user-${index}`,
          bio:
            index < assets.length
              ? `主营${assets[index].category}，主页里都是直播讲解过的真实商品。`
              : '直播间常驻观众，喜欢看讲解后再下单。',
          homepageTitle:
            index < assets.length ? `${nickname} 的好物主页` : '我的作品与收藏',
          followerCount: 1360 + index * 417,
          followingCount: 12 + index,
        },
      }),
    ),
  )

  const products = await Promise.all(
    assets.map((asset, index) =>
      prisma.product.create({
        data: {
          title: asset.product,
          coverUrl: asset.image,
          price: asset.price,
          originPrice: Math.round(asset.price * 1.35),
          stock: 35 + index * 3,
          sales: 120 + index * 18,
          category: asset.category,
          tags: JSON.stringify(['直播专享', '限时优惠']),
          description: `${asset.author} 直播间同款商品，已绑定素材视频，可用于短视频种草、直播讲解、加购和下单闭环。`,
          sellerId: users[index].id,
          status: 'ON_SALE',
        },
      }),
    ),
  )

  const videos = await Promise.all(
    assets.map((asset, index) =>
      prisma.video.create({
        data: {
          title: `${asset.author} 讲解 ${asset.product}`,
          coverUrl: asset.image,
          videoUrl: mediaUrl(asset.file),
          authorName: asset.author,
          authorAvatar: users[index].avatarUrl,
          userId: users[index].id,
          status: 'PUBLISHED',
          playCount: 1200 + index * 330,
          likeCount: 80 + index * 17,
          commentCount: 5,
          shareCount: 28 + index * 9,
        },
      }),
    ),
  )

  for (const [index, video] of videos.entries()) {
    const linkedProducts = [
      products[index],
      products[(index + 1) % products.length],
      products[(index + 2) % products.length],
    ]
    for (const [sort, product] of linkedProducts.entries()) {
      await prisma.videoProduct.create({
        data: {
          videoId: video.id,
          productId: product.id,
          sort,
          startTime: sort * 15,
        },
      })
    }
  }

  const liveRooms = await Promise.all(
    assets.map((asset, index) =>
      prisma.liveRoom.create({
        data: {
          title: `${asset.author} · ${asset.product} 专场`,
          coverUrl: asset.image,
          videoUrl: mediaUrl(asset.file),
          anchorName: asset.author,
          anchorAvatar: users[index].avatarUrl,
          anchorUserId: users[index].id,
          status: 'LIVING',
          onlineCount: 1280 + index * 450,
          heat: 9600 + index * 2000,
          currentProductId: products[index].id,
        },
      }),
    ),
  )

  for (const [roomIndex, room] of liveRooms.entries()) {
    const roomProducts = [
      products[roomIndex],
      products[(roomIndex + 1) % products.length],
      products[(roomIndex + 2) % products.length],
      products[(roomIndex + 3) % products.length],
    ]
    for (const [sort, product] of roomProducts.entries()) {
      await prisma.liveRoomProduct.create({
        data: { liveRoomId: room.id, productId: product.id, sort },
      })
    }
  }

  await Promise.all(
    Array.from({ length: 5 }).map((_, index) =>
      prisma.coupon.create({
        data: {
          title: `直播间专享 ${10 + index * 5} 元券`,
          amount: (10 + index * 5) * 100,
          minAmount: (99 + index * 20) * 100,
        },
      }),
    ),
  )

  for (let index = 0; index < 50; index++) {
    await prisma.comment.create({
      data: {
        userId: users[index % users.length].id,
        videoId: videos[index % videos.length].id,
        liveRoomId:
          index % 2 === 0 ? liveRooms[index % liveRooms.length].id : undefined,
        content: [
          '这个价格可以',
          '主播讲得很清楚',
          '有没有更多颜色',
          '已经加购了',
        ][index % 4],
      },
    })
  }

  for (let index = 0; index < 5; index++) {
    await prisma.order.create({
      data: {
        orderNo: `LCSEED${index + 1}`,
        userId: users[2].id,
        status: index % 2 === 0 ? 'PAID' : 'PENDING_PAYMENT',
        totalAmount: products[index].price,
        payAmount: products[index].price,
        address: '北京市朝阳区测试地址',
        items: {
          create: {
            productId: products[index].id,
            title: products[index].title,
            coverUrl: products[index].coverUrl,
            price: products[index].price,
            quantity: 1,
          },
        },
      },
    })
  }

  console.log('seed completed')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
