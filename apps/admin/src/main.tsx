import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Form, Image, Input, InputNumber, Layout, Modal, Select, Space, Table, Tabs, Tag, Typography, Upload, message }
  from 'antd'
import axios from 'axios'
import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import 'antd/dist/reset.css'
import './styles.css'

const request = axios.create({ baseURL: 'http://localhost:4000/api' })
const adminTokenKey = 'live-commerce-admin-token'

request.interceptors.request.use((config) => {
  const token = localStorage.getItem(adminTokenKey)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

request.interceptors.response.use(
  (res) => res.data.data,
  (error) => {
    if (error.response?.status === 401) localStorage.removeItem(adminTokenKey)
    return Promise.reject(new Error(error.response?.data?.message || error.message || '请求失败'))
  },
)

type User = {
  id: string
  username?: string | null
  nickname: string
  phone?: string | null
  avatarUrl?: string | null
}

type Product = {
  id: string
  title: string
  coverUrl: string
  price: number
  originPrice?: number
  stock: number
  sales: number
  status: string
  category?: string
  description?: string
  videoLinks?: Array<{ video: { id: string; title: string } }>
  liveLinks?: Array<{ liveRoom: { id: string; title: string } }>
}

type Video = {
  id: string
  title: string
  coverUrl: string
  videoUrl: string
  status: string
  authorName: string
  authorAvatar?: string | null
  userId?: string | null
  products: Array<{ product: Product }>
  liveRoom?: LiveRoom | null
  liveRoomId?: string | null
}

type LiveRoom = {
  id: string
  title: string
  coverUrl: string
  videoUrl?: string | null
  status: string
  anchorName: string
  anchorAvatar?: string | null
  currentProductId?: string
  products: Array<{ product: Product }>
}

type MarketingRule = {
  id?: string
  liveRoomId?: string
  type: 'COUPON' | 'DISCOUNT' | 'FULL_REDUCTION' | 'SECKILL'
  title: string
  status: 'ACTIVE' | 'INACTIVE'
  productId?: string | null
  amount?: number | null
  minAmount?: number | null
  discountPercent?: number | null
  countdownSeconds?: number | null
}

type AiContentDraft = {
  videoTitles: string[]
  sellingPoints: string[]
  recommendation: string
  liveScript: string
}

function price(value: number) {
  return `¥${(value / 100).toFixed(2)}`
}

function yuanToCent(value?: number | null) {
  return value == null ? null : Math.round(value * 100)
}

function centToYuan(value?: number | null) {
  return value == null ? undefined : value / 100
}

function liveStatusLabel(value: string) {
  return ({ NOT_STARTED: '未开始', LIVE: '直播中', LIVING: '直播中', ENDED: '已结束' } as Record<string, string>)[value] || value
}

function normalizeLiveStatus(value?: string) {
  return value === 'LIVING' ? 'LIVE' : value
}

function draftToText(draft: AiContentDraft) {
  return [
    '短视频标题',
    ...draft.videoTitles.map((item, index) => `${index + 1}. ${item}`),
    '',
    '商品卖点',
    ...draft.sellingPoints.map((item, index) => `${index + 1}. ${item}`),
    '',
    '商品推荐语',
    draft.recommendation,
    '',
    '直播讲解文案',
    draft.liveScript,
  ].join('\n')
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function LoginScreen({ onLogin }: { onLogin: (payload: { token: string; user: User }) => void }) {
  const [form] = Form.useForm()
  const login = useMutation({
    mutationFn: (values: { phone: string; password: string }) => request.post('/auth/login', values) as Promise<{ token: string; user: User }>,
    onSuccess: (payload) => {
      localStorage.setItem(adminTokenKey, payload.token)
      message.success('登录成功')
      onLogin(payload)
    },
    onError: (error) => message.error((error as Error).message),
  })

  return (
    <div className="login-page">
      <Card className="login-card">
        <Typography.Title level={2} style={{ marginBottom: 8 }}>运营后台登录</Typography.Title>
        <Typography.Paragraph type="secondary">使用移动端同一套手机号和密码登录。</Typography.Paragraph>
        <Form form={form} layout="vertical" onFinish={(values) => login.mutate(values)} requiredMark={false}>
          <Form.Item name="phone" label="手机号" rules={[{ required: true, message: '请输入手机号' }, { pattern: /^1\d{10}$/, message: '请输入正确的手机号' }]}>
            <Input size="large" placeholder="请输入手机号" maxLength={11} />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少 6 位' }]}>
            <Input.Password size="large" placeholder="请输入密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={login.isPending}>登录后台</Button>
        </Form>
      </Card>
    </div>
  )
}

function Dashboard() {
  const { data } = useQuery({ queryKey: ['overview'], queryFn: () => request.get('/admin/dashboard/overview') as Promise<any> })
  return (
    <div className="metrics">
      {[
        ['商品数', data?.productCount || 0],
        ['视频数', data?.videoCount || 0],
        ['订单数', data?.orderCount || 0],
        ['GMV', price(data?.gmv || 0)],
      ].map(([label, value]) => (
        <Card key={label}>
          <div className="metric-label">{label}</div>
          <div className="metric-value">{value}</div>
        </Card>
      ))}
    </div>
  )
}

const trendData = [
  { day: '06-03', plays: 12800, likes: 860, comments: 126 },
  { day: '06-04', plays: 15600, likes: 1080, comments: 168 },
  { day: '06-05', plays: 14200, likes: 940, comments: 151 },
  { day: '06-06', plays: 19600, likes: 1480, comments: 226 },
  { day: '06-07', plays: 22400, likes: 1760, comments: 284 },
  { day: '06-08', plays: 26800, likes: 2140, comments: 336 },
  { day: '06-09', plays: 31500, likes: 2580, comments: 418 },
]

const funnelData = [
  { label: '商品曝光', value: 128600, color: '#1677ff' },
  { label: '商品点击', value: 42600, color: '#13c2c2' },
  { label: '加入购物车', value: 11280, color: '#faad14' },
  { label: '提交订单', value: 3860, color: '#ff7a45' },
  { label: '支付完成', value: 2460, color: '#f5222d' },
]

const gmvRankData = [
  { rank: 1, title: '与辉同行 讲解 德州扒鸡', gmv: 286500, orders: 421, conversion: '5.8%' },
  { rank: 2, title: '娄艺潇 讲解 全棉时代洗脸巾', gmv: 218900, orders: 512, conversion: '6.4%' },
  { rank: 3, title: '贾乃亮 讲解 欧莱雅防晒', gmv: 196200, orders: 286, conversion: '4.9%' },
  { rank: 4, title: '交个朋友 讲解 FITOFITO燃咖啡', gmv: 166800, orders: 348, conversion: '5.1%' },
  { rank: 5, title: '韩束官方直播间 讲解 红蛮腰大礼盒', gmv: 149300, orders: 173, conversion: '3.7%' },
]

const hotProductsData = [
  { rank: 1, title: '德州扒鸡', exposure: 38600, clicks: 12800, orders: 421, gmv: 286500 },
  { rank: 2, title: '全棉时代洗脸巾', exposure: 35400, clicks: 11680, orders: 512, gmv: 218900 },
  { rank: 3, title: '欧莱雅防晒', exposure: 31800, clicks: 10520, orders: 286, gmv: 196200 },
  { rank: 4, title: 'FITOFITO燃咖啡', exposure: 28600, clicks: 8840, orders: 348, gmv: 166800 },
  { rank: 5, title: '红蛮腰大礼盒', exposure: 24100, clicks: 7260, orders: 173, gmv: 149300 },
  { rank: 6, title: '精品茶叶', exposure: 21300, clicks: 6820, orders: 156, gmv: 132600 },
  { rank: 7, title: '体恤衫', exposure: 19800, clicks: 5940, orders: 201, gmv: 104800 },
  { rank: 8, title: '精美餐具', exposure: 17600, clicks: 4860, orders: 98, gmv: 92300 },
  { rank: 9, title: '红瑶红薯干', exposure: 16400, clicks: 4520, orders: 186, gmv: 84600 },
  { rank: 10, title: 'iPhone17', exposure: 9200, clicks: 3180, orders: 18, gmv: 125800 },
]

function compact(value: number) {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
  return value.toLocaleString()
}

function MiniTrendChart() {
  const width = 680
  const height = 220
  const padding = 28
  const max = Math.max(...trendData.flatMap((item) => [item.plays, item.likes * 10, item.comments * 60]))
  const toPoints = (key: 'plays' | 'likes' | 'comments', scale = 1) => trendData.map((item, index) => {
    const x = padding + (index * (width - padding * 2)) / (trendData.length - 1)
    const y = height - padding - ((item[key] * scale) / max) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        {[0, 1, 2, 3].map((line) => <line key={line} x1={padding} x2={width - padding} y1={padding + line * 48} y2={padding + line * 48} className="chart-grid" />)}
        <polyline points={toPoints('plays')} className="chart-line plays" />
        <polyline points={toPoints('likes', 10)} className="chart-line likes" />
        <polyline points={toPoints('comments', 60)} className="chart-line comments" />
        {trendData.map((item, index) => {
          const x = padding + (index * (width - padding * 2)) / (trendData.length - 1)
          return <text key={item.day} x={x} y={height - 6} textAnchor="middle" className="chart-label">{item.day}</text>
        })}
      </svg>
      <div className="chart-legend">
        <span><i className="legend-dot plays" />播放量</span>
        <span><i className="legend-dot likes" />点赞量 x10</span>
        <span><i className="legend-dot comments" />评论量 x60</span>
      </div>
    </div>
  )
}

function ConversionFunnel() {
  const max = funnelData[0].value
  return (
    <div className="funnel">
      {funnelData.map((item, index) => {
        const percent = Math.max(12, Math.round((item.value / max) * 100))
        const prev = index === 0 ? item.value : funnelData[index - 1].value
        return (
          <div key={item.label} className="funnel-row">
            <div className="funnel-label">{item.label}</div>
            <div className="funnel-track">
              <div className="funnel-bar" style={{ width: `${percent}%`, background: item.color }}>
                <span>{compact(item.value)}</span>
              </div>
            </div>
            <div className="funnel-rate">{index === 0 ? '100%' : `${((item.value / prev) * 100).toFixed(1)}%`}</div>
          </div>
        )
      })}
    </div>
  )
}

function AnalyticsPage() {
  const totalPlays = trendData.reduce((sum, item) => sum + item.plays, 0)
  const totalLikes = trendData.reduce((sum, item) => sum + item.likes, 0)
  const totalComments = trendData.reduce((sum, item) => sum + item.comments, 0)
  const mockGmv = gmvRankData.reduce((sum, item) => sum + item.gmv, 0)

  return (
    <Space direction="vertical" size={18} style={{ width: '100%' }}>
      <div className="analytics-head">
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>运营分析</Typography.Title>
          <Typography.Text type="secondary">当前为测试阶段 mock 数据，用于验证商品种草视频的收益转化看板。</Typography.Text>
        </div>
        <Tag color="blue">Mock 数据</Tag>
      </div>
      <div className="metrics">
        {[
          ['近 7 日播放', compact(totalPlays)],
          ['近 7 日点赞', compact(totalLikes)],
          ['近 7 日评论', compact(totalComments)],
          ['种草 GMV', price(mockGmv)],
          ['支付转化率', `${((funnelData.at(-1)!.value / funnelData[0].value) * 100).toFixed(2)}%`],
        ].map(([label, value]) => (
          <Card key={label}>
            <div className="metric-label">{label}</div>
            <div className="metric-value">{value}</div>
          </Card>
        ))}
      </div>
      <div className="analytics-grid">
        <Card title="视频播放 / 点赞 / 评论趋势">
          <MiniTrendChart />
        </Card>
        <Card title="商品转化漏斗">
          <ConversionFunnel />
        </Card>
      </div>
      <div className="analytics-grid">
        <Card title="不同视频 GMV 排行">
          <Table rowKey="rank" size="small" pagination={false} dataSource={gmvRankData} columns={[
            { title: '排名', dataIndex: 'rank', width: 70, render: (rank) => <Tag color={rank <= 3 ? 'red' : 'default'}>Top {rank}</Tag> },
            { title: '视频', dataIndex: 'title', ellipsis: true },
            { title: 'GMV', dataIndex: 'gmv', width: 120, render: price },
            { title: '订单', dataIndex: 'orders', width: 90 },
            { title: '转化率', dataIndex: 'conversion', width: 90 },
          ]} />
        </Card>
        <Card title="热门商品 Top10">
          <Table rowKey="rank" size="small" pagination={false} dataSource={hotProductsData} columns={[
            { title: '排名', dataIndex: 'rank', width: 70 },
            { title: '商品', dataIndex: 'title', ellipsis: true },
            { title: '曝光', dataIndex: 'exposure', width: 90, render: compact },
            { title: '点击', dataIndex: 'clicks', width: 90, render: compact },
            { title: 'GMV', dataIndex: 'gmv', width: 110, render: price },
          ]} />
        </Card>
      </div>
    </Space>
  )
}

function ProductList() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [uploadedImageName, setUploadedImageName] = useState('')
  const [form] = Form.useForm()
  const coverUrl = Form.useWatch('coverUrl', form)
  const { data = [], isLoading } = useQuery({ queryKey: ['admin-products'], queryFn: () => request.get('/admin/products') as Promise<Product[]> })
  const { data: videos = [] } = useQuery({ queryKey: ['admin-videos'], queryFn: () => request.get('/admin/videos') as Promise<Video[]> })
  const save = useMutation({
    mutationFn: (values: Partial<Product> & { videoIds?: string[] }) => editing ? request.patch(`/admin/products/${editing.id}`, values) : request.post('/admin/products', values),
    onSuccess: () => {
      message.success('商品已保存')
      setOpen(false)
      setEditing(null)
      setUploadedImageName('')
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      queryClient.invalidateQueries({ queryKey: ['admin-videos'] })
      queryClient.invalidateQueries({ queryKey: ['admin-live-rooms'] })
      queryClient.invalidateQueries({ queryKey: ['overview'] })
    },
    onError: (error) => message.error((error as Error).message),
  })
  const status = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) => request.patch(`/admin/products/${id}/status`, { status: value }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-products'] }),
  })
  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return request.post('/admin/upload/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } }) as Promise<{ key: string; url: string }>
    },
    onSuccess: (result, file) => {
      form.setFieldValue('coverUrl', result.url)
      setUploadedImageName(file.name)
      message.success('商品图片已上传到腾讯云 COS')
    },
    onError: (error) => message.error((error as Error).message),
  })

  function openCreate() {
    setEditing(null)
    setUploadedImageName('')
    form.resetFields()
    form.setFieldsValue({ status: 'ON_SALE', videoIds: [] })
    setOpen(true)
  }

  function openEdit(product: Product) {
    setEditing(product)
    setUploadedImageName('')
    form.setFieldsValue({
      ...product,
      price: product.price / 100,
      originPrice: product.originPrice ? product.originPrice / 100 : undefined,
      videoIds: product.videoLinks?.map((item) => item.video.id) || [],
    })
    setOpen(true)
  }

  return (
    <>
      <div className="toolbar"><Button type="primary" onClick={openCreate}>新增商品</Button></div>
      <Table rowKey="id" loading={isLoading} dataSource={data} columns={[
        { title: '图片', dataIndex: 'coverUrl', width: 96, render: (url) => <Image width={58} height={58} src={url} className="product-thumb" /> },
        { title: '商品名称', dataIndex: 'title', width: 220 },
        { title: '价格', dataIndex: 'price', render: price },
        { title: '库存', dataIndex: 'stock' },
        { title: '销量', dataIndex: 'sales' },
        { title: '绑定视频', render: (_, row) => row.videoLinks?.length ? row.videoLinks.map((item) => <Tag key={item.video.id}>{item.video.title}</Tag>) : '-' },
        { title: '状态', dataIndex: 'status', render: (v, row) => <Select value={v} style={{ width: 120 }} onChange={(value) => status.mutate({ id: row.id, value })} options={[{ value: 'ON_SALE', label: '上架' }, { value: 'OFF_SALE', label: '下架' }]} /> },
        { title: '操作', width: 100, render: (_, row) => <Button onClick={() => openEdit(row)}>编辑</Button> },
      ]} />
      <Modal title={editing ? '编辑商品' : '新增商品'} open={open} width={760} onCancel={() => { setOpen(false); setEditing(null); setUploadedImageName(''); form.resetFields() }} onOk={() => form.submit()} confirmLoading={save.isPending}>
        <Form form={form} layout="vertical" requiredMark={false} onFinish={(values) => save.mutate({ ...values, price: Math.round(values.price * 100), originPrice: values.originPrice ? Math.round(values.originPrice * 100) : null, videoIds: values.videoIds || [], liveRoomIds: [] })}>
          <Form.Item name="title" label="商品名称" rules={[{ required: true, message: '请输入商品名称' }, { min: 2, message: '商品名称至少 2 个字' }]}><Input /></Form.Item>
          <Form.Item name="coverUrl" hidden rules={[{ required: true, message: '请先上传商品图片' }]}><Input /></Form.Item>
          <Form.Item label="商品图片" required>
            <Space align="start">
              {coverUrl ? <Image width={92} height={92} src={coverUrl} className="product-preview" /> : null}
              <div>
                <Upload
                  accept="image/*"
                  maxCount={1}
                  showUploadList={false}
                  customRequest={({ file, onSuccess, onError }) => {
                    uploadImage.mutate(file as File, {
                      onSuccess: () => onSuccess?.('ok'),
                      onError: (error) => onError?.(error as Error),
                    })
                  }}
                >
                  <Button loading={uploadImage.isPending}>{coverUrl ? '重新上传图片' : '选择并上传图片'}</Button>
                </Upload>
                <div className="upload-hint">
                  {uploadedImageName ? `已上传：${uploadedImageName}` : coverUrl ? '图片已在腾讯云 COS 中，如需替换请重新上传。' : '请选择本地商品图片，上传成功后会自动写入图片地址。'}
                </div>
              </div>
            </Space>
          </Form.Item>
          <Form.Item name="price" label="价格（元）" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="originPrice" label="原价（元）"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="stock" label="库存" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="status" label="商品状态" rules={[{ required: true, message: '请选择商品状态' }]}><Select options={[{ value: 'ON_SALE', label: '上架' }, { value: 'OFF_SALE', label: '下架' }]} /></Form.Item>
          <Form.Item name="category" label="类目"><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea /></Form.Item>
          <Form.Item name="videoIds" label="绑定短视频">
            <Select mode="multiple" placeholder="选择要绑定的短视频" options={videos.map((item) => ({ value: item.id, label: item.title }))} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

function VideoList({ currentUser }: { currentUser: User }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Video | null>(null)
  const [marketingVideo, setMarketingVideo] = useState<Video | null>(null)
  const [aiDraft, setAiDraft] = useState<AiContentDraft | null>(null)
  const [uploadedVideoName, setUploadedVideoName] = useState('')
  const [form] = Form.useForm()
  const [marketingForm] = Form.useForm()
  const { data: products = [] } = useQuery({ queryKey: ['admin-products'], queryFn: () => request.get('/admin/products') as Promise<Product[]> })
  const { data = [], isLoading } = useQuery({ queryKey: ['admin-videos'], queryFn: () => request.get('/admin/videos') as Promise<Video[]> })
  const bind = useMutation({ mutationFn: ({ id, productIds }: { id: string; productIds: string[] }) => request.post(`/admin/videos/${id}/products`, { productIds }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-videos'] }) })
  const current = useMutation({
    mutationFn: ({ liveRoomId, productId }: { liveRoomId: string; productId: string }) => request.patch(`/admin/live-rooms/${liveRoomId}/current-product`, { productId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-videos'] }),
    onError: (error) => message.error((error as Error).message),
  })
  const status = useMutation({ mutationFn: ({ id, value }: { id: string; value: string }) => request.patch(`/admin/videos/${id}/status`, { status: value }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-videos'] }) })
  const save = useMutation({
    mutationFn: (values: {
      title: string
      videoUrl: string
      status: string
      productIds: string[]
      liveTitle?: string
      liveStatus: string
      currentProductId?: string
    }) => editing ? request.patch(`/admin/videos/${editing.id}`, values) : request.post('/admin/videos', values),
    onSuccess: () => {
      message.success('内容已保存')
      setOpen(false)
      setEditing(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['admin-videos'] })
      queryClient.invalidateQueries({ queryKey: ['admin-live-rooms'] })
      queryClient.invalidateQueries({ queryKey: ['overview'] })
    },
    onError: (error) => message.error((error as Error).message),
  })
  const uploadVideo = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return request.post('/admin/upload/video', formData, { headers: { 'Content-Type': 'multipart/form-data' } }) as Promise<{ key: string; url: string }>
    },
    onSuccess: (result, file) => {
      form.setFieldValue('videoUrl', result.url)
      setUploadedVideoName(file.name)
      message.success('视频已上传到腾讯云 COS')
    },
    onError: (error) => message.error((error as Error).message),
  })
  const selectedProductIds = Form.useWatch('productIds', form) || []
  const watchedTitle = Form.useWatch('title', form)
  const watchedLiveTitle = Form.useWatch('liveTitle', form)
  const selectedProducts = products.filter((item) => selectedProductIds.includes(item.id))
  const generateAiDraft = useMutation({
    mutationFn: () => request.post('/admin/ai/content-draft', {
      productIds: selectedProductIds,
      videoTitle: watchedTitle,
      liveTitle: watchedLiveTitle,
    }) as Promise<AiContentDraft>,
    onSuccess: (draft) => {
      setAiDraft(draft)
      message.success('AI 内容已生成')
    },
    onError: (error) => message.error((error as Error).message),
  })
  const marketingRulesQuery = useQuery({
    queryKey: ['admin-marketing-rules', marketingVideo?.liveRoomId],
    queryFn: () => request.get(`/admin/live-rooms/${marketingVideo!.liveRoomId}/marketing-rules`) as Promise<MarketingRule[]>,
    enabled: !!marketingVideo?.liveRoomId,
  })
  const saveMarketing = useMutation({
    mutationFn: (values: { rules?: MarketingRule[] }) => {
      const rules = (values.rules || []).map((rule) => {
        const base = {
          type: rule.type,
          title: rule.title,
          status: rule.status || 'ACTIVE',
        }
        if (rule.type === 'COUPON') return { ...base, minAmount: yuanToCent(rule.minAmount), amount: yuanToCent(rule.amount) }
        if (rule.type === 'DISCOUNT') return { ...base, productId: rule.productId || null, discountPercent: rule.discountPercent ? Number(rule.discountPercent) : null }
        if (rule.type === 'FULL_REDUCTION') return { ...base, minAmount: yuanToCent(rule.minAmount), amount: yuanToCent(rule.amount) }
        return { ...base, productId: rule.productId || null, discountPercent: rule.discountPercent ? Number(rule.discountPercent) : null, countdownSeconds: rule.countdownSeconds ? Number(rule.countdownSeconds) : 60 }
      })
      return request.post(`/admin/live-rooms/${marketingVideo!.liveRoomId}/marketing-rules`, { rules })
    },
    onSuccess: () => {
      message.success('营销配置已同步到直播间')
      setMarketingVideo(null)
      marketingForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['admin-marketing-rules'] })
    },
    onError: (error) => message.error((error as Error).message),
  })

  function openCreate() {
    setEditing(null)
    setUploadedVideoName('')
    form.resetFields()
    form.setFieldsValue({ status: 'DRAFT', liveStatus: 'LIVE', productIds: [] })
    setOpen(true)
  }

  function openEdit(video: Video) {
    setEditing(video)
    setUploadedVideoName('')
    form.setFieldsValue({
      title: video.title,
      videoUrl: video.videoUrl,
      status: video.status,
      productIds: video.products.map((item) => item.product.id),
      liveTitle: video.liveRoom?.title || video.title,
      liveStatus: normalizeLiveStatus(video.liveRoom?.status) || 'LIVE',
      currentProductId: video.liveRoom?.currentProductId || video.products[0]?.product.id,
    })
    setOpen(true)
  }

  function handleGenerateAiDraft() {
    if (!selectedProductIds.length) {
      message.warning('请先选择关联商品，AI 会根据商品信息生成内容')
      return
    }
    generateAiDraft.mutate()
  }

  function openMarketing(video: Video) {
    setMarketingVideo(video)
    marketingForm.resetFields()
  }

  function fillMarketingForm(rules: MarketingRule[]) {
    marketingForm.setFieldsValue({
      rules: rules.map((rule) => ({
        ...rule,
        amount: centToYuan(rule.amount),
        minAmount: centToYuan(rule.minAmount),
        countdownSeconds: rule.countdownSeconds || undefined,
      })),
    })
  }

  useEffect(() => {
    if (marketingVideo && marketingRulesQuery.data) fillMarketingForm(marketingRulesQuery.data)
  }, [marketingVideo?.id, marketingRulesQuery.data])

  return (
    <>
      <div className="toolbar">
        <Button type="primary" onClick={openCreate}>上传短视频</Button>
      </div>
      <Table rowKey="id" loading={isLoading} dataSource={data} tableLayout="fixed" scroll={{ x: 1320 }} columns={[
        { title: '标题', dataIndex: 'title', width: 260 },
        { title: '作者', dataIndex: 'authorName', width: 140 },
        { title: '直播标题', width: 220, ellipsis: true, render: (_, row) => row.liveRoom?.title || '-' },
        { title: '直播状态', width: 120, render: (_, row) => liveStatusLabel(row.liveRoom?.status || 'NOT_STARTED') },
        {
          title: '状态',
          dataIndex: 'status',
          width: 140,
          render: (v, row) => <Select value={v} style={{ width: 120 }} onChange={(value) => status.mutate({ id: row.id, value })} options={[{ value: 'DRAFT', label: '草稿' }, { value: 'PUBLISHED', label: '已发布' }, { value: 'OFFLINE', label: '已下架' }]} />,
        },
        {
          title: '关联商品',
          width: 320,
          className: 'select-table-cell',
          render: (_, row) => <Select mode="multiple" maxTagCount="responsive" className="table-select" value={row.products.map((item) => item.product.id)} options={products.map((item) => ({ value: item.id, label: item.title }))} onChange={(productIds) => bind.mutate({ id: row.id, productIds })} />,
        },
        {
          title: '当前讲解',
          width: 200,
          className: 'select-table-cell',
          render: (_, row) => row.liveRoomId ? (
            <Select
              className="table-select"
              placeholder="选择商品"
              value={row.liveRoom?.currentProductId || undefined}
              options={row.products.map((item) => ({ value: item.product.id, label: item.product.title }))}
              onChange={(productId) => current.mutate({ liveRoomId: row.liveRoomId!, productId })}
            />
          ) : '-',
        },
        { title: '视频地址', dataIndex: 'videoUrl', width: 240, ellipsis: true },
        {
          title: '操作',
          width: 170,
          render: (_, row) => (
            <Space>
              <Button onClick={() => openEdit(row)}>编辑</Button>
              <Button disabled={!row.liveRoomId} onClick={() => openMarketing(row)}>营销</Button>
            </Space>
          ),
        },
      ]} />
      <Modal
        title={editing ? '编辑内容' : '上传短视频'}
        open={open}
        width={720}
        onCancel={() => { setOpen(false); setEditing(null); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
      >
        <Form form={form} layout="vertical" requiredMark={false} onFinish={(values) => save.mutate({ ...values, productIds: values.productIds || [] })}>
          <Form.Item name="title" label="视频标题" rules={[{ required: true, message: '请输入视频标题' }, { min: 2, message: '标题至少 2 个字' }]}>
            <Input placeholder="例如：与辉同行 讲解 德州扒鸡" />
          </Form.Item>
          <Form.Item label="作者/商家">
            <Input value={currentUser.nickname} disabled />
          </Form.Item>
          <Form.Item name="videoUrl" hidden rules={[{ required: true, message: '请先上传本地视频' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="本地视频" required>
            <Upload
              accept="video/*"
              maxCount={1}
              showUploadList={false}
              customRequest={({ file, onSuccess, onError }) => {
                uploadVideo.mutate(file as File, {
                  onSuccess: () => onSuccess?.('ok'),
                  onError: (error) => onError?.(error as Error),
                })
              }}
            >
              <Button loading={uploadVideo.isPending}>{editing ? '重新上传视频' : '选择并上传视频'}</Button>
            </Upload>
            <div className="upload-hint">
              {uploadedVideoName ? `已上传：${uploadedVideoName}` : form.getFieldValue('videoUrl') ? '已存在视频，如需替换请重新上传。' : '请选择本地视频文件，上传成功后会自动保存腾讯云视频地址。'}
            </div>
          </Form.Item>
          <Form.Item name="productIds" label="关联商品">
            <Select mode="multiple" placeholder="选择要挂载到视频下方的商品" options={products.map((item) => ({ value: item.id, label: item.title }))} />
          </Form.Item>
          <Form.Item label="AI 内容辅助">
            <Space wrap>
              <Button onClick={handleGenerateAiDraft} loading={generateAiDraft.isPending}>根据商品生成文案</Button>
              <Typography.Text type="secondary">生成短视频标题、商品卖点、推荐语和直播讲解文案。</Typography.Text>
            </Space>
          </Form.Item>
          <Form.Item name="status" label="视频状态" rules={[{ required: true, message: '请选择视频状态' }]}>
            <Select options={[{ value: 'DRAFT', label: '草稿' }, { value: 'PUBLISHED', label: '已发布' }, { value: 'OFFLINE', label: '已下架' }]} />
          </Form.Item>
          <Form.Item name="liveTitle" label="直播间标题">
            <Input placeholder="默认使用视频标题" />
          </Form.Item>
          <Form.Item name="currentProductId" label="当前讲解商品">
            <Select allowClear placeholder="请从关联商品中选择" options={selectedProducts.map((item) => ({ value: item.id, label: item.title }))} />
          </Form.Item>
          <Form.Item name="liveStatus" label="直播状态" rules={[{ required: true, message: '请选择直播状态' }]}>
            <Select options={[{ value: 'NOT_STARTED', label: '未开始' }, { value: 'LIVE', label: '直播中' }, { value: 'ENDED', label: '已结束' }]} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="AI 生成内容"
        open={!!aiDraft}
        width={820}
        onCancel={() => setAiDraft(null)}
        footer={aiDraft ? [
          <Button key="download" onClick={() => downloadTextFile(`AI内容方案-${new Date().toISOString().slice(0, 10)}.txt`, draftToText(aiDraft))}>下载到本地</Button>,
          <Button key="title" onClick={() => aiDraft.videoTitles[0] && form.setFieldValue('title', aiDraft.videoTitles[0])}>使用第一个标题</Button>,
          <Button key="close" type="primary" onClick={() => setAiDraft(null)}>完成</Button>,
        ] : null}
      >
        {aiDraft ? (
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <Card size="small" title="短视频标题">
              <Space direction="vertical" style={{ width: '100%' }}>
                {aiDraft.videoTitles.map((item, index) => <Typography.Text key={`${item}-${index}`}>{index + 1}. {item}</Typography.Text>)}
              </Space>
            </Card>
            <Card size="small" title="商品卖点">
              <Space direction="vertical" style={{ width: '100%' }}>
                {aiDraft.sellingPoints.map((item, index) => <Typography.Text key={`${item}-${index}`}>{index + 1}. {item}</Typography.Text>)}
              </Space>
            </Card>
            <Card size="small" title="商品推荐语">
              <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{aiDraft.recommendation}</Typography.Paragraph>
            </Card>
            <Card size="small" title="直播讲解文案">
              <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{aiDraft.liveScript}</Typography.Paragraph>
            </Card>
          </Space>
        ) : null}
      </Modal>
      <Modal
        title={marketingVideo ? `营销配置：${marketingVideo.title}` : '营销配置'}
        open={!!marketingVideo}
        width={920}
        onCancel={() => { setMarketingVideo(null); marketingForm.resetFields() }}
        onOk={() => marketingForm.submit()}
        confirmLoading={saveMarketing.isPending}
      >
        <Typography.Paragraph type="secondary">保存后会实时同步到客户端直播间。金额单位为元，折扣填 1-100，例如 8 折填写 80；秒杀倒计时单位为秒。</Typography.Paragraph>
        <Form form={marketingForm} layout="vertical" onFinish={(values) => saveMarketing.mutate(values)} initialValues={{ rules: [] }}>
          <Form.List name="rules">
            {(fields, { add, remove }) => (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Space wrap>
                  <Button onClick={() => add({ type: 'COUPON', title: '直播间优惠券', status: 'ACTIVE', minAmount: 99, amount: 10 })}>添加优惠券</Button>
                  <Button onClick={() => add({ type: 'DISCOUNT', title: '限时折扣', status: 'ACTIVE', discountPercent: 90 })}>添加限时折扣</Button>
                  <Button onClick={() => add({ type: 'FULL_REDUCTION', title: '满减活动', status: 'ACTIVE', minAmount: 199, amount: 30 })}>添加满减</Button>
                  <Button onClick={() => add({ type: 'SECKILL', title: '秒杀活动', status: 'ACTIVE', discountPercent: 70, countdownSeconds: 60 })}>添加秒杀</Button>
                </Space>
                {fields.map((field) => (
                  <Form.Item key={field.key} noStyle shouldUpdate>
                    {({ getFieldValue }) => {
                      const type = getFieldValue(['rules', field.name, 'type']) as MarketingRule['type'] | undefined
                      const needsProduct = type === 'DISCOUNT' || type === 'SECKILL'
                      const needsAmount = type === 'COUPON' || type === 'FULL_REDUCTION'
                      const needsThreshold = type === 'COUPON' || type === 'FULL_REDUCTION'
                      const needsDiscount = type === 'DISCOUNT' || type === 'SECKILL'
                      return (
                        <Card size="small" className="marketing-rule-card">
                          <div className="marketing-rule-grid">
                            <Form.Item name={[field.name, 'type']} label="类型" rules={[{ required: true }]}>
                              <Select options={[
                                { value: 'COUPON', label: '优惠券' },
                                { value: 'DISCOUNT', label: '限时折扣' },
                                { value: 'FULL_REDUCTION', label: '满减' },
                                { value: 'SECKILL', label: '秒杀' },
                              ]} />
                            </Form.Item>
                            <Form.Item name={[field.name, 'title']} label="标题" rules={[{ required: true }]}><Input /></Form.Item>
                            <Form.Item name={[field.name, 'status']} label="状态" rules={[{ required: true }]}>
                              <Select options={[{ value: 'ACTIVE', label: '启用' }, { value: 'INACTIVE', label: '停用' }]} />
                            </Form.Item>
                            {needsProduct ? (
                              <Form.Item name={[field.name, 'productId']} label="指定商品">
                                <Select allowClear placeholder="不选则全场生效" options={(marketingVideo?.products || []).map((item) => ({ value: item.product.id, label: item.product.title }))} />
                              </Form.Item>
                            ) : null}
                            {needsDiscount ? <Form.Item name={[field.name, 'discountPercent']} label={type === 'SECKILL' ? '秒杀折扣' : '折扣'} rules={[{ required: true, message: '请填写折扣' }]}><InputNumber min={1} max={100} addonAfter="%" style={{ width: '100%' }} /></Form.Item> : null}
                            {needsThreshold ? <Form.Item name={[field.name, 'minAmount']} label="门槛金额" rules={[{ required: true, message: '请填写门槛金额' }]}><InputNumber min={0} addonAfter="元" style={{ width: '100%' }} /></Form.Item> : null}
                            {needsAmount ? <Form.Item name={[field.name, 'amount']} label="优惠金额" rules={[{ required: true, message: '请填写优惠金额' }]}><InputNumber min={0} addonAfter="元" style={{ width: '100%' }} /></Form.Item> : null}
                            {type === 'SECKILL' ? <Form.Item name={[field.name, 'countdownSeconds']} label="倒计时" rules={[{ required: true, message: '请填写倒计时' }]}><InputNumber min={1} addonAfter="秒" style={{ width: '100%' }} /></Form.Item> : null}
                            <Form.Item label="操作"><Button danger onClick={() => remove(field.name)}>删除</Button></Form.Item>
                          </div>
                        </Card>
                      )
                    }}
                  </Form.Item>
                ))}
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>
    </>
  )
}

function LiveRoomList({ currentUser }: { currentUser: User }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<LiveRoom | null>(null)
  const [uploadedCoverName, setUploadedCoverName] = useState('')
  const [uploadedVideoName, setUploadedVideoName] = useState('')
  const [form] = Form.useForm()
  const coverUrl = Form.useWatch('coverUrl', form)
  const videoUrl = Form.useWatch('videoUrl', form)
  const { data: products = [] } = useQuery({ queryKey: ['admin-products'], queryFn: () => request.get('/admin/products') as Promise<Product[]> })
  const { data = [], isLoading } = useQuery({ queryKey: ['admin-live-rooms'], queryFn: () => request.get('/admin/live-rooms') as Promise<LiveRoom[]> })
  const current = useMutation({ mutationFn: ({ id, productId }: { id: string; productId: string }) => request.patch(`/admin/live-rooms/${id}/current-product`, { productId }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-live-rooms'] }) })
  const bind = useMutation({ mutationFn: ({ id, productIds }: { id: string; productIds: string[] }) => request.post(`/admin/live-rooms/${id}/products`, { productIds }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-live-rooms'] }) })
  const coupon = useMutation({ mutationFn: (id: string) => request.post(`/admin/live-rooms/${id}/push-coupon`), onSuccess: () => message.success('优惠券已推送') })
  const save = useMutation({
    mutationFn: (values: {
      title: string
      coverUrl: string
      videoUrl?: string
      anchorName: string
      anchorAvatar?: string
      status: string
      productIds: string[]
      currentProductId?: string
    }) => editing ? request.patch(`/admin/live-rooms/${editing.id}`, values) : request.post('/admin/live-rooms', values),
    onSuccess: () => {
      message.success('直播间已保存')
      setOpen(false)
      setEditing(null)
      setUploadedCoverName('')
      setUploadedVideoName('')
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['admin-live-rooms'] })
      queryClient.invalidateQueries({ queryKey: ['overview'] })
    },
    onError: (error) => message.error((error as Error).message),
  })
  const uploadCover = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return request.post('/admin/upload/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } }) as Promise<{ key: string; url: string }>
    },
    onSuccess: (result, file) => {
      form.setFieldValue('coverUrl', result.url)
      setUploadedCoverName(file.name)
      message.success('直播封面已上传到腾讯云 COS')
    },
    onError: (error) => message.error((error as Error).message),
  })
  const uploadLiveVideo = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return request.post('/admin/upload/video', formData, { headers: { 'Content-Type': 'multipart/form-data' } }) as Promise<{ key: string; url: string }>
    },
    onSuccess: (result, file) => {
      form.setFieldValue('videoUrl', result.url)
      setUploadedVideoName(file.name)
      message.success('模拟直播视频已上传到腾讯云 COS')
    },
    onError: (error) => message.error((error as Error).message),
  })

  function openCreate() {
    setEditing(null)
    setUploadedCoverName('')
    setUploadedVideoName('')
    form.resetFields()
    form.setFieldsValue({
      anchorName: currentUser.nickname,
      anchorAvatar: currentUser.avatarUrl || undefined,
      status: 'NOT_STARTED',
      productIds: [],
    })
    setOpen(true)
  }

  function openEdit(room: LiveRoom) {
    setEditing(room)
    setUploadedCoverName('')
    setUploadedVideoName('')
    form.setFieldsValue({
      title: room.title,
      coverUrl: room.coverUrl,
      videoUrl: room.videoUrl || undefined,
      anchorName: room.anchorName,
      anchorAvatar: room.anchorAvatar || undefined,
      status: normalizeLiveStatus(room.status),
      productIds: room.products.map((item) => item.product.id),
      currentProductId: room.currentProductId,
    })
    setOpen(true)
  }

  return (
    <>
      <div className="toolbar"><Button type="primary" onClick={openCreate}>创建模拟直播间</Button></div>
      <Table rowKey="id" loading={isLoading} dataSource={data} columns={[
        { title: '封面', dataIndex: 'coverUrl', width: 96, render: (url) => <Image width={58} height={58} src={url} className="product-thumb" /> },
        { title: '直播间', dataIndex: 'title', width: 220 },
        { title: '主播', dataIndex: 'anchorName', width: 140 },
        { title: '状态', dataIndex: 'status', width: 130, render: liveStatusLabel },
        { title: '绑定商品', render: (_, row) => <Select mode="multiple" maxTagCount="responsive" style={{ minWidth: 260 }} value={row.products.map((item) => item.product.id)} options={products.map((item) => ({ value: item.id, label: item.title }))} onChange={(productIds) => bind.mutate({ id: row.id, productIds })} /> },
        { title: '当前讲解商品', render: (_, row) => <Select style={{ minWidth: 220 }} value={row.currentProductId} options={row.products.map((item) => ({ value: item.product.id, label: item.product.title }))} onChange={(productId) => current.mutate({ id: row.id, productId })} /> },
        {
          title: '操作',
          width: 190,
          render: (_, row) => (
            <Space>
              <Button onClick={() => openEdit(row)}>编辑</Button>
              <Button onClick={() => coupon.mutate(row.id)}>推券</Button>
            </Space>
          ),
        },
      ]} />
      <Modal
        title={editing ? '编辑直播间' : '创建模拟直播间'}
        open={open}
        width={780}
        onCancel={() => { setOpen(false); setEditing(null); setUploadedCoverName(''); setUploadedVideoName(''); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
      >
        <Form form={form} layout="vertical" requiredMark={false} onFinish={(values) => save.mutate({ ...values, productIds: values.productIds || [] })}>
          <Form.Item name="title" label="直播标题" rules={[{ required: true, message: '请输入直播标题' }, { min: 2, message: '直播标题至少 2 个字' }]}>
            <Input placeholder="例如：今晚 8 点厨房好物专场" />
          </Form.Item>
          <Form.Item name="coverUrl" hidden rules={[{ required: true, message: '请先上传直播封面' }]}><Input /></Form.Item>
          <Form.Item label="直播封面" required>
            <Space align="start">
              {coverUrl ? <Image width={112} height={78} src={coverUrl} className="live-preview" /> : null}
              <div>
                <Upload
                  accept="image/*"
                  maxCount={1}
                  showUploadList={false}
                  customRequest={({ file, onSuccess, onError }) => {
                    uploadCover.mutate(file as File, {
                      onSuccess: () => onSuccess?.('ok'),
                      onError: (error) => onError?.(error as Error),
                    })
                  }}
                >
                  <Button loading={uploadCover.isPending}>{coverUrl ? '重新上传封面' : '选择并上传封面'}</Button>
                </Upload>
                <div className="upload-hint">
                  {uploadedCoverName ? `已上传：${uploadedCoverName}` : coverUrl ? '封面已在腾讯云 COS 中。' : '请选择本地图片，上传成功后自动写入封面地址。'}
                </div>
              </div>
            </Space>
          </Form.Item>
          <Form.Item name="videoUrl" hidden rules={[{ required: true, message: '请先上传模拟直播视频' }]}><Input /></Form.Item>
          <Form.Item label="模拟直播视频" required>
            <Upload
              accept="video/*"
              maxCount={1}
              showUploadList={false}
              customRequest={({ file, onSuccess, onError }) => {
                uploadLiveVideo.mutate(file as File, {
                  onSuccess: () => onSuccess?.('ok'),
                  onError: (error) => onError?.(error as Error),
                })
              }}
            >
              <Button loading={uploadLiveVideo.isPending}>{videoUrl ? '重新上传视频' : '选择并上传视频'}</Button>
            </Upload>
            <div className="upload-hint">
              {uploadedVideoName ? `已上传：${uploadedVideoName}` : videoUrl ? '已存在模拟直播视频，如需替换请重新上传。' : '这里不接真实直播流，上传一个本地视频作为直播间播放内容。'}
            </div>
          </Form.Item>
          <Form.Item name="anchorName" label="主播名称" rules={[{ required: true, message: '请输入主播名称' }]}>
            <Input placeholder="默认使用当前登录用户昵称" />
          </Form.Item>
          <Form.Item name="anchorAvatar" label="主播头像地址">
            <Input placeholder="可选，默认使用当前登录用户头像" />
          </Form.Item>
          <Form.Item name="productIds" label="商品列表">
            <Select mode="multiple" placeholder="选择直播间挂载商品" options={products.map((item) => ({ value: item.id, label: item.title }))} />
          </Form.Item>
          <Form.Item name="currentProductId" label="当前讲解商品">
            <Select allowClear placeholder="不选则默认使用商品列表中的第一个" options={products.map((item) => ({ value: item.id, label: item.title }))} />
          </Form.Item>
          <Form.Item name="status" label="直播状态" rules={[{ required: true, message: '请选择直播状态' }]}>
            <Select options={[{ value: 'NOT_STARTED', label: '未开始' }, { value: 'LIVE', label: '直播中' }, { value: 'ENDED', label: '已结束' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

function AdminShell({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <Layout className="shell">
      <Layout.Header className="header">
        <span>直播带货运营后台</span>
        <Space>
          <span className="header-user">{user.nickname}</span>
          <Button size="small" onClick={onLogout}>退出登录</Button>
        </Space>
      </Layout.Header>
      <Layout.Content className="content">
        <Space direction="vertical" size={18} style={{ width: '100%' }}>
          <Dashboard />
          <Card>
            <Tabs items={[
              { key: 'content', label: '内容管理', children: <VideoList currentUser={user} /> },
              { key: 'products', label: '商品管理', children: <ProductList /> },
              { key: 'analytics', label: '运营分析', children: <AnalyticsPage /> },
            ]} />
          </Card>
        </Space>
      </Layout.Content>
    </Layout>
  )
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(adminTokenKey) || '')
  const queryClient = useQueryClient()
  const me = useQuery({
    queryKey: ['admin-me', token],
    queryFn: () => request.get('/users/me') as Promise<User | null>,
    enabled: !!token,
    retry: false,
    refetchInterval: 5000,
  })

  function handleLogin(payload: { token: string; user: User }) {
    setToken(payload.token)
    queryClient.setQueryData(['admin-me', payload.token], payload.user)
  }

  function handleLogout() {
    localStorage.removeItem(adminTokenKey)
    setToken('')
    queryClient.clear()
  }

  if (!token) return <LoginScreen onLogin={handleLogin} />
  if (me.isLoading) return <div className="login-page"><Card>正在验证登录状态...</Card></div>
  if (me.isError || !me.data) {
    localStorage.removeItem(adminTokenKey)
    return <LoginScreen onLogin={handleLogin} />
  }

  return <AdminShell user={me.data} onLogout={handleLogout} />
}

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient()}>
    <App />
  </QueryClientProvider>,
)
