import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
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
  created_at: string
}

const STATUS_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'open', label: '待處理' },
  { key: 'in_progress', label: '處理中' },
  { key: 'resolved', label: '已完成' },
]

export default function TicketsScreen() {
  const { user } = useAuth()
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

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  const onRefresh = () => {
    setRefreshing(true)
    fetchTickets()
  }

  const handleUpdateStatus = async (ticketId: string, nextStatus: string) => {
    try {
      const { error } = await supabase
        .from('cs_tickets')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', ticketId)

      if (error) {
        Alert.alert('更新失敗', error.message)
      } else {
        fetchTickets()
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
          description: newDescription.trim(),
          priority: newPriority,
          platform: 'app',
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

  const renderTicket = ({ item }: { item: Ticket }) => {
    const isResolved = item.status === 'resolved' || item.status === 'closed'
    const priorityColor = getPriorityColor(item.priority)

    return (
      <View style={styles.ticketCard}>
        <View style={styles.cardTop}>
          <View style={[styles.priorityBadge, { backgroundColor: `${priorityColor}15` }]}>
            <Text style={[styles.priorityText, { color: priorityColor }]}>
              {item.priority === 'urgent' ? '緊急' : item.priority === 'high' ? '高優先級' : '一般'}
            </Text>
          </View>
          <Text style={styles.dateText}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>

        <Text style={styles.subjectText}>{item.subject}</Text>
        {item.description ? (
          <Text style={styles.descText} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        <View style={styles.cardBottom}>
          <View style={styles.reporterInfo}>
            <Ionicons name="person-circle-outline" size={16} color="#64748B" />
            <Text style={styles.reporterText}>{item.from_name || '系統建立'}</Text>
          </View>

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
              <Ionicons name="checkmark" size={14} color="#16A34A" />
              <Text style={styles.completedTagText}>已完成</Text>
            </View>
          )}
        </View>
      </View>
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
              <Text style={styles.emptySub}>維修、清潔或交辦事項將顯示在此</Text>
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
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  subjectText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 6,
  },
  descText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 12,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  reporterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reporterText: {
    fontSize: 12,
    color: '#64748B',
  },
  resolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  resolveBtnText: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '600',
  },
  completedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  completedTagText: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#64748B',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  prioritySelector: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  priorityOptionActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  priorityOptionText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  priorityOptionTextActive: {
    color: '#2563EB',
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
})
