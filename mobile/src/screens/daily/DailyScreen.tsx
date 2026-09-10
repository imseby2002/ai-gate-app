import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiFetch } from '../../lib/supabase'

interface DailyRecord {
  id: string
  date: string
  room_name: string
  room_password: string | null
  gate_password: string | null
  order_number: string | null
  guest_name: string | null
  price_total: number | null
  deposit: number | null
  paid: boolean
  platform: string | null
  booking_id: string | null
  source: 'traiwan' | 'manual' | 'booking'
  sort_order: number
}

interface UnmatchedBooking {
  guest_name: string
  order_number: string
  booking_id: string | null
  platform: string | null
  check_in: string | null
  check_out: string | null
}

const PLATFORM_LABELS: Record<string, string> = {
  booking_com: 'Booking',
  agoda: 'Agoda',
  trip_com: 'Trip',
  asiayo: 'AsiaYo',
  airbnb: 'Airbnb',
  expedia: 'Expedia',
  hotels_com: 'Hotels',
  ctrip: 'Ctrip',
  klook: 'Klook',
  kkday: 'KKday',
  easytravel: 'EzTravel',
  manual: '自來客',
  direct: '官網',
}

function getTodayTW() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDaysStr(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DailyScreen() {
  const [currentDate, setCurrentDate] = useState<string>(getTodayTW)
  const [records, setRecords] = useState<DailyRecord[]>([])
  const [unmatched, setUnmatched] = useState<UnmatchedBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  // 密碼全域遮蔽控制
  const [showPasswords, setShowPasswords] = useState(false)

  // 大門密碼（全棟共用）
  const [gatePw, setGatePw] = useState('')
  const [savingGate, setSavingGate] = useState(false)

  // 現場快速編輯 Modal
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<DailyRecord | null>(null)
  const [editForm, setEditForm] = useState({
    guest_name: '',
    order_number: '',
    platform: '',
    price_total: '',
    deposit: '',
    room_password: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)

  const requestIdRef = useRef(0)

  const fetchDaily = useCallback(async (dateStr: string) => {
    const myId = ++requestIdRef.current
    try {
      const res = await apiFetch(`/api/booking/daily?date=${dateStr}`)
      if (res.ok) {
        const json = await res.json()
        if (myId !== requestIdRef.current) return

        if (json.rooms && Array.isArray(json.rooms)) {
          setRecords(json.rooms)
          setUnmatched(Array.isArray(json.unmatched) ? json.unmatched : [])
          setGatePw(json.rooms[0]?.gate_password || '')
        } else if (Array.isArray(json)) {
          setRecords(json)
          setUnmatched([])
          setGatePw(json[0]?.gate_password || '')
        } else {
          setRecords([])
          setUnmatched([])
        }
      }
    } catch (err) {
      console.log('獲取每日入住資料失敗:', err)
    } finally {
      if (myId === requestIdRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    fetchDaily(currentDate)
  }, [fetchDaily, currentDate])

  const shiftDate = (days: number) => {
    const nextDate = addDaysStr(currentDate, days)
    setCurrentDate(nextDate)
    setLoading(true)
  }

  const goToday = () => {
    const today = getTodayTW()
    setCurrentDate(today)
    setLoading(true)
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchDaily(currentDate)
  }

  // 更新大門密碼（向後套用當天及未來日期）
  const commitGatePassword = async () => {
    const newVal = gatePw.trim() || null
    if ((records[0]?.gate_password ?? null) === newVal) return

    setSavingGate(true)
    try {
      const res = await apiFetch('/api/booking/daily', {
        method: 'PATCH',
        body: JSON.stringify({
          forward: true,
          from_date: currentDate,
          field: 'gate_password',
          value: newVal,
        }),
      })

      if (res.ok) {
        setRecords((prev) => prev.map((r) => ({ ...r, gate_password: newVal })))
      } else {
        const err = await res.json()
        Alert.alert('更新失敗', err.error || '無法更新大門密碼')
      }
    } catch {
      Alert.alert('連線異常', '請檢查網路連線')
    } finally {
      setSavingGate(false)
    }
  }

  // 切換已付款狀態
  const togglePaidStatus = async (item: DailyRecord) => {
    const nextPaid = !item.paid
    setRecords((prev) => prev.map((r) => (r.id === item.id ? { ...r, paid: nextPaid } : r)))
    setSavingId(item.id)

    try {
      const res = await apiFetch('/api/booking/daily', {
        method: 'PATCH',
        body: JSON.stringify({ id: item.id, paid: nextPaid }),
      })

      if (!res.ok) {
        const err = await res.json()
        Alert.alert('更新失敗', err.error || '無法切換收款狀態')
        // 回復原本狀態
        setRecords((prev) => prev.map((r) => (r.id === item.id ? { ...r, paid: !nextPaid } : r)))
      }
    } catch {
      Alert.alert('連線異常', '請稍後重試')
      setRecords((prev) => prev.map((r) => (r.id === item.id ? { ...r, paid: !nextPaid } : r)))
    } finally {
      setSavingId(null)
    }
  }

  // 一鍵續住：帶入前一天同房間住客與訂單，並自動將訂單退房日延後一晚
  const handleContinueStay = async (item: DailyRecord) => {
    setSavingId(item.id)
    try {
      const res = await apiFetch('/api/booking/daily', {
        method: 'PATCH',
        body: JSON.stringify({ id: item.id, action: 'continue' }),
      })

      const d = await res.json()
      if (res.ok && d) {
        setRecords((prev) => prev.map((r) => (r.id === item.id ? { ...r, ...d } : r)))
        Alert.alert('續住成功', `已成功帶入前一日住客資料並展延退房日！`)
      } else {
        Alert.alert('續住失敗', d?.error || '前一天沒有可帶入的入住資料')
      }
    } catch {
      Alert.alert('連線異常', '請稍後重試')
    } finally {
      setSavingId(null)
    }
  }

  // 打開編輯彈窗
  const openEditModal = (item: DailyRecord) => {
    setEditingRow(item)
    setEditForm({
      guest_name: item.guest_name || '',
      order_number: item.order_number || '',
      platform: item.platform || '',
      price_total: item.price_total != null ? String(item.price_total) : '',
      deposit: item.deposit != null ? String(item.deposit) : '',
      room_password: item.room_password || '',
    })
    setEditModalOpen(true)
  }

  // 儲存現場編輯
  const saveEdit = async () => {
    if (!editingRow) return
    setSavingEdit(true)

    try {
      const newPrice = editForm.price_total.trim() ? parseFloat(editForm.price_total) : null
      const newDeposit = editForm.deposit.trim() ? parseFloat(editForm.deposit) : null
      const newPw = editForm.room_password.trim() || null

      // 1. 若房門密碼有改動，呼叫 forward 更新該房當日及之後
      if (editingRow.room_password !== newPw) {
        await apiFetch('/api/booking/daily', {
          method: 'PATCH',
          body: JSON.stringify({
            forward: true,
            from_date: currentDate,
            field: 'room_password',
            value: newPw,
            room_name: editingRow.room_name,
          }),
        })
      }

      // 2. 更新其他欄位
      const res = await apiFetch('/api/booking/daily', {
        method: 'PATCH',
        body: JSON.stringify({
          id: editingRow.id,
          guest_name: editForm.guest_name.trim() || null,
          order_number: editForm.order_number.trim() || null,
          platform: editForm.platform.trim() || null,
          price_total: newPrice,
          deposit: newDeposit,
          room_password: newPw,
        }),
      })

      if (res.ok) {
        const updated = await res.json()
        setRecords((prev) =>
          prev.map((r) =>
            r.id === editingRow.id
              ? {
                  ...r,
                  ...updated,
                  guest_name: editForm.guest_name.trim() || null,
                  order_number: editForm.order_number.trim() || null,
                  platform: editForm.platform.trim() || null,
                  price_total: newPrice,
                  deposit: newDeposit,
                  room_password: newPw,
                }
              : r
          )
        )
        setEditModalOpen(false)
      } else {
        const err = await res.json()
        Alert.alert('儲存失敗', err.error || '無法更新入住資料')
      }
    } catch {
      Alert.alert('連線異常', '請檢查網路連線')
    } finally {
      setSavingEdit(false)
    }
  }

  const isToday = currentDate === getTodayTW()

  return (
    <View style={styles.container}>
      {/* 頂部全域控制列 */}
      <View style={styles.topControlCard}>
        {/* 大門密碼區塊 (全棟共用) */}
        <View style={styles.gateRow}>
          <View style={styles.gateLeft}>
            <Ionicons name="key-outline" size={18} color="#4F46E5" />
            <Text style={styles.gateLabel}>大門密碼 (全棟共用)：</Text>
          </View>
          <View style={styles.gateInputBox}>
            <TextInput
              style={styles.gateInput}
              secureTextEntry={!showPasswords}
              value={gatePw}
              placeholder="點此填寫..."
              placeholderTextColor="#94A3B8"
              onChangeText={setGatePw}
              onBlur={commitGatePassword}
            />
            {savingGate && <ActivityIndicator size="small" color="#4F46E5" />}
          </View>
        </View>

        {/* 密碼顯隱與刷新按鈕 */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.togglePwBtn}
            onPress={() => setShowPasswords((v) => !v)}
          >
            <Ionicons
              name={showPasswords ? 'eye-off-outline' : 'eye-outline'}
              size={16}
              color="#475569"
            />
            <Text style={styles.togglePwText}>
              {showPasswords ? '遮蔽密碼' : '顯示密碼'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} disabled={loading}>
            <Ionicons
              name="refresh-outline"
              size={16}
              color="#475569"
              style={loading ? styles.rotating : undefined}
            />
            <Text style={styles.refreshBtnText}>重整</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 日期切換導覽列 */}
      <View style={styles.dateBar}>
        <TouchableOpacity style={styles.dateNavBtn} onPress={() => shiftDate(-1)}>
          <Ionicons name="chevron-back" size={18} color="#1E293B" />
          <Text style={styles.dateNavText}>前一天</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.dateCenterBtn} onPress={goToday}>
          <Text style={styles.dateTitle}>{currentDate}</Text>
          {isToday ? (
            <View style={styles.todayTag}>
              <Text style={styles.todayTagText}>今天</Text>
            </View>
          ) : (
            <Text style={styles.backTodayText}>回到今天</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.dateNavBtn} onPress={() => shiftDate(1)}>
          <Text style={styles.dateNavText}>後一天</Text>
          <Ionicons name="chevron-forward" size={18} color="#1E293B" />
        </TouchableOpacity>
      </View>

      {/* 主內容捲動區 */}
      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} />}
      >
        {/* 未配對訂單提示 (Unmatched Bookings) */}
        {unmatched.length > 0 && (
          <View style={styles.unmatchedCard}>
            <View style={styles.unmatchedHeader}>
              <Ionicons name="warning-outline" size={16} color="#D97706" />
              <Text style={styles.unmatchedTitle}>
                有 {unmatched.length} 筆當日訂單尚未配對房號
              </Text>
            </View>
            {unmatched.map((u, i) => (
              <View key={i} style={styles.unmatchedItem}>
                <Text style={styles.unmatchedGuest}>{u.guest_name || '無姓名'}</Text>
                <Text style={styles.unmatchedOrder}>單號：{u.order_number || '—'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 房間卡片列表 */}
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>載入今日入住資料...</Text>
          </View>
        ) : records.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="bed-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>此日期尚無任何房型或入住資料</Text>
            <Text style={styles.emptySub}>請確認是否已於後台建立房型或同步訂單</Text>
          </View>
        ) : (
          records.map((row) => {
            const price = row.price_total ?? null
            const dep = row.deposit ?? null
            const balance = price != null ? price - (dep ?? 0) : null
            const isSaving = savingId === row.id
            const platLabel = row.platform ? PLATFORM_LABELS[row.platform] || row.platform : null

            return (
              <View key={row.id} style={[styles.card, isSaving && styles.cardSaving]}>
                {/* 房卡頂部：房名 + 快速編輯按鈕 */}
                <View style={styles.cardHeader}>
                  <View style={styles.roomBadge}>
                    <Ionicons name="bed" size={14} color="#0284C7" />
                    <Text style={styles.roomNameText}>{row.room_name}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.editCardBtn}
                    onPress={() => openEditModal(row)}
                  >
                    <Ionicons name="create-outline" size={16} color="#2563EB" />
                    <Text style={styles.editCardBtnText}>現場編輯</Text>
                  </TouchableOpacity>
                </View>

                {/* 住客與訂單 */}
                <View style={styles.guestSection}>
                  <View style={styles.infoRow}>
                    <Text style={styles.fieldLabel}>住客姓名</Text>
                    <View style={styles.guestRightCol}>
                      <Text style={[styles.guestName, !row.guest_name && styles.placeholderText]}>
                        {row.guest_name || '尚未填寫住客'}
                      </Text>
                      {!row.guest_name && !row.order_number && (
                        <TouchableOpacity
                          style={styles.continueBtn}
                          onPress={() => handleContinueStay(row)}
                        >
                          <Ionicons name="arrow-redo" size={12} color="#4F46E5" />
                          <Text style={styles.continueBtnText}>一鍵續住</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.fieldLabel}>訂單單號</Text>
                    <View style={styles.orderRightCol}>
                      <Text style={[styles.orderNumber, !row.order_number && styles.placeholderText]}>
                        {row.order_number || '無單號'}
                      </Text>
                      {platLabel && (
                        <View style={styles.platTag}>
                          <Text style={styles.platTagText}>{platLabel}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* 財務三項 (總額 / 訂金 / 尾款) */}
                <View style={styles.financeGrid}>
                  <View style={styles.financeCol}>
                    <Text style={styles.finLabel}>總金額</Text>
                    <Text style={styles.finVal}>
                      {price != null ? `NT$ ${price.toLocaleString()}` : '—'}
                    </Text>
                  </View>
                  <View style={styles.financeCol}>
                    <Text style={styles.finLabel}>訂金</Text>
                    <Text style={styles.finVal}>
                      {dep != null ? `NT$ ${dep.toLocaleString()}` : '—'}
                    </Text>
                  </View>
                  <View style={styles.financeCol}>
                    <Text style={styles.finLabel}>尾款</Text>
                    <Text style={[styles.finVal, balance && balance > 0 ? styles.balanceAlert : null]}>
                      {balance != null ? `NT$ ${balance.toLocaleString()}` : '—'}
                    </Text>
                  </View>
                </View>

                {/* 底部狀態列：收款切換 + 房間密碼 */}
                <View style={styles.cardFooter}>
                  {/* 付款切換按鈕 */}
                  <TouchableOpacity
                    style={[styles.paidToggle, row.paid ? styles.paidActive : styles.paidInactive]}
                    onPress={() => togglePaidStatus(row)}
                  >
                    <Ionicons
                      name={row.paid ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={row.paid ? '#15803D' : '#64748B'}
                    />
                    <Text style={[styles.paidText, row.paid ? styles.paidTextActive : styles.paidTextInactive]}>
                      {row.paid ? '已結清' : '未付清'}
                    </Text>
                  </TouchableOpacity>

                  {/* 房門密碼 */}
                  <View style={styles.roomPwBox}>
                    <Text style={styles.pwLabel}>房門密碼：</Text>
                    <Text style={styles.pwVal}>
                      {showPasswords
                        ? row.room_password || '未設定'
                        : row.room_password
                        ? '••••••'
                        : '未設定'}
                    </Text>
                  </View>
                </View>
              </View>
            )
          })
        )}
      </ScrollView>

      {/* 現場編輯 Modal */}
      <Modal visible={editModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{editingRow?.room_name} · 現場資料編輯</Text>
                <Text style={styles.modalSub}>{currentDate} 入住資料</Text>
              </View>
              <TouchableOpacity onPress={() => setEditModalOpen(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* 續住捷徑按鈕 */}
              {editingRow && (
                <TouchableOpacity
                  style={styles.modalContinueBar}
                  onPress={() => {
                    setEditModalOpen(false)
                    handleContinueStay(editingRow)
                  }}
                >
                  <Ionicons name="arrow-redo" size={16} color="#4F46E5" />
                  <Text style={styles.modalContinueText}>帶入前一天住客資料（一鍵續住）</Text>
                </TouchableOpacity>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>住客姓名</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="例如：陳大文"
                  value={editForm.guest_name}
                  onChangeText={(v) => setEditForm((f) => ({ ...f, guest_name: v }))}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>訂單單號</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="訂單編號"
                  value={editForm.order_number}
                  onChangeText={(v) => setEditForm((f) => ({ ...f, order_number: v }))}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>來源平台</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                  {Object.entries(PLATFORM_LABELS).map(([k, label]) => {
                    const isSel = editForm.platform === k
                    return (
                      <TouchableOpacity
                        key={k}
                        style={[styles.platSelectPill, isSel && styles.platSelectPillActive]}
                        onPress={() => setEditForm((f) => ({ ...f, platform: k }))}
                      >
                        <Text style={[styles.platSelectText, isSel && styles.platSelectTextActive]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>總金額 (NT$)</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="numeric"
                    placeholder="0"
                    value={editForm.price_total}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, price_total: v }))}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>已付訂金 (NT$)</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="numeric"
                    placeholder="0"
                    value={editForm.deposit}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, deposit: v }))}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>房間獨立密碼 (套用當天及未來日期)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="留空即無密碼"
                  value={editForm.room_password}
                  onChangeText={(v) => setEditForm((f) => ({ ...f, room_password: v }))}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditModalOpen(false)}
                disabled={savingEdit}
              >
                <Text style={styles.cancelBtnText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, savingEdit && styles.confirmBtnDisabled]}
                onPress={saveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmBtnText}>儲存更新</Text>
                )}
              </TouchableOpacity>
            </View>
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
  topControlCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  gateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  gateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3730A3',
  },
  gateInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    maxWidth: 130,
  },
  gateInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A5B4FC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 13,
    color: '#1E1B4B',
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  togglePwBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  togglePwText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  refreshBtnText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  rotating: {
    opacity: 0.5,
  },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  dateNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 6,
  },
  dateNavText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  dateCenterBtn: {
    alignItems: 'center',
  },
  dateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  todayTag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 8,
    marginTop: 2,
  },
  todayTagText: {
    fontSize: 10,
    color: '#2563EB',
    fontWeight: '600',
  },
  backTodayText: {
    fontSize: 11,
    color: '#2563EB',
    marginTop: 2,
    fontWeight: '500',
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    padding: 12,
    paddingBottom: 32,
  },
  unmatchedCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  unmatchedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  unmatchedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
  },
  unmatchedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  unmatchedGuest: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
  },
  unmatchedOrder: {
    fontSize: 12,
    color: '#78350F',
  },
  centerLoading: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
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
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  cardSaving: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
  },
  roomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roomNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0369A1',
  },
  editCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  editCardBtnText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '600',
  },
  guestSection: {
    paddingVertical: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  fieldLabel: {
    width: 68,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  guestRightCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  guestName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  placeholderText: {
    color: '#CBD5E1',
    fontWeight: '400',
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  continueBtnText: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '600',
  },
  orderRightCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderNumber: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  platTag: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  platTagText: {
    fontSize: 10,
    color: '#0369A1',
    fontWeight: '600',
  },
  financeGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  financeCol: {
    flex: 1,
    alignItems: 'center',
  },
  finLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  finVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  balanceAlert: {
    color: '#DC2626',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 4,
  },
  paidToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  paidActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  paidInactive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  paidText: {
    fontSize: 12,
    fontWeight: '600',
  },
  paidTextActive: {
    color: '#15803D',
  },
  paidTextInactive: {
    color: '#64748B',
  },
  roomPwBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pwLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  pwVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: 1,
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
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalBody: {
    marginTop: 12,
  },
  modalContinueBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  modalContinueText: {
    fontSize: 13,
    color: '#4F46E5',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
  },
  platSelectPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 6,
  },
  platSelectPillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  platSelectText: {
    fontSize: 11,
    color: '#475569',
  },
  platSelectTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
})
