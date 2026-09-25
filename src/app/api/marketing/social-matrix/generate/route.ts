import { NextRequest, NextResponse } from 'next/server'
import { requireSocialMatrix } from '@/lib/social-matrix/access'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { TargetGroup, MatrixCopy, SocialPlatform } from '@/lib/social-matrix/types'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const guard = await requireSocialMatrix(req)
  if (guard.res) return guard.res
  const authUser = guard.user

  try {
    const body = await req.json()
    const {
      industry = '越南包車旅遊與在地商務代辦',
      core_product = '中越峴港/會安/巴拿山專車接送、中文雙語司機、機場快速通關',
      target_audience = '台灣家庭出遊、自由行背包客、商務考察團',
      offer = '預約享早鳥 9 折，免費贈送越南 5G 網卡與在地私房美食地圖',
      cta_link = 'LINE 官方諮詢：@danang_pro 或 官網預約',
      platforms = ['facebook', 'instagram', 'threads', 'tiktok', 'dcard'],
    } = body

    // Try AI generation first if GOOGLE_AI_API_KEY is present
    if (process.env.GOOGLE_AI_API_KEY) {
      try {
        const google = createGoogleGenerativeAI({
          apiKey: process.env.GOOGLE_AI_API_KEY,
        })

        const systemPrompt = `你是一位精通全球社群矩陣行銷 (Social Media Matrix) 與防風控封號 (Anti-ban Evasion) 的頂級行銷專家。
使用者會提供其推廣產業、核心產品、受眾與優惠誘因。

請執行兩大核心任務：
任務一：【AI 社團與看板雷達 (Target Groups Radar)】
探勘 6 個最精準、高流量的社群受眾聚集地（涵蓋 Facebook 公開社團、Dcard 看板、Threads 話題圈、Instagram 熱門標籤），並標註成員量、版規審查嚴格度 (low / medium / high) 與建議切入策略。

任務二：【防封防重矩陣文案庫 (Anti-Collision Copy Matrix)】
生成 5 組「核心意思相同，但語句結構、行文視角、段落組織徹底變異」的矩陣文案，避免任何平台比對重複 Hash 封號。
文案切入角度需包含：
1. 痛點引導型（避坑/避雷視角）
2. 真實旅客心得（第一人稱口碑視角）
3. 在地專家真心話（專業視角）
4. 懶人包乾貨（實用攻略視角）
5. 限時福利（優惠急迫感視角）

請嚴格輸出 JSON 格式，不得包含任何 Markdown 代碼塊（\`\`\`json 等標記），直接輸出合法 JSON 物件：
{
  "target_groups": [
    {
      "id": "tg-1",
      "name": "社團或看板名稱",
      "platform": "facebook"|"dcard"|"threads"|"instagram",
      "category": "分類類別",
      "members_count": "例如 15.8萬 成員",
      "strictness": "low"|"medium"|"high",
      "url": "https://...",
      "recommended_strategy": "建議切入手法"
    }
  ],
  "copies": [
    {
      "id": "cp-1",
      "angle": "切入角度名稱",
      "title": "文案標題",
      "content": "文案完整內文（排版優美、自帶 emoji、換行清晰）",
      "hashtags": ["#標籤1", "#標籤2"],
      "call_to_action": "行動呼籲",
      "anti_collision_hash": "8位隨機變異碼例如 7f8a9b2c"
    }
  ]
}`

        const userPrompt = `【廣告產業與標的】
產業類別：${industry}
核心產品與賣點：${core_product}
目標客群：${target_audience}
促銷誘因/福利：${offer}
行動呼籲與導流目標：${cta_link}
目標社群平台：${(platforms as string[]).join(', ')}

請依上述資料產出社團雷達與 5 組防封矩陣文案 JSON。`

        const { text } = await generateText({
          model: google('gemini-2.5-flash'),
          system: systemPrompt,
          prompt: userPrompt,
          maxOutputTokens: 3000,
        })

        // Clean any code block backticks if present
        const cleaned = text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '').trim()
        const parsed = JSON.parse(cleaned)

        if (parsed.target_groups && parsed.copies) {
          return NextResponse.json({
            success: true,
            source: 'gemini',
            target_groups: parsed.target_groups,
            copies: parsed.copies,
          })
        }
      } catch (aiErr) {
        console.warn('[social-matrix generate] AI call failed, falling back to smart dynamic generator:', aiErr)
      }
    }

    // Dynamic High-Quality Fallback Generator
    const dynamicGroups: TargetGroup[] = [
      {
        id: 'tg-fb-1',
        name: `${industry.slice(0, 8)}愛好者 & 自由行情報站`,
        platform: 'facebook',
        category: '旅遊生活交流社團',
        members_count: '18.6萬 成員',
        strictness: 'low',
        url: 'https://www.facebook.com/groups/travel_tw',
        recommended_strategy: '軟文分享心得切入，文末留言附上優惠代碼，防管理員秒刪',
      },
      {
        id: 'tg-fb-2',
        name: `台灣人在海外 / 海外生活互助情報圈`,
        platform: 'facebook',
        category: '海外在地台商交流',
        members_count: '9.2萬 成員',
        strictness: 'medium',
        url: 'https://www.facebook.com/groups/overseas_tw',
        recommended_strategy: '主打在地中文溝通與透明定價，強調安全可靠與企業發票報帳',
      },
      {
        id: 'tg-dcard-1',
        name: 'Dcard 旅遊板 / 國外自由行討論專區',
        platform: 'dcard',
        category: '年輕學生與年輕白領聚集地',
        members_count: '42萬 追蹤者',
        strictness: 'high',
        url: 'https://www.dcard.tw/f/travel',
        recommended_strategy: '避開直接打廣告，以「防踩雷清單 + 司機報價實測比對」獲取高按讚並在留言區被動導流',
      },
      {
        id: 'tg-threads-1',
        name: `Threads 脆友【#${industry.split(' ')[0] || '行銷'}】話題串`,
        platform: 'threads',
        category: '短文即時互動圈',
        members_count: '每日 50萬+ 活躍互動',
        strictness: 'low',
        url: 'https://www.threads.net',
        recommended_strategy: '以朋友閒聊碎碎念語氣發文，拋出疑問引發討論留言，再於第一條留言放私訊鉤子',
      },
      {
        id: 'tg-ig-1',
        name: `Instagram 精選熱門打卡標籤矩陣`,
        platform: 'instagram',
        category: '視覺圖文打卡流量池',
        members_count: '單一標籤 100萬+ 貼文',
        strictness: 'low',
        url: 'https://www.instagram.com',
        recommended_strategy: '多圖輪播 (Carousel) 前3頁放實景美照，第4頁放詳細價格與服務對比，引導小盒子私訊',
      }
    ]

    const dynamicCopies: MatrixCopy[] = [
      {
        id: 'cp-01',
        angle: '痛點引爆型（避坑踩雷視角）',
        title: `去過才敢說的真心話！很多人不知道的【${core_product.slice(0, 14)}】挑選陷阱⚠️`,
        content: `準備出發體驗【${industry}】的朋友千萬先看完這篇，省下至少三千塊冤枉錢！❌\n\n很多人一開始只看便宜定價，結果現場加價、語言不通、司機找不到人...真的很崩潰。\n\n我們團隊實測總結了三點避坑重點：\n1️⃣ 務必確認全程一口價（包含過路費、超時費）\n2️⃣ 中文即時客服支援，突發狀況不用雞同鴨講\n3️⃣ 選擇有在地實體營業執照的正規服務\n\n這次我們找到的【${core_product}】完全解決以上痛點。\n現在私訊預約還有早鳥優惠：${offer}！\n\n有需要的朋友可以直接點下方看完整方案👇`,
        hashtags: ['#旅遊避坑', '#自由行攻略', '#在地推薦', '#超值優惠', '#防踩雷'],
        call_to_action: cta_link,
        anti_collision_hash: `hk_${Math.random().toString(36).substring(2, 9)}`,
      },
      {
        id: 'cp-02',
        angle: '真實旅客口碑（第一人稱體驗視角）',
        title: `這趟旅行最正確的決定！終於不用走到腳斷掉了～✨`,
        content: `上週剛結束這趟行程，回來第一件事就是想分享給大家！❤️\n\n以前總覺得自己搭車或轉乘很省，結果帶著長輩跟行李，換車換到懷疑人生...\n這次狠下心訂了【${core_product}】，體驗直接升級到五星級！司機大哥超級準時，車內乾淨有冷氣，還會主動介紹隱藏版私房景點。\n\n特別是【${target_audience}】，強烈建議把預算花在這裡，省下的時間跟體力多拍幾張美照完全值得！\n\n🎁 限時福利：${offer}\n需要的趕緊收藏，下次出發直接用：${cta_link}`,
        hashtags: ['#旅行日常', '#行程推薦', '#真實心得', '#渡假首選', '#包車日記'],
        call_to_action: cta_link,
        anti_collision_hash: `rv_${Math.random().toString(36).substring(2, 9)}`,
      },
      {
        id: 'cp-03',
        angle: '在地老司機私房（行家專業視角）',
        title: `在地人才知道的秘境玩法！內行人都是這樣安排的 🗺️`,
        content: `在【${industry}】深耕多年，看過太多遊客被觀光客行程耽誤時間。\n\n其實真正懂玩的，都是這樣規劃：\n📍 清晨避開人潮直達核心景點\n📍 中午在冷氣車上舒適補眠休息\n📍 下午走在地人私房路線，夕陽時間正好抵達絕美打卡點\n\n我們的【${core_product}】就是專為想深度放鬆的旅客量身打造。\n有中文在地團隊協助，完全不需煩惱交通和行程安排！\n\n💡 目前限定釋出福利：${offer}\n歡迎直接諮詢預約：${cta_link}`,
        hashtags: ['#行家私房', '#秘境探索', '#深度旅遊', '#在地指南', '#專屬行程'],
        call_to_action: cta_link,
        anti_collision_hash: `ex_${Math.random().toString(36).substring(2, 9)}`,
      },
      {
        id: 'cp-04',
        angle: '保姆級實用清單（懶人包乾貨視角）',
        title: `【2026 最新整理】一分鐘看懂【${industry}】怎麼選最划算 📌`,
        content: `存起來！準備安排【${industry}】的懶人必備比對表 📋\n\n普通交通 vs 專業包車體驗對比：\n⏱️ 等車耗時：大眾轉乘 1.5hr ❌ vs 專車直達 35min ✅\n🧳 行李搬運：拖著大箱滿街跑 ❌ vs 車尾箱隨放隨走 ✅\n🗣️ 溝通障礙：比手畫腳心好累 ❌ vs 中文即時線上秘書協助 ✅\n\n核心服務包含：${core_product}\n現在預約立刻享：${offer}\n\n👉 預訂傳送門：${cta_link}`,
        hashtags: ['#懶人包', '#出國必看', '#比價攻略', '#省心省力', '#行程規劃'],
        call_to_action: cta_link,
        anti_collision_hash: `ch_${Math.random().toString(36).substring(2, 9)}`,
      },
      {
        id: 'cp-05',
        angle: '限時福利號召（早鳥急迫感視角）',
        title: `⚠️ 限時名額釋出！本月預訂【${core_product.slice(0, 12)}】專屬回饋來了 ⚡`,
        content: `好消息！感謝大家一直以來的支持～🎉\n為了回饋新老朋友，我們正式推出本季度最殺早鳥企劃！\n\n只要在近期出行：\n🔥 ${offer}\n\n專屬服務重點：\n✔️ ${core_product}\n✔️ 專為【${target_audience}】貼心定制\n✔️ 保證出車，不滿意無條件退換方案\n\n名額有限，先搶先贏，立即了解詳情：\n🔗 ${cta_link}`,
        hashtags: ['#限時優惠', '#早鳥特惠', '#超值折扣', '#手慢無', '#專屬好康'],
        call_to_action: cta_link,
        anti_collision_hash: `fl_${Math.random().toString(36).substring(2, 9)}`,
      }
    ]

    return NextResponse.json({
      success: true,
      source: 'dynamic_template',
      target_groups: dynamicGroups,
      copies: dynamicCopies,
    })
  } catch (err) {
    return NextResponse.json({ error: `文案矩陣生成失敗: ${String(err)}` }, { status: 500 })
  }
}
