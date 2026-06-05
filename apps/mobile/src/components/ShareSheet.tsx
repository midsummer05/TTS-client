import {
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

type Props = {
  visible: boolean
  onClose: () => void
}

const friends = [
  {
    name: '葛雪晴',
    avatar: 'https://api.dicebear.com/9.x/thumbs/png?seed=gexueqing',
  },
  {
    name: '罗乾钦',
    avatar: 'https://api.dicebear.com/9.x/thumbs/png?seed=luoqianqin',
  },
  {
    name: '胡涛',
    avatar: 'https://api.dicebear.com/9.x/thumbs/png?seed=hutao',
  },
  {
    name: '蒋康',
    avatar: 'https://api.dicebear.com/9.x/thumbs/png?seed=jiangkang',
  },
  {
    name: '张一菲',
    avatar: 'https://api.dicebear.com/9.x/thumbs/png?seed=zhangyifei',
  },
  {
    name: '宋铭',
    avatar: 'https://api.dicebear.com/9.x/thumbs/png?seed=songming',
  },
  {
    name: '陈思远',
    avatar: 'https://api.dicebear.com/9.x/thumbs/png?seed=chensiyuan',
  },
  {
    name: '林小满',
    avatar: 'https://api.dicebear.com/9.x/thumbs/png?seed=linxiaoman',
  },
]

const tools = [
  { label: '复制链接', icon: '⌁', wide: true },
  { label: '下载', icon: '↓' },
  { label: '二维码', icon: '▦' },
  { label: 'DOU+', icon: 'DOU+' },
]

export function ShareSheet({ visible, onClose }: Props) {
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
        <TouchableOpacity
          activeOpacity={1}
          style={{
            height: '82%',
            backgroundColor: '#242633',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: 20,
              paddingBottom: 24,
              borderBottomWidth: 1,
              borderBottomColor: '#343642',
            }}
          >
            <View
              style={{
                height: 64,
                borderRadius: 14,
                backgroundColor: '#383a46',
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 22,
              }}
            >
              <Text
                style={{
                  color: '#8f929f',
                  fontSize: 34,
                  marginRight: 12,
                  lineHeight: 38,
                }}
              >
                ⌕
              </Text>
              <TextInput
                placeholder="搜索"
                placeholderTextColor="#9295a0"
                style={{
                  flex: 1,
                  color: '#fff',
                  fontSize: 26,
                  fontWeight: '700',
                  paddingVertical: 0,
                }}
              />
            </View>
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 14,
              paddingTop: 28,
              paddingBottom: 112,
            }}
          >
            <Text
              style={{
                color: '#9699a7',
                fontSize: 22,
                fontWeight: '800',
                marginBottom: 18,
              }}
            >
              分享给朋友
            </Text>
            {friends.map((friend) => (
              <View
                key={friend.name}
                style={{
                  minHeight: 92,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Image
                  source={{ uri: friend.avatar }}
                  style={{
                    width: 66,
                    height: 66,
                    borderRadius: 33,
                    backgroundColor: '#fff',
                  }}
                />
                <Text
                  style={{
                    flex: 1,
                    marginLeft: 22,
                    color: '#f6f6f8',
                    fontSize: 25,
                    fontWeight: '700',
                  }}
                >
                  {friend.name}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={{
                    width: 136,
                    height: 64,
                    borderRadius: 14,
                    backgroundColor: '#ff2f5f',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{ color: '#fff', fontSize: 26, fontWeight: '800' }}
                  >
                    分享
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 104,
              paddingHorizontal: 24,
              paddingTop: 28,
              borderTopWidth: 1,
              borderTopColor: '#383a46',
              backgroundColor: '#242633',
              flexDirection: 'row',
              gap: 16,
            }}
          >
            {tools.map((tool) => (
              <TouchableOpacity
                key={tool.label}
                activeOpacity={0.85}
                style={{
                  height: 64,
                  minWidth: tool.wide ? 296 : 64,
                  paddingHorizontal: tool.wide ? 24 : 0,
                  borderRadius: 14,
                  backgroundColor: '#383a46',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    color: '#f5f5f7',
                    fontSize: tool.label === 'DOU+' ? 17 : 30,
                    fontWeight: '900',
                    marginRight: tool.wide ? 12 : 0,
                  }}
                >
                  {tool.icon}
                </Text>
                {tool.wide ? (
                  <Text
                    style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}
                  >
                    {tool.label}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}
