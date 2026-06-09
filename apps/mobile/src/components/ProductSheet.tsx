import { Image, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useEffect, useState } from 'react'
import { toMediaUrl } from '@/api/request'
import type { Product } from '@/types'
import { formatPrice } from '@/utils/formatPrice'

type Props = {
  product?: Product
  products?: Product[]
  visible: boolean
  onClose: () => void
  onAddCart: (product: Product) => void
  onBuyNow: (product: Product) => void
}

export function ProductSheet({
  product,
  products = product ? [product] : [],
  visible,
  onClose,
  onAddCart,
  onBuyNow,
}: Props) {
  const [selected, setSelected] = useState<Product | undefined>(product || products[0])

  useEffect(() => {
    if (!visible) return
    setSelected(product || products[0])
  }, [product?.id, products[0]?.id, visible])

  const list = products.length ? products : selected ? [selected] : []

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'flex-end',
        }}
      >
        {selected ? (
          <TouchableOpacity
            activeOpacity={1}
            style={{
              minHeight: 420,
              maxHeight: '78%',
              backgroundColor: '#fff',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 18,
            }}
          >
            {list.length > 1 ? (
              <>
                <Text style={{ marginBottom: 12, color: '#111', fontSize: 18, fontWeight: '800' }}>全部商品</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {list.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => setSelected(item)}
                        style={{
                          width: 116,
                          borderRadius: 10,
                          borderWidth: selected.id === item.id ? 2 : 1,
                          borderColor: selected.id === item.id ? '#e43d33' : '#e5e7eb',
                          padding: 8,
                          backgroundColor: selected.id === item.id ? '#fff5f5' : '#fff',
                        }}
                      >
                        <Image source={{ uri: toMediaUrl(item.coverUrl) }} style={{ width: '100%', height: 70, borderRadius: 8, backgroundColor: '#eee' }} />
                        <Text numberOfLines={2} style={{ marginTop: 6, color: '#111', fontSize: 12, fontWeight: '700' }}>{item.title}</Text>
                        <Text style={{ marginTop: 4, color: '#e43d33', fontSize: 13, fontWeight: '800' }}>{formatPrice(item.price)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Image
                source={{ uri: toMediaUrl(selected.coverUrl) }}
                style={{
                  width: 110,
                  height: 110,
                  borderRadius: 8,
                  backgroundColor: '#eee',
                }}
              />
              <View style={{ flex: 1 }}>
                <Text
                style={{ fontSize: 18, fontWeight: '700', color: '#111' }}
              >
                  {selected.title}
                </Text>
                <Text
                  style={{
                    marginTop: 10,
                    fontSize: 24,
                    fontWeight: '800',
                    color: '#e43d33',
                  }}
                >
                  {formatPrice(selected.price)}
                </Text>
                <Text style={{ marginTop: 6, color: '#777' }}>
                  库存 {selected.stock} · 已售 {selected.sales}
                </Text>
              </View>
            </View>
            <Text style={{ marginTop: 18, lineHeight: 22, color: '#444' }}>
              {selected.description || '直播间精选商品，支持加购和立即购买。'}
            </Text>
            <View
              style={{
                marginTop: 18,
                backgroundColor: '#fff5ed',
                padding: 12,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: '#b45309' }}>
                可领取直播间优惠券，下单自动按条件抵扣
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                gap: 12,
                marginTop: 'auto',
                paddingBottom: 16,
              }}
            >
              <TouchableOpacity
                disabled={selected.stock <= 0}
                onPress={() => onAddCart(selected)}
                style={{
                  flex: 1,
                  height: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#ffb020',
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: '#111', fontWeight: '700' }}>
                  加入购物车
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={selected.stock <= 0}
                onPress={() => onBuyNow(selected)}
                style={{
                  flex: 1,
                  height: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#e43d33',
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  立即购买
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    </Modal>
  )
}
