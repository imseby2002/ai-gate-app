import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  StatusBar,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { apiFetch } from '../../lib/supabase'

interface Conversation {
  platform: string
  from_id: string
  name: string | null
  stage: string
  messageCount: number
  lastMessageAt: string
  takeover: boolean
}

const PLATFORM_META: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  line: { label: 'LINE', color: '#06C755', icon: 'chatbubble' },
  'line-oa': { label: 'LINE', color: '#06C755', icon: 'chatbubble' },
  whatsapp: { label: 'WhatsApp', color: '#25D366', icon: 'logo-whatsapp' },
  'whatsapp-biz': { label: 'WhatsApp', color: '#25D366', icon: 'logo-whatsapp' },
  telegram: { label: 'Telegram', color: '#2AABEE', icon: 'paper-plane' },
  wechat: { label: 'WeChat', color: '#07C160', icon: 'chatbubbles' },
  test: { label: '測試', color: '#8B5CF6', icon: 'flask' },
}

export default function ChatListScreen() {
  const navigation = useNavigation<any>()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiFetch('/api/marketing/cs-thread')
      if (res.ok) {
        const json = await res.json()
        setConversations(json.convos || [])
      }
    } catch (err) {
      console.log('載入對話清單失敗:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
    // 設定每 15 秒自動輪詢（確保在無推播時也能及時看到）
    const timer = setInterval(fetchConversations, 15000)
    return () => clearInterval(timer)
  }, [fetchConversations])

  const onRefresh = () => {
    setRefreshing(true)
    fetchConversations()
  }

  const formatTime = (ts: string) => {
    if (!ts) return ''
    try {
      const d = new Date(ts)
      const now = new Date()
      const isToday = d.toDateString() === now.toDateString()
      if (isToday) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      }
      return `${d.getMonth() + 1}/${d.getDate()}`
    } catch {
      return ''
    }
  }

  const filtered = conversations.filter((c) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      c.from_id.toLowerCase().includes(q) ||
      c.platform.toLowerCase().includes(q)
    )
  })

  const renderItem = ({ item }: { item: Conversation }) => {
    const meta = PLATFORM_META[item.platform] || { label: item.platform, color: '#64748B', icon: 'chatbubble-ellipses' }
    const displayName = item.name?.trim() || (item.from_id.length > 12 ? `${item.platform.toUpperCase()} 用戶` : item.from_id)

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate('ChatDetail', {
            platform: item.platform,
            from_id: item.from_id,
            name: displayName,
            initialTakeover: item.takeover,
          })
        }
      >
        <View style={[styles.avatar, { backgroundColor: `${meta.color}20` }]}>
          <Ionicons name={meta.icon} size={22} color={meta.color} />
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.time}>{formatTime(item.lastMessageAt)}</Text>
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.badgeRow}>
              <View style={[styles.platformBadge, { borderColor: meta.color }]}>
                <Text style={[styles.platformBadgeText, { color: meta.color }]}>{meta.label}</Text>
              </View>

              {item.takeover ? (
                <View style={styles.takeoverBadge}>
                  <Text style={styles.takeoverText}>人工接管中</Text>
                </View>
              ) : (
                <View style={styles.aiBadge}>
                  <Text style={styles.aiText}>AI 託管</Text>
                </View>
              )}
            </View>

            {item.messageCount > 0 && (
              <View style={styles.msgCountBadge}>
                <Text style={styles.msgCountText}>{item.messageCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* 搜尋列 */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#94A3B8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="搜尋客人姓名或 ID..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* 對話清單 */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>載入客人對話中...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => `${item.platform}:${item.from_id}`}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={56} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>目前尚無客戶對話</Text>
              <Text style={styles.emptySub}>當客人在 LINE / 網站傳訊時，會即時顯示於此</Text>
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 12,
    color: '#94A3B8',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  platformBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  platformBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  takeoverBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  takeoverText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '600',
  },
  aiBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  msgCountBadge: {
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  msgCountText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
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
    textAlign: 'center',
  },
})
