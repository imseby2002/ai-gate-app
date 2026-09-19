import React from 'react'
import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../context/AuthContext'

import ChatListScreen from '../screens/chat/ChatListScreen'
import TicketsScreen from '../screens/tickets/TicketsScreen'
import CalendarScreen from '../screens/calendar/CalendarScreen'
import DailyScreen from '../screens/daily/DailyScreen'
import SettingsScreen from '../screens/settings/SettingsScreen'

const Tab = createBottomTabNavigator()

export default function MainTabs() {
  const { hasBookingAccess } = useAuth()
  const insets = useSafeAreaInsets()

  const bottomPadding = insets.bottom > 0 ? insets.bottom : 8
  const tabHeight = 58 + insets.bottom

  return (
    <Tab.Navigator
      screenOptions={({ navigation }) => ({
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          height: tabHeight,
          paddingBottom: bottomPadding,
          paddingTop: 6,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: '#FFFFFF',
          elevation: 1,
          shadowOpacity: 0.05,
        },
        headerTitleStyle: {
          fontSize: 17,
          fontWeight: '700',
          color: '#0F172A',
        },
        headerRight: () => (
          <TouchableOpacity
            onPress={() => navigation.navigate('Feedback')}
            style={styles.headerFeedbackBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chatbox-ellipses-outline" size={16} color="#2563EB" />
            <Text style={styles.headerFeedbackText}>意見提供</Text>
          </TouchableOpacity>
        ),
      })}
    >
      {/* 1. 客服對話收件夾 (首頁) */}
      <Tab.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{
          title: '客服對話',
          tabBarLabel: '對話',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
        }}
      />

      {/* 2. 工單系統 */}
      <Tab.Screen
        name="Tickets"
        component={TicketsScreen}
        options={{
          title: '工單交辦',
          tabBarLabel: '工單',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="clipboard" size={size} color={color} />
          ),
        }}
      />

      {/* 3. 日曆訂房 (依權限動態呈現) */}
      {hasBookingAccess && (
        <Tab.Screen
          name="Calendar"
          component={CalendarScreen}
          options={{
            title: '日曆訂房',
            tabBarLabel: '日曆',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar" size={size} color={color} />
            ),
          }}
        />
      )}

      {/* 4. 每日入住看板 (依權限動態呈現) */}
      {hasBookingAccess && (
        <Tab.Screen
          name="Daily"
          component={DailyScreen}
          options={{
            title: '每日入住',
            tabBarLabel: '入住',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bed" size={size} color={color} />
            ),
          }}
        />
      )}

      {/* 5. 個人設定與反饋入口 */}
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: '個人設定',
          tabBarLabel: '設定',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  )
}

const styles = StyleSheet.create({
  headerFeedbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    gap: 4,
  },
  headerFeedbackText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
})
