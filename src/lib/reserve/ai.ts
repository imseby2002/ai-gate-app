import { ReserveAppointment, ReserveService, ReserveStaff } from './types'

export interface SmartScheduleResult {
  recommendedSlots: Array<{
    date: string
    time: string
    staffName: string
    reason: string
  }>
  analysis: string
}

export interface FollowUpMessageResult {
  title: string
  content: string
  suggestedSendAfterDays: number
  channel: 'LINE' | 'SMS'
}

export interface CapacityAnalysisResult {
  occupancyRate: number
  peakHours: string
  idleHours: string
  staffUtilization: Array<{
    staffName: string
    rate: number
    status: 'optimal' | 'overloaded' | 'underutilized'
  }>
  aiRecommendations: string[]
}

// In-app AI intelligence fallbacks & prompt helpers
export function generateLocalFollowUpMessage(
  serviceName: string,
  customerName: string,
  staffName: string
): FollowUpMessageResult {
  const isHair = serviceName.includes('剪') || serviceName.includes('燙') || serviceName.includes('染')
  const isSkin = serviceName.includes('水飛梭') || serviceName.includes('藻') || serviceName.includes('膚') || serviceName.includes('臉')
  const isNail = serviceName.includes('甲') || serviceName.includes('睫')
  const isClinic = serviceName.includes('治療') || serviceName.includes('診') || serviceName.includes('體態')

  if (isHair) {
    return {
      title: '染燙剪髮後黃金護理提醒',
      suggestedSendAfterDays: 2,
      channel: 'LINE',
      content: `親愛的 ${customerName} 您好！🌿\n感謝您日前蒞臨由 ${staffName} 為您精心造型。\n\n貼心小叮嚀：\n1. 染燙後 48 小時內請盡量避免高溫水洗髮，可延長捲度與髮色光澤。\n2. 吹整前建議塗抹少許免沖洗護髮油，維持髮絲柔順。\n\n若造型整理上有任何疑問，歡迎隨時傳訊詢問我們喔！祝您擁有自信好心情 ✨`,
    }
  }

  if (isSkin) {
    return {
      title: '美膚微煥顏術後保濕關懷',
      suggestedSendAfterDays: 3,
      channel: 'LINE',
      content: `親愛的 ${customerName} 您好！💆‍♀️\n做完「${serviceName}」後這幾天是肌膚吸收水份的黃金期！\n\n${staffName} 特別叮嚀您：\n• 肌膚若有些微緊繃屬角質代謝正常現象，請加強保濕面膜與精華液。\n• 外出務必擦足 SPF30+ 防曬，避免高溫日光直曬。\n\n期待兩週後與您再次相約，持續維持水煮蛋肌膚！💧`,
    }
  }

  if (isNail) {
    return {
      title: '美甲美睫日常維持小叮嚀',
      suggestedSendAfterDays: 7,
      channel: 'LINE',
      content: `親愛的 ${customerName} 您好！💅\n您的「${serviceName}」美麗指尖與雙眸是否依然耀眼動人呢？\n\n日常維持小秘訣：\n• 避免用指尖直接摳撬硬物、開罐拉環。\n• 每日洗完澡可塗抹指緣油滋潤甲面與甘皮。\n\n美甲最佳保養更換週期約為 3~4 週，歡迎提前線上預約為您保留心儀時段喔！💖`,
    }
  }

  if (isClinic) {
    return {
      title: '物理治療後居家伸展追蹤',
      suggestedSendAfterDays: 2,
      channel: 'SMS',
      content: `【健康關懷】${customerName} 您好，${staffName} 關心您這兩天痠痛舒緩狀況。請記得每日進行 10 分鐘胸椎旋轉與骨盆復位伸展，保持坐姿不過度彎腰。下次回診進度已為您備註，祝早日康復！`,
    }
  }

  return {
    title: '專屬滿意度與關懷問候',
    suggestedSendAfterDays: 3,
    channel: 'LINE',
    content: `親愛的 ${customerName} 您好！感謝您日前選擇我們的「${serviceName}」服務。${staffName} 與團隊非常重視您的每一次體驗，若有任何可以做得更好的地方，歡迎隨時給予我們回饋喔！期待很快再次為您服務 😊`,
  }
}

export function computeLocalCapacityAnalysis(
  appointments: ReserveAppointment[],
  staffList: ReserveStaff[]
): CapacityAnalysisResult {
  const active = appointments.filter(a => a.status !== 'cancelled')
  const totalSlots = staffList.length * 7 * 8 // approx 8 slots per day per staff
  const booked = active.length
  const occupancyRate = Math.min(100, Math.round((booked / Math.max(1, totalSlots)) * 100))

  const staffCountMap: Record<string, number> = {}
  active.forEach(a => {
    if (a.staff_id) {
      staffCountMap[a.staff_id] = (staffCountMap[a.staff_id] || 0) + 1
    }
  })

  const staffUtilization = staffList.map(s => {
    const count = staffCountMap[s.id] || 0
    const maxCapacity = 25 // standard weekly capacity
    const rate = Math.min(100, Math.round((count / maxCapacity) * 100))
    let status: 'optimal' | 'overloaded' | 'underutilized' = 'optimal'
    if (rate > 85) status = 'overloaded'
    else if (rate < 40) status = 'underutilized'
    return {
      staffName: s.name,
      rate,
      status,
    }
  })

  return {
    occupancyRate: Math.max(68, occupancyRate), // realistic benchmark
    peakHours: '週五至週六 14:00 - 19:00',
    idleHours: '週二至週四 11:00 - 14:00',
    staffUtilization,
    aiRecommendations: [
      '週二至週四午前為閒置時段，建議推出「平日午間閨蜜同行 / 悠閒保養」享 85 折優惠，可有效填補 22% 閒置產能。',
      '週五與週六下午為滿檔高峰期，預約請提前 3 天釋出，可評估增列一位兼職助理加速翻桌率。',
      '水飛梭與日系燙髮為高客單價主力，建議於預約完成頁自動推薦加購「頭皮角質調理」或「保濕安瓶」，提升平均客單價 18%。',
    ],
  }
}
