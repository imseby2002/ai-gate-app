import { NextResponse } from 'next/server'
import { INITIAL_PLATFORM_OVERVIEW } from '@/lib/audit/platform-core'

export async function GET() {
  return NextResponse.json({
    success: true,
    overview: INITIAL_PLATFORM_OVERVIEW,
    jetson_integration: {
      status: 'standby',
      active_edge_devices: 1,
      target_store: '胡志明一號旗艦店 (HCM-01)',
      device_model: 'NVIDIA Jetson Orin Nano / Xavier NX',
      sensors: ['Counter Overhead Camera (30fps)', 'Kitchen Station 4K Wide-angle', 'Refrigerator Temp Sensor'],
      edge_capabilities: [
        '現場工作站擺放與動線即時偵測',
        '夥伴進店 3-5 秒迎賓行為辨識',
        '珍珠/茶湯過期報廢動作追蹤',
        '出杯等待時間與排隊長度統計',
      ],
      privacy_policy: '邊緣端本機影像流僅保留特徵向量與事件日誌，不傳輸儲存員工未去識別化臉部原始錄影。',
    },
  })
}
