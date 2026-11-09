import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentStore } from '@/lib/reserve/current-store'
import { StoreCategory } from '@/lib/reserve/types'

// 各行業預設模板資料庫
export const INDUSTRY_TEMPLATES: Record<string, {
  name: string
  category: StoreCategory
  description: string
  phone: string
  address: string
  notice: string
  services: Array<{
    category_name: string
    name: string
    description: string
    duration_minutes: number
    buffer_minutes: number
    price: number
    sale_price: number | null
  }>
  staff: Array<{
    name: string
    title: string
    bio: string
  }>
}> = {
  clinic: {
    name: '康健全人醫學診所 · 物理治療所',
    category: 'clinic',
    description: '整合家醫看診諮詢、徒手物理治療、運動防護與痛點深層放鬆之預約掛號服務。',
    phone: '02-2345-6789',
    address: '台北市大安區信義路三段 120 號 2 樓',
    notice: '1. 初診請於看診前 10 分鐘報到。\n2. 物理治療項目請穿著輕便運動服飾以利伸展評估。\n3. 如需取消請至少提前 3 小時線上變更或來電告知。',
    services: [
      {
        category_name: '門診評估與諮詢',
        name: '院長特約自費門診諮詢 (30分)',
        description: '全方位慢性病調理、健康檢查報告專業深度解讀與營養健康生活規劃。',
        duration_minutes: 30,
        buffer_minutes: 10,
        price: 1200,
        sale_price: 1000,
      },
      {
        category_name: '物理治療與復健',
        name: '一對一骨骼體態評估與運動物理治療',
        description: '骨盆脊椎對齊評估，徒手深層筋膜放鬆，客製化核心矯正訓練與居家運動處方。',
        duration_minutes: 60,
        buffer_minutes: 10,
        price: 2200,
        sale_price: 1800,
      },
      {
        category_name: '物理治療與復健',
        name: '肩頸膏肓與下背慢性疼痛深層調理',
        description: '針對久坐上班族、低頭族之斜方肌、肩胛提肌深層激痛點放鬆與關節鬆動術。',
        duration_minutes: 45,
        buffer_minutes: 10,
        price: 1600,
        sale_price: null,
      },
    ],
    staff: [
      {
        name: '陳柏翰 醫師',
        title: '院長 / 家庭醫學專科',
        bio: '醫學中心主治經歷，專精預防醫學、健檢分析與慢性疾病生活整合調理。',
      },
      {
        name: '黃柏榮 治療師',
        title: '國家高考合格物理治療師',
        bio: '專注運動傷害防護、脊椎體態矯正、各類術後復健與上班族肩頸疼痛調理。',
      },
    ],
  },
  hair: {
    name: 'AURA 質感美髮沙龍工作室',
    category: 'hair',
    description: '專注日系微剪裁、柔霧質感染髮與結構式頭皮修護，為每位顧客打造專屬空氣感線條。',
    phone: '02-2771-3355',
    address: '台北市大安區敦化南路一段 161 巷 18 號',
    notice: '1. 燙染服務時間約 2~3 小時，請預留充裕時間。\n2. 如需更換造型想法，可於現場與設計師詳細溝通。\n3. 遲到超過 15 分鐘系統將調整服務項目。',
    services: [
      {
        category_name: '剪髮與造型',
        name: '日系訂製剪髮 + 薄荷精油頭皮舒壓',
        description: '修飾臉型輪廓精準剪裁，含精油洗髮與頭肩頸熱敷放鬆。',
        duration_minutes: 60,
        buffer_minutes: 10,
        price: 1500,
        sale_price: 1200,
      },
      {
        category_name: '燙髮與塑型',
        name: '日系溫塑燙髮 / 韓系氣墊燙（含剪護）',
        description: '嚴選日本哥德式燙髮藥水，打造自然蓬鬆輕盈線條，燙後柔順不乾澀。',
        duration_minutes: 150,
        buffer_minutes: 15,
        price: 4500,
        sale_price: 3980,
      },
      {
        category_name: '染髮與護色',
        name: '歐美手刷染 / 霧感調色（含頭皮隔離）',
        description: '客製化柔霧髮色調配，含洋甘菊頭皮防護精華油與染後結構護色。',
        duration_minutes: 120,
        buffer_minutes: 15,
        price: 3600,
        sale_price: 3200,
      },
    ],
    staff: [
      {
        name: 'Leo (張家瑋)',
        title: '特約造型總監',
        bio: '曾任東京表參道沙龍客座設計師，擅長慵懶空氣感修飾剪燙與男士輪廓微調。',
      },
      {
        name: 'Emily (陳思婷)',
        title: '資深色彩與造型設計師',
        bio: '擅長歐美手刷染、韓系自然氣墊燙與女孩顯白調色。',
      },
    ],
  },
  beauty: {
    name: '雅緻美學美膚管理 · 美甲美睫',
    category: 'beauty',
    description: '引進韓式肌膚深層管理、高訂光療美甲與日系極細睫毛嫁接，享受全方位細緻呵護。',
    phone: '02-2788-9900',
    address: '台北市信義區忠孝東路五段 236 巷 12 號',
    notice: '1. 美甲或睫毛卸除請事先於備註勾選告知。\n2. 請於預約時間準時抵達，保留座位 10 分鐘。\n3. 提供茶點與舒壓空間。',
    services: [
      {
        category_name: '肌膚管理',
        name: '水光保濕深層毛孔淨化護理 (75分)',
        description: '無痛粉刺淨化、超微水氣泡深層注水與冰鎮鎮定修護導入。',
        duration_minutes: 75,
        buffer_minutes: 15,
        price: 2500,
        sale_price: 1980,
      },
      {
        category_name: '光療美甲',
        name: '日韓系高訂凝膠光療指甲 (含基礎保養)',
        description: '含甘皮修整、甲型精修與客製化暈染或貓眼造型設計。',
        duration_minutes: 90,
        buffer_minutes: 15,
        price: 1800,
        sale_price: 1500,
      },
      {
        category_name: '美睫稼接',
        name: '日系空氣感單根美睫 (160根)',
        description: '輕盈無重力自然毛，打造天生濃密眼線感。',
        duration_minutes: 60,
        buffer_minutes: 10,
        price: 1600,
        sale_price: 1280,
      },
    ],
    staff: [
      {
        name: 'Ruby (林筱婷)',
        title: '首席皮膚管理師',
        bio: '國家美容乙級證照，專注敏弱肌、粉刺痘痘調理與緊緻拉提。',
      },
      {
        name: 'Vicky (許雅琪)',
        title: '資深美甲美睫藝術師',
        bio: '日本 JNEC 美甲檢定合格，擅長精緻暈染、手繪法式與自然感睫毛。',
      },
    ],
  },
  fitness: {
    name: 'CORE 核心動能私人教練體態工作室',
    category: 'fitness',
    description: '專精一對一科學化重訓、皮拉提斯器械體態矯正與個人化飲食運動課表規劃。',
    phone: '02-2500-1122',
    address: '台北市中山區南京東路三段 89 號 B1',
    notice: '1. 請自備乾淨室內運動鞋與毛巾。\n2. 初次諮詢包含 INBODY 身體組成量測與動作評估。\n3. 課程前 2 小時請避免過量進食。',
    services: [
      {
        category_name: '私人教練課',
        name: '一對一私人教練體態評估與重訓體驗 (60分)',
        description: 'INBODY 體測、活動度評估、核心啟動與基礎重量訓練動作校正。',
        duration_minutes: 60,
        buffer_minutes: 10,
        price: 1800,
        sale_price: 1200,
      },
      {
        category_name: '器械皮拉提斯',
        name: '一對一核心器械床體態雕塑 (Reformer)',
        description: '皮拉提斯核心床訓練，深層核心強化、骨盆平衡與下背放鬆。',
        duration_minutes: 50,
        buffer_minutes: 10,
        price: 2200,
        sale_price: 1800,
      },
    ],
    staff: [
      {
        name: 'Alex (王俊翔)',
        title: 'ACE-CPT 美國運動委員會私人教練',
        bio: '專長力量訓練、運動傷害防護與體脂管理，已指導超過 500 位學員達成體態目標。',
      },
      {
        name: 'Chloe (張語婕)',
        title: '國際皮拉提斯器械合格師資',
        bio: '專精脊椎側彎體態調整、產後骨盆修復與核心線條雕塑。',
      },
    ],
  },
  pet: {
    name: '毛樂園 寵物精緻美學沙龍',
    category: 'pet',
    description: '透明開放式毛孩洗護空間、精緻低敏草本泥浴 SPA 與專業寵物造型修剪。',
    phone: '02-2930-8866',
    address: '台北市文山區興隆路二段 77 號',
    notice: '1. 毛孩須施打過基本預防針，若有心臟病或攻擊傾向請務必提前告知。\n2. 請於預約時間前後準時接送毛孩。\n3. 洗護過程不使用鎮定劑。',
    services: [
      {
        category_name: '基礎洗護',
        name: '中小型犬深層低敏草本洗護 (含清耳剪指甲)',
        description: '天然草本洗毛精、護毛素、修剪腳底毛、擠肛門腺與清耳朵。',
        duration_minutes: 60,
        buffer_minutes: 15,
        price: 800,
        sale_price: 700,
      },
      {
        category_name: '精緻造型大修',
        name: '貴賓/比熊/博美 泰迪萌萌大修造型',
        description: '全身手工手剪造型、立體大頭圓圓臉修剪，洗香香兼具萌度爆表。',
        duration_minutes: 120,
        buffer_minutes: 15,
        price: 1600,
        sale_price: 1400,
      },
    ],
    staff: [
      {
        name: 'Penny (林佩妮)',
        title: 'KCT A級寵物美容師',
        bio: '從事寵物美容 8 年，溫柔有耐心，擅長各犬種日韓系萌系造型修剪。',
      },
    ],
  },
  consulting: {
    name: '宏策聯合法律與商務諮詢事務所',
    category: 'consulting',
    description: '提供公司設立、企業法務合約審查、民刑事法律諮詢與資產傳承規劃。',
    phone: '02-2391-7788',
    address: '台北市中正區重慶南路一段 100 號 8 樓',
    notice: '1. 初次諮詢請先備齊案情相關合約、對話截圖或判決資料以提升效率。\n2. 諮詢過程全程保密，嚴格遵守律師倫理準則。',
    services: [
      {
        category_name: '法律諮詢',
        name: '資深律師民事/商務專案面談諮詢 (50分)',
        description: '由專責律師親自面談，釐清法律爭點、提供訴訟評估與策略分析。',
        duration_minutes: 50,
        buffer_minutes: 10,
        price: 4000,
        sale_price: 3500,
      },
      {
        category_name: '合約與法務',
        name: '新創合夥協議與商業契約審閱諮詢',
        description: '股東協議書、投資意向書（LOI）與商業合約條款風險把關審查。',
        duration_minutes: 60,
        buffer_minutes: 10,
        price: 5000,
        sale_price: null,
      },
    ],
    staff: [
      {
        name: '張文軒 律師',
        title: '合夥律師 / 商務爭端專長',
        bio: '台大法律碩士，專精公司法、智慧財產權與民商事爭端談判處理。',
      },
    ],
  },
  auto: {
    name: '極鋒車體美學 · 石墨烯鍍膜中心',
    category: 'auto',
    description: '專精頂級雙層石墨烯鍍膜、無塵鏡面拋光、全車皮革深層護理與洗車工藝。',
    phone: '02-8792-5566',
    address: '台北市內湖區舊宗路二段 128 號',
    notice: '1. 施作全車鍍膜請預留約 4~6 小時施工時間。\n2. 車內貴重物品請事先取出。\n3. 完工後享有保固期與免費定期回廠漆面檢測。',
    services: [
      {
        category_name: '精緻洗護',
        name: '全車精緻手工泡泡洗車 + 內裝深層吸塵殺菌',
        description: '高壓水槍軟水沖洗、輪圈鐵粉去除、全車磁土去柏油與中控皮革保養。',
        duration_minutes: 60,
        buffer_minutes: 15,
        price: 1200,
        sale_price: 999,
      },
      {
        category_name: '車體鍍膜',
        name: '德系石墨烯硬度車體雙層鍍膜 (三年保固)',
        description: '三道漆面鏡面研磨修復細紋，全車漆面、塑料、輪圈雙層長效防護。',
        duration_minutes: 240,
        buffer_minutes: 30,
        price: 18000,
        sale_price: 15800,
      },
    ],
    staff: [
      {
        name: '阿豪 (陳志豪)',
        title: '首席車體工藝技師',
        bio: '10 年超跑汽車美容鍍膜經驗，對漆面細緻度與車內縫隙清潔有極致要求。',
      },
    ],
  },
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { templateKey, storeSlug } = await req.json()
    const template = INDUSTRY_TEMPLATES[templateKey]
    if (!template) {
      return NextResponse.json({ error: 'Invalid template' }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1. 更新目前操作的門市（沒有門市時建立）；slug 只在新建時設定，避免改掉已分享的預約網址
    const current = await getCurrentStore<{ id: string }>(user.id, req, 'id', admin)
    const storeFields = {
      name: template.name,
      category: template.category,
      description: template.description,
      phone: template.phone,
      address: template.address,
      notice: template.notice,
      slot_interval_minutes: 30,
      advance_booking_days: 30,
      min_booking_hours: 2,
      allow_any_staff: true,
      deposit_required: false,
      deposit_amount: 0,
      currency: 'TWD',
      is_active: true,
      updated_at: new Date().toISOString(),
    }
    const { data: store, error: storeErr } = current
      ? await admin.from('reserve_stores').update(storeFields).eq('id', current.id).eq('user_id', user.id).select().single()
      : await admin.from('reserve_stores').insert({ ...storeFields, user_id: user.id, slug: storeSlug || `${templateKey}-${user.id.slice(0, 5)}` }).select().single()

    if (storeErr || !store) {
      return NextResponse.json({ error: storeErr?.message || 'Failed to create store' }, { status: 500 })
    }

    // 2. 清除該店家舊有服務並插入模板服務
    await admin.from('reserve_services').delete().eq('store_id', store.id)
    const servicesToInsert = template.services.map((s, idx) => ({
      store_id: store.id,
      category_name: s.category_name,
      name: s.name,
      description: s.description,
      duration_minutes: s.duration_minutes,
      buffer_minutes: s.buffer_minutes,
      price: s.price,
      sale_price: s.sale_price,
      sort_order: idx + 1,
      is_active: true,
    }))
    await admin.from('reserve_services').insert(servicesToInsert)

    // 3. 清除該店家舊有人員並插入模板人員
    await admin.from('reserve_staff').delete().eq('store_id', store.id)
    const staffToInsert = template.staff.map((st, idx) => ({
      store_id: store.id,
      name: st.name,
      title: st.title,
      bio: st.bio,
      sort_order: idx + 1,
      is_active: true,
      weekly_schedule: {
        mon: { work: true, start: '10:00', end: '19:00' },
        tue: { work: true, start: '10:00', end: '19:00' },
        wed: { work: true, start: '10:00', end: '19:00' },
        thu: { work: true, start: '10:00', end: '19:00' },
        fri: { work: true, start: '10:00', end: '19:00' },
        sat: { work: true, start: '10:00', end: '18:00' },
        sun: { work: false },
      },
    }))
    await admin.from('reserve_staff').insert(staffToInsert)

    return NextResponse.json({
      success: true,
      store,
      message: `已成功套用「${template.name}」模板！`,
    })
  } catch (err: any) {
    console.error('[template-apply-error]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
