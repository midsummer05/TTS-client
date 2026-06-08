import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Form, Input, InputNumber, Layout, Modal, Select, Space, Table, Tabs, Typography, Upload, message }
  from 'antd'
import axios from 'axios'
import React, { useState } from 'react'
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
}

type LiveRoom = {
  id: string
  title: string
  status: string
  anchorName: string
  currentProductId?: string
  products: Array<{ product: Product }>
}

function price(value: number) {
  return `¥${(value / 100).toFixed(2)}`
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

function ProductList() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form] = Form.useForm()
  const { data = [], isLoading } = useQuery({ queryKey: ['admin-products'], queryFn: () => request.get('/admin/products') as Promise<Product[]> })
  const save = useMutation({
    mutationFn: (values: Partial<Product>) => editing ? request.patch(`/admin/products/${editing.id}`, values) : request.post('/admin/products', values),
    onSuccess: () => {
      message.success('商品已保存')
      setOpen(false)
      setEditing(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
    },
  })
  const status = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) => request.patch(`/admin/products/${id}/status`, { status: value }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-products'] }),
  })

  return (
    <>
      <div className="toolbar"><Button type="primary" onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>新增商品</Button></div>
      <Table rowKey="id" loading={isLoading} dataSource={data} columns={[
        { title: '商品', dataIndex: 'title' },
        { title: '价格', dataIndex: 'price', render: price },
        { title: '库存', dataIndex: 'stock' },
        { title: '销量', dataIndex: 'sales' },
        { title: '状态', dataIndex: 'status', render: (v, row) => <Select value={v} style={{ width: 120 }} onChange={(value) => status.mutate({ id: row.id, value })} options={[{ value: 'ON_SALE', label: '上架' }, { value: 'OFF_SALE', label: '下架' }]} /> },
        { title: '操作', render: (_, row) => <Button onClick={() => { setEditing(row); form.setFieldsValue({ ...row, price: row.price / 100, originPrice: row.originPrice ? row.originPrice / 100 : undefined }); setOpen(true) }}>编辑</Button> },
      ]} />
      <Modal title={editing ? '编辑商品' : '新增商品'} open={open} onCancel={() => { setOpen(false); setEditing(null); form.resetFields() }} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={(values) => save.mutate({ ...values, price: Math.round(values.price * 100), originPrice: values.originPrice ? Math.round(values.originPrice * 100) : undefined, status: editing?.status || 'ON_SALE', sales: editing?.sales || 0 })}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="coverUrl" label="封面 URL" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="price" label="价格（元）" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="originPrice" label="原价（元）"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="stock" label="库存" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="category" label="类目"><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea /></Form.Item>
        </Form>
      </Modal>
    </>
  )
}

function VideoList({ currentUser }: { currentUser: User }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Video | null>(null)
  const [uploadedVideoName, setUploadedVideoName] = useState('')
  const [form] = Form.useForm()
  const { data: products = [] } = useQuery({ queryKey: ['admin-products'], queryFn: () => request.get('/admin/products') as Promise<Product[]> })
  const { data = [], isLoading } = useQuery({ queryKey: ['admin-videos'], queryFn: () => request.get('/admin/videos') as Promise<Video[]> })
  const bind = useMutation({ mutationFn: ({ id, productIds }: { id: string; productIds: string[] }) => request.post(`/admin/videos/${id}/products`, { productIds }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-videos'] }) })
  const status = useMutation({ mutationFn: ({ id, value }: { id: string; value: string }) => request.patch(`/admin/videos/${id}/status`, { status: value }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-videos'] }) })
  const save = useMutation({
    mutationFn: (values: {
      title: string
      videoUrl: string
      status: string
      productIds: string[]
    }) => editing ? request.patch(`/admin/videos/${editing.id}`, values) : request.post('/admin/videos', values),
    onSuccess: () => {
      message.success('内容已保存')
      setOpen(false)
      setEditing(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['admin-videos'] })
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

  function openCreate() {
    setEditing(null)
    setUploadedVideoName('')
    form.resetFields()
    form.setFieldsValue({ status: 'DRAFT', productIds: [] })
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
    })
    setOpen(true)
  }

  return (
    <>
      <div className="toolbar">
        <Button type="primary" onClick={openCreate}>上传短视频</Button>
      </div>
      <Table rowKey="id" loading={isLoading} dataSource={data} columns={[
        { title: '标题', dataIndex: 'title', width: 260 },
        { title: '作者', dataIndex: 'authorName', width: 140 },
        {
          title: '状态',
          dataIndex: 'status',
          width: 140,
          render: (v, row) => <Select value={v} style={{ width: 120 }} onChange={(value) => status.mutate({ id: row.id, value })} options={[{ value: 'DRAFT', label: '草稿' }, { value: 'PUBLISHED', label: '已发布' }, { value: 'OFFLINE', label: '已下架' }]} />,
        },
        {
          title: '关联商品',
          render: (_, row) => <Select mode="multiple" maxTagCount="responsive" style={{ minWidth: 280 }} value={row.products.map((item) => item.product.id)} options={products.map((item) => ({ value: item.id, label: item.title }))} onChange={(productIds) => bind.mutate({ id: row.id, productIds })} />,
        },
        { title: '视频地址', dataIndex: 'videoUrl', ellipsis: true },
        { title: '操作', width: 100, render: (_, row) => <Button onClick={() => openEdit(row)}>编辑</Button> },
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
          <Form.Item name="status" label="视频状态" rules={[{ required: true, message: '请选择视频状态' }]}>
            <Select options={[{ value: 'DRAFT', label: '草稿' }, { value: 'PUBLISHED', label: '已发布' }, { value: 'OFFLINE', label: '已下架' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

function LiveRoomList() {
  const queryClient = useQueryClient()
  const { data: products = [] } = useQuery({ queryKey: ['admin-products'], queryFn: () => request.get('/admin/products') as Promise<Product[]> })
  const { data = [], isLoading } = useQuery({ queryKey: ['admin-live-rooms'], queryFn: () => request.get('/admin/live-rooms') as Promise<LiveRoom[]> })
  const current = useMutation({ mutationFn: ({ id, productId }: { id: string; productId: string }) => request.patch(`/admin/live-rooms/${id}/current-product`, { productId }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-live-rooms'] }) })
  const bind = useMutation({ mutationFn: ({ id, productIds }: { id: string; productIds: string[] }) => request.post(`/admin/live-rooms/${id}/products`, { productIds }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-live-rooms'] }) })
  const coupon = useMutation({ mutationFn: (id: string) => request.post(`/admin/live-rooms/${id}/push-coupon`), onSuccess: () => message.success('优惠券已推送') })
  return (
    <Table rowKey="id" loading={isLoading} dataSource={data} columns={[
      { title: '直播间', dataIndex: 'title' },
      { title: '主播', dataIndex: 'anchorName' },
      { title: '状态', dataIndex: 'status' },
      { title: '绑定商品', render: (_, row) => <Select mode="multiple" style={{ minWidth: 260 }} value={row.products.map((item) => item.product.id)} options={products.map((item) => ({ value: item.id, label: item.title }))} onChange={(productIds) => bind.mutate({ id: row.id, productIds })} /> },
      { title: '当前讲解商品', render: (_, row) => <Select style={{ minWidth: 260 }} value={row.currentProductId} options={row.products.map((item) => ({ value: item.product.id, label: item.product.title }))} onChange={(productId) => current.mutate({ id: row.id, productId })} /> },
      { title: '操作', render: (_, row) => <Button onClick={() => coupon.mutate(row.id)}>推送优惠券</Button> },
    ]} />
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
              { key: 'live', label: '直播间管理', children: <LiveRoomList /> },
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
