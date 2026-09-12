import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { apiFetch } from '../../lib/supabase'

interface Booking {
  id: string
  guest_name: string
  guest_phone: string
  check_in: string
  check_out: string
  status: string
  platform: string
  num_guests: number
  extra_beds?: number
  total_price: number | null
  currency: string
  properties?: { name: string } | null
  property_id: string | null
}

interface Property {
  id: string
  name: string
  room_count: number
  base_price: number | null
  currency: string
  max_guests?: number
  extra_guest_fee?: number | null
  base_guests?: number
  extra_fee_mode?: string
  max_extra_beds?: number
  extra_bed_fee?: number | null
  extra_bed_type?: string
}

const PLATFORM_META: Record<string, { label: string; color: string }> = {
  direct: { label: '直訂', color: '#4F46E5' },
  manual: { label: '手動', color: '#64748B' },
  booking_com: { label: 'Booking', color: '#1E40AF' },
  agoda: { label: 'Agoda', color: '#7E22CE' },
  airbnb: { label: 'Airbnb', color: '#E11D48' },
  trip_com: { label: 'Trip.com', color: '#0284C7' },
  asiayo: { label: 'AsiaYo', color: '#EA580C' },
  easytravel: { label: 'EzTravel', color: '#0891B2' },
  expedia: { label: 'Expedia', color: '#D97706' },
  klook: { label: 'Klook', color: '#FF5722' },
}

const PROP_PALETTE = [
  '#4F46E5', '#059669', '#D97706', '#E11D48',
  '#7C3AED', '#0D9488', '#EA580C', '#DB2777',
]

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: '已確認', color: '#15803D', bg: '#DCFCE7' },
  pending: { label: '待確認', color: '#B45309', bg: '#FEF3C7' },
  cancelled: { label: '已取消', color: '#B91C1C', bg: '#FEE2E2' },
  completed: { label: '已退房', color: '#475569', bg: '#F1F5F9' },
  no_show: { label: '未入住', color: '#C2410C', bg: '#FFEDD5' },
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getDaysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate()
}

function getFirstDayOfWeek(y: number, m: number) {
  return new Date(y, m, 1).getDay()
}

function addDays(ds: string, n: number) {
  const d = new Date(ds + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

interface RoomLine {
  property_id: string
  property_name: string
  total_price: string
  num_guests: number
  extra_beds: number
}

interface QuickForm {
  guest_name: string
  guest_phone: string
  guest_email: string
  platform_booking_id: string
  check_in: string
  check_out: string
  platform: string
  rooms: RoomLine[]
}

interface EditForm {
  id: string
  guest_name: string
  guest_phone: string
  check_in: string
  check_out: string
  platform: string
  status: string
  total_price: string
  num_guests: string
  extra_beds: string
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export default function CalendarScreen() {
  const now = useMemo(() => new Date(), [])
  const todayStr = useMemo(() => toDateStr(now), [now])

  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)

  const [bookings, setBookings] = useState<Booking[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [filterProp, setFilterProp] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // 快速訂房 Modal
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickForm, setQuickForm] = useState<QuickForm>({
    guest_name: '',
    guest_phone: '',
    guest_email: '',
    platform_booking_id: '',
    check_in: todayStr,
    check_out: addDays(todayStr, 1),
    platform: 'direct',
    rooms: [],
  })
  const [orderTotal, setOrderTotal] = useState('')
  const [saving, setSaving] = useState(false)

  // 載入當月訂單與房型資料
  const fetchData = useCallback(async () => {
    try {
      const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const lastDay = getDaysInMonth(year, month)
      const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      let url = `/api/booking/bookings?from=${from}&to=${to}&limit=500`
      if (filterProp) url += `&property_id=${filterProp}`

      const [bkRes, prRes] = await Promise.all([
        apiFetch(url),
        apiFetch('/api/booking/properties'),
      ])

      if (bkRes.ok) {
        const bkJson = await bkRes.json()
        setBookings(bkJson.bookings || [])
      }
      if (prRes.ok) {
        const prJson = await prRes.json()
        const propList: Property[] = (prJson.properties || []).filter((p: Property) => p.room_count > 0)
        setProperties(propList)
      }
    } catch (err) {
      console.log('載入日曆資料失敗:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [year, month, filterProp])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const onRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  const prevMonth = () => {
    if (month === 0) {
      setYear((y) => y - 1)
      setMonth(11)
    } else {
      setMonth((m) => m - 1)
    }
  }

  const nextMonth = () => {
    if (month === 11) {
      setYear((y) => y + 1)
      setMonth(0)
    } else {
      setMonth((m) => m + 1)
    }
  }

  const goToday = () => {
    const cur = new Date()
    setYear(cur.getFullYear())
    setMonth(cur.getMonth())
    setSelectedDate(todayStr)
  }

  const visibleProps = useMemo(() => {
    return filterProp ? properties.filter((p) => p.id === filterProp) : properties
  }, [filterProp, properties])

  const totalRooms = useMemo(() => {
    return visibleProps.reduce((sum, p) => sum + p.room_count, 0)
  }, [visibleProps])

  // 整理日期對應的訂單列表
  const dateBookings = useMemo(() => {
    const map: Record<string, Booking[]> = {}
    for (const bk of bookings) {
      if (bk.status === 'cancelled') continue
      const cur = new Date(bk.check_in + 'T00:00:00')
      const end = new Date(bk.check_out + 'T00:00:00')
      while (cur < end) {
        const ds = toDateStr(cur)
        if (!map[ds]) map[ds] = []
        map[ds].push(bk)
        cur.setDate(cur.getDate() + 1)
      }
    }
    return map
  }, [bookings])

  const availableCount = useCallback(
    (ds: string) => {
      return Math.max(0, totalRooms - (dateBookings[ds] || []).length)
    },
    [totalRooms, dateBookings]
  )

  const selectedBookings = useMemo(() => {
    return dateBookings[selectedDate] || []
  }, [dateBookings, selectedDate])

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)

  // 頁面聚焦時自動重新整理資料（保持與每日入住同步）
  useFocusEffect(
    useCallback(() => {
      fetchData()
    }, [fetchData])
  )

  // 快速訂房：打開指定房型與日期
  const openQuickBooking = (p: Property, ds: string) => {
    setOrderTotal('')
    const defaultGuests = p.base_guests ?? 2
    setQuickForm({
      guest_name: '',
      guest_phone: '',
      guest_email: '',
      platform_booking_id: '',
      check_in: ds,
      check_out: addDays(ds, 1),
      platform: 'direct',
      rooms: [
        {
          property_id: p.id,
          property_name: p.name,
          total_price: p.base_price ? String(p.base_price) : '',
          num_guests: defaultGuests,
          extra_beds: 0,
        },
      ],
    })
    setQuickOpen(true)
  }

  const addRoomLine = (propertyId: string) => {
    if (!propertyId) return
    const p = properties.find((x) => x.id === propertyId)
    if (!p || quickForm.rooms.some((r) => r.property_id === propertyId)) return
    const defaultGuests = p.base_guests ?? 2
    setQuickForm((f) => ({
      ...f,
      rooms: [
        ...f.rooms,
        {
          property_id: p.id,
          property_name: p.name,
          total_price: p.base_price ? String(p.base_price) : '',
          num_guests: defaultGuests,
          extra_beds: 0,
        },
      ],
    }))
  }

  const removeRoomLine = (propertyId: string) => {
    setQuickForm((f) => ({
      ...f,
      rooms: f.rooms.length <= 1 ? f.rooms : f.rooms.filter((r) => r.property_id !== propertyId),
    }))
  }

  const updateRoomLine = (propertyId: string, patch: Partial<RoomLine>) => {
    setQuickForm((f) => ({
      ...f,
      rooms: f.rooms.map((r) => (r.property_id === propertyId ? { ...r, ...patch } : r)),
    }))
  }

  const applyOrderTotal = () => {
    const total = parseFloat(orderTotal)
    const n = quickForm.rooms.length
    if (!total || n === 0) return
    const base = Math.floor(total / n)
    setQuickForm((f) => ({
      ...f,
      rooms: f.rooms.map((r, i) => ({
        ...r,
        total_price: String(i === n - 1 ? total - base * (n - 1) : base),
      })),
    }))
  }

  const saveQuickBooking = async () => {
    if (!quickForm.guest_name.trim()) {
      Alert.alert('請填寫旅客姓名')
      return
    }
    if (quickForm.rooms.length === 0) {
      Alert.alert('請至少選擇一間房型')
      return
    }

    setSaving(true)
    try {
      const res = await apiFetch('/api/booking/orders', {
        method: 'POST',
        body: JSON.stringify({
          guest_name: quickForm.guest_name.trim(),
          guest_phone: quickForm.guest_phone.trim(),
          guest_email: quickForm.guest_email.trim(),
          platform_booking_id: quickForm.platform_booking_id.trim() || null,
          check_in: quickForm.check_in,
          check_out: quickForm.check_out,
          platform: quickForm.platform,
          source: 'manual',
          rooms: quickForm.rooms.map((r) => ({
            property_id: r.property_id,
            num_guests: r.num_guests,
            extra_beds: r.extra_beds ?? 0,
            total_price: r.total_price ? parseFloat(r.total_price) : null,
          })),
        }),
      })

      const d = await res.json()
      if (!res.ok) {
        Alert.alert('新增失敗', d.error || '無法建立訂單')
        return
      }

      setQuickOpen(false)
      Alert.alert('建立成功', '訂單已加入日曆並自動同步每日入住！')
      fetchData()
    } catch {
      Alert.alert('錯誤', '網路連線異常，請稍後重試')
    } finally {
      setSaving(false)
    }
  }

  // ── 編輯訂單 ──────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>({
    id: '', guest_name: '', guest_phone: '',
    check_in: '', check_out: '', platform: 'direct',
    status: 'confirmed', total_price: '', num_guests: '1', extra_beds: '0',
  })
  const [editSaving, setEditSaving] = useState(false)

  const openEdit = (bk: Booking) => {
    setEditForm({
      id: bk.id,
      guest_name: bk.guest_name || '',
      guest_phone: bk.guest_phone || '',
      check_in: bk.check_in,
      check_out: bk.check_out,
      platform: bk.platform,
      status: bk.status,
      total_price: bk.total_price != null ? String(bk.total_price) : '',
      num_guests: String(bk.num_guests || 1),
      extra_beds: String(bk.extra_beds ?? 0),
    })
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!editForm.guest_name.trim()) {
      Alert.alert('請填寫旅客姓名')
      return
    }
    setEditSaving(true)
    try {
      const res = await apiFetch('/api/booking/bookings', {
        method: 'PUT',
        body: JSON.stringify({
          id: editForm.id,
          guest_name: editForm.guest_name.trim(),
          guest_phone: editForm.guest_phone.trim(),
          check_in: editForm.check_in,
          check_out: editForm.check_out,
          platform: editForm.platform,
          status: editForm.status,
          total_price: editForm.total_price ? parseFloat(editForm.total_price) : null,
          num_guests: parseInt(editForm.num_guests) || 1,
          extra_beds: parseInt(editForm.extra_beds) || 0,
        }),
      })
      const d = await res.json()
      if (!res.ok) {
        Alert.alert('更新失敗', d.error || '無法更新訂單')
        return
      }
      setEditOpen(false)
      fetchData()
    } catch {
      Alert.alert('錯誤', '網路連線異常，請稍後重試')
    } finally {
      setEditSaving(false)
    }
  }

  const deleteBooking = (bk: Booking) => {
    Alert.alert(
      '確認刪除',
      `確定要刪除「${bk.guest_name || '此訂單'}」？此操作無法復原。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '刪除', style: 'destructive',
          onPress: async () => {
            try {
              const res = await apiFetch('/api/booking/bookings', {
                method: 'DELETE',
                body: JSON.stringify({ id: bk.id }),
              })
              if (!res.ok) {
                const d = await res.json()
                Alert.alert('刪除失敗', d.error || '無法刪除訂單')
                return
              }
              setEditOpen(false)
              fetchData()
            } catch {
              Alert.alert('錯誤', '網路連線異常，請稍後重試')
            }
          },
        },
      ]
    )
  }

  return (
    <View style={styles.container}>
      {/* 頂部月曆導覽列 */}
      <View style={styles.header}>
        <View style={styles.monthRow}>
          <TouchableOpacity style={styles.navBtn} onPress={prevMonth}>
            <Ionicons name="chevron-back" size={20} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {year} 年 {month + 1} 月
          </Text>
          <TouchableOpacity style={styles.navBtn} onPress={nextMonth}>
            <Ionicons name="chevron-forward" size={20} color="#1E293B" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.todayPill} onPress={goToday}>
            <Text style={styles.todayPillText}>今天</Text>
          </TouchableOpacity>
        </View>

        {/* 房型快速切換標籤列 */}
        {properties.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.propertyScroll}
            contentContainerStyle={styles.propertyScrollContent}
          >
            <TouchableOpacity
              style={[styles.propPill, filterProp === '' && styles.propPillActive]}
              onPress={() => setFilterProp('')}
            >
              <Text style={[styles.propPillText, filterProp === '' && styles.propPillTextActive]}>
                全部房型 ({properties.length})
              </Text>
            </TouchableOpacity>
            {properties.map((p, idx) => {
              const active = filterProp === p.id
              const dotColor = PROP_PALETTE[idx % PROP_PALETTE.length]
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.propPill, active && styles.propPillActive]}
                  onPress={() => setFilterProp(p.id)}
                >
                  <View style={[styles.propDot, { backgroundColor: dotColor }]} />
                  <Text style={[styles.propPillText, active && styles.propPillTextActive]}>
                    {p.name}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        )}
      </View>

      <ScrollView
        style={styles.contentScroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} />}
      >
        {/* 月曆網格 (Calendar Grid) */}
        <View style={styles.calendarCard}>
          {/* 星期列 */}
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, idx) => (
              <View key={w} style={styles.weekCell}>
                <Text
                  style={[
                    styles.weekText,
                    idx === 0 ? styles.sunText : idx === 6 ? styles.satText : null,
                  ]}
                >
                  {w}
                </Text>
              </View>
            ))}
          </View>

          {/* 日期網格 */}
          {loading ? (
            <View style={styles.calendarLoading}>
              <ActivityIndicator size="small" color="#2563EB" />
              <Text style={styles.loadingSub}>更新日曆中...</Text>
            </View>
          ) : (
            <View style={styles.daysGrid}>
              {/* 空白填充前置天數 */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.dayCellEmpty} />
              ))}

              {/* 該月每日 */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const dayBks = dateBookings[ds] || []
                const avail = totalRooms > 0 ? availableCount(ds) : null
                const isFull = avail !== null && avail === 0
                const isToday = ds === todayStr
                const isSel = ds === selectedDate
                const colIdx = (firstDay + i) % 7

                return (
                  <TouchableOpacity
                    key={ds}
                    style={[
                      styles.dayCell,
                      isSel && styles.dayCellSelected,
                      isFull && !isSel && styles.dayCellFull,
                    ]}
                    onPress={() => setSelectedDate(ds)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.dayNumBadge,
                        isToday && styles.dayNumToday,
                        isSel && styles.dayNumSel,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNumText,
                          colIdx === 0 && !isToday && !isSel ? styles.sunText : null,
                          colIdx === 6 && !isToday && !isSel ? styles.satText : null,
                          (isToday || isSel) && styles.dayNumTextActive,
                        ]}
                      >
                        {day}
                      </Text>
                    </View>

                    {/* 空房提示 */}
                    {avail !== null && totalRooms > 0 && (
                      <Text
                        style={[
                          styles.availText,
                          isFull ? styles.availFullText : null,
                          isSel ? styles.availSelText : null,
                        ]}
                        numberOfLines={1}
                      >
                        {isFull ? '滿房' : `空${avail}`}
                      </Text>
                    )}

                    {/* 預訂小圓點 */}
                    {dayBks.length > 0 && (
                      <View style={styles.dotRow}>
                        {dayBks.slice(0, 3).map((bk, bi) => (
                          <View
                            key={`${bk.id}-${bi}`}
                            style={[
                              styles.bkDot,
                              { backgroundColor: PLATFORM_META[bk.platform]?.color || '#64748B' },
                            ]}
                          />
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        </View>

        {/* 當日房況詳情 (Selected Date Detail) */}
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View>
              <Text style={styles.detailDateText}>{selectedDate}</Text>
              <Text style={styles.detailSub}>
                當日房況 · 空房 {availableCount(selectedDate)} 間 / 已售 {selectedBookings.length} 間
              </Text>
            </View>
          </View>

          {/* 1. 空房表 (可直接點「快速訂房」) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="bed-outline" size={16} color="#0284C7" />
              <Text style={styles.sectionTitle}>空房狀況與快速訂房</Text>
            </View>

            {visibleProps.length === 0 ? (
              <Text style={styles.emptyNotice}>尚未設定房型</Text>
            ) : (
              visibleProps.map((p) => {
                const bksThis = selectedBookings.filter((b) => b.property_id === p.id)
                const av = Math.max(0, p.room_count - bksThis.length)
                const isFull = av === 0

                return (
                  <View key={p.id} style={[styles.roomRow, isFull && styles.roomRowFull]}>
                    <View style={styles.roomInfoCol}>
                      <Text style={styles.roomName}>{p.name}</Text>
                      <Text style={styles.roomPrice}>
                        {p.base_price ? `NT$ ${Number(p.base_price).toLocaleString()} / 晚` : '未定價'}
                      </Text>
                    </View>

                    <View style={styles.roomAvailCol}>
                      <Text style={[styles.availBadge, isFull ? styles.availBadgeFull : styles.availBadgeOk]}>
                        {isFull ? '已滿房' : `剩 ${av} 間`}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.addBtn, isFull && styles.addBtnDisabled]}
                      onPress={() => openQuickBooking(p, selectedDate)}
                      disabled={isFull}
                    >
                      <Ionicons name="add" size={14} color="#FFFFFF" />
                      <Text style={styles.addBtnText}>快速訂房</Text>
                    </TouchableOpacity>
                  </View>
                )
              })
            )}
          </View>

          {/* 2. 已售訂單列表 */}
          <View style={[styles.section, styles.sectionTopBorder]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="receipt-outline" size={16} color="#4F46E5" />
              <Text style={styles.sectionTitle}>已售訂單明細 ({selectedBookings.length})</Text>
            </View>

            {selectedBookings.length === 0 ? (
              <Text style={styles.emptyNotice}>當日尚無訂單</Text>
            ) : (
              selectedBookings.map((bk) => {
                const st = STATUS_MAP[bk.status] || { label: bk.status, color: '#64748B', bg: '#F1F5F9' }
                const plat = PLATFORM_META[bk.platform] || { label: bk.platform || '其他', color: '#64748B' }

                return (
                  <TouchableOpacity key={bk.id} style={styles.bookingCard} onPress={() => openEdit(bk)} activeOpacity={0.8}>
                    <View style={styles.bkTopRow}>
                      <View style={styles.guestCol}>
                        <Text style={styles.guestNameText}>{bk.guest_name || '無姓名'}</Text>
                        {bk.guest_phone ? <Text style={styles.guestPhoneText}>{bk.guest_phone}</Text> : null}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                          <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                        </View>
                        <TouchableOpacity onPress={() => openEdit(bk)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="create-outline" size={18} color="#2563EB" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.bkMidRow}>
                      <Text style={styles.bkRoomText}>
                        {bk.properties?.name || '指定房型'}
                        {bk.num_guests > 1 ? ` · ${bk.num_guests}人` : ''}
                        {(bk.extra_beds ?? 0) > 0 ? ` · 加${bk.extra_beds}床` : ''}
                      </Text>
                      <View style={[styles.platBadge, { borderColor: plat.color }]}>
                        <Text style={[styles.platText, { color: plat.color }]}>{plat.label}</Text>
                      </View>
                    </View>

                    <View style={styles.bkBotRow}>
                      <Text style={styles.bkDatesText}>
                        入住: {bk.check_in} ~ 退房: {bk.check_out}
                      </Text>
                      {bk.total_price != null && (
                        <Text style={styles.bkPriceText}>NT$ {Number(bk.total_price).toLocaleString()}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                )
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* 快速訂房 Modal */}
      <Modal visible={quickOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>日曆快速訂房</Text>
                <Text style={styles.modalSub}>
                  入住：{quickForm.check_in} (共 {quickForm.rooms.length} 間房)
                </Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setQuickOpen(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* 已選房型清單 */}
              <Text style={styles.inputLabel}>已選房型與房價</Text>
              {quickForm.rooms.map((r) => {
                const prop = properties.find((p) => p.id === r.property_id)
                const calcNights = (() => {
                  const ci = new Date(quickForm.check_in + 'T00:00:00')
                  const co = new Date(quickForm.check_out + 'T00:00:00')
                  const diff = Math.round((co.getTime() - ci.getTime()) / 86400000)
                  return diff > 0 ? diff : 1
                })()
                const basePrice = prop?.base_price ?? 0
                const extraGuestFee = prop?.extra_guest_fee ?? 0
                const extraBedFee = prop?.extra_bed_fee ?? 0
                const baseGuests = prop?.base_guests ?? 2
                const feeMode = prop?.extra_fee_mode ?? 'by_guest'
                const extraPersonCharge =
                  feeMode === 'by_guest'
                    ? Math.max(0, r.num_guests - baseGuests) * extraGuestFee * calcNights
                    : 0
                const extraBedCharge = (r.extra_beds ?? 0) * extraBedFee * calcNights
                const calcTotal = basePrice * calcNights + extraPersonCharge + extraBedCharge
                const maxExtraBeds = prop?.max_extra_beds ?? 0

                return (
                  <View key={r.property_id} style={styles.roomBox}>
                    <View style={styles.roomBoxHeader}>
                      <Text style={styles.roomBoxName}>{r.property_name}</Text>
                      {quickForm.rooms.length > 1 && (
                        <TouchableOpacity onPress={() => removeRoomLine(r.property_id)}>
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* 輸入群組：人數、加床、房價 */}
                    <View style={styles.roomBoxInputs}>
                      <View style={styles.miniInputGroup}>
                        <Text style={styles.miniLabel}>
                          人數{prop?.max_guests ? `(≤${prop.max_guests})` : ''}
                        </Text>
                        <TextInput
                          style={styles.miniInput}
                          keyboardType="numeric"
                          value={String(r.num_guests)}
                          onChangeText={(v) =>
                            updateRoomLine(r.property_id, {
                              num_guests: Math.min(
                                parseInt(v) || 1,
                                prop?.max_guests ?? 99
                              ),
                            })
                          }
                        />
                      </View>

                      {maxExtraBeds > 0 && (
                        <View style={styles.miniInputGroup}>
                          <Text style={styles.miniLabel}>
                            加床{prop?.extra_bed_type === 'double' ? '(雙人)' : '(單人)'}
                          </Text>
                          <View style={styles.bedCounterRow}>
                            <TouchableOpacity
                              style={styles.bedCounterBtn}
                              onPress={() =>
                                updateRoomLine(r.property_id, {
                                  extra_beds: Math.max(0, (r.extra_beds ?? 0) - 1),
                                })
                              }
                            >
                              <Text style={styles.bedCounterBtnText}>-</Text>
                            </TouchableOpacity>
                            <Text style={styles.bedCountText}>{r.extra_beds ?? 0}</Text>
                            <TouchableOpacity
                              style={styles.bedCounterBtn}
                              onPress={() =>
                                updateRoomLine(r.property_id, {
                                  extra_beds: Math.min(
                                    maxExtraBeds,
                                    (r.extra_beds ?? 0) + 1
                                  ),
                                })
                              }
                            >
                              <Text style={styles.bedCounterBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      <View style={[styles.miniInputGroup, { flex: 1 }]}>
                        <Text style={styles.miniLabel}>房價 (NT$)</Text>
                        <TextInput
                          style={styles.miniInput}
                          keyboardType="numeric"
                          placeholder="金額"
                          value={r.total_price}
                          onChangeText={(v) => updateRoomLine(r.property_id, { total_price: v })}
                        />
                      </View>
                    </View>

                    {/* 試算提示與一鍵套用按鈕 */}
                    {prop && calcTotal > 0 && (
                      <View style={styles.calcHintRow}>
                        <Text style={styles.calcHintText} numberOfLines={1}>
                          底 {basePrice.toLocaleString()}×{calcNights}晚
                          {extraPersonCharge > 0 ? ` + 加人${extraPersonCharge.toLocaleString()}` : ''}
                          {extraBedCharge > 0 ? ` + 加床${extraBedCharge.toLocaleString()}` : ''}
                        </Text>
                        <TouchableOpacity
                          style={styles.calcApplyBtn}
                          onPress={() => updateRoomLine(r.property_id, { total_price: String(calcTotal) })}
                        >
                          <Text style={styles.calcApplyBtnText}>= NT${calcTotal.toLocaleString()} ↑</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )
              })}

              {/* 整單總額平均分配 */}
              {quickForm.rooms.length > 1 && (
                <View style={styles.orderTotalRow}>
                  <TextInput
                    style={styles.orderTotalInput}
                    keyboardType="numeric"
                    placeholder="輸入折扣後整單總額..."
                    value={orderTotal}
                    onChangeText={setOrderTotal}
                  />
                  <TouchableOpacity
                    style={styles.applyBtn}
                    onPress={applyOrderTotal}
                    disabled={!orderTotal}
                  >
                    <Text style={styles.applyBtnText}>均分到各房</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* 加選其他房型按鈕 */}
              {properties.some((p) => !quickForm.rooms.some((r) => r.property_id === p.id)) && (
                <View style={styles.addMoreRoomsRow}>
                  <Text style={styles.miniLabel}>加選其他房型合訂：</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                    {properties
                      .filter((p) => !quickForm.rooms.some((r) => r.property_id === p.id))
                      .map((p) => (
                        <TouchableOpacity
                          key={p.id}
                          style={styles.addMorePill}
                          onPress={() => addRoomLine(p.id)}
                        >
                          <Ionicons name="add" size={12} color="#0284C7" />
                          <Text style={styles.addMorePillText}>{p.name}</Text>
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </View>
              )}

              {/* 旅客基本資料 */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  旅客姓名 <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="例如：王小明"
                  value={quickForm.guest_name}
                  onChangeText={(v) => setQuickForm((f) => ({ ...f, guest_name: v }))}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>聯絡電話</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0912-345-678"
                  keyboardType="phone-pad"
                  value={quickForm.guest_phone}
                  onChangeText={(v) => setQuickForm((f) => ({ ...f, guest_phone: v }))}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>訂單編號 (選填)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="平台單號或內部編號"
                  value={quickForm.platform_booking_id}
                  onChangeText={(v) => setQuickForm((f) => ({ ...f, platform_booking_id: v }))}
                />
              </View>

              {/* 入住與退房日期 */}
              <View style={styles.dateRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>入住日期</Text>
                  <TextInput
                    style={styles.textInput}
                    value={quickForm.check_in}
                    onChangeText={(v) => setQuickForm((f) => ({ ...f, check_in: v }))}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>退房日期</Text>
                  <TextInput
                    style={styles.textInput}
                    value={quickForm.check_out}
                    onChangeText={(v) => setQuickForm((f) => ({ ...f, check_out: v }))}
                  />
                </View>
              </View>

              {/* 來源通路平台 */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>來源通路</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                  {Object.entries(PLATFORM_META).map(([key, meta]) => {
                    const sel = quickForm.platform === key
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.platPill, sel && { backgroundColor: meta.color, borderColor: meta.color }]}
                        onPress={() => setQuickForm((f) => ({ ...f, platform: key }))}
                      >
                        <Text style={[styles.platPillText, sel && { color: '#FFFFFF' }]}>
                          {meta.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setQuickOpen(false)}
                disabled={saving}
              >
                <Text style={styles.cancelBtnText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, saving && styles.confirmBtnDisabled]}
                onPress={saveQuickBooking}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmBtnText}>確認新增訂單</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 編輯訂單 Modal */}
      <Modal visible={editOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>編輯訂單</Text>
                <Text style={styles.modalSub}>{editForm.check_in} ~ {editForm.check_out}</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setEditOpen(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* 旅客姓名 */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>旅客姓名 <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="例如：王小明"
                  value={editForm.guest_name}
                  onChangeText={(v) => setEditForm((f) => ({ ...f, guest_name: v }))}
                />
              </View>

              {/* 聯絡電話 */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>聯絡電話</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0912-345-678"
                  keyboardType="phone-pad"
                  value={editForm.guest_phone}
                  onChangeText={(v) => setEditForm((f) => ({ ...f, guest_phone: v }))}
                />
              </View>

              {/* 入住 / 退房 */}
              <View style={styles.dateRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>入住日期</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editForm.check_in}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, check_in: v }))}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>退房日期</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editForm.check_out}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, check_out: v }))}
                  />
                </View>
              </View>

              {/* 人數 / 加床 / 金額 */}
              <View style={styles.dateRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 6 }]}>
                  <Text style={styles.inputLabel}>人數</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={editForm.num_guests}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, num_guests: v }))}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 6 }]}>
                  <Text style={styles.inputLabel}>加床數</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={editForm.extra_beds}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, extra_beds: v }))}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1.5 }]}>
                  <Text style={styles.inputLabel}>金額 (NT$)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    placeholder="總金額"
                    value={editForm.total_price}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, total_price: v }))}
                  />
                </View>
              </View>

              {/* 來源通路 */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>來源通路</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                  {Object.entries(PLATFORM_META).map(([key, meta]) => {
                    const sel = editForm.platform === key
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.platPill, sel && { backgroundColor: meta.color, borderColor: meta.color }]}
                        onPress={() => setEditForm((f) => ({ ...f, platform: key }))}
                      >
                        <Text style={[styles.platPillText, sel && { color: '#FFFFFF' }]}>{meta.label}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
              </View>

              {/* 狀態 */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>訂單狀態</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                  {Object.entries(STATUS_MAP).map(([key, meta]) => {
                    const sel = editForm.status === key
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[
                          styles.platPill,
                          sel && { backgroundColor: meta.color, borderColor: meta.color },
                        ]}
                        onPress={() => setEditForm((f) => ({ ...f, status: key }))}
                      >
                        <Text style={[styles.platPillText, sel && { color: '#FFFFFF' }]}>{meta.label}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: '#FCA5A5' }]}
                onPress={() => deleteBooking({ id: editForm.id, guest_name: editForm.guest_name } as Booking)}
                disabled={editSaving}
              >
                <Text style={[styles.cancelBtnText, { color: '#DC2626' }]}>刪除訂單</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, editSaving && styles.confirmBtnDisabled]}
                onPress={saveEdit}
                disabled={editSaving}
              >
                {editSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmBtnText}>儲存修改</Text>
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
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingTop: 10,
    paddingBottom: 8,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    position: 'relative',
  },
  navBtn: {
    padding: 8,
    borderRadius: 8,
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginHorizontal: 16,
  },
  todayPill: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  todayPillText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '600',
  },
  propertyScroll: {
    marginTop: 10,
  },
  propertyScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  propPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  propPillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  propDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  propPillText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  propPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  contentScroll: {
    flex: 1,
  },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    margin: 12,
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  weekRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 6,
  },
  weekCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  sunText: {
    color: '#EF4444',
  },
  satText: {
    color: '#2563EB',
  },
  calendarLoading: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  loadingSub: {
    marginTop: 8,
    fontSize: 12,
    color: '#94A3B8',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellEmpty: {
    width: '14.28%',
    height: 52,
  },
  dayCell: {
    width: '14.28%',
    height: 52,
    alignItems: 'center',
    paddingTop: 4,
    borderRadius: 8,
  },
  dayCellSelected: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#2563EB',
  },
  dayCellFull: {
    backgroundColor: '#FEF2F2',
  },
  dayNumBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumToday: {
    backgroundColor: '#2563EB',
  },
  dayNumSel: {
    backgroundColor: '#1E40AF',
  },
  dayNumText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  dayNumTextActive: {
    color: '#FFFFFF',
  },
  availText: {
    fontSize: 9,
    color: '#059669',
    fontWeight: '700',
    marginTop: 1,
  },
  availFullText: {
    color: '#DC2626',
  },
  availSelText: {
    color: '#1E40AF',
  },
  dotRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  bkDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginBottom: 24,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  detailDateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  detailSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  section: {
    paddingTop: 12,
  },
  sectionTopBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  emptyNotice: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 12,
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  roomRowFull: {
    opacity: 0.5,
  },
  roomInfoCol: {
    flex: 1,
  },
  roomName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  roomPrice: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  roomAvailCol: {
    marginRight: 12,
  },
  availBadge: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  availBadgeOk: {
    backgroundColor: '#DCFCE7',
    color: '#15803D',
  },
  availBadgeFull: {
    backgroundColor: '#FEE2E2',
    color: '#B91C1C',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 2,
  },
  addBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  bookingCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bkTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  guestCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guestNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  guestPhoneText: {
    fontSize: 12,
    color: '#64748B',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  bkMidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  bkRoomText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  platBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  platText: {
    fontSize: 10,
    fontWeight: '600',
  },
  bkBotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F6',
    paddingTop: 6,
  },
  bkDatesText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  bkPriceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
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
    maxHeight: '85%',
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
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  modalBody: {
    marginTop: 12,
  },
  roomBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  roomBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomBoxName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  roomBoxInputs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  miniInputGroup: {
    width: 70,
  },
  miniLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  miniInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    color: '#0F172A',
  },
  bedCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    height: 28,
  },
  bedCounterBtn: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bedCounterBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },
  bedCountText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  calcHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
  },
  calcHintText: {
    flex: 1,
    fontSize: 11,
    color: '#64748B',
    marginRight: 6,
  },
  calcApplyBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  calcApplyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  orderTotalRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  orderTotalInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
  },
  applyBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  applyBtnText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '600',
  },
  addMoreRoomsRow: {
    marginBottom: 12,
  },
  addMorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
  },
  addMorePillText: {
    fontSize: 11,
    color: '#0369A1',
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  required: {
    color: '#EF4444',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
  },
  dateRow: {
    flexDirection: 'row',
  },
  platPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 6,
    backgroundColor: '#FFFFFF',
  },
  platPillText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
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
