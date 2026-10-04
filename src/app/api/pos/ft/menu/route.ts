import { NextResponse, after } from 'next/server'
import { FtError, deviceKeyFrom, fetchTranslatedMenu, resolveDevice } from '@/lib/ft-kiosk/server'
import { translateMissing } from '@/lib/ft-kiosk/translate'

export const maxDuration = 300

/** 點單機（會員 APP 串接）取菜單；缺的中英文翻譯在回應後背景補齊 */
export async function GET(req: Request) {
  const device = resolveDevice(deviceKeyFrom(req))
  if (!device) return NextResponse.json({ error: 'INVALID_DEVICE' }, { status: 403 })
  try {
    const { menu, missing } = await fetchTranslatedMenu(device)
    if (missing.length > 0) after(() => translateMissing(missing))
    return NextResponse.json(menu)
  } catch (err) {
    const e = err instanceof FtError ? err : new FtError('UNKNOWN')
    return NextResponse.json({ error: e.code }, { status: e.status })
  }
}
