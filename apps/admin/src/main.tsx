import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Layout,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  message,
} from 'antd'
import axios from 'axios'
import React, { useCallback, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import 'antd/dist/reset.css'
import './styles.css'

const request = axios.create({ baseURL: 'http://localhost:4000/api' })
request.interceptors.response.use((res) => res.data.data)

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
}

type Video = {
  id: string
  title: string
  status: string
  authorName: string
  products: Array<{ product: Product }>
}

type LiveRoom = {
  id: string
  title: string
  status: string
  anchorName: string
  currentProductId?: string
  products: Array<{ product: Product }>
}

type GenerateType =
  | 'video_title'
  | 'selling_point'
  | 'live_script'
  | 'recommend_copy'

const TYPE_LABELS: Record<GenerateType, string> = {
  video_title: '短视频标题',
  selling_point: '商品卖点',
  live_script: '直播讲解文案',
  recommend_copy: '商品推荐语',
}

function price(value: number) {
  return `¥${(value / 100).toFixed(2)}`
}

/* ---------- SSE streaming helper ---------- */
async function streamAiGenerate(
  type: GenerateType,
  product: Partial<Product>,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
) {
  try {
    const response = await fetch(
      'http://localhost:4000/api/ai/generate/stream',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, product }),
      },
    )

    if (!response.ok) {
      onError(`请求失败: ${response.status}`)
      return
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6)
          if (payload === '[DONE]') {
            onDone()
            return
          }
          try {
            const parsed = JSON.parse(payload)
            if (parsed.error) {
              onError(parsed.error)
              return
            }
            if (parsed.content) {
              onChunk(parsed.content)
            }
          } catch {
            /* skip incomplete JSON */
          }
        }
      }
    }
    onDone()
  } catch (err: any) {
    onError(err.message || '网络连接失败，请检查后端服务是否启动')
  }
}

/* ---------- AI Generation Modal ---------- */
function AIGenerateModal({
  open,
  onClose,
  product,
  initialType = 'selling_point',
  onFill,
}: {
  open: boolean
  onClose: () => void
  product: Partial<Product>
  initialType?: GenerateType
  onFill: (text: string) => void
}) {
  const [genType, setGenType] = useState<GenerateType>(initialType)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const abortRef = useRef(false)

  // 用 ref 直接操作 DOM，绕过 React 18 批处理，实现逐 token 流式渲染
  const contentRef = useRef('')
  const displayRef = useRef<HTMLDivElement>(null)

  function appendChunk(chunk: string) {
    contentRef.current += chunk
    if (displayRef.current) {
      displayRef.current.textContent = contentRef.current
      displayRef.current.scrollTop = displayRef.current.scrollHeight
    }
  }

  const startGenerate = useCallback(() => {
    contentRef.current = ''
    if (displayRef.current) displayRef.current.textContent = ''
    setError('')
    setDone(false)
    setLoading(true)
    abortRef.current = false

    streamAiGenerate(
      genType,
      product,
      (chunk) => {
        if (!abortRef.current) appendChunk(chunk)
      },
      () => {
        setLoading(false)
        setDone(true)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
  }, [genType, product])

  // 打开弹窗时自动开始生成（useEffect 避免 render 阶段副作用）
  const prevOpen = useRef(false)
  React.useEffect(() => {
    if (open && !prevOpen.current) {
      prevOpen.current = true
      startGenerate()
    }
    if (!open) {
      prevOpen.current = false
      abortRef.current = true
      contentRef.current = ''
      if (displayRef.current) displayRef.current.textContent = ''
      setError('')
      setDone(false)
      setLoading(false)
    }
  }, [open, startGenerate])

  const hasContent = contentRef.current.length > 0

  const displayBoxStyle: React.CSSProperties = {
    minHeight: 200,
    maxHeight: 400,
    overflow: 'auto',
    background: '#fafafa',
    borderRadius: 8,
    padding: 16,
    whiteSpace: 'pre-wrap',
    lineHeight: 1.8,
    fontSize: 14,
    color: '#1d1d1d',
    position: 'relative',
  }

  return (
    <Modal
      title="AI 智能生成"
      open={open}
      onCancel={onClose}
      width={640}
      footer={[
        <Button key="retry" onClick={startGenerate} loading={loading}>
          重新生成
        </Button>,
        <Button
          key="copy"
          onClick={() => {
            navigator.clipboard
              .writeText(contentRef.current)
              .then(() => message.success('已复制到剪贴板'))
          }}
          disabled={!hasContent}
        >
          复制
        </Button>,
        <Button
          key="fill"
          type="primary"
          disabled={!hasContent}
          onClick={() => {
            onFill(contentRef.current)
            onClose()
          }}
        >
          填入
        </Button>,
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <span style={{ marginRight: 8 }}>生成类型：</span>
        <Select
          value={genType}
          onChange={(v) => {
            setGenType(v)
            contentRef.current = ''
            if (displayRef.current) displayRef.current.textContent = ''
            setError('')
            setDone(false)
            // 切换后自动重新生成
            setTimeout(() => startGenerate(), 0)
          }}
          style={{ width: 180 }}
          options={Object.entries(TYPE_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        {done && (
          <span style={{ marginLeft: 12, color: '#52c41a' }}>✓ 生成完成</span>
        )}
      </div>

      {error ? (
        <div
          style={{
            color: '#ff4d4f',
            padding: 24,
            background: '#fff2f0',
            borderRadius: 8,
            whiteSpace: 'pre-wrap',
          }}
        >
          {error}
          <div style={{ marginTop: 12, fontSize: 12, color: '#999' }}>
            请确认 .env 中 AI_API_KEY 已正确配置，且后端服务已重启。
          </div>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* loading 层独立于内容 div，不与 ref 控制的 DOM 冲突 */}
          {!hasContent && loading && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
                pointerEvents: 'none',
              }}
            >
              <Spin tip="AI 正在生成中..." />
            </div>
          )}
          {/* 内容展示 div：零 React 子节点，完全由 ref 控制 DOM */}
          <div ref={displayRef} style={displayBoxStyle} />
        </div>
      )}
    </Modal>
  )
}

/* ---------- Dashboard ---------- */
function Dashboard() {
  const { data } = useQuery({
    queryKey: ['overview'],
    queryFn: () => request.get('/admin/dashboard/overview') as Promise<any>,
  })
  return (
    <div className="metrics">
      {[
        ['商品数', data?.productCount || 0],
        ['视频数', data?.videoCount || 0],
        ['直播间', data?.liveRoomCount || 0],
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

/* ---------- Product List ---------- */
function ProductList() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form] = Form.useForm()
  const [aiOpen, setAiOpen] = useState(false)
  const [aiProduct, setAiProduct] = useState<Partial<Product>>({})
  const [aiType, setAiType] = useState<GenerateType>('selling_point')

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () => request.get('/admin/products') as Promise<Product[]>,
  })
  const save = useMutation({
    mutationFn: (values: Partial<Product>) =>
      editing
        ? request.patch(`/admin/products/${editing.id}`, values)
        : request.post('/admin/products', values),
    onSuccess: () => {
      message.success('商品已保存')
      setOpen(false)
      setEditing(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
    },
  })
  const status = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      request.patch(`/admin/products/${id}/status`, { status: value }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin-products'] }),
  })

  return (
    <>
      <div className="toolbar">
        <Button
          type="primary"
          onClick={() => {
            setEditing(null)
            form.resetFields()
            setOpen(true)
          }}
        >
          新增商品
        </Button>
      </div>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          { title: '商品', dataIndex: 'title' },
          { title: '价格', dataIndex: 'price', render: price },
          { title: '库存', dataIndex: 'stock' },
          { title: '销量', dataIndex: 'sales' },
          {
            title: '状态',
            dataIndex: 'status',
            render: (v, row) => (
              <Select
                value={v}
                style={{ width: 120 }}
                onChange={(value) => status.mutate({ id: row.id, value })}
                options={[
                  { value: 'ON_SALE', label: '上架' },
                  { value: 'OFF_SALE', label: '下架' },
                ]}
              />
            ),
          },
          {
            title: '操作',
            render: (_, row) => (
              <Space>
                <Button
                  onClick={() => {
                    setEditing(row)
                    form.setFieldsValue({
                      ...row,
                      price: row.price / 100,
                      originPrice: row.originPrice
                        ? row.originPrice / 100
                        : undefined,
                    })
                    setOpen(true)
                  }}
                >
                  编辑
                </Button>
                <Button
                  onClick={() => {
                    setAiProduct(row)
                    setAiType('selling_point')
                    setAiOpen(true)
                  }}
                >
                  🤖 AI 生成卖点
                </Button>
                <Button
                  onClick={() => {
                    setAiProduct(row)
                    setAiType('recommend_copy')
                    setAiOpen(true)
                  }}
                >
                  🤖 AI 生成推荐语
                </Button>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? '编辑商品' : '新增商品'}
        open={open}
        onCancel={() => {
          setOpen(false)
          setEditing(null)
          form.resetFields()
        }}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) =>
            save.mutate({
              ...values,
              price: Math.round(values.price * 100),
              originPrice: values.originPrice
                ? Math.round(values.originPrice * 100)
                : undefined,
              status: editing?.status || 'ON_SALE',
              sales: editing?.sales || 0,
            })
          }
        >
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="coverUrl"
            label="封面 URL"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="price"
            label="价格（元）"
            rules={[{ required: true }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="originPrice" label="原价（元）">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="stock" label="库存" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="category" label="类目">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <AIGenerateModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        product={aiProduct}
        initialType={aiType}
        onFill={(text) => {
          // 找到编辑弹窗并填入描述字段
          const currentDesc = form.getFieldValue('description') || ''
          form.setFieldsValue({
            description: currentDesc ? currentDesc + '\n\n' + text : text,
          })
          message.success('已填入描述')
        }}
      />
    </>
  )
}

/* ---------- Video List ---------- */
function VideoList() {
  const queryClient = useQueryClient()
  const [aiOpen, setAiOpen] = useState(false)
  const [aiProduct, setAiProduct] = useState<Partial<Product>>({})
  const { data: products = [] } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () => request.get('/admin/products') as Promise<Product[]>,
  })
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-videos'],
    queryFn: () => request.get('/admin/videos') as Promise<Video[]>,
  })
  const bind = useMutation({
    mutationFn: ({ id, productIds }: { id: string; productIds: string[] }) =>
      request.post(`/admin/videos/${id}/products`, { productIds }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin-videos'] }),
  })
  const status = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      request.patch(`/admin/videos/${id}/status`, { status: value }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin-videos'] }),
  })

  return (
    <>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          { title: '标题', dataIndex: 'title' },
          { title: '作者', dataIndex: 'authorName' },
          {
            title: '状态',
            dataIndex: 'status',
            render: (v, row) => (
              <Select
                value={v}
                style={{ width: 130 }}
                onChange={(value) => status.mutate({ id: row.id, value })}
                options={[
                  { value: 'DRAFT', label: '草稿' },
                  { value: 'PUBLISHED', label: '发布' },
                  { value: 'OFFLINE', label: '下架' },
                ]}
              />
            ),
          },
          {
            title: '绑定商品',
            render: (_, row) => (
              <Select
                mode="multiple"
                style={{ minWidth: 260 }}
                defaultValue={row.products.map((item) => item.product.id)}
                options={products.map((item) => ({
                  value: item.id,
                  label: item.title,
                }))}
                onChange={(productIds) =>
                  bind.mutate({ id: row.id, productIds })
                }
              />
            ),
          },
          {
            title: '操作',
            render: (_, row) => {
              const firstProduct = row.products[0]?.product
              return (
                <Button
                  disabled={!firstProduct}
                  onClick={() => {
                    setAiProduct(firstProduct)
                    setAiOpen(true)
                  }}
                >
                  🤖 AI 生成标题
                </Button>
              )
            },
          },
        ]}
      />
      <AIGenerateModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        product={aiProduct}
        initialType="video_title"
        onFill={(text) => message.success('标题文案已生成，可复制使用')}
      />
    </>
  )
}

/* ---------- Live Room List ---------- */
function LiveRoomList() {
  const queryClient = useQueryClient()
  const [aiOpen, setAiOpen] = useState(false)
  const [aiProduct, setAiProduct] = useState<Partial<Product>>({})
  const { data: products = [] } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () => request.get('/admin/products') as Promise<Product[]>,
  })
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-live-rooms'],
    queryFn: () => request.get('/admin/live-rooms') as Promise<LiveRoom[]>,
  })
  const current = useMutation({
    mutationFn: ({ id, productId }: { id: string; productId: string }) =>
      request.patch(`/admin/live-rooms/${id}/current-product`, { productId }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin-live-rooms'] }),
  })
  const bind = useMutation({
    mutationFn: ({ id, productIds }: { id: string; productIds: string[] }) =>
      request.post(`/admin/live-rooms/${id}/products`, { productIds }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin-live-rooms'] }),
  })
  const coupon = useMutation({
    mutationFn: (id: string) =>
      request.post(`/admin/live-rooms/${id}/push-coupon`),
    onSuccess: () => message.success('优惠券已推送'),
  })

  return (
    <>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          { title: '直播间', dataIndex: 'title' },
          { title: '主播', dataIndex: 'anchorName' },
          { title: '状态', dataIndex: 'status' },
          {
            title: '绑定商品',
            render: (_, row) => (
              <Select
                mode="multiple"
                style={{ minWidth: 260 }}
                value={row.products.map((item) => item.product.id)}
                options={products.map((item) => ({
                  value: item.id,
                  label: item.title,
                }))}
                onChange={(productIds) =>
                  bind.mutate({ id: row.id, productIds })
                }
              />
            ),
          },
          {
            title: '当前讲解商品',
            render: (_, row) => (
              <Select
                style={{ minWidth: 260 }}
                value={row.currentProductId}
                options={row.products.map((item) => ({
                  value: item.product.id,
                  label: item.product.title,
                }))}
                onChange={(productId) =>
                  current.mutate({ id: row.id, productId })
                }
              />
            ),
          },
          {
            title: '操作',
            render: (_, row) => (
              <Space>
                <Button onClick={() => coupon.mutate(row.id)}>
                  推送优惠券
                </Button>
                {row.currentProductId && (
                  <Button
                    onClick={() => {
                      const p = row.products.find(
                        (item) => item.product.id === row.currentProductId,
                      )?.product
                      if (p) {
                        setAiProduct(p)
                        setAiOpen(true)
                      }
                    }}
                  >
                    🤖 AI 讲解文案
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />
      <AIGenerateModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        product={aiProduct}
        initialType="live_script"
        onFill={(text) => message.success('讲解文案已生成，可复制使用')}
      />
    </>
  )
}

/* ---------- App ---------- */
function App() {
  return (
    <Layout className="shell">
      <Layout.Header className="header">直播带货运营后台</Layout.Header>
      <Layout.Content className="content">
        <Space direction="vertical" size={18} style={{ width: '100%' }}>
          <Dashboard />
          <Card>
            <Tabs
              items={[
                {
                  key: 'products',
                  label: '商品管理',
                  children: <ProductList />,
                },
                { key: 'videos', label: '视频管理', children: <VideoList /> },
                {
                  key: 'live',
                  label: '直播间管理',
                  children: <LiveRoomList />,
                },
              ]}
            />
          </Card>
        </Space>
      </Layout.Content>
    </Layout>
  )
}

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient()}>
    <App />
  </QueryClientProvider>,
)
