// 平台連結「詳細設定教學」：行銷自動化（發文/數據）與客服系統（收訊息）共用的一步一步中文教學。
// 每個平台 = 幾個段落（每段是一串步驟）＋注意事項＋官方文件連結。
// 內容以各平台官方流程為準；平台介面會改版，按鈕名稱以英文版為主、括號內附常見中文翻譯。

export interface GuideSection { title: string; steps: string[] }
export interface GuideLink { label: string; url: string }
export interface PlatformGuide {
  summary: string
  sections: GuideSection[]
  warnings?: string[]
  links: GuideLink[]
}

// ─── 共用段落 ────────────────────────────────────────────────────────────────

const META_APP: GuideSection = {
  title: '建立 Meta 應用程式（只要做一次，FB／IG／Threads／Messenger／WhatsApp 共用）',
  steps: [
    '用管理粉專的 Facebook 帳號登入 https://developers.facebook.com ，第一次進入會要求「註冊成為開發者」，照畫面驗證手機即可。',
    '右上角「My Apps（我的應用程式）」→「Create App（建立應用程式）」。',
    '應用程式名稱填公司名稱（例如「IMT 行銷」），聯絡 Email 填你的 Email。',
    '「使用案例（Use cases）」依要串的平台勾選：發文選「管理粉絲專頁的一切」、IG 選「管理 Instagram 上的訊息和內容」、Threads 選「存取 Threads API」、客服私訊選「透過 Messenger 與顧客互動」、WhatsApp 選「透過 WhatsApp 與顧客聯繫」。之後也可以在應用程式主控台「新增使用案例」補上。',
    '「商家（Business）」選你的 Meta 企業管理平台帳號（沒有就先略過）。',
    '按「建立應用程式」，輸入 Facebook 密碼確認。',
  ],
}

const META_LONG_TOKEN: GuideSection = {
  title: '取得「不會過期」的粉專權杖（Page Access Token）',
  steps: [
    '開啟 Graph API 測試工具：https://developers.facebook.com/tools/explorer/',
    '右側「Meta App」選剛建立的應用程式；「User or Page」選「Get User Access Token（取得用戶存取權杖）」。',
    '「Permissions（權限）」加入本卡片要求的權限（見下一段），按「Generate Access Token（產生存取權杖）」，跳出視窗時選你的粉專並全部允許。',
    '複製產生的權杖，開啟權杖偵錯工具：https://developers.facebook.com/tools/debug/accesstoken/ ，貼上 →「Debug」→ 最下方按「Extend Access Token（延長存取權杖）」，複製新的長期用戶權杖（約 60 天）。',
    '回到 Graph API 測試工具，把上方權杖欄換成長期權杖，查詢欄輸入 me/accounts 按「Submit」。',
    '結果列表中找到你的粉專：「access_token」就是不會過期的粉專權杖，「id」就是粉專 ID。',
    '（可選）把粉專權杖貼到權杖偵錯工具，「Expires（到期）」顯示「Never（永不）」就代表成功。',
  ],
}

const META_APP_SECRET: GuideSection = {
  title: '取得應用程式密鑰（App Secret）',
  steps: [
    '到 https://developers.facebook.com/apps 點進你的應用程式。',
    '左側「App settings（應用程式設定）」→「Basic（基本資料）」。',
    '「App secret（應用程式密鑰）」右邊按「Show（顯示）」，輸入 Facebook 密碼後複製。',
  ],
}

const META_LIVE: GuideSection = {
  title: '讓一般客人也能用（上線）',
  steps: [
    '開發模式下只有「應用程式角色」裡的人（管理員、開發者、測試人員）能被回覆，適合先自己測試。',
    '要對所有客人回覆：左側「App Review（應用程式審查）」申請本卡片列出的權限「Advanced Access（進階存取）」，並完成「商家驗證」。',
    '審查通過後，應用程式主控台上方把「App Mode（應用程式模式）」切到「Live（上線）」。',
  ],
}

// ─── 行銷自動化：發文／數據平台 ───────────────────────────────────────────────

export const MARKETING_GUIDES: Record<string, PlatformGuide> = {
  Facebook: {
    summary: '讓系統自動發文到你的 FB 粉專（含 FB Reels），並可讓 AI Agent 讀取／投放 Meta 廣告。',
    sections: [
      META_APP,
      {
        title: '需要的權限',
        steps: [
          '發文：pages_show_list、pages_read_engagement、pages_manage_posts。',
          '（要讓 Agent 投放廣告才需要）ads_management、ads_read。',
        ],
      },
      META_LONG_TOKEN,
      {
        title: '（選填）廣告帳戶 ID——要讓 AI Agent 投放廣告才需要',
        steps: [
          '到 https://business.facebook.com/settings （企業管理平台設定）→「帳號」→「廣告帳號」，點你的廣告帳號，右側會顯示「編號」（一串數字）。',
          '填入時前面加上 act_，例如 act_1234567890。',
          '建議改用「系統使用者權杖」（永不過期、權限最穩）：企業設定 →「使用者」→「系統使用者」→「新增」→ 角色選「管理員」→「指派資產」勾選粉專與廣告帳號（完整控制權）→「產生新權杖」→ 選你的應用程式、到期選「永不」、權限勾 pages_show_list、pages_read_engagement、pages_manage_posts、ads_management、ads_read → 複製權杖貼到上方 Page Access Token。',
        ],
      },
      {
        title: '填入本系統',
        steps: [
          'Page Access Token：貼上粉專權杖（或系統使用者權杖）。',
          'Page ID：貼上粉專 ID（me/accounts 結果裡的 id）。',
          '廣告帳戶 ID：act_ 開頭（不投廣告可留空）。',
          '按「儲存」。有填廣告帳戶時，按「測試 Meta 廣告連線」確認帳戶狀態為「正常」（唯讀，不會花錢）。',
        ],
      },
    ],
    warnings: [
      'Graph API 測試工具直接產生的短期權杖約 1～2 小時就會失效，一定要照「延長存取權杖 → me/accounts」取得長期粉專權杖。',
      '你的 Facebook 帳號必須是該粉專的管理員。',
    ],
    links: [
      { label: 'Pages API 入門', url: 'https://developers.facebook.com/docs/pages-api/getting-started' },
      { label: '長期權杖說明', url: 'https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived' },
      { label: 'Graph API 測試工具', url: 'https://developers.facebook.com/tools/explorer/' },
      { label: '系統使用者', url: 'https://www.facebook.com/business/help/503306463479099' },
    ],
  },

  Instagram: {
    summary: '讓系統自動發文到 IG（含 IG Reels）。',
    sections: [
      {
        title: '事前準備',
        steps: [
          'IG 帳號要切換成「專業帳號」（商家或創作者）：IG App →「設定和隱私」→「帳號類型和工具」→「切換為專業帳號」。',
          '把 IG 連結到 FB 粉專：FB 粉專 →「設定」→「已連結的帳號」→ Instagram →「連結帳號」。',
        ],
      },
      META_APP,
      {
        title: '取得權杖與 IG User ID',
        steps: [
          '照 Facebook 卡片的「取得不會過期的粉專權杖」步驟做，權限加上：instagram_basic、instagram_content_publish、pages_show_list、pages_read_engagement。',
          '在 Graph API 測試工具用長期權杖查詢：me/accounts?fields=name,access_token,instagram_business_account',
          '你的粉專那一筆裡「instagram_business_account」底下的 id 就是 IG User ID（一串數字，不是 IG 帳號名稱）。',
          '同一筆的 access_token 就是要填的 Access Token。',
        ],
      },
      {
        title: '填入本系統',
        steps: ['Access Token：貼上粉專權杖。', 'IG User ID：貼上 instagram_business_account 的 id。', '按「儲存」。'],
      },
    ],
    warnings: ['IG 發文一定要有圖片或影片網址，純文字無法發佈。', '個人 IG 帳號（非專業帳號）無法用 API 發文。'],
    links: [
      { label: 'IG 內容發佈 API', url: 'https://developers.facebook.com/docs/instagram-platform/content-publishing' },
      { label: 'Graph API 測試工具', url: 'https://developers.facebook.com/tools/explorer/' },
    ],
  },

  Threads: {
    summary: '讓系統自動發文到 Threads。',
    sections: [
      META_APP,
      {
        title: '加入測試人員並產生權杖',
        steps: [
          '應用程式主控台 →「使用案例」→「存取 Threads API」→「自訂」→「權限」確認有 threads_basic、threads_content_publish。',
          '左側「應用程式角色」→「角色」→「新增人員」→ 選「Threads 測試人員」，輸入你的 Threads 帳號名稱。',
          '用手機開 Threads App →「設定」→「帳號」→「網站權限」→「邀請」，接受應用程式的邀請。',
          '回到「使用案例」→「存取 Threads API」→「設定」頁下方的「User Token Generator（用戶權杖產生器）」，對你的帳號按「Generate Access Token」，複製權杖（長期權杖，約 60 天）。',
        ],
      },
      {
        title: '取得 Threads User ID',
        steps: [
          '在瀏覽器網址列貼上（把 權杖 換成剛複製的）：https://graph.threads.net/v1.0/me?fields=id,username&access_token=權杖',
          '畫面會顯示 {"id":"…","username":"…"}，id 那串數字就是 Threads User ID。',
        ],
      },
      { title: '填入本系統', steps: ['Access Token、Threads User ID 各自貼上，按「儲存」。'] },
    ],
    warnings: ['Threads 長期權杖約 60 天到期，到期前需重新產生並貼上。'],
    links: [{ label: 'Threads API 入門', url: 'https://developers.facebook.com/docs/threads/get-started' }],
  },

  LinkedIn: {
    summary: '讓系統自動發文到 LinkedIn 個人帳號或公司頁。',
    sections: [
      {
        title: '建立 LinkedIn 應用程式',
        steps: [
          '到 https://www.linkedin.com/developers/apps →「Create app」。',
          'App name 填公司名稱；LinkedIn Page 選你的公司頁（沒有要先在 LinkedIn 建立公司頁）；上傳 Logo；勾選同意條款 →「Create app」。',
          '「Settings」分頁按「Verify」，把驗證連結交給公司頁管理員點擊確認。',
          '「Products」分頁：發到個人帳號 → 申請「Share on LinkedIn」與「Sign In with LinkedIn using OpenID Connect」（通常立即核准）；發到公司頁 → 另外申請「Community Management API」（需要 LinkedIn 審核）。',
        ],
      },
      {
        title: '產生 Access Token',
        steps: [
          '開啟 https://www.linkedin.com/developers/tools/oauth/token-generator',
          '選你的 App，勾選權限：個人帳號勾 openid、profile、w_member_social；公司頁再勾 w_organization_social。',
          '按「Request access token」，登入並允許，複製產生的 Access Token（約 60 天有效）。',
        ],
      },
      {
        title: '取得 Author URN',
        steps: [
          '個人帳號：用同一個權杖呼叫 https://api.linkedin.com/v2/userinfo （可用「Token Inspector」或請工程協助），回傳的 sub 值 → 填 urn:li:person:sub值。',
          '公司頁：打開公司頁管理後台，網址 linkedin.com/company/數字/admin 裡的數字 → 填 urn:li:organization:數字。',
        ],
      },
      { title: '填入本系統', steps: ['Access Token、Author URN 各自貼上，按「儲存」。'] },
    ],
    warnings: ['LinkedIn 權杖約 60 天到期，到期需重新產生。', '發到公司頁必須先通過 Community Management API 審核。'],
    links: [
      { label: 'Share on LinkedIn', url: 'https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin' },
      { label: 'Token Generator', url: 'https://www.linkedin.com/developers/tools/oauth/token-generator' },
    ],
  },

  'Twitter/X': {
    summary: '讓系統自動發文到 X（Twitter）。',
    sections: [
      {
        title: '申請開發者帳號與 App',
        steps: [
          '用要發文的 X 帳號登入 https://developer.x.com/en/portal/dashboard ，選 Free（免費）方案並填寫用途說明（英文，簡述「自動發佈自家商家貼文」）。',
          '進入後預設會有一個 Project 與 App。',
        ],
      },
      {
        title: '一定要先改成「可寫入」',
        steps: [
          '點 App →「Settings」→「User authentication settings」→「Set up」。',
          'App permissions 選「Read and write」；Type of App 選「Web App, Automated App or Bot」。',
          'Callback URI 與 Website URL 填你的官網網址（例如 https://agent.im-tourist.com ）→「Save」。',
        ],
      },
      {
        title: '取得四組金鑰',
        steps: [
          'App →「Keys and tokens」分頁。',
          '「Consumer Keys」→「Regenerate」→ 複製 API Key 與 API Key Secret。',
          '「Authentication Tokens」→「Access Token and Secret」→「Generate」→ 複製 Access Token 與 Access Token Secret，並確認下方顯示「Read and Write」。',
        ],
      },
      { title: '填入本系統', steps: ['四個欄位依名稱對應貼上，按「儲存」。'] },
    ],
    warnings: [
      '如果 Access Token 是在改成「Read and write」之前產生的，會沒有發文權限，必須重新 Generate。',
      'Free 方案每月可發文數有上限，以 X 開發者後台顯示為準。',
    ],
    links: [{ label: 'API Key 與 Access Token', url: 'https://developer.x.com/en/docs/authentication/oauth-1-0a/api-key-and-secret' }],
  },

  'LINE VOOM': {
    summary: '用 LINE 官方帳號「群發訊息」給所有好友（系統目前是以廣播訊息方式發送，不是發到 VOOM 動態牆）。',
    sections: [
      {
        title: '建立官方帳號並開啟 Messaging API',
        steps: [
          '還沒有官方帳號：到 https://tw.linebiz.com/ 申請 LINE 官方帳號（一般帳號即可）。',
          '登入 LINE Official Account Manager：https://manager.line.biz/ ，進入你的官方帳號。',
          '右上角「設定」→ 左側「Messaging API」→「啟用 Messaging API」→ 選擇或建立服務提供者（Provider，填公司名稱）→ 確定。',
        ],
      },
      {
        title: '取得 Channel Access Token',
        steps: [
          '到 LINE Developers：https://developers.line.biz/console/ ，用同一個 LINE 帳號登入。',
          '點剛才的 Provider → 點你的官方帳號（Messaging API channel）。',
          '上方「Messaging API」分頁，拉到最下面「Channel access token（long-lived）」→「Issue（發行）」→ 複製。',
        ],
      },
      { title: '填入本系統', steps: ['Channel Access Token 貼上，按「儲存」。'] },
    ],
    warnings: [
      '每次發文都會推播給「所有好友」，會計入官方帳號每月的訊息則數，免費方案則數有限，超過需付費或加購。',
      '若客服系統已綁定同一個 LINE 官方帳號，可貼同一組 Channel Access Token（兩邊分開儲存、互不影響）。',
    ],
    links: [
      { label: 'Messaging API 入門', url: 'https://developers.line.biz/en/docs/messaging-api/getting-started/' },
      { label: 'Channel access token', url: 'https://developers.line.biz/en/docs/basics/channel-access-token/' },
    ],
  },

  Zalo: {
    summary: '讓系統自動在 Zalo 官方帳號（OA）發表文章。',
    sections: [
      {
        title: '準備 Zalo OA 與開發者應用程式',
        steps: [
          '到 https://oa.zalo.me/ 建立 Zalo Official Account（需越南手機號碼的 Zalo 帳號）。',
          '到 https://developers.zalo.me/ →「Tạo ứng dụng mới（建立新應用程式）」，填名稱與分類。',
          '應用程式 →「Official Account」→ 連結你的 OA，並申請文章相關權限。',
        ],
      },
      {
        title: '取得 OA Access Token 與 OA ID',
        steps: [
          '開發者後台「Công cụ（工具）」→「API Explorer」，類型選「OA Access Token」，選你的應用程式與 OA →「Lấy Access Token（取得）」→ 複製。',
          'OA ID：OA 管理後台 https://oa.zalo.me/ →「Thông tin OA（OA 資訊）」頁面上的 ID。',
        ],
      },
      { title: '填入本系統', steps: ['OA Access Token、OA ID 各自貼上，按「儲存」。'] },
    ],
    warnings: ['Zalo OA Access Token 有效期很短（約 1 天），系統目前不會自動更新，過期後發文會失敗，需重新取得並貼上。'],
    links: [
      { label: 'OA 授權與 Access Token', url: 'https://developers.zalo.me/docs/official-account/bat-dau/xac-thuc-va-uy-quyen-cho-ung-dung-new' },
      { label: '發表文章 API', url: 'https://developers.zalo.me/docs/official-account/article' },
    ],
  },

  'YouTube Shorts': {
    summary: '讓系統把短影音上傳到 YouTube 頻道（Shorts）。',
    sections: [
      {
        title: '在 Google Cloud 開啟 API',
        steps: [
          '到 https://console.cloud.google.com/ ，上方選擇（或建立）一個專案。',
          '搜尋列輸入「YouTube Data API v3」→ 點進去 →「啟用」。',
        ],
      },
      {
        title: '設定 OAuth 同意畫面',
        steps: [
          '左側選單「API 和服務」→「OAuth 同意畫面」（新版介面叫「Google Auth Platform」）→「開始」。',
          '應用程式名稱填公司名稱、支援 Email 填你的 Email；目標對象選「外部」→ 建立。',
          '「目標對象」頁的「測試使用者」→「新增使用者」，加入擁有 YouTube 頻道的 Google 帳號。',
        ],
      },
      {
        title: '建立 OAuth 用戶端（取得 Client ID／Client Secret）',
        steps: [
          '「API 和服務」→「憑證」→「建立憑證」→「OAuth 用戶端 ID」。',
          '應用程式類型選「網頁應用程式」。',
          '「已授權的重新導向 URI」→「新增 URI」→ 填 https://developers.google.com/oauthplayground',
          '按「建立」，複製 Client ID 與 Client Secret。',
        ],
      },
      {
        title: '用 OAuth Playground 取得 Refresh Token',
        steps: [
          '開啟 https://developers.google.com/oauthplayground/',
          '右上角齒輪 → 勾選「Use your own OAuth credentials」→ 貼上 Client ID、Client Secret → Close。',
          '左側下方輸入框貼上 https://www.googleapis.com/auth/youtube.upload →「Authorize APIs」。',
          '用擁有頻道的 Google 帳號登入 → 出現「Google 尚未驗證這個應用程式」→「繼續」→ 允許。',
          '回到 Playground 按「Exchange authorization code for tokens」→ 複製「Refresh token」（1// 開頭）。',
        ],
      },
      { title: '填入本系統', steps: ['Client ID、Client Secret、Refresh Token 各自貼上，按「儲存」。'] },
    ],
    warnings: [
      'OAuth 同意畫面停在「測試中」時，Refresh Token 約 7 天就會失效；要長期使用，請在「目標對象」按「發布應用程式」。',
      '未通過 YouTube API 稽核的專案，上傳的影片會被限制為「私人」，需向 YouTube 申請稽核後才能公開。',
    ],
    links: [
      { label: '上傳影片 API', url: 'https://developers.google.com/youtube/v3/guides/uploading_a_video' },
      { label: 'OAuth Playground', url: 'https://developers.google.com/oauthplayground/' },
    ],
  },

  TikTok: {
    summary: '讓系統把短影音上傳到 TikTok。',
    sections: [
      {
        title: '建立 TikTok 開發者應用程式',
        steps: [
          '到 https://developers.tiktok.com/ 登入 →「Manage apps」→「Connect an app」。',
          '填寫 App 名稱、圖示、分類、網站網址（例如 https://agent.im-tourist.com ）、隱私權政策與服務條款網址。',
          '「Add products」加入「Login Kit」與「Content Posting API」，並開啟「Direct Post」；Scopes 勾選 video.publish。',
          '送出審核（Submit for review）。',
        ],
      },
      {
        title: '取得 Access Token',
        steps: [
          'TikTok 的 Access Token 只能透過 Login Kit 的 OAuth 授權流程取得（授權後以 code 換取 token），沒有像 Meta 那樣的網頁工具可直接產生。',
          '這一步需要工程協助；取得後把 access_token 貼到本系統並按「儲存」。',
        ],
      },
    ],
    warnings: [
      'TikTok Access Token 約 24 小時到期，系統目前不會自動更新，過期後上傳會失敗。',
      '應用程式通過 TikTok 審核前，透過 API 發佈的影片只能設為「僅自己可見」。',
    ],
    links: [{ label: 'Content Posting API 入門', url: 'https://developers.tiktok.com/doc/content-posting-api-get-started' }],
  },

  GA4: {
    summary: '讓 AI Agent 讀取官網流量（造訪次數、使用者數），並可自動在本平台民宿官網裝上追蹤碼。',
    sections: [
      {
        title: 'A. 建立 GA4 資源（已經有 GA4 可跳過）',
        steps: [
          '開啟 https://analytics.google.com ，用公司的 Google 帳號登入。沒有任何 GA 時會直接進入「建立帳戶」。',
          '帳戶名稱填公司或民宿名稱 →「下一步」。',
          '資源名稱填「XX官網」，報表時區選「台灣」、幣別選「新台幣」→「下一步」。',
          '商家詳細資料：產業選「旅遊」、規模依實際選擇 →「下一步」→ 商家目標任選 →「建立」→ 國家選台灣、勾選同意條款 →「我接受」。',
          '「選擇平台」點「網頁」→ 網站網址填官網網址 → 串流名稱填「官網」→「建立串流」。',
          '畫面右上角的「評估 ID」（G- 開頭）抄下來。',
          '一家民宿只要「一個資源、一條串流」；外部網站與本平台官網都裝同一個評估 ID。',
        ],
      },
      {
        title: 'B. 在 Google Cloud 開啟 API 並建立服務帳戶',
        steps: [
          '到 https://console.cloud.google.com/ ，上方選擇（或建立）一個專案。',
          '搜尋列輸入「Google Analytics Data API」→ 點進去 →「啟用」。',
          '左側選單「IAM 與管理」→「服務帳戶」→ 上方「建立服務帳戶」。',
          '服務帳戶名稱填 AGENT；服務帳戶 ID 填 ga4-reader（6～30 字元、小寫英文開頭，只能用小寫英文、數字、-）。',
          '直接按左下角「建立並關閉」（「權限」與「具備存取權的主體」都不用填）。',
          '在服務帳戶清單複製它的「電子郵件」，形如 ga4-reader@專案ID.iam.gserviceaccount.com。',
        ],
      },
      {
        title: 'C. 下載 JSON 金鑰',
        steps: [
          '在服務帳戶清單點 ga4-reader → 上方「金鑰」分頁。',
          '「新增鍵」→「建立新的金鑰」→ 選「JSON」→「建立」，瀏覽器會下載一個 .json 檔（只能下載這一次）。',
          '若出現「已停用服務帳戶金鑰建立」，代表組織政策擋住，需請 Google Cloud 組織管理員開放。',
        ],
      },
      {
        title: 'D. 在 GA4 授權服務帳戶',
        steps: [
          '回到 https://analytics.google.com ，左下角齒輪「管理」。',
          '「資源」欄 →「資源存取管理」→ 右上角藍色「+」→「新增使用者」。',
          '電子郵件貼上 B 步驟複製的服務帳戶 email；取消勾選「透過電子郵件通知新使用者」；角色選「檢視者」→「新增」。',
          '「管理」→「資源」欄 →「資源詳細資料」，右上角的「資源 ID」（純數字）抄下來。',
        ],
      },
      {
        title: 'E. 填入本系統',
        steps: [
          'GA4 資源 ID：填 D 步驟的純數字。',
          '評估 ID：填 A 步驟的 G- 開頭代碼（填了本平台民宿官網、加入會員頁會自動裝上追蹤碼）。',
          '服務帳戶 JSON 金鑰：用記事本打開下載的 .json 檔，全選（Ctrl+A）複製，整份貼上。',
          '按「儲存」→「測試 GA4 連線」。剛裝好顯示 0 是正常的，約 24～48 小時後才會有數字。',
        ],
      },
      {
        title: 'F. 有自己外部網站時',
        steps: [
          '外部網站貼同一個評估 ID（WordPress／Wix 等後台都有 Google Analytics 欄位，或請網站廠商處理）。',
          'GA4「管理」→「資料串流」→ 點串流 →「設定代碼設定」→「設定網域」，把外部網站網域與 agent.im-tourist.com 都加入（跨網域追蹤，客人跨站瀏覽不會被重複計算）。',
        ],
      },
    ],
    warnings: ['JSON 金鑰等於密碼，不要傳給別人或貼到其他地方。', 'GA4 不佔方案平台數。'],
    links: [
      { label: '為網站設定 GA4', url: 'https://support.google.com/analytics/answer/9304153?hl=zh-Hant' },
      { label: '建立服務帳戶', url: 'https://cloud.google.com/iam/docs/service-accounts-create?hl=zh-tw' },
      { label: '跨網域評估', url: 'https://support.google.com/analytics/answer/10071811?hl=zh-Hant' },
    ],
  },
}

// ─── 客服系統：收發私訊平台 ───────────────────────────────────────────────────

export const CS_GUIDES: Record<string, PlatformGuide> = {
  line: {
    summary: '讓 AI 客服自動回覆 LINE 官方帳號的私訊。',
    sections: [
      {
        title: '建立官方帳號並開啟 Messaging API',
        steps: [
          '還沒有官方帳號：到 https://tw.linebiz.com/ 申請 LINE 官方帳號。',
          '登入 https://manager.line.biz/ ，進入你的官方帳號。',
          '右上角「設定」→ 左側「Messaging API」→「啟用 Messaging API」→ 選擇或建立服務提供者（Provider）→ 確定。',
        ],
      },
      {
        title: '取得 Channel Secret 與 Channel Access Token',
        steps: [
          '到 https://developers.line.biz/console/ ，用同一個 LINE 帳號登入 → 點 Provider → 點你的官方帳號。',
          '「Basic settings」分頁 →「Channel secret」→ 複製。',
          '「Messaging API」分頁最下方「Channel access token（long-lived）」→「Issue」→ 複製。',
        ],
      },
      {
        title: '設定 Webhook',
        steps: [
          '先把兩個值貼到本卡片並按「儲存」。',
          '複製本卡片上方的「Webhook URL」。',
          'LINE Developers →「Messaging API」分頁 →「Webhook settings」→「Webhook URL」→「Edit」→ 貼上 →「Update」→「Verify」，出現 Success 即成功。',
          '同一區塊把「Use webhook」打開。',
        ],
      },
      {
        title: '關閉 LINE 內建自動回覆（避免重複回覆）',
        steps: [
          'LINE Official Account Manager →「設定」→「回應設定」。',
          '「聊天」可保持開啟（真人仍可在後台回覆）；「Webhook」開啟；「自動回應訊息」關閉；「加入好友的歡迎訊息」依需要。',
        ],
      },
    ],
    warnings: ['Verify 失敗時，先確認已在本系統按過「儲存」，再重新 Verify。'],
    links: [
      { label: 'Messaging API 入門', url: 'https://developers.line.biz/en/docs/messaging-api/getting-started/' },
      { label: 'Webhook 設定', url: 'https://developers.line.biz/en/docs/messaging-api/receiving-messages/' },
    ],
  },

  whatsapp: {
    summary: '讓 AI 客服自動回覆 WhatsApp Business（Cloud API）的訊息。',
    sections: [
      META_APP,
      {
        title: '取得 Phone Number ID 與 Access Token',
        steps: [
          '應用程式主控台 → WhatsApp →「API Setup（API 設定）」。',
          '系統會先給一個測試號碼；要用自己的號碼：同頁「Add phone number（新增電話號碼）」，填商家名稱與號碼並用簡訊／電話驗證（該號碼不能同時在 WhatsApp App 上使用）。',
          '「From」選你的號碼，下方的「Phone number ID」複製。',
          '頁面上的暫時權杖只有 24 小時；正式使用請產生永久權杖：https://business.facebook.com/settings →「使用者」→「系統使用者」→「新增」（管理員）→「指派資產」勾選你的應用程式與 WhatsApp 帳號（完整控制權）→「產生新權杖」→ 到期選「永不」、權限勾 whatsapp_business_messaging、whatsapp_business_management → 複製。',
        ],
      },
      META_APP_SECRET,
      {
        title: '設定 Webhook',
        steps: [
          '「驗證權杖（Verify Token）」自己想一組英數字（例如 imt_wa_2026），填到本卡片。',
          '把 Phone Number ID、Access Token、Verify Token、App Secret 都填好並按「儲存」。',
          '應用程式主控台 → WhatsApp →「Configuration（設定）」→「Webhook」→「Edit」：Callback URL 貼上本卡片的 Webhook URL，Verify token 填剛剛那組 →「Verify and save」。',
          '下方「Webhook fields」找到 messages →「Subscribe」。',
        ],
      },
    ],
    warnings: ['顧客 24 小時內沒有傳訊息時，只能用 Meta 核准的「訊息範本」主動聯繫，且依 WhatsApp 計價收費。'],
    links: [
      { label: 'Cloud API 入門', url: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started' },
      { label: '系統使用者', url: 'https://www.facebook.com/business/help/503306463479099' },
    ],
  },

  messenger: {
    summary: '讓 AI 客服自動回覆 FB 粉專（Messenger）的私訊。',
    sections: [
      META_APP,
      {
        title: '需要的權限',
        steps: ['pages_show_list、pages_messaging、pages_manage_metadata、pages_read_engagement。'],
      },
      META_LONG_TOKEN,
      META_APP_SECRET,
      {
        title: '設定 Webhook',
        steps: [
          '「驗證權杖（Verify Token）」自己想一組英數字（例如 imt_fb_2026），填到本卡片。',
          '把 Page Access Token、Verify Token、App Secret 填好並按「儲存」。',
          '應用程式主控台 →「使用案例」→「透過 Messenger 與顧客互動」→「自訂」→「Messenger API 設定」。',
          '「設定 Webhook」：回呼網址貼上本卡片的 Webhook URL，驗證權杖填剛剛那組 →「驗證並儲存」。',
          '同頁「產生存取權杖」區塊 → 連結你的粉專 → 粉專右側「Webhook 訂閱」勾選 messages、messaging_postbacks。',
        ],
      },
      META_LIVE,
    ],
    links: [
      { label: 'Messenger Platform 入門', url: 'https://developers.facebook.com/docs/messenger-platform/getting-started' },
      { label: 'Graph API 測試工具', url: 'https://developers.facebook.com/tools/explorer/' },
    ],
  },

  instagram: {
    summary: '讓 AI 客服自動回覆 IG 私訊（Direct）。',
    sections: [
      {
        title: '事前準備',
        steps: [
          'IG 帳號切換為「專業帳號」（商家或創作者），並連結到 FB 粉專（FB 粉專 →「設定」→「已連結的帳號」→ Instagram）。',
          'IG App →「設定和隱私」→「訊息和限時動態回覆」→「訊息控制」→「已連結的工具」→ 開啟「允許存取訊息」。',
        ],
      },
      META_APP,
      {
        title: '取得 Access Token',
        steps: [
          '照 Messenger 卡片的「取得不會過期的粉專權杖」步驟做，權限加上：instagram_basic、instagram_manage_messages、pages_show_list、pages_manage_metadata。',
          'me/accounts 結果裡，連結 IG 的那個粉專的 access_token 就是要填的權杖。',
        ],
      },
      META_APP_SECRET,
      {
        title: '設定 Webhook',
        steps: [
          '「驗證權杖（Verify Token）」自己想一組英數字（例如 imt_ig_2026），填到本卡片。',
          '三個欄位填好並按「儲存」。',
          '應用程式主控台 →「使用案例」→「管理 Instagram 上的訊息和內容」→「自訂」→「Webhook」（或左側「Webhooks」產品，物件選 Instagram）。',
          '回呼網址貼上本卡片的 Webhook URL，驗證權杖填剛剛那組 →「驗證並儲存」→ 訂閱 messages 欄位。',
        ],
      },
      META_LIVE,
    ],
    links: [
      { label: 'Instagram 訊息 API', url: 'https://developers.facebook.com/docs/messenger-platform/instagram' },
      { label: 'Graph API 測試工具', url: 'https://developers.facebook.com/tools/explorer/' },
    ],
  },

  telegram: {
    summary: '讓 AI 客服自動回覆 Telegram Bot 收到的訊息，並把通知／審核推播給管理員。',
    sections: [
      {
        title: '建立 Bot 取得 Token',
        steps: [
          '在 Telegram 搜尋 @BotFather（有藍勾勾的官方帳號）→「Start」。',
          '傳送 /newbot → 輸入 Bot 顯示名稱（例如「喬民宿客服」）→ 輸入 Bot 帳號（英文，必須以 bot 結尾，例如 jiao_bnb_bot）。',
          'BotFather 會回傳一串 Token（形如 123456789:AAF…），複製。',
        ],
      },
      {
        title: '取得管理員 Chat ID',
        steps: [
          '先在 Telegram 搜尋你剛建立的 Bot →「Start」（沒有先 Start，Bot 無法主動傳訊息給你）。',
          '搜尋 @userinfobot →「Start」，它會回覆你的 Id（一串數字），複製。',
        ],
      },
      {
        title: '填入本系統',
        steps: ['Bot Token、管理員 Chat ID 各自貼上，按「儲存」。系統會自動設定 Webhook，不需要手動設定。'],
      },
    ],
    links: [{ label: 'Telegram Bot 教學', url: 'https://core.telegram.org/bots/tutorial' }],
  },

  zalo: {
    summary: '讓 AI 客服自動回覆 Zalo 官方帳號（OA）的訊息。',
    sections: [
      {
        title: '準備 Zalo OA 與開發者應用程式',
        steps: [
          '到 https://oa.zalo.me/ 建立 Zalo Official Account。',
          '到 https://developers.zalo.me/ →「Tạo ứng dụng mới（建立新應用程式）」。',
          '應用程式 →「Official Account」→ 連結你的 OA，並申請傳送訊息相關權限。',
        ],
      },
      {
        title: '取得 OA Access Token',
        steps: [
          '開發者後台「Công cụ（工具）」→「API Explorer」，類型選「OA Access Token」，選應用程式與 OA →「Lấy Access Token（取得）」→ 複製，貼到本卡片並按「儲存」。',
        ],
      },
      {
        title: '設定 Webhook',
        steps: [
          '應用程式 →「Webhook」→ Webhook URL 貼上本卡片的 Webhook URL → 儲存。',
          '依畫面指示完成網域驗證，並勾選要接收的事件：user_send_text、user_send_image 等使用者傳訊事件。',
        ],
      },
    ],
    warnings: ['Zalo OA Access Token 有效期很短（約 1 天），系統目前不會自動更新，過期後會無法回覆，需重新取得並貼上。'],
    links: [
      { label: 'OA 授權與 Access Token', url: 'https://developers.zalo.me/docs/official-account/bat-dau/xac-thuc-va-uy-quyen-cho-ung-dung-new' },
      { label: 'Zalo OA 文件', url: 'https://developers.zalo.me/docs/official-account' },
    ],
  },
}
