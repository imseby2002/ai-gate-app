import { Platform } from 'react-native'
import * as Device from 'expo-device'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import { supabase } from './supabase'

// 判斷是否處於 Expo Go Client 環境
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  Constants.appOwnership === 'expo'

/**
 * 安全註冊前台通知處理器
 * 官方自 SDK 53 起在 Android Expo Go 移除了遠端推播原生模組，
 * 若在 Android Expo Go 頂層呼叫會直接引發原生崩潰 (runtime not ready)。
 */
export function initNotificationHandler() {
  if (Platform.OS === 'android' && isExpoGo) {
    // Expo Go on Android 不支援遠端推播，略過以防崩潰
    return
  }

  try {
    const Notifications = require('expo-notifications')
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      }),
    })
  } catch (err) {
    console.log('通知 Handler 初始化略過:', err)
  }
}

// 嘗試在安全時機初始化
try {
  initNotificationHandler()
} catch {
  // 忽略
}

/**
 * 向手機請求推播權限並取得 Expo Push Token
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // 1. Android Expo Go 官方不支援遠端推播（需在 APK / 正式打包中運行）
  if (Platform.OS === 'android' && isExpoGo) {
    console.log('[Expo Go] Android Expo Go 官方已停用遠端推播，打包 APK 時會自動完整啟用。')
    return null
  }

  try {
    const Notifications = require('expo-notifications')
    let token: string | null = null

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3B82F6',
      })
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync()
      let finalStatus = existingStatus
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }
      if (finalStatus !== 'granted') {
        console.log('推播權限未被允許')
        return null
      }

      try {
        const pushTokenData = await Notifications.getExpoPushTokenAsync()
        token = pushTokenData.data
        console.log('取得 Expo Push Token:', token)

        // 呼叫後端 API 註冊 Token
        const { CONFIG } = await import('./config')
        const sessionRes = await supabase.auth.getSession()
        await fetch(`${CONFIG.API_BASE_URL}/api/mobile/push-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionRes.data.session?.access_token || ''}`,
          },
          body: JSON.stringify({
            push_token: token,
            device_os: Platform.OS,
            device_name: Device.modelName || Device.deviceName,
          }),
        }).catch((e) => console.log('註冊 Push Token 到後端略過:', e))
      } catch (tokenErr) {
        console.log('取得 Push Token 失敗 (若無 projectId 屬正常現象):', tokenErr)
      }
    } else {
      console.log('請在實體手機上測試推播通知')
    }

    return token
  } catch (outerErr) {
    console.log('registerForPushNotificationsAsync 異常略過:', outerErr)
    return null
  }
}
