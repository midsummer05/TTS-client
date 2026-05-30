import { Image, Modal, Text, TouchableOpacity, View } from 'react-native'
import type { Product } from '@/types'
import { formatPrice } from '@/utils/formatPrice'

type Props = {
  product?: Product
  visible: boolean
  onClose: () => void
  onAddCart: (product: Product) => void
  onBuyNow: (product: Product) => void
}

export function ProductSheet({ product, visible, onClose, onAddCart, onBuyNow }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        {product ? (
          <TouchableOpacity activeOpacity={1} style={{ minHeight: 420, maxHeight: '78%', backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 18 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Image source={{ uri: product.coverUrl }} style={{ width: 110, height: 110, borderRadius: 8, backgroundColor: '#eee' }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#111' }}>{product.title}</Text>
                <Text style={{ marginTop: 10, fontSize: 24, fontWeight: '800', color: '#e43d33' }}>{formatPrice(product.price)}</Text>
                <Text style={{ marginTop: 6, color: '#777' }}>库存 {product.stock} · 已售 {product.sales}</Text>
              </View>
            </View>
            <Text style={{ marginTop: 18, lineHeight: 22, color: '#444' }}>{product.description || '直播间精选商品，支持加购和立即购买。'}</Text>
            <View style={{ marginTop: 18, backgroundColor: '#fff5ed', padding: 12, borderRadius: 8 }}>
              <Text style={{ color: '#b45309' }}>可领取直播间优惠券，下单自动按条件抵扣</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 'auto', paddingBottom: 16 }}>
              <TouchableOpacity disabled={product.stock <= 0} onPress={() => onAddCart(product)} style={{ flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffb020', borderRadius: 8 }}>
                <Text style={{ color: '#111', fontWeight: '700' }}>加入购物车</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={product.stock <= 0} onPress={() => onBuyNow(product)} style={{ flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e43d33', borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>立即购买</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    </Modal>
  )
}
