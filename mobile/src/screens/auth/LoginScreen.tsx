import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../context/AuthContext'

export default function LoginScreen() {
  const { signIn, signInWithGoogle, signInWithOtp, verifyOtp, isLoading } = useAuth()

  // 登入模式：'google' / 'otp' / 'password'
  const [authMode, setAuthMode] = useState<'otp' | 'password'>('otp')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 1. Google 一鍵登入
  const handleGoogleLogin = async () => {
    setSubmitting(true)
    const { error } = await signInWithGoogle()
    setSubmitting(false)
    if (error) {
      Alert.alert('Google 登入失敗', error.message || '無法開啟 Google 授權視窗')
    }
  }

  // 2. 發送 Email OTP 驗證碼
  const handleSendOtp = async () => {
    if (!email.trim()) {
      Alert.alert('提示', '請輸入您的 Google 或工作 Email 信箱')
      return
    }

    setSubmitting(true)
    const { error } = await signInWithOtp(email)
    setSubmitting(false)

    if (error) {
      Alert.alert('發送失敗', error.message)
    } else {
      setOtpSent(true)
      Alert.alert('驗證碼已寄出', `6 位數登入驗證碼已寄至 ${email}，請查收信箱並輸入。`)
    }
  }

  // 3. 驗證 OTP 並登入
  const handleVerifyOtp = async () => {
    if (!otpCode.trim() || otpCode.trim().length < 6) {
      Alert.alert('提示', '請輸入完整的 6 位數驗證碼')
      return
    }

    setSubmitting(true)
    const { error } = await verifyOtp(email, otpCode)
    setSubmitting(false)

    if (error) {
      Alert.alert('登入失敗', error.message || '驗證碼錯誤或已過期')
    }
  }

  // 4. 一般密碼登入
  const handlePasswordLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('提示', '請輸入帳號 (Email) 與密碼')
      return
    }

    setSubmitting(true)
    const { error } = await signIn(email, password)
    setSubmitting(false)

    if (error) {
      Alert.alert(
        '登入失敗',
        '帳號或密碼錯誤。若您原本是使用 Google 登入，請點擊上方「使用 Google 帳號登入」或使用「Email 驗證碼登入」。'
      )
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Ionicons name="chatbubbles" size={38} color="#38BDF8" />
          </View>
          <Text style={styles.title}>AI GATE</Text>
          <Text style={styles.subtitle}>智能客服與旅宿即時管理工作台</Text>
        </View>

        {/* 登入卡片 */}
        <View style={styles.formCard}>
          {/* Google 一鍵登入按鈕 (首選) */}
          <TouchableOpacity
            style={[styles.googleBtn, submitting && styles.btnDisabled]}
            onPress={handleGoogleLogin}
            disabled={submitting || isLoading}
          >
            <Ionicons name="logo-google" size={20} color="#EA4335" style={{ marginRight: 10 }} />
            <Text style={styles.googleBtnText}>使用 Google 帳號一鍵登入</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>或使用信箱驗證</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* 模式切換 Tabs */}
          <View style={styles.modeTabs}>
            <TouchableOpacity
              style={[styles.modeTab, authMode === 'otp' && styles.modeTabActive]}
              onPress={() => {
                setAuthMode('otp')
                setOtpSent(false)
              }}
            >
              <Text style={[styles.modeTabText, authMode === 'otp' && styles.modeTabTextActive]}>
                信箱驗證碼 (免密碼)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, authMode === 'password' && styles.modeTabActive]}
              onPress={() => setAuthMode('password')}
            >
              <Text style={[styles.modeTabText, authMode === 'password' && styles.modeTabTextActive]}>
                帳號密碼登入
              </Text>
            </TouchableOpacity>
          </View>

          {/* Email 輸入欄 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>電子信箱 (Email)</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="例如: yourname@gmail.com"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* OTP 模式 */}
          {authMode === 'otp' && (
            <>
              {otpSent ? (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>6 位數驗證碼 (請查收信箱)</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons name="key-outline" size={20} color="#64748B" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="請輸入 6 位數字驗證碼"
                        placeholderTextColor="#94A3B8"
                        value={otpCode}
                        onChangeText={setOtpCode}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryBtn, submitting && styles.btnDisabled]}
                    onPress={handleVerifyOtp}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryBtnText}>驗證並進入系統</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.resendBtn}
                    onPress={handleSendOtp}
                    disabled={submitting}
                  >
                    <Text style={styles.resendBtnText}>沒收到？重新發送驗證碼</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.primaryBtn, submitting && styles.btnDisabled]}
                  onPress={handleSendOtp}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>發送登入驗證碼到信箱</Text>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}

          {/* 密碼模式 */}
          {authMode === 'password' && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>密碼</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="請輸入 AI-GATE 密碼"
                    placeholderTextColor="#94A3B8"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, submitting && styles.btnDisabled]}
                onPress={handlePasswordLogin}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>密碼登入</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 6,
  },
  formCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  googleBtnText: {
    color: '#1E293B',
    fontSize: 15,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#64748B',
    fontSize: 12,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 4,
    marginBottom: 18,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeTabActive: {
    backgroundColor: '#334155',
  },
  modeTabText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  modeTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#CBD5E1',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 15,
  },
  eyeBtn: {
    padding: 6,
  },
  primaryBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  resendBtn: {
    marginTop: 14,
    alignItems: 'center',
  },
  resendBtnText: {
    color: '#38BDF8',
    fontSize: 13,
  },
})
