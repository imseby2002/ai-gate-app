'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface Section {
  id: string
  title: string
  summary: string
  steps?: string[]
  faq?: { q: string; a: string }[]
}

const SECTIONS: Section[] = [
  {
    id: 'channels',
    title: '① 頻道綁定（LINE / WhatsApp / Telegram / Zalo）',
    summary: '讓客人在 LINE、WhatsApp 等平台傳訊息給你時，AI 客服能自動收到並回覆。這是最優先要做的設定，沒綁定頻道，AI 客服就收不到客人的訊息。',
    steps: [
      'LINE OA：登入 LINE Developers Console → 建立 Messaging API 頻道 → 在「頻道綁定」頁貼上 Channel Access Token 與 Channel Secret → 把系統顯示的 Webhook URL 貼回 LINE 後台，並開啟「Use webhook」、關閉「自動回應訊息」',
      'WhatsApp Business：到 Meta for Developers 建立 WhatsApp 產品 → 填入 Phone Number ID、Access Token → 自訂一組 Verify Token（自己設一串英數字，前後台要一致）→ 把 Webhook URL 和 Verify Token 貼到 Meta 後台',
      'Telegram：跟 @BotFather 對話建立 Bot，取得 Token 貼上即可，系統會自動註冊 Webhook，不用手動設定',
      'Zalo OA：到 Zalo for Business 後台取得 OA Access Token 貼上，並把 Webhook URL 貼到 Zalo 後台',
      '不確定怎麼操作可以直接按「不會設定？找人幫我設定」，留聯絡方式讓我們幫你處理',
    ],
    faq: [
      { q: '綁定後客人傳訊息我卻沒收到？', a: '先確認該平台後台「Webhook」有沒有顯示綁定成功／驗證通過，再檢查是否有關閉自動回應訊息（LINE 需手動關閉，否則會跟 AI 打架）。' },
      { q: '一定要自己填 Token 嗎？', a: '不用，這步驟對第一次用電腦的人偏難，建議直接用「找人幫我設定」讓我們代操作。' },
    ],
  },
  {
    id: 'platforms',
    title: '② 客服系統內的平台狀態',
    summary: '這裡跟「頻道綁定」是同一份資料，差別只是換一個地方看。可以看到每個平台目前是「已連線」還是「未設定」，也能對 Telegram 做連線診斷、送測試訊息確認有沒有接通。',
    steps: [
      '進「平台」分頁，看每個平台卡片右上角是「已連線」還是「未設定」',
      'Telegram 專屬：按「查看錯誤狀態」可以看 Webhook 是否正常、Bot Token 是否有效；按「送出」可以傳一則測試訊息到指定 Chat ID，確認機器人真的能回話',
      '如果狀態一直卡在「未設定」，回到①「頻道綁定」重新檢查 Token 有沒有存對',
    ],
  },
  {
    id: 'ai-settings',
    title: '③ AI 設定（系統提示詞 / 報價流程 / VIP / 優惠）',
    summary: '這裡決定 AI 客服「怎麼講話」跟「遇到什麼狀況要怎麼做」，是整個客服系統最核心的設定，但也最容易搞混——記住一個原則：「AI 的個性」放這裡，「具體資料」放「知識庫」分頁。',
    steps: [
      '先按「套用模板」快速套用你這個行業（民宿/電商/餐飲…）的預設講法，不用從零開始寫',
      '系統提示詞：定義 AI 的角色與語氣，例如「你是一間民宿的客服，請親切有禮」——這裡不要貼 FAQ 或價格，那些是「知識庫」的工作',
      'AI 路由：低/中風險問題交給 Gemini（快、便宜），退換貨/投訴/法律問題自動升級給 Claude（更謹慎），一般不用改，除非你想讓更多問題也升級',
      '報價流程：開啟後，AI 會依客人說的話自動判斷是不是要問價，逐步收集入住/購買資訊，最後套用「報價計算機」算出正確金額',
      '優惠與贈品：填入客人猶豫或嫌貴時，AI 可以主動提的折扣或贈品，AI 每次只講一項，不會整包倒出來',
      'VIP 關鍵字：填入常客的名字、LINE 暱稱或手機後 4 碼，符合的話對話會自動標示「VIP 優先處理」',
    ],
    faq: [
      { q: 'AI 亂回答價格怎麼辦？', a: '價格不要寫在「系統提示詞」，要設定在「報價計算機」分頁，AI 才會照系統算出的數字回答，不會自己亂猜。' },
    ],
  },
  {
    id: 'dialogue-files',
    title: '④ 知識庫（FAQ / 產品資訊）',
    summary: '放你會被問到的常見問題和答案、房型/商品介紹、規定條款等「具體資訊」。AI 客服會優先從這裡找答案，找不到才會用③的系統提示詞去發揮。',
    steps: [
      '直接在文字框貼上你的 FAQ，格式例如「Q：幾點可以入住？A：下午 3 點後」',
      '也可以在「測試」分頁跟 AI 對話後，把客服回答的內容一鍵「加入知識庫」，之後遇到類似問題就會直接引用',
      '內容愈完整，AI 答錯的機率愈低，建議把「客人最常問的 10 個問題」都先寫進來',
    ],
  },
  {
    id: 'data-sources',
    title: '⑤ 資料來源（Google Sheets 串接）',
    summary: '如果你已經有 Google Sheets 在記錄訂單、密碼、庫存等資料，可以直接串接，讓 AI 客服即時查表回答，不用每次都手動複製貼上到知識庫。',
    steps: [
      '把 Google Sheets 權限改成「知道連結的人可以查看」',
      '按「新增」，貼上表單網址，填「查詢欄位」（例如訂單編號欄位名稱）與「回傳欄位」（要回覆客人的欄位，例如房號、密碼）',
      '設定「觸發關鍵字」，客人訊息中出現這些字才會去查表，例如「訂單、密碼、房號」',
      '常見用法：訂單密碼表（查房號/門鎖密碼）、訂單查詢表（查物流/到貨狀態）',
    ],
    faq: [
      { q: '為什麼查不到資料？', a: '最常見原因是 Google Sheets 權限沒開「知道連結的人可以查看」，或「查詢欄位」名稱跟表格標題列打的字不完全一樣（含空格都要一致）。' },
    ],
  },
  {
    id: 'pricing',
    title: '⑥ 報價計算機',
    summary: '把你的價目表（房型、票種、平假日價、套餐、團體折扣）設定好之後，AI 回覆價格時會精確套用這裡的數字去計算，不會用猜的，也不會算錯錢。',
    steps: [
      '按上方「+ 訂房」或「+ 行程」新增一個品項',
      '填入平日價、假日價（系統預設週五六日算假日，其餘算平日），也可以另外標記國定連假',
      '有團體或多晚優惠的話，填「團體折扣」規則',
      '設定完成後到「測試」分頁輸入「這週末兩位大人，OO房型多少錢」實際驗證算出來的金額對不對',
    ],
  },
  {
    id: 'test',
    title: '⑦ 測試對話',
    summary: '正式上線前，先在這裡假裝自己是客人跟 AI 對話，確認①～⑥的設定都生效，AI 回答得符合你的期待。',
    steps: [
      '直接在輸入框打字，模擬客人會問的問題',
      '確認 AI 有沒有正確回覆知識庫內容、報價是否正確、遇到投訴類問題有沒有自動升級',
      '覺得某個回答不錯，可以按「加入知識庫」把它變成之後的標準答案',
    ],
  },
  {
    id: 'logs',
    title: '⑧ 紀錄與報表',
    summary: '這裡看得到 AI 客服每天實際回答了多少問題、哪些是熱門問題、回應速度多快，幫助你了解客服狀況、找出還要補強知識庫的地方。',
  },
  {
    id: 'tickets',
    title: '⑨ 工單系統',
    summary: '客人要求真人協助，或 AI 判斷需要升級處理時，系統會建立一張工單，你可以在這裡追蹤處理進度（待處理/處理中/已解決/已結案）。',
  },
  {
    id: 'inbox',
    title: '⑩ 統一收件匣',
    summary: '把 LINE、WhatsApp、Telegram 等所有平台的對話都集中在同一個畫面，可以直接回覆客人，也能隨時切換「AI 自動回覆」或「真人接管」。手機也能安裝成 App 使用，方便隨時查看。',
  },
]

export function CsHelp() {
  return (
    <div className="min-h-full bg-slate-50/50 dark:bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/cs" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
          <div>
            <h1 className="text-lg sm:text-xl font-bold">客服系統設定教學</h1>
            <p className="text-xs text-muted-foreground mt-0.5">照順序看下去就能完成整個客服系統設定，不熟電腦也沒關係，有問題隨時用「找人幫我設定」。</p>
          </div>
        </div>

        {/* 目錄 */}
        <nav className="bg-card rounded-2xl border p-4 flex flex-wrap gap-2">
          {SECTIONS.map(s => (
            <a key={s.id} href={`#${s.id}`}
              className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-accent text-foreground/80 transition-colors">
              {s.title}
            </a>
          ))}
        </nav>

        {SECTIONS.map(s => (
          <section key={s.id} id={s.id} className="bg-card rounded-2xl border p-5 sm:p-6 scroll-mt-6">
            <h2 className="text-base font-bold mb-2">{s.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">{s.summary}</p>

            {s.steps && (
              <ol className="space-y-2 mb-4">
                {s.steps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold flex items-center justify-center mt-0.5">{i + 1}</span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            )}

            {s.faq && s.faq.length > 0 && (
              <div className="mt-4 pt-4 border-t space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">常見問題</div>
                {s.faq.map((f, i) => (
                  <div key={i} className="text-sm">
                    <div className="font-medium text-foreground">Q：{f.q}</div>
                    <div className="text-muted-foreground mt-0.5">A：{f.a}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}

        <div className="text-center py-4">
          <Link href="/cs/settings" className="text-sm text-primary font-medium hover:underline">
            前往頻道綁定頁面 →
          </Link>
        </div>
      </div>
    </div>
  )
}
