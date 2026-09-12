import { NextRequest, NextResponse } from 'next/server'
import { getEsimSettings, saveEsimSettings } from '@/lib/esim/db'
import { DEFAULT_PRICING_SETTINGS, EsimPricingSettings } from '@/lib/esim/catalog'

export async function GET() {
  try {
    const settings = await getEsimSettings<EsimPricingSettings>('pricing_settings', DEFAULT_PRICING_SETTINGS)
    return NextResponse.json({
      success: true,
      settings,
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const current = await getEsimSettings<EsimPricingSettings>('pricing_settings', DEFAULT_PRICING_SETTINGS)

    const updated: EsimPricingSettings = {
      hkd_twd_rate: typeof body.hkd_twd_rate === 'number' && body.hkd_twd_rate > 0 ? body.hkd_twd_rate : current.hkd_twd_rate,
      default_markup: typeof body.default_markup === 'number' && body.default_markup >= 1.0 ? body.default_markup : current.default_markup,
      fixed_fee_twd: typeof body.fixed_fee_twd === 'number' && body.fixed_fee_twd >= 0 ? body.fixed_fee_twd : current.fixed_fee_twd,
      round_to_9: typeof body.round_to_9 === 'boolean' ? body.round_to_9 : current.round_to_9,
      min_price_twd: typeof body.min_price_twd === 'number' && body.min_price_twd >= 0 ? body.min_price_twd : current.min_price_twd,
      promo_discount: typeof body.promo_discount === 'number' && body.promo_discount > 0 && body.promo_discount <= 1.0 ? body.promo_discount : current.promo_discount,
      promo_title: typeof body.promo_title === 'string' ? body.promo_title.trim() : current.promo_title,
      promo_active: typeof body.promo_active === 'boolean' ? body.promo_active : current.promo_active,
      country_markups: typeof body.country_markups === 'object' && body.country_markups !== null ? body.country_markups : current.country_markups,
    }

    await saveEsimSettings('pricing_settings', updated, 'eSIM 定價、匯率與促銷設定')

    return NextResponse.json({
      success: true,
      settings: updated,
      message: '定價與促銷設定已成功儲存！',
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
