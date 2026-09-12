import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { apiFetch, supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

interface Ticket {
  id: string
  subject: string
  description: string | null
  priority: string
  status: string
  platform: string | null
  from_name: string | null
  from_id: string | null
  created_at: string
  intent?: string | null
}

const STATUS_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'open', label: '待處理' },
  { key: 'in_progress', label: '處理中' },
  { key: 'resolved', label: '已完成' },
]

const PLATFORM_META: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  line: { label: 'LINE', color: '#06C755', icon: 'chatbubble' },
  'line-oa': { label: 'LINE', color: '#06C755', icon: 'chatbubble' },
  whatsapp: { label: 'WhatsApp', color: '#25D366', icon: 'logo-whatsapp' },
  'whatsapp-biz': { label: 'WhatsApp', color: '#25D366', icon: 'logo-whatsapp' },
  telegram: { label: 'Telegram', color: '#2AABEE', icon: 'paper-plane' },
  wechat: { label: 'WeChat', color: '#07C160', icon: 'chatbubbles' },
  test: { label: '測試', color: '#8B5CF6', icon: 'flask' },
}

export default function TicketsScreen() {
  const { user } = useAuth()
  const navigation = useNavigation<any>()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')

  // 新增工單 Modal 狀態
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [newSubject, setNewSubject] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newPriority, setNewPriority] = useState('medium')
  const [submitting, setSubmitting] = useState(false)

  const fetchTickets = useCallback(async () => {
    try {
      let endpoint = '/api/marketing/cs-tickets'
      if (activeFilter !== 'all') {
        endpoint += `?status=${activeFilter}`
      }
      const res = await apiFetch(endpoint)
      if (res.ok) {
        const json = await res.json()
        setTickets(json.tickets || [])
      }
    } catch (err) {
      console.log('獲取工單清單失敗:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeFilter])

  // 當畫面重新獲得焦點時自動更新（例如專員自收件匣返回）
  useFocusEffect(
    useCallback(() => {
      fetchTickets()
    }, [fetchTickets])
  )

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  const onRefresh = () => {
    setRefreshing(true)
    fetchTickets()
  }

  // 核心功能：跳轉至該客戶的收件匣直接回覆（與網頁版 CsWorkspace jumpToCustomerInbox 一致）
  const jumpToCustomerInbox = (item: Ticket) => {
    if (!item.from_id) {
      Alert.alert('內部工單', '此工單為內部交辦事項，無關聯之通訊軟體客戶。')
      return
    }

    navigation.navigate('ChatDetail', {
      platform: item.platform || 'line',
      from_id: item.from_id,
      name: item.from_name || (item.platform ? `${item.platform.toUpperCase()} 客戶` : '客戶對話'),
      initialTakeover: true,
    })
  }

  // 更新工單狀態
  const handleUpdateStatus = async (ticketId: string, nextStatus: string) => {
    try {
      const res = await apiFetch(`/api/marketing/cs-tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      })

      if (res.ok) {
        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, status: nextStatus } : t))
        )
      } else {
        // Fallback 直接更新 Supabase
        const { error } = await supabase
          .from('cs_tickets')
          .update({ status: nextStatus, updated_at: new Date().toISOString() })
          .eq('id', ticketId)

        if (error) {
          Alert.alert('更新失敗', error.message)
        } else {
          fetchTickets()
        }
      }
    } catch {
      Alert.alert('錯誤', '操作失敗，請稍候再試')
    }
  }

  const handleCreateTicket = async () => {
    if (!newSubject.trim()) {
      Alert.alert('提示', '請輸入工單主旨')
      return
    }

    setSubmitting(true)
    try {
      const res = await apiFetch('/api/marketing/cs-tickets', {
        method: 'POST',
        body: JSON.stringify({
          subject: newSubject.trim(),
          description: newDescription.trim() || null,
          priority: newPriority,
          platform: 'manual',
          from_name: user?.email || '現場人員',
        }),
      })

      if (res.ok) {
        setCreateModalVisible(false)
        setNewSubject('')
        setNewDescription('')
        setNewPriority('medium')
        fetchTickets()
        Alert.alert('成功', '工單已建立！')
      } else {
        const errJson = await res.json().catch(() => ({}))
        Alert.alert('建立失敗', errJson.error || '無法建立工單')
      }
    } catch {
      Alert.alert('網路錯誤', '無法連線至伺服器')
    } finally {
      setSubmitting(false)
    }
  }

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'urgent':
        return '#EF4444'
      case 'high':
        return '#F97316'
      case 'medium':
        return '#3B82F6'
      default:
        return '#64748B'
    }
  }

  const formatTicketDate = (ts: string) => {
    if (!ts) return ''
    try {
      const d = new Date(ts)
      const now = new Date()
      const isToday = d.toDateString() === now.toDateString()
      if (isToday) {
        return `今天 ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`
      }
      return `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`
    } catch {
      return ''
    }
  }

  const renderTicket = ({ item }: { item: Ticket }) => {
    const isResolved = item.status === 'resolved' || item.status === 'closed'
    const priorityColor = getPriorityColor(item.priority)
    const platMeta = item.platform ? PLATFORM_META[item.platform] : null
    const hasCustomer = !!item.from_id

    return (
      <TouchableOpacity
        style={styles.ticketCard}
        activeOpacity={hasCustomer ? 0.7 : 1}
        onPress={() => {
          if (hasCustomer) jumpToCustomerInbox(item)
        }}
      >
        {/* 卡片頂部：客戶名稱/平台 + 優先級與時間 */}
        <View style={styles.cardTop}>
          <View style={styles.customerRow}>
            {platMeta ? (
              <View style={[styles.platIconBadge, { backgroundColor: `${platMeta.color}15` }]}>
                <Ionicons name={platMeta.icon} size={13} color={platMeta.color} />
              </View>
            ) : (
              <Ionicons name="person-circle" size={18} color="#64748B" />
            )}
            <Text style={styles.customerNameText} numberOfLines={1}>
              {item.from_name || (hasCustomer ? '未知名稱客戶' : '內部交辦事項')}
            </Text>
          </View>

          <View style={styles.topRightCol}>
            <View style={[styles.priorityBadge, { backgroundColor: `${priorityColor}15` }]}>
              <Text style={[styles.priorityText, { color: priorityColor }]}>
                {item.priority === 'urgent'
                  ? '緊急'
                  : item.priority === 'high'
                  ? '急件'
                  : '一般'}
              </Text>
            </View>
            <Text style={styles.dateText}>{formatTicketDate(item.created_at)}</Text>
          </View>
        </View>

        {/* 主旨與描述 */}
        <Text style={styles.subjectText}>{item.subject}</Text>
        {item.description ? (
          <Text style={styles.descText} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        {/* 底部操作區：前往收件匣按鈕 + 標記完成 */}
        <View style={styles.cardBottom}>
          {hasCustomer ? (
            <TouchableOpacity
              style={styles.inboxActionBtn}
              activeOpacity={0.8}
              onPress={() => jumpToCustomerInbox(item)}
            >
              <Ionicons name="chatbubble-ellipses" size={15} color="#FFFFFF" />
              <Text style={styles.inboxActionText}>前往收件匣回覆 →</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.internalTag}>
              <Ionicons name="document-text-outline" size={13} color="#94A3B8" />
              <Text style={styles.internalTagText}>內部工作</Text>
            </View>
          )}

          {!isResolved ? (
            <TouchableOpacity
              style={styles.resolveBtn}
              onPress={() => handleUpdateStatus(item.id, 'resolved')}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color="#16A34A" />
              <Text style={styles.resolveBtnText}>標記完成</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.completedTag}>
              <Ionicons name="checkmark" size={13} color="#16A34A" />
              <Text style={styles.completedTagText}>已完成</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      {/* 頂部狀態過濾條 */}
      <View style={styles.filterBar}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, activeFilter === f.key && styles.filterTabActive]}
            onPress={() => setActiveFilter(f.key)}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === f.key && styles.filterTabTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 工單列表 */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>載入工單中...</Text>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          renderItem={renderTicket}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="clipboard-outline" size={56} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>目前尚無相關工單</Text>
              <Text style={styles.emptySub}>客人的人工客服請求或維修交辦事項將顯示在此</Text>
            </View>
          }
        />
      )}

      {/* 浮動新增按鈕 (FAB) */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => setCreateModalVisible(true)}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* 新增工單 Modal */}
      <Modal visible={createModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>建立新工單</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>工單主旨 *</Text>
            <TextInput
              style={styles.input}
              placeholder="例如: 201號房 空調故障需要維修"
              value={newSubject}
              onChangeText={setNewSubject}
            />

            <Text style={styles.inputLabel}>詳細說明</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="請填寫故障細節或現場狀況..."
              value={newDescription}
              onChangeText={setNewDescription}
              multiline
              numberOfLines={4}
            />

            <Text style={styles.inputLabel}>優先級別</Text>
            <View style={styles.prioritySelector}>
              {[
                { key: 'medium', label: '一般' },
                { key: 'high', label: '急件' },
                { key: 'urgent', label: '特急 (緊急修繕)' },
              ].map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={[
                    styles.priorityOption,
                    newPriority === p.key && styles.priorityOptionActive,
                  ]}
                  onPress={() => setNewPriority(p.key)}
                >
                  <Text
                    style={[
                      styles.priorityOptionText,
                      newPriority === p.key && styles.priorityOptionTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleCreateTicket}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>確認送出工單</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  filterBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  filterTabActive: {
    backgroundColor: '#2563EB',
  },
  filterTabText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  ticketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  platIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  topRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  subjectText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  descText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 10,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginTop: 4,
  },
  inboxActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#2563EB',
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  inboxActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  internalTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  internalTagText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  resolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  resolveBtnText: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '600',
  },
  completedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  completedTagText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 14,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  prioritySelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  priorityOptionActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  priorityOptionText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  priorityOptionTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
})
