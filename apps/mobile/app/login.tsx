import { StatusBar } from 'expo-status-bar'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '@/api'
import { loginReasonText } from '@/hooks/useAuthPrompt'
import { useUserStore } from '@/store/userStore'

type PageMode = 'login' | 'register'

export default function LoginScreen() {
  const { redirect, reason } = useLocalSearchParams<{ redirect?: string; reason?: string }>()
  const setSession = useUserStore((state) => state.setSession)
  const [mode, setMode] = useState<PageMode>('login')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const phoneValid = /^1\d{10}$/.test(phone)
  const passwordValid = password.length >= 6
  const canSubmit = mode === 'register'
    ? phoneValid && passwordValid && nickname.trim().length >= 2
    : phoneValid && passwordValid

  async function submit() {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const session = mode === 'register'
        ? await api.register({ phone, nickname: nickname.trim(), password })
        : await api.login({ phone, password })
      setSession(session)
      router.replace((redirect?.startsWith('/') ? redirect : '/me') as never)
    } catch (requestError) {
      setError((requestError as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  function changeMode(nextMode: PageMode) {
    setMode(nextMode)
    setError('')
    setPassword('')
  }

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/feed')} style={styles.backButton}>
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{mode === 'login' ? '欢迎登录' : '注册账号'}</Text>
            <Text style={styles.subtitle}>{mode === 'login' ? '登录后继续发现直播好物' : '注册后即可收藏、加购和下单'}</Text>
            {reason ? (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>登录后才可以{loginReasonText(reason)}，你仍然可以先浏览视频内容。</Text>
              </View>
            ) : null}

            <View style={styles.tabs}>
              <View style={styles.tabButton}>
                <Text style={[styles.tabText, styles.tabTextActive]}>{mode === 'login' ? '手机号登录' : '手机号注册'}</Text>
                <View style={styles.tabIndicator} />
              </View>
            </View>

            <View style={styles.form}>
              {mode === 'register' ? <View style={styles.inputBox}><TextInput value={nickname} onChangeText={setNickname} placeholder="请输入昵称" placeholderTextColor="#b8b9c0" maxLength={20} style={styles.input} /></View> : null}
              <View style={styles.inputBox}>
                <Text style={styles.countryCode}>+86</Text><View style={styles.countryDivider} />
                <TextInput value={phone} onChangeText={(value) => setPhone(value.replace(/\D/g, '').slice(0, 11))} placeholder="请输入手机号" placeholderTextColor="#b8b9c0" keyboardType="phone-pad" maxLength={11} style={styles.input} />
              </View>
              <View style={styles.inputBox}>
                <TextInput value={password} onChangeText={setPassword} placeholder={mode === 'register' ? '请设置密码（至少 6 位）' : '请输入密码'} placeholderTextColor="#b8b9c0" secureTextEntry maxLength={32} style={styles.input} />
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TouchableOpacity disabled={!canSubmit || submitting} onPress={submit} style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}>
                <Text style={styles.submitText}>{submitting ? '请稍候...' : mode === 'login' ? '登录' : '注册并登录'}</Text>
              </TouchableOpacity>
              <Text style={styles.agreement}>登录即代表同意 <Text style={styles.link}>用户协议</Text> 和 <Text style={styles.link}>隐私政策</Text></Text>
              <TouchableOpacity onPress={() => changeMode(mode === 'login' ? 'register' : 'login')} style={styles.switchMode}>
                <Text style={styles.switchText}>{mode === 'login' ? '还没有账号？' : '已经有账号？'}<Text style={styles.switchLink}>{mode === 'login' ? ' 手机号注册' : ' 返回登录'}</Text></Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { flexGrow: 1 },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 28, paddingTop: 18, paddingBottom: 28 },
  backButton: { width: 42, height: 42, justifyContent: 'center' },
  backIcon: { color: '#262833', fontSize: 38, lineHeight: 38 },
  title: { marginTop: 32, color: '#262833', fontSize: 30, fontWeight: '800' },
  subtitle: { marginTop: 10, color: '#a3a5ad', fontSize: 15 },
  notice: { marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: '#fff1f4', borderWidth: 1, borderColor: '#ffd1dc' },
  noticeText: { color: '#d92d52', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  tabs: { marginTop: 54, height: 44, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 18 },
  tabButton: { minWidth: 110, alignItems: 'center' },
  tabText: { color: '#bbbcc3', fontSize: 19, fontWeight: '600' },
  tabTextActive: { color: '#252731' },
  tabIndicator: { marginTop: 10, width: 26, height: 3, borderRadius: 2, backgroundColor: '#ff7890' },
  form: { marginTop: 26, gap: 16 },
  inputBox: { minHeight: 64, paddingHorizontal: 18, borderRadius: 18, backgroundColor: '#f7f7f9', flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, height: 64, color: '#252731', fontSize: 16 },
  countryCode: { color: '#252731', fontSize: 18, fontWeight: '600' },
  countryDivider: { width: 1, height: 20, marginHorizontal: 14, backgroundColor: '#e4e4e7' },
  error: { color: '#e6485d', fontSize: 13 },
  submit: { height: 60, marginTop: 48, borderRadius: 18, backgroundColor: '#ff6f89', alignItems: 'center', justifyContent: 'center' },
  submitDisabled: { backgroundColor: '#ffadbd' },
  submitText: { color: '#fff', fontSize: 19, fontWeight: '800' },
  agreement: { marginTop: 12, color: '#b2b3ba', fontSize: 13, textAlign: 'center' },
  link: { color: '#777a85' },
  switchMode: { marginTop: 24, alignItems: 'center' },
  switchText: { color: '#9698a1', fontSize: 14 },
  switchLink: { color: '#ff6682', fontWeight: '800' },
})
