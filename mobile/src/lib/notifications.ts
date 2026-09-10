import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { supabase } from './supabase'

// 設定前台收到推播時的預設行為（彈出橫幅、發出聲音）
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

/**
 * 向手機請求推播權限並取得 Expo Push Token
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
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
      await fetch(`${(await import('./config')).CONFIG.API_BASE_URL}/api/mobile/push-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
        },
        body: JSON.stringify({
          push_token: token,
          device_os: Platform.OS,
          device_name: Device.modelName || Device.deviceName,
        }),
      }).catch((e) => console.log('註冊 Push Token 到後端略過:', e))
    } catch (error) {
      console.log('取得 Push Token 失敗 (若在模擬器中屬正常現象):', error)
    }
  } else {
    console.log('請在實體手機上測試推播通知')
  }

  return token
}
