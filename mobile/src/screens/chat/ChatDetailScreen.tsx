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
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRoute, useNavigation } from '@react-navigation/native'
import { apiFetch, supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

interface Bubble {
  side: 'in' | 'out'
  sender: 'customer' | 'ai' | 'agent'
  text: string
  at: string
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

  const flatListRef = useRef<FlatList>(null)

  const fetchThread = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/marketing/cs-thread?platform=${platform}&to=${from_id}`)
      if (res.ok) {
        const json = await res.json()
        setBubbles(json.bubbles || [])
        if (typeof json.takeover === 'boolean') {
          setTakeover(json.takeover)
        }
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

        <View style={[styles.bubble, isMe ? styles.bubbleOut : styles.bubbleIn]}>
          <Text style={[styles.bubbleText, isMe ? styles.bubbleTextOut : styles.bubbleTextIn]}>
            {item.text}
          </Text>
        </View>

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
  sendButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
})
