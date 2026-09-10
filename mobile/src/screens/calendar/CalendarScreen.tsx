import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiFetch } from '../../lib/supabase'

interface Booking {
  id: string
  guest_name: string
  guest_phone: string | null
  check_in: string
  check_out: string
  status: string
  total_price: number | null
  platform: string | null
  properties?: { name: string } | null
}

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchBookings = useCallback(async (dateStr: string) => {
    try {
      // 抓取該日期的訂單 (包含當天入住、退房或在住)
      const res = await apiFetch(`/api/booking/bookings?from=${dateStr}&to=${dateStr}`)
      if (res.ok) {
        const json = await res.json()
        setBookings(json.bookings || [])
      }
    } catch (err) {
      console.log('載入訂單失敗:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchBookings(selectedDate)
  }, [fetchBookings, selectedDate])

  const shiftDate = (days: number) => {
    const current = new Date(selectedDate)
    current.setDate(current.getDate() + days)
    const nextDate = current.toISOString().split('T')[0]
    setSelectedDate(nextDate)
    setLoading(true)
  }

  const goToday = () => {
    const today = new Date().toISOString().split('T')[0]
    setSelectedDate(today)
    setLoading(true)
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchBookings(selectedDate)
  }

  const renderBooking = ({ item }: { item: Booking }) => {
    const isCheckin = item.check_in === selectedDate
    const isCheckout = item.check_out === selectedDate

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.guestRow}>
            <Ionicons name="person" size={18} color="#0F172A" />
            <Text style={styles.guestName}>{item.guest_name || '無姓名'}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {isCheckin ? '今日入住' : isCheckout ? '今日退房' : '在住中'}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>房型 / 物業：</Text>
          <Text style={styles.infoValue}>{item.properties?.name || '未指定房型'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>入住期間：</Text>
          <Text style={styles.infoValue}>
            {item.check_in} ~ {item.check_out}
          </Text>
        </View>

        {item.total_price != null && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>訂單金額：</Text>
            <Text style={[styles.infoValue, styles.priceText]}>
              NT$ {item.total_price.toLocaleString()}
            </Text>
          </View>
        )}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* 日期切換導覽列 */}
      <View style={styles.dateBar}>
        <TouchableOpacity style={styles.navBtn} onPress={() => shiftDate(-1)}>
          <Ionicons name="chevron-back" size={20} color="#334155" />
          <Text style={styles.navBtnText}>前一天</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.todayBtn} onPress={goToday}>
          <Text style={styles.dateTitle}>{selectedDate}</Text>
          <Text style={styles.todayLabel}>回到今天</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navBtn} onPress={() => shiftDate(1)}>
          <Text style={styles.navBtnText}>後一天</Text>
          <Ionicons name="chevron-forward" size={20} color="#334155" />
        </TouchableOpacity>
      </View>

      {/* 訂單列表 */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>載入當日訂單...</Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={renderBooking}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={56} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>此日期尚無預訂資料</Text>
              <Text style={styles.emptySub}>點選前後日切換查看房態</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
  },
  navBtnText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  todayBtn: {
    alignItems: 'center',
  },
  dateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  todayLabel: {
    fontSize: 11,
    color: '#2563EB',
    marginTop: 2,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
  },
  card: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  guestName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  badge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  infoValue: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '500',
  },
  priceText: {
    color: '#059669',
    fontWeight: '700',
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
})
