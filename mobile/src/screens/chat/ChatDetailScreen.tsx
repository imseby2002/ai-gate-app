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
import * as WebBrowser from 'expo-web-browser'
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

// 與網頁版收件匣一致：需要真人提醒、訂房／預約資訊、客戶檔案（CRM）
interface ThreadExtras {
  alert: { intents: string[]; ticketIds: string[]; notes?: string[] } | null
  booking: { id: string; guestName: string | null; checkIn: string; checkOut: string; room: string | null; guests: number | null } | null
  reservation: { id: string; startTime: string; service: string | null; staff: string | null; store: string | null; statusLabel: string } | null
  crmContactId: string | null
}
const MANUAL_FLAG_INTENT = '人工標記待處理'

// AI 回覆裡的「[圖片] 網址」拆出來直接顯示圖片（同網頁版 src/lib/cs/bubble-images.ts）
const IMAGE_URL_RE = /(?:\[圖片\]\s*)?(https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp))/gi
function splitBubbleImages(text: string): { text: string; images: string[] } {
  if (!text) return { text: '', images: [] }
  const images: string[] = []
  const rest = text
    .replace(IMAGE_URL_RE, (_m, url: string) => { images.push(url); return '' })
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { text: rest, images }
}

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
const openWeb = (path: string) => WebBrowser.openBrowserAsync(`${CONFIG.API_BASE_URL}${path}`)

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
  const [extras, setExtras] = useState<ThreadExtras | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [flagBusy, setFlagBusy] = useState(false)
  // 標記需處理：輸入要處理的事項（Android 沒有 Alert.prompt，改用面板）
  const [flagNote, setFlagNote] = useState<string | null>(null)
  // 加到常見問答
  const [faq, setFaq] = useState<{ q: string; a: string; saving: boolean; done: boolean } | null>(null)

  const flatListRef = useRef<FlatList>(null)

  // silent：即時更新時帶 lite=1，伺服器不重查訂房／預約／CRM
  const fetchThread = useCallback(async (silent = false) => {
    try {
      // 走後端 API：依目前商戶過濾，並回傳人工接管狀態（與網頁版同一套規則）
      const res = await apiFetch(
        `/api/marketing/cs-thread?platform=${encodeURIComponent(platform)}&to=${encodeURIComponent(from_id)}${silent ? '&lite=1' : ''}`
      )
      if (res.ok) {
        const json = await res.json()
        setBubbles((json.bubbles || []) as Bubble[])
        if (typeof json.takeover === 'boolean') setTakeover(json.takeover)
        setSummary(json.summary ?? null)
        setExtras((prev) => ({
          alert: json.alert ?? null,
          booking: json.booking !== undefined ? json.booking : prev?.booking ?? null,
          reservation: json.reservation !== undefined ? json.reservation : prev?.reservation ?? null,
          crmContactId: json.crmContactId !== undefined ? json.crmContactId : prev?.crmContactId ?? null,
        }))
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
          fetchThread(true)
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

  // 標記需處理：開一張不會自動結案的工單，處理完按「已處理」
  const submitFlag = async () => {
    if (flagNote === null || flagBusy) return
    const note = flagNote.trim()
    setFlagBusy(true)
    try {
      const res = await apiFetch('/api/marketing/cs-tickets', {
        method: 'POST',
        body: JSON.stringify({
          industry: 'homestay', platform, from_id, from_name: name || undefined,
          subject: note || MANUAL_FLAG_INTENT, description: note, priority: 'high', intent: MANUAL_FLAG_INTENT,
        }),
      })
      if (res.ok) {
        setFlagNote(null)
        await fetchThread(true)
      } else {
        Alert.alert('標記失敗', '請稍後再試')
      }
    } catch {
      Alert.alert('標記失敗', '請檢查網路連線')
    } finally {
      setFlagBusy(false)
    }
  }

  const dismissAlert = async () => {
    const ids = extras?.alert?.ticketIds ?? []
    if (!ids.length || flagBusy) return
    setFlagBusy(true)
    try {
      const ok = await Promise.all(ids.map((id) => apiFetch(`/api/marketing/cs-tickets/${id}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'resolved' }),
      }).then((r) => r.ok).catch(() => false)))
      if (ok.every(Boolean)) setExtras((prev) => (prev ? { ...prev, alert: null } : prev))
      else Alert.alert('處理失敗', '部分工單無法結案，請稍後再試')
    } finally {
      setFlagBusy(false)
    }
  }

  const saveFaq = async () => {
    if (!faq || !faq.a.trim() || faq.saving) return
    setFaq({ ...faq, saving: true })
    try {
      const res = await apiFetch('/api/marketing/cs-faq', {
        method: 'POST',
        body: JSON.stringify({ q: faq.q, a: faq.a, keywords: [], industry: 'homestay', autoSuggest: true, context: faq.q }),
      })
      if (!res.ok) throw new Error()
      setFaq((f) => (f ? { ...f, saving: false, done: true } : f))
      setTimeout(() => setFaq(null), 900)
    } catch {
      setFaq((f) => (f ? { ...f, saving: false } : f))
      Alert.alert('加入失敗', '請稍後再試')
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

  const renderBubble = ({ item, index }: { item: Bubble; index: number }) => {
    const isMe = item.side === 'out'
    const isAI = item.sender === 'ai'
    const parts = item.image ? { text: '', images: [] as string[] } : splitBubbleImages(item.text)

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
          <>
            {!!parts.text && (
              <View style={[styles.bubble, isMe ? styles.bubbleOut : styles.bubbleIn]}>
                <Text style={[styles.bubbleText, isMe ? styles.bubbleTextOut : styles.bubbleTextIn]}>
                  {parts.text}
                </Text>
              </View>
            )}
            {parts.images.map((url) => (
              <TouchableOpacity key={url} activeOpacity={0.85} onPress={() => setPreviewImage(url)} style={styles.inlineImageWrap}>
                <Image source={{ uri: url }} style={styles.bubbleImage} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={[styles.metaRow, isMe ? styles.timeRight : styles.timeLeft]}>
          {isMe && !!item.text.trim() && !item.image && (
            <TouchableOpacity
              onPress={() => {
                const prevIn = bubbles.slice(0, index).reverse().find((x) => x.side === 'in')
                setFaq({ q: prevIn?.text ?? '', a: item.text, saving: false, done: false })
              }}
            >
              <Text style={styles.faqLink}>＋常見問答</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.timeText}>{formatClock(item.at)}</Text>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* 操作列：標記需處理、客戶檔案（CRM） */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={[styles.chip, styles.chipRose]} onPress={() => setFlagNote('')} disabled={flagBusy}>
          <Text style={styles.chipRoseText}>標記需處理</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, styles.chipIndigo]}
          onPress={() => openWeb(extras?.crmContactId
            ? `/crm?contact=${encodeURIComponent(extras.crmContactId)}`
            : `/crm?q=${encodeURIComponent(name || from_id)}`)}
        >
          <Text style={styles.chipIndigoText}>客戶檔案</Text>
        </TouchableOpacity>
      </View>

      {/* 需要真人提醒 */}
      {extras?.alert && (
        <View style={styles.alertBar}>
          <Text style={styles.alertTitle}>需要真人</Text>
          <Text style={styles.alertText} numberOfLines={2}>
            {extras.alert.intents.filter((i) => i !== MANUAL_FLAG_INTENT).concat(extras.alert.notes ?? []).join('、')
              || extras.alert.intents.join('、')}
          </Text>
          <TouchableOpacity style={[styles.chip, styles.chipRose]} onPress={dismissAlert} disabled={flagBusy}>
            <Text style={styles.chipRoseText}>已處理</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 訂房／預約資訊與客人摘要 */}
      {(extras?.booking || extras?.reservation || summary) && (
        <View style={styles.infoCard}>
          {extras?.booking && (
            <TouchableOpacity onPress={() => openWeb(`/booking/bookings/${extras.booking!.id}`)}>
              <Text style={styles.infoLink}>
                🗓 {md(extras.booking.checkIn)}–{md(extras.booking.checkOut)}
                {extras.booking.room ? ` · ${extras.booking.room}` : ''}
                {extras.booking.guestName ? ` · ${extras.booking.guestName}` : ''}
                {extras.booking.guests ? ` · ${extras.booking.guests}人` : ''}
              </Text>
            </TouchableOpacity>
          )}
          {extras?.reservation && (
            <TouchableOpacity onPress={() => openWeb(`/reserve/appointments?id=${encodeURIComponent(extras.reservation!.id)}`)}>
              <Text style={styles.infoLink}>
                📅 {new Date(extras.reservation.startTime).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}
                {extras.reservation.service ? ` · ${extras.reservation.service}` : ''}
                {extras.reservation.staff ? ` · ${extras.reservation.staff}` : ''}
                {extras.reservation.store ? ` · ${extras.reservation.store}` : ''}
                {` · ${extras.reservation.statusLabel}`}
              </Text>
            </TouchableOpacity>
          )}
          {!!summary && (
            <TouchableOpacity style={styles.summaryRow} onPress={() => setSummaryOpen((o) => !o)}>
              <Text style={styles.summaryText} numberOfLines={summaryOpen ? undefined : 1}>
                <Text style={styles.summaryTitle}>客人摘要：</Text>{summary}
              </Text>
              <Text style={styles.summaryToggle}>{summaryOpen ? '收合' : '展開'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

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
      {/* 標記需處理：輸入要處理的事項 */}
      <Modal visible={flagNote !== null} transparent animationType="fade" onRequestClose={() => !flagBusy && setFlagNote(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => !flagBusy && setFlagNote(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>標記需處理</Text>
            <TextInput
              style={styles.sheetInput}
              placeholder="要處理什麼？（例如：等匯款後再報名登島）"
              placeholderTextColor="#94A3B8"
              value={flagNote ?? ''}
              onChangeText={setFlagNote}
              multiline
            />
            <View style={styles.sheetButtons}>
              <TouchableOpacity style={styles.sheetCancel} onPress={() => setFlagNote(null)} disabled={flagBusy}>
                <Text style={styles.sheetCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetSave} onPress={submitFlag} disabled={flagBusy}>
                {flagBusy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.sheetSaveText}>標記</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 加到常見問答 */}
      <Modal visible={!!faq} transparent animationType="fade" onRequestClose={() => !faq?.saving && setFaq(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => !faq?.saving && setFaq(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>加到常見問答</Text>
            <TextInput
              style={styles.sheetInput}
              placeholder="客人的問題"
              placeholderTextColor="#94A3B8"
              value={faq?.q ?? ''}
              onChangeText={(q) => setFaq((f) => (f ? { ...f, q } : f))}
              multiline
            />
            <TextInput
              style={[styles.sheetInput, { minHeight: 96 }]}
              value={faq?.a ?? ''}
              onChangeText={(a) => setFaq((f) => (f ? { ...f, a } : f))}
              multiline
            />
            <View style={styles.sheetButtons}>
              <TouchableOpacity style={styles.sheetCancel} onPress={() => setFaq(null)} disabled={faq?.saving}>
                <Text style={styles.sheetCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sheetSave}
                onPress={saveFaq}
                disabled={!faq || faq.saving || faq.done || !faq.a.trim()}
              >
                {faq?.saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                  <Text style={styles.sheetSaveText}>{faq?.done ? '已加入' : '加入'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  faqLink: {
    fontSize: 11,
    color: '#2563EB',
  },
  inlineImageWrap: {
    marginTop: 4,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  chipRose: { borderColor: '#FDA4AF' },
  chipRoseText: { fontSize: 12, color: '#BE123C', fontWeight: '600' },
  chipIndigo: { borderColor: '#A5B4FC' },
  chipIndigoText: { fontSize: 12, color: '#4338CA', fontWeight: '600' },
  alertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFF1F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FECDD3',
  },
  alertTitle: { fontSize: 13, fontWeight: '700', color: '#9F1239' },
  alertText: { flex: 1, fontSize: 13, color: '#9F1239' },
  infoCard: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
    backgroundColor: '#F7F9FC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  infoLink: { fontSize: 13, color: '#1A73E8' },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  summaryText: { flex: 1, fontSize: 13, color: '#334155' },
  summaryTitle: { fontWeight: '700', color: '#1E293B' },
  summaryToggle: { fontSize: 11, color: '#1A73E8', marginTop: 2 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    gap: 10,
  },
  sheetTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  sheetInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: '#0F172A',
    minHeight: 56,
    textAlignVertical: 'top',
  },
  sheetButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  sheetCancel: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  sheetCancelText: { fontSize: 14, color: '#334155' },
  sheetSave: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#1A73E8', minWidth: 64, alignItems: 'center' },
  sheetSaveText: { fontSize: 14, color: '#FFFFFF', fontWeight: '600' },
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
