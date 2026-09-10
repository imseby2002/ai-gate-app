import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiFetch, supabase } from '../../lib/supabase'

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
}

export default function DailyScreen() {
  const [currentDate, setCurrentDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [records, setRecords] = useState<DailyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})

  const fetchDaily = useCallback(async (dateStr: string) => {
    try {
      const res = await apiFetch(`/api/booking/daily?date=${dateStr}`)
      if (res.ok) {
        const json = await res.json()
        setRecords(json.records || [])
      }
    } catch (err) {
      console.log('獲取每日入住資料失敗:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchDaily(currentDate)
  }, [fetchDaily, currentDate])

  const shiftDate = (days: number) => {
    const current = new Date(currentDate)
    current.setDate(current.getDate() + days)
    const nextDate = current.toISOString().split('T')[0]
    setCurrentDate(nextDate)
    setLoading(true)
  }

  const goToday = () => {
    const today = new Date().toISOString().split('T')[0]
    setCurrentDate(today)
    setLoading(true)
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchDaily(currentDate)
  }

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const togglePaidStatus = async (item: DailyRecord) => {
    const nextPaid = !item.paid
    try {
      const { error } = await supabase
        .from('bnb_daily_records')
        .update({ paid: nextPaid, updated_at: new Date().toISOString() })
        .eq('id', item.id)

      if (error) {
        Alert.alert('更新失敗', error.message)
      } else {
        setRecords((prev) =>
          prev.map((r) => (r.id === item.id ? { ...r, paid: nextPaid } : r))
        )
      }
    } catch {
      Alert.alert('錯誤', '連線異常，請稍後重試')
    }
  }

  const renderItem = ({ item }: { item: DailyRecord }) => {
    const showPw = visiblePasswords[item.id]
    const balance = (item.price_total ?? 0) - (item.deposit ?? 0)

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.roomTag}>
            <Text style={styles.roomText}>{item.room_name}</Text>
          </View>
          <TouchableOpacity
            style={[styles.paidBtn, item.paid ? styles.paidActive : styles.paidInactive]}
            onPress={() => togglePaidStatus(item)}
          >
            <Ionicons
              name={item.paid ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={item.paid ? '#16A34A' : '#64748B'}
            />
            <Text style={[styles.paidBtnText, { color: item.paid ? '#16A34A' : '#64748B' }]}>
              {item.paid ? '已結清' : '未付清'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>住客姓名：</Text>
          <Text style={styles.valueHighlight}>{item.guest_name || '未填寫'}</Text>
        </View>

        {/* 密碼資訊 */}
        <View style={styles.passwordRow}>
          <View style={styles.passwordCol}>
            <Text style={styles.label}>房間密碼：</Text>
            <Text style={styles.pwText}>
              {showPw ? (item.room_password || '無') : (item.room_password ? '••••••' : '無')}
            </Text>
          </View>
          {item.room_password && (
            <TouchableOpacity onPress={() => togglePasswordVisibility(item.id)}>
              <Ionicons
                name={showPw ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color="#64748B"
              />
            </TouchableOpacity>
          )}
        </View>

        {/* 財務金額 */}
        <View style={styles.financeRow}>
          <View style={styles.financeItem}>
            <Text style={styles.financeLabel}>總金額</Text>
            <Text style={styles.financeVal}>NT$ {(item.price_total ?? 0).toLocaleString()}</Text>
          </View>
          <View style={styles.financeItem}>
            <Text style={styles.financeLabel}>訂金</Text>
            <Text style={styles.financeVal}>NT$ {(item.deposit ?? 0).toLocaleString()}</Text>
          </View>
          <View style={styles.financeItem}>
            <Text style={styles.financeLabel}>尾款</Text>
            <Text style={[styles.financeVal, balance > 0 ? styles.balanceAlert : null]}>
              NT$ {balance.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* 頂部日期切換導航 */}
      <View style={styles.dateBar}>
        <TouchableOpacity style={styles.navBtn} onPress={() => shiftDate(-1)}>
          <Ionicons name="chevron-back" size={20} color="#334155" />
          <Text style={styles.navBtnText}>前一天</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.todayBtn} onPress={goToday}>
          <Text style={styles.dateTitle}>{currentDate}</Text>
          <Text style={styles.todayLabel}>回到今天</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navBtn} onPress={() => shiftDate(1)}>
          <Text style={styles.navBtnText}>後一天</Text>
          <Ionicons name="chevron-forward" size={20} color="#334155" />
        </TouchableOpacity>
      </View>

      {/* 入住清單 */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>載入今日入住資料...</Text>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="bed-outline" size={56} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>此日期無排房入住紀錄</Text>
              <Text style={styles.emptySub}>排房與 Traiwan 同步紀錄將顯示於此</Text>
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
    marginBottom: 10,
  },
  roomTag: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roomText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  paidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  paidActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#DCFCE7',
  },
  paidInactive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  paidBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    color: '#64748B',
  },
  valueHighlight: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    marginVertical: 8,
  },
  passwordCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pwText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
    letterSpacing: 1,
  },
  financeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginTop: 4,
  },
  financeItem: {
    alignItems: 'center',
  },
  financeLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 2,
  },
  financeVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  balanceAlert: {
    color: '#DC2626',
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
