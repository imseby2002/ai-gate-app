import React, { useEffect, useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Modal,
  Pressable,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRoute, useNavigation } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import { apiFetch, supabase } from '../../lib/supabase'
import { CONFIG } from '../../lib/config'
import { useAuth } from '../../context/AuthContext'

interface Bubble {
  side: 'in' | 'out'
  sender: 'customer' | 'ai' | 'agent'
  text: string
  at: string
  /** 客人或客服傳的圖片（後端回傳 1 小時有效的簽名網址） */
  image?: string
}

export default function ChatDetailScreen() {
  const route = useRoute<any>()
  const navigation = useNavigation()
  const { user } = useAuth()
  const { platform, from_id, name, initialTakeover } = route.params

  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [loading, setLoading] = useState(true)
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [takeover, setTakeover] = useState<boolean>(initialTakeover ?? false)
  const [togglingTakeover, setTogglingTakeover] = useState(false)

  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const flatListRef = useRef<FlatList>(null)

  const fetchThread = useCallback(async () => {
    try {
      // 走後端 API：依目前商戶過濾，並回傳人工接管狀態（與網頁版同一套規則）
      const res = await apiFetch(
        `/api/marketing/cs-thread?platform=${encodeURIComponent(platform)}&to=${encodeURIComponent(from_id)}`
      )
      if (res.ok) {
        const json = await res.json()
        setBubbles((json.bubbles || []) as Bubble[])
        if (typeof json.takeover === 'boolean') setTakeover(json.takeover)
      } else {
        console.log('載入對話訊息失敗:', res.status)
      }
    } catch (err) {
      console.log('載入對話訊息失敗:', err)
    } finally {
      setLoading(false)
    }
  }, [platform, from_id])

  useEffect(() => {
    navigation.setOptions({
      title: name || from_id,
      headerRight: () => (
        <TouchableOpacity
          style={[styles.takeoverToggle, takeover ? styles.takeoverActive : styles.takeoverInactive]}
          onPress={handleToggleTakeover}
          disabled={togglingTakeover}
        >
          {togglingTakeover ? (
            <ActivityIndicator size="small" color={takeover ? '#D97706' : '#2563EB'} />
          ) : (
            <>
              <Ionicons
                name={takeover ? 'hand-left' : 'sparkles'}
                size={14}
                color={takeover ? '#D97706' : '#2563EB'}
              />
              <Text style={[styles.takeoverToggleText, { color: takeover ? '#D97706' : '#2563EB' }]}>
                {takeover ? '人工接管' : 'AI 託管'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      ),
    })
  }, [navigation, name, from_id, takeover, togglingTakeover])

  useEffect(() => {
    fetchThread()

    // 訂閱 Supabase Realtime 即時更新新訊息
    const channel = supabase
      .channel(`cs_messages_${from_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'cs_messages',
          filter: `from_id=eq.${from_id}`,
        },
        () => {
          fetchThread()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchThread, from_id])

  const handleToggleTakeover = async () => {
    setTogglingTakeover(true)
    const nextState = !takeover
    try {
      const res = await apiFetch('/api/marketing/cs-takeover', {
        method: 'POST',
        body: JSON.stringify({
          platform,
          to: from_id,
          from_id,
          takeover: nextState,
        }),
      })
      if (res.ok) {
        setTakeover(nextState)
      } else {
        Alert.alert('切換失敗', '無法更新接管狀態，請稍後再試')
      }
    } catch {
      Alert.alert('網路異常', '請檢查連線')
    } finally {
      setTogglingTakeover(false)
    }
  }

  const handleSend = async () => {
    const text = inputText.trim()
    if (!text || sending) return

    setSending(true)
    // 樂觀更新 (Optimistic UI)
    const optimisticBubble: Bubble = {
      side: 'out',
      sender: 'agent',
      text,
      at: new Date().toISOString(),
    }
    setBubbles((prev) => [...prev, optimisticBubble])
    setInputText('')

    try {
      const res = await apiFetch('/api/marketing/cs-send', {
        method: 'POST',
        body: JSON.stringify({
          platform,
          to: from_id,
          text,
          fromName: user?.email || '客服專員',
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        Alert.alert('送訊失敗', errJson.error || '無法發送訊息至原平台')
        fetchThread() // 恢復原狀
      } else {
        setTakeover(true) // 人工主動回覆後，系統會自動切換為人工接管
      }
    } catch (err) {
      Alert.alert('發送錯誤', '請檢查網路連線')
      fetchThread()
    } finally {
      setSending(false)
    }
  }

  // 傳送圖片：先上傳到 cs-upload 取得路徑，再交給 cs-send 發到客人原平台（與網頁版同流程）
  const handleSendImage = async () => {
    if (sending) return
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (perm.status !== 'granted') {
      Alert.alert('權限不足', '請允許存取相簿以傳送圖片')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      Alert.alert('圖片太大', '圖片上限 5MB')
      return
    }

    setSending(true)
    setBubbles((prev) => [...prev, { side: 'out', sender: 'agent', text: '', image: asset.uri, at: new Date().toISOString() }])
    try {
      const mime = asset.mimeType || 'image/jpeg'
      const form = new FormData()
      form.append('file', { uri: asset.uri, name: asset.fileName || `photo.${mime.includes('png') ? 'png' : 'jpg'}`, type: mime } as unknown as Blob)
      form.append('to', from_id)
      const { data: { session } } = await supabase.auth.getSession()
      // FormData 不能用 apiFetch（它固定送 JSON 的 Content-Type）
      const upRes = await fetch(`${CONFIG.API_BASE_URL}/api/marketing/cs-upload`, {
        method: 'POST',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: form,
      })
      const upJson = await upRes.json().catch(() => ({}))
      if (!upRes.ok || !upJson.path) {
        Alert.alert('上傳失敗', upJson.error || '無法上傳圖片')
        fetchThread()
        return
      }

      const res = await apiFetch('/api/marketing/cs-send', {
        method: 'POST',
        body: JSON.stringify({
          platform,
          to: from_id,
          text: '',
          imagePath: upJson.path,
          fromName: user?.email || '客服專員',
        }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        Alert.alert('送訊失敗', errJson.error || '無法發送圖片至原平台')
        fetchThread()
      } else {
        setTakeover(true)
      }
    } catch {
      Alert.alert('發送錯誤', '請檢查網路連線')
      fetchThread()
    } finally {
      setSending(false)
    }
  }

  const formatClock = (ts: string) => {
    try {
      const d = new Date(ts)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    } catch {
      return ''
    }
  }

  const renderBubble = ({ item }: { item: Bubble }) => {
    const isMe = item.side === 'out'
    const isAI = item.sender === 'ai'

    return (
      <View style={[styles.bubbleWrapper, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
        {!isMe && (
          <View style={styles.senderHeader}>
            <Text style={styles.senderName}>{name || '客人'}</Text>
          </View>
        )}
        {isMe && isAI && (
          <View style={styles.aiTag}>
            <Ionicons name="sparkles" size={12} color="#6366F1" />
            <Text style={styles.aiTagText}>AI 自動回覆</Text>
          </View>
        )}

        {item.image ? (
          <TouchableOpacity activeOpacity={0.85} onPress={() => setPreviewImage(item.image!)}>
            <Image source={{ uri: item.image }} style={styles.bubbleImage} resizeMode="cover" />
          </TouchableOpacity>
        ) : (
          <View style={[styles.bubble, isMe ? styles.bubbleOut : styles.bubbleIn]}>
            <Text style={[styles.bubbleText, isMe ? styles.bubbleTextOut : styles.bubbleTextIn]}>
              {item.text}
            </Text>
          </View>
        )}

        <Text style={[styles.timeText, isMe ? styles.timeRight : styles.timeLeft]}>
          {formatClock(item.at)}
        </Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={bubbles}
          keyExtractor={(_, index) => String(index)}
          renderItem={renderBubble}
          contentContainerStyle={styles.bubbleList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* 底部輸入列 */}
      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.attachButton} onPress={handleSendImage} disabled={sending}>
          <Ionicons name="image-outline" size={24} color={sending ? '#94A3B8' : '#2563EB'} />
        </TouchableOpacity>
        <TextInput
          style={styles.textInput}
          placeholder="輸入回覆訊息（將發送至客人原平台）..."
          placeholderTextColor="#94A3B8"
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="send" size={18} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
      {/* 點圖片放大 */}
      <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewImage(null)}>
          {previewImage && (
            <Image source={{ uri: previewImage }} style={styles.previewImage} resizeMode="contain" />
          )}
          <View style={styles.previewClose}>
            <Ionicons name="close" size={30} color="#FFFFFF" />
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  takeoverToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 10,
    borderWidth: 1,
  },
  takeoverActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  takeoverInactive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  takeoverToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bubbleList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  bubbleWrapper: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  bubbleLeft: {
    alignSelf: 'flex-start',
  },
  bubbleRight: {
    alignSelf: 'flex-end',
  },
  senderHeader: {
    marginBottom: 3,
  },
  senderName: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-end',
    marginBottom: 3,
  },
  aiTagText: {
    fontSize: 11,
    color: '#6366F1',
    fontWeight: '600',
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleIn: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bubbleOut: {
    backgroundColor: '#2563EB',
    borderTopRightRadius: 4,
  },
  bubbleImage: {
    width: 220,
    height: 220,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '85%',
  },
  previewClose: {
    position: 'absolute',
    top: 48,
    right: 20,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleTextIn: {
    color: '#0F172A',
  },
  bubbleTextOut: {
    color: '#FFFFFF',
  },
  timeText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  timeLeft: {
    alignSelf: 'flex-start',
  },
  timeRight: {
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachButton: {
    width: 36,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
})
