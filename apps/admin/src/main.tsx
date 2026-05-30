import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Form, Input, InputNumber, Layout, Modal, Select, Space, Table, Tabs, Tag, message } from 'antd'
import axios from 'axios'
import React, { useState } from 'react'
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

function price(value: number) {
  return `¥${(value / 100).toFixed(2)}`
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

function VideoList() {
  const queryClient = useQueryClient()
  const { data: products = [] } = useQuery({ queryKey: ['admin-products'], queryFn: () => request.get('/admin/products') as Promise<Product[]> })
  const { data = [], isLoading } = useQuery({ queryKey: ['admin-videos'], queryFn: () => request.get('/admin/videos') as Promise<Video[]> })
  const bind = useMutation({ mutationFn: ({ id, productIds }: { id: string; productIds: string[] }) => request.post(`/admin/videos/${id}/products`, { productIds }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-videos'] }) })
  const status = useMutation({ mutationFn: ({ id, value }: { id: string; value: string }) => request.patch(`/admin/videos/${id}/status`, { status: value }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-videos'] }) })
  return (
    <Table rowKey="id" loading={isLoading} dataSource={data} columns={[
      { title: '标题', dataIndex: 'title' },
      { title: '作者', dataIndex: 'authorName' },
      { title: '状态', dataIndex: 'status', render: (v, row) => <Select value={v} style={{ width: 130 }} onChange={(value) => status.mutate({ id: row.id, value })} options={[{ value: 'DRAFT', label: '草稿' }, { value: 'PUBLISHED', label: '发布' }, { value: 'OFFLINE', label: '下架' }]} /> },
      { title: '绑定商品', render: (_, row) => <Select mode="multiple" style={{ minWidth: 260 }} defaultValue={row.products.map((item) => item.product.id)} options={products.map((item) => ({ value: item.id, label: item.title }))} onChange={(productIds) => bind.mutate({ id: row.id, productIds })} /> },
    ]} />
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

function App() {
  return (
    <Layout className="shell">
      <Layout.Header className="header">直播带货运营后台</Layout.Header>
      <Layout.Content className="content">
        <Space direction="vertical" size={18} style={{ width: '100%' }}>
          <Dashboard />
          <Card>
            <Tabs items={[
              { key: 'products', label: '商品管理', children: <ProductList /> },
              { key: 'videos', label: '视频管理', children: <VideoList /> },
              { key: 'live', label: '直播间管理', children: <LiveRoomList /> },
            ]} />
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
