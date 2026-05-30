# API 文档

所有接口返回：

```ts
type ApiResponse<T> = {
  code: number
  message: string
  data: T
}
```

## Auth

- `POST /api/auth/mock-login`

## 视频

- `GET /api/videos?page=1&pageSize=10`
- `GET /api/videos/:id`
- `POST /api/videos/:id/like`
- `GET /api/videos/:id/products`
- `GET /api/videos/:id/comments`
- `POST /api/videos/:id/comments`

## 商品

- `GET /api/products`
- `GET /api/products/:id`

## 购物车

- `GET /api/cart`
- `POST /api/cart`
- `PATCH /api/cart/:cartItemId`
- `DELETE /api/cart/:cartItemId`
- `PATCH /api/cart/:cartItemId/selected`
- `PATCH /api/cart/select-all`

## 订单

- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/:id`
- `POST /api/orders/:id/pay`
- `POST /api/orders/:id/cancel`

## 直播

- `GET /api/live-rooms`
- `GET /api/live-rooms/:id`
- `GET /api/live-rooms/:id/products`
- `GET /api/live-rooms/:id/comments`
- `POST /api/live-rooms/:id/comments`

## 后台

- `GET|POST /api/admin/products`
- `PATCH /api/admin/products/:id`
- `PATCH /api/admin/products/:id/status`
- `GET|POST /api/admin/videos`
- `PATCH /api/admin/videos/:id`
- `POST /api/admin/videos/:id/products`
- `GET|POST /api/admin/live-rooms`
- `PATCH /api/admin/live-rooms/:id/current-product`
- `POST /api/admin/live-rooms/:id/push-coupon`
- `GET /api/admin/dashboard/overview`
