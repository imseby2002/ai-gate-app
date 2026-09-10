import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../../context/AuthContext'
import { CONFIG } from '../../lib/config'
import { apiFetch } from '../../lib/supabase'
import { registerForPushNotificationsAsync } from '../../lib/notifications'

export default function SettingsScreen() {
  const navigation = useNavigation<any>()
  const { user, profile, hasBookingAccess, signOut, refreshProfile } = useAuth()

  const handleSignOut = () => {
    Alert.alert('確認登出', '您確定要登出 AI GATE 嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '登出',
        style: 'destructive',
        onPress: () => signOut(),
      },
    ])
  }

  const handleRefresh = async () => {
    await refreshProfile()
    Alert.alert('更新成功', '使用者權限與帳號資料已同步！')
  }

  const handleTestPush = async () => {
    try {
      const token = await registerForPushNotificationsAsync()
      if (!token) {
        Alert.alert('提示', '未能取得推播 Token。若在模擬器中請改用實體手機，或請確認手機設定中已允許推播通知。')
        return
      }
      const res = await apiFetch('/api/mobile/push-token', {
        method: 'POST',
        body: JSON.stringify({
          push_token: token,
          test: true,
        }),
      })
      if (res.ok) {
        Alert.alert('已發送測試推播！', '系統已對您的手機發出測試訊息，請留意上方橫幅與提示音。')
      } else {
        Alert.alert('發送失敗', '請確認網路連線')
      }
    } catch (e: any) {
      Alert.alert('錯誤', e?.message || '測試失敗')
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 個人帳號卡片 */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={32} color="#2563EB" />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.userEmail}>{user?.email || '已登入使用者'}</Text>
          <View style={styles.roleRow}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>
                {profile?.user_type === 'admin' ? '系統管理員' : '工作同仁'}
              </Text>
            </View>
            <View style={[styles.moduleBadge, hasBookingAccess ? styles.badgeFull : styles.badgeCS]}>
              <Text style={[styles.moduleText, hasBookingAccess ? styles.textFull : styles.textCS]}>
                {hasBookingAccess ? '全功能 (客服+訂房)' : '純客服模式'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 設定與工具選單 */}
      <View style={styles.menuSection}>
        <Text style={styles.sectionHeader}>系統功能</Text>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('Feedback')}
        >
          <View style={[styles.iconWrapper, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="chatbox-ellipses" size={20} color="#D97706" />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>問題回饋與建議</Text>
            <Text style={styles.menuSub}>直通總管理端後台（/admin/feedback）</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleRefresh}>
          <View style={[styles.iconWrapper, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="sync" size={20} color="#2563EB" />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>同步帳號與權限</Text>
            <Text style={styles.menuSub}>重新抓取最新的角色與模組設定</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleTestPush}>
          <View style={[styles.iconWrapper, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="notifications" size={20} color="#16A34A" />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>測試手機推播通知</Text>
            <Text style={styles.menuSub}>發送一則推播至本機以驗證響鈴與橫幅</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* 關於資訊 */}
      <View style={styles.menuSection}>
        <Text style={styles.sectionHeader}>關於</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>APP 名稱</Text>
          <Text style={styles.infoValue}>AI GATE 行動端</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>當前版本</Text>
          <Text style={styles.infoValue}>v{CONFIG.APP_VERSION}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>後端連線</Text>
          <Text style={styles.infoValue}>Supabase 雲端實例</Text>
        </View>
      </View>

      {/* 登出按鈕 */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color="#DC2626" />
        <Text style={styles.logoutText}>登出帳號</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  profileInfo: {
    flex: 1,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 6,
  },
  roleBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  moduleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeFull: {
    backgroundColor: '#ECFDF5',
  },
  badgeCS: {
    backgroundColor: '#EFF6FF',
  },
  moduleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  textFull: {
    color: '#059669',
  },
  textCS: {
    color: '#2563EB',
  },
  menuSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  menuSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  infoValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    height: 50,
    marginTop: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  logoutText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '600',
  },
})
