// FEELING TEA 門市營運教練 AI (Store Management Coach AI) 企業標準知識庫
import type {
  Workstation, StaffMovement, StoreBestPractice, HygieneStandard,
  CleaningBestPractice, ServiceBehavior, CoachingMethod, StoreProblemMemory,
  CompanyPrinciple
} from '@/lib/types/store-coach'

export const STANDARD_WORKSTATIONS: Workstation[] = [
  {
    id: 'ws-tea-core',
    store_id: 'standard',
    name: '調茶核心站 (Tea Core Station)',
    type: 'tea_station',
    location: '吧台中央黃金三角區',
    purpose: '茶湯定量、調味、加糖與雪克搖勻核心樞紐',
    equipment: ['定量果糖機', '智能搖茶機', '溫度槍', '計時器'],
    tools: ['不鏽鋼雪克杯 (3 組)', '量杯 (100ml / 50ml)', '長柄調酒匙'],
    ingredients: ['四季春高山茶', '阿薩姆紅茶', '茉莉綠茶', '特級二砂糖漿'],
    frequency_of_use: 'continuous',
    ergonomic_score: 92,
    efficiency_score: 95,
    hygiene_score: 90,
    safety_score: 95,
    notes: '茶桶出水口與果糖機出糖口距離保持 45cm 最佳作業半徑，避免伸手過長。'
  },
  {
    id: 'ws-topping-seal',
    store_id: 'standard',
    name: '配料封膜站 (Topping & Sealing Station)',
    type: 'topping_station',
    location: '調茶站右側順流位',
    purpose: '加料、冰塊調整、杯蓋封口、貼標出餐',
    equipment: ['自動微電腦封膜機', 'POS 出單貼標機', '保溫珍珠鍋'],
    tools: ['多孔瀝糖波霸漏杓', '長柄配料匙', '食品級冰鏟'],
    ingredients: ['黑糖珍珠', '椰果', '布丁', '冰塊'],
    frequency_of_use: 'continuous',
    ergonomic_score: 88,
    efficiency_score: 90,
    hygiene_score: 92,
    safety_score: 90,
    notes: '封口機維持 165°C 恆溫，珍珠盆定時每 30 分鐘微保溫翻動。'
  },
  {
    id: 'ws-wash-prep',
    store_id: 'standard',
    name: '備料水洗站 (Wash & Prep Station)',
    type: 'washing',
    location: '後吧台水槽洗滌區',
    purpose: '器具即時沖洗、抹布浸泡消毒、煮茶與珍珠備料',
    equipment: ['高壓洗杯噴頭', '三槽式洗滌水槽', '濾水淨化系統'],
    tools: ['量桶', '攪拌棒', '雙色專用抹布 (藍色/綠色)'],
    ingredients: ['食品用清潔劑', '75% 酒精消毒液'],
    frequency_of_use: 'hourly',
    ergonomic_score: 85,
    efficiency_score: 88,
    hygiene_score: 96,
    safety_score: 92,
    notes: '洗杯機噴頭水壓建議保持 2.5-3.0 bar，單杯沖洗 3 秒完成。'
  }
]

export const STANDARD_MOVEMENTS: StaffMovement[] = [
  {
    id: 'mov-1',
    store_id: 'standard',
    task: '尖峰期拿取低脂鮮奶',
    start_position: '調茶站 (中央)',
    end_position: '大冰箱 (左側底角)',
    distance_meters: 3.2,
    estimated_seconds: 6,
    frequency_per_hour: 28,
    cross_traffic: true,
    bottleneck: '橫越水槽時與備料人員背對碰撞，需繞過洗滌區。',
    recommended_route: '建議尖峰前將 4 瓶鮮奶預置於調茶站下方小冷藏櫃，走位距離降為 0 米。'
  },
  {
    id: 'mov-2',
    store_id: 'standard',
    task: '取冰至調茶站',
    start_position: '調茶站',
    end_position: '製冰機儲冰槽',
    distance_meters: 1.8,
    estimated_seconds: 4,
    frequency_per_hour: 45,
    cross_traffic: false,
    recommended_route: '冰鏟落座定位，尖峰期雙手雪克杯順流取冰。'
  }
]

export const STORE_BEST_PRACTICES: StoreBestPractice[] = [
  {
    id: 'bp-1',
    category: 'rush_hour',
    title: '下午茶尖峰時段「前後雙人單向流水線」',
    problem: '下午 14:00-16:00 訂單暴增時，吧員各自獨立做杯導致交叉碰撞、出杯時間拉長至 180 秒/杯。',
    recommended_method: '拆分為 A 員（前台點單 + 配料貼標）與 B 員（調茶 + 冰塊 + 封膜出杯），單向流動絕不回頭。',
    why: '消除 80% 的轉身與交叉走位，讓高頻動作（調茶、下料）進入肌肉記憶節奏。',
    expected_benefit: '單杯平均出杯時間由 180 秒縮短至 95 秒，門市出杯產能提升 89%。',
    time_saved_seconds: 85,
    quality_improvement: '避免雙人同時動同一個茶桶造成量杯誤拿。',
    source: 'Feeling Tea 旗艦示範店實測認證',
    evidence_level: 'verified_in_field',
    applicable_store_type: ['mall_kiosk', 'street_store']
  },
  {
    id: 'bp-2',
    category: 'speed',
    title: '尖峰期常用原料「黃金三角視線定置法」',
    problem: '果糖機、量杯、常用茶桶高低不一，吧員視線需頻繁上下左右切換造成動作停頓。',
    recommended_method: '以吧員視線水平向下 15 度為中心，將四款熱銷茶龍頭、果糖機噴嘴、雪克杯架排列於半徑 60cm 內。',
    why: '符合人體工學（Ergonomics），手臂自然下垂即可完成抓取，無需墊腳或大幅彎腰。',
    expected_benefit: '每小時走位步數減少 1,200 步，員工尖峰期體力衰退延後 2 小時。',
    time_saved_seconds: 12,
    source: '工業工程 (IE) 動作研究',
    evidence_level: 'verified_in_field',
    applicable_store_type: ['mall_kiosk', 'street_store']
  }
]

export const HYGIENE_STANDARDS: HygieneStandard[] = [
  {
    id: 'hyg-counter',
    category: 'counter',
    area: '調飲與出餐操作吧台',
    standard: '檯面乾淨乾燥、無糖漬茶漬、無多餘雜物堆積、工具依規定就位。',
    acceptable_condition: ['檯面完全乾燥無水痕', '無黏手糖漿殘留', '抹布折疊整齊置於專用瀝水盤', '雪克杯瀝水倒扣'],
    unacceptable_condition: ['積水未刮除', '有茶湯乾涸痕跡', '抹布隨意丟在封膜機旁', '杯底帶水直接出餐'],
    critical_limit: '檯面不得接觸未洗淨之個人物品，抹布每 2 小時更換或熱水浸泡消毒。',
    inspection_method: '目視檢驗 + 手觸有無黏滯感',
    frequency: 'every_2_hours',
    responsible_role: 'barista',
    source: 'vietnam_food_law_haccp',
    risk_level: 'high'
  },
  {
    id: 'hyg-ice',
    category: 'ice_maker',
    area: '製冰機與儲冰槽',
    standard: '冰鏟專用收納盒吊掛、冰槽門隨手關閉、槽內無異物。',
    acceptable_condition: ['冰鏟置於槽外專用消毒盒內', '儲冰槽門完全密合', '冰塊清澈無黑點雜質'],
    unacceptable_condition: ['冰鏟直接插在冰塊中', '儲冰槽門敞開', '槽壁有水垢或黴斑'],
    critical_limit: '絕不可直接以手觸碰冰塊，冰鏟每班次以 75% 酒精消毒。',
    inspection_method: '目視槽體邊緣與冰塊淨度',
    frequency: 'per_shift',
    responsible_role: 'shift_leader',
    source: 'haccp_ccp',
    risk_level: 'critical'
  }
]

export const CLEANING_BEST_PRACTICES: CleaningBestPractice[] = [
  {
    id: 'cln-bar-90s',
    area: '調飲操作吧台',
    problem: '尖峰過後檯面雜亂，傳統清理耗時 5-8 分鐘且容易將糖水抹勻反倒更黏。',
    cleaning_method: '6 步高效率乾濕分離刮洗工法',
    tools: ['專用刮水器', '藍色濕擦超細纖維布', '黃色乾擦拋光布', '75% 酒精噴霧'],
    chemical: '75% 食品級酒精清潔液',
    sequence: [
      { step: 1, action: '移料：將正在瀝水之雪克杯與量杯集中推至後瀝水架', duration_seconds: 15, tip: '一手推三杯，動作迅速。' },
      { step: 2, action: '刮水：使用食品級橡膠刮水器由後向前將積水刮入集水溝槽', duration_seconds: 20, tip: '單向刮除，切忌來回塗抹。' },
      { step: 3, action: '濕擦：以擰乾之藍色布擦除殘留糖漬邊緣', duration_seconds: 20, tip: '對著果糖機滴嘴正下方重點施力。' },
      { step: 4, action: '消毒：噴灑 75% 酒精 2-3 下於檯面', duration_seconds: 10, tip: '保持霧狀均勻散佈。' },
      { step: 5, action: '乾擦：使用黃色乾布順紋擦乾發亮', duration_seconds: 15, tip: '擦完檯面立即呈現完全乾爽狀態。' },
      { step: 6, action: '復位：將常用器具歸回標準定位坐標', duration_seconds: 10, tip: '檢查量匙與冰鏟就位。' }
    ],
    estimated_time_seconds: 90,
    frequency: 'after_each_rush',
    quality_score: 98,
    hygiene_score: 96,
    labor_score: 92,
    best_practice_tips: '刮水器取代抹布硬擦，省力 70% 且不傷不鏽鋼檯面。'
  }
]

export const SERVICE_BEHAVIORS: ServiceBehavior[] = [
  {
    id: 'beh-greeting',
    category: 'greeting',
    behavior: '進門 1 秒眼神接觸與 3 秒親切迎賓',
    definition: '顧客跨入店門 1 公尺或靠近櫃台時，全體吧員在 3 秒內給予眼神平視與微笑招呼。',
    good_example: '放下手中非緊急備料，平視顧客眼神微帶笑容：「Xin chào! 歡迎光臨 Feeling Tea，今天想喝點什麼清爽的嗎？」',
    bad_example: '低頭算帳或背對客人擦杯子，等客人自己開口說「你好」才慢吞吞抬頭，表情冷漠。',
    customer_effect: '顧客第一時間感受被重視，大幅降低等候點單的焦慮感，提升首訪好感度。',
    manager_coaching: '店長在早會挑選一位同仁扮演顧客，連續演練進門 3 秒的情境反饋。',
    training_method: '3 秒鐘抬頭盲測演練（背對練習，聽到門鈴 1 秒內自然轉身微笑）',
    evaluation_method: '神秘客稽核（Mystery Shopper）迎賓及時率 100%'
  },
  {
    id: 'beh-handover',
    category: 'drink_handover',
    behavior: '雙手雙指端杯交付與暖心提醒',
    definition: '交飲品給顧客時，雙手端杯、杯身標籤朝向顧客，並主動說明冰塊甜度與最佳飲用方式。',
    good_example: '雙手將飲料穩穩遞上：「您的黑糖珍珠厚奶，微糖微冰，喝前建議上下均勻搖晃 5 下風味最棒喔！」',
    bad_example: '單手抓著杯蓋提給客人，頭也不抬喊單號「102 號自己拿」。',
    customer_effect: '儀式感與專業度倍增，能有效引導顧客正確品嚐產品最佳風味。',
    manager_coaching: '觀察新進員工交付動作，當天給予即時正向激勵回饋。',
    training_method: '雙手握持安定感模擬培訓',
    evaluation_method: '出單抽查合格率'
  }
]

export const COACHING_METHODS: CoachingMethod[] = [
  {
    id: 'coach-smile',
    skill: '如何教導害羞或緊張的員工自然微笑與打招呼',
    employee_level: 'junior_month1',
    situation: '新員工站收銀櫃台時神情僵硬、說話聲量小、完全不笑，客人反映感受冷淡。',
    coaching_method: '5 步無痛帶教法：示範 ➔ 模仿 ➔ 情境演練 ➔ 立即正向回饋 ➔ 隔日跟進',
    example_dialogue: `店長：「阿榮，剛才看你收銀動作非常精準，找零也完全正確，這一點做得很好！
不過我有注意到你因為很專注怕按錯 POS，臉上看起來有點嚴肅。
來，我們換位思考一下，如果你去買飲料，店員緊繃著臉，你會不會也覺得有點緊張？
我們現在練習一個簡單的小技巧：看著我，先放鬆肩膀，在開口說『Xin chào』的第一個字時，嘴角稍微往上提一點點。
對！就是這個表情，非常親切自然！
接下來這三位客人，你試試看用剛才這個表情打招呼，我在你旁邊幫你加油，做到了等下請你喝最新配方的四季春！」`,
    demonstration_guide: '店長親自站上 POS 示範一次完整服務流程，展現自然的微笑與語調節奏。',
    practice_exercise: '店長扮演猶豫不決的顧客，讓員工演練兩次推薦商品與親切問候。',
    feedback_framework: '讚美 80% 的正確動作 + 調整 20% 的面部表情肌肉放鬆技巧。',
    follow_up_period: '隔天下午尖峰前再花 2 分鐘觀察與給予擊掌鼓勵。',
    common_mistakes: '切忌當著客人的面大聲斥責「你怎麼都不會笑」，這會讓員工更加焦慮緊張。'
  }
]

export const STORE_PROBLEM_MEMORIES: StoreProblemMemory[] = [
  {
    id: 'mem-sweetness-check',
    similarity_tags: ['甜度', '太甜', '配方太甜', '糖度過高', '客訴'],
    problem_pattern: '顧客連續兩天反映特定飲品（如黑糖珍珠厚奶）喝起來比平常「太甜」。',
    root_cause_pattern: '并非研發配方改變，而是門市果糖機未進行每週校準，出糖計量電磁閥偏移 18%，加上珍珠保溫浸泡時間超過 50 分鐘吸附過多糖汁。',
    proven_solution: '1. 立即使用量杯校準果糖機（10ml/20ml 精確度）。2. 嚴格執行煮珠後蜜糖 25 分鐘標準定時，超時未售完重新加溫水稀釋或報銷。3. 呼叫 R&D 配方標準糖度（18° Brix）現場以折光儀抽驗。',
    success_metrics: '當日客訴歸零，出糖一致性回復 99.5%，糖漿耗損下降 8.3%。',
    applied_count: 5,
    source_store_name: 'Feeling Tea 峴港店'
  },
  {
    id: 'mem-rush-bottleneck',
    similarity_tags: ['出杯慢', '尖峰塞車', '排隊太長', '外送催單', '等候時間長'],
    problem_pattern: '下午 14:00-16:00 尖峰時段，門市平均出杯時間達 6.5 分鐘，外送員頻繁催單。',
    root_cause_pattern: '調飲站與大冰箱走位交叉，員工頻繁來回拿取鮮奶與冰塊，單杯移動步數高達 12 步。',
    proven_solution: '實施「尖峰前後雙人單向流水線」+「鮮奶小冷藏小車預置法」，調飲員站定不動，前台人員負責配料與出單。',
    success_metrics: '平均等候時間由 6.5 分鐘降至 4.1 分鐘（下降 37%），外送出單準時率提升至 96.8%。',
    applied_count: 8,
    source_store_name: 'Feeling Tea 怡朗示範店'
  }
]

export const COMPANY_PRINCIPLES: CompanyPrinciple[] = [
  {
    id: 'prin-quality-first',
    category: 'quality',
    principle: '品質絕對不可妥協 (Uncompromising Quality)',
    meaning: '每一杯遞到顧客手中的飲品，都代表著 Feeling Tea 的靈魂與信譽。絕不因為客人沒發現就交出次級品。',
    why: '連鎖品牌建立口碑需要 1,000 杯的好評，但摧毀信任只需要 1 杯失誤的劣品。',
    good_example: '發現茶湯存放超過 4 小時已有澀味，即使尖峰期很忙，仍堅決倒掉重煮，主動向等候客人致歉並奉上新鮮試飲。',
    bad_example: '發現牛奶接近過期臨界點或茶色稍微變黑，心存僥倖認為「加了冰塊和糖客人喝不出來」而照常出單。',
    manager_action: '當員工主動倒掉不合格原料時，公開表揚其守護品質的勇氣，絕不因此扣懲員工耗損。',
    employee_action: '發現任何原料或出杯異常，立即舉手回報並重做一杯。'
  }
]

export const STORE_COACH_KNOWLEDGE = {
  layouts: [
    {
      id: 'LAYOUT-01',
      code: 'I-SHAPE',
      name: '直線型單向流動 (I-Shape Single-Track)',
      target_area_ping: '15-25 坪 (長條型街邊店)',
      description: '客流由左至右單向推進，點單 ➔ 茶湯 ➔ 配料 ➔ 封口 ➔ 取餐 一直線排列，零交叉走位。',
      peak_capacity_cups_hr: 120,
      staff_count_min: 2,
      staff_count_max: 3,
      station_sequence: ['點餐收銀站', '茶湯核心站', '加料調製站', '雪克封口站', '取餐品檢站'],
      movement_characteristics: '嚴格執行「單向順流，絕不回頭」。備料區置於後方通道，補料由後方獨立通道完成，不干擾前台調飲線。',
    },
    {
      id: 'LAYOUT-02',
      code: 'L-SHAPE',
      name: 'L型黃金轉角配置 (L-Shape Corner)',
      target_area_ping: '20-35 坪 (商場角窗店)',
      description: '前櫃點餐取餐，轉角吧檯集中調茶與封膜，創造最大顧客互動可視面。',
      peak_capacity_cups_hr: 150,
      staff_count_min: 3,
      staff_count_max: 4,
      station_sequence: ['正面點餐區', '轉角茶湯核心', '內側配料冰槽', '封口出杯站', '轉角取餐台'],
      movement_characteristics: '調茶師以轉角為中心，旋轉 90 度即可完成茶湯與加料，手臂移動半徑不超過 60cm。',
    },
    {
      id: 'LAYOUT-03',
      code: 'ISLAND-DUAL',
      name: '中島雙軌平行分流 (Island Dual-Track)',
      target_area_ping: '30-50 坪 (高單量旗艦大店)',
      description: '外帶散客軌道與外送 (Delivery/Zalo) 訂單完全分離，中央配置中島洗滌與備料島。',
      peak_capacity_cups_hr: 180,
      staff_count_min: 4,
      staff_count_max: 6,
      station_sequence: ['外帶點餐軌', '外送專用軌', '中央中島水槽', '雙封口出杯站', '得來速/外送取餐區'],
      movement_characteristics: '雙軌獨立作業，外送員完全不進門市櫃檯主動線，尖峰期雙軌可平行達到 180 杯/小時產能。',
    },
  ],
  workstations: [
    {
      id: 'WS-01',
      name: '點餐收銀工作站 (POS & Cashier)',
      purpose: '顧客第一接觸點，負責快速點單、會員辨識、金流結帳與出單貼標。',
      ergonomics_rule: '觸控螢幕角度傾斜 45 度，外帶紙袋預置於胸口高度抽屜，取用無需大幅彎腰。',
      equipment_list: ['智能觸控 POS 機', '熱感應出單標籤機', '信用卡/QR 掃碼槍', '現金抽屜'],
      common_mistakes: '紙袋置於地面櫃底導致頻繁彎腰；零錢箱未預先分類造成找零延遲。',
    },
    {
      id: 'WS-02',
      name: '茶湯核心工作站 (Tea Core Station)',
      purpose: 'Feeling Tea 核心風味樞紐，專責標準茶湯注取、蔗糖定量與基底茶調配。',
      ergonomics_rule: '茶桶出水龍頭、果糖機噴嘴、電子秤皆置於手肘 45cm 水平圓弧內，兩腳站定即可注料。',
      equipment_list: ['定溫保溫茶桶 (4 桶)', '微電腦定量果糖機', '智能溫水機 (85°C)', '高精密度電子秤'],
      common_mistakes: '果糖機出糖嘴未平視量杯刻度；茶湯逾 4 小時未倒掉重泡。',
    },
    {
      id: 'WS-03',
      name: '加料與調製工作站 (Topping & Mixing)',
      purpose: '黑糖珍珠、椰果、愛玉與新鮮水果副料精準下料，冰塊量控制。',
      ergonomics_rule: '冰槽開口離吧檯面 10cm，冰鏟握柄配有止滑保護套，避免調茶師手腕隧道症候群。',
      equipment_list: ['嵌入式保溫冰槽', '副料溫控冷藏槽 (6 槽)', '長柄瀝糖漏杓', '食品級不鏽鋼冰鏟'],
      common_mistakes: '冰鏟直接插在冰塊中（重大食安缺失）；珍珠浸泡過久吸附過多糖汁。',
    },
    {
      id: 'WS-04',
      name: '雪克與封口工作站 (Shake & Seal Station)',
      purpose: '飲品均勻乳化與撞擊香氣釋放，高溫恆溫封口，雙重防漏檢查。',
      ergonomics_rule: '封口機維持 165°C 恆溫，雪克機與杯架同高，單手即可順勢推入卡槽。',
      equipment_list: ['高速旋風雪克機', '自動微電腦封膜機', '杯身擦拭瀝水架'],
      common_mistakes: '封口模具沾附糖漿未即時清潔導致杯緣漏封；未倒扣瀝乾雪克杯。',
    },
    {
      id: 'WS-05',
      name: '取餐與品檢工作站 (QC & Handover)',
      purpose: '最後出杯把關，核對品項標籤、甜度冰塊，雙手奉茶並提供暖心服務。',
      ergonomics_rule: '出杯檯面高度 105cm，便於視線直接平視顧客眼睛，傳遞微笑與問候。',
      equipment_list: ['取餐叫號顯示螢幕', '吸管與紙巾收納盒', '專用杯托外帶架'],
      common_mistakes: '單手抓著杯蓋提給客人；叫號聲音微弱低頭不看客人。',
    },
  ],
  staffMovements: STANDARD_MOVEMENTS,
  bestPractices: STORE_BEST_PRACTICES,
  hygieneStandards: HYGIENE_STANDARDS,
  cleaningSequences: [
    {
      id: 'SOP-CLEAN-01',
      title: '茶桶 90 秒換茶沖洗法',
      target_duration_seconds: 90,
      trigger_timing: '每次新煮茶湯出鍋更換茶桶時',
      steps: [
        { step_number: 1, action: '倒除舊茶並排空出水閥', duration_seconds: 15, tool_needed: '中島水槽', quality_checkpoint: '確認茶桶完全排空無殘餘積水' },
        { step_number: 2, action: '高壓熱水沖洗桶壁內膽', duration_seconds: 25, tool_needed: '80°C 熱水龍頭', quality_checkpoint: '無殘留茶垢茶膜' },
        { step_number: 3, action: '專用軟布擦洗出水嘴喉管', duration_seconds: 25, tool_needed: '黃色專用抹布 + 專用通水刷', quality_checkpoint: '出水龍頭開關無黏滯' },
        { step_number: 4, action: '噴灑 75% 酒精並倒扣瀝乾', duration_seconds: 25, tool_needed: '75% 酒精噴霧', quality_checkpoint: '置於瀝水架，貼上新茶賞味標籤' },
      ],
      success_criteria: '桶內無異味、內膽光亮如新、出水嘴潔淨無茶垢。',
    },
    {
      id: 'SOP-CLEAN-02',
      title: '果糖機 90 秒防結晶溫水清洗法',
      target_duration_seconds: 90,
      trigger_timing: '每日打烊前及下午離峰換班交接時',
      steps: [
        { step_number: 1, action: '旋下出糖嘴外蓋浸入 60°C 溫水', duration_seconds: 20, tool_needed: '60°C 溫水量杯', quality_checkpoint: '糖漿結晶快速溶解' },
        { step_number: 2, action: '專用軟毛刷刷洗內芯螺牙', duration_seconds: 25, tool_needed: '食品級圓頭毛刷', quality_checkpoint: '清除螺牙縫隙黏稠殘留' },
        { step_number: 3, action: '乾淨黃色抹布擦乾並鎖回', duration_seconds: 20, tool_needed: '黃色專用抹布', quality_checkpoint: '確認旋緊到位無傾斜' },
        { step_number: 4, action: '磅秤連續 3 次出糖校準驗證', duration_seconds: 25, tool_needed: '高精度電子秤', quality_checkpoint: '誤差在 ±0.5g 內' },
      ],
      success_criteria: '出糖流暢直落無分岔滴漏，出糖重量 100% 符合配方標準。',
    },
    {
      id: 'SOP-CLEAN-03',
      title: '水槽與排水濾網 90 秒快閃清潔法',
      target_duration_seconds: 90,
      trigger_timing: '每 2 小時巡站或煮茶後',
      steps: [
        { step_number: 1, action: '提起不鏽鋼濾網傾倒茶渣茶包', duration_seconds: 15, tool_needed: '廚餘桶', quality_checkpoint: '拍乾淨所有微小茶渣' },
        { step_number: 2, action: '專用長柄硬刷刷洗濾杯與排水孔', duration_seconds: 30, tool_needed: '紅色水槽專用刷', quality_checkpoint: '清除排水口管壁黏膜' },
        { step_number: 3, action: '注入熱水沖刷排水下水道', duration_seconds: 25, tool_needed: '高溫熱水', quality_checkpoint: '消除異味並預防油脂附著' },
        { step_number: 4, action: '歸位濾網並噴灑除臭酒精', duration_seconds: 20, tool_needed: '食品級酒精', quality_checkpoint: '水槽表面無積水' },
      ],
      success_criteria: '排水暢通無積水，濾網清澈見底，無任何發酵酸味。',
    },
    {
      id: 'SOP-CLEAN-04',
      title: '封口機 90 秒發熱模具清潔法',
      target_duration_seconds: 90,
      trigger_timing: '每日下午換班及打烊斷電後',
      steps: [
        { step_number: 1, action: '切斷電源確認模具降至微溫 (約50°C)', duration_seconds: 15, tool_needed: '電源開關', quality_checkpoint: '確保操作安全防燙傷' },
        { step_number: 2, action: '使用耐熱專用刮片刮除殘膜殘膠', duration_seconds: 30, tool_needed: '鐵氟龍專用刮片', quality_checkpoint: '嚴禁使用金屬刀片刮傷塗層' },
        { step_number: 3, action: '微濕纖維布擦拭上下壓模環', duration_seconds: 25, tool_needed: '專用擦模布', quality_checkpoint: '壓模環光亮無焦黑糖斑' },
        { step_number: 4, action: '檢視切刀微動感應器與進出軌道', duration_seconds: 20, tool_needed: '乾布', quality_checkpoint: '軌道無阻力滑順推移' },
      ],
      success_criteria: '下壓切膜完整光滑無毛邊，封膜 100% 緊密防漏。',
    },
  ],
  serviceBehaviors: [
    {
      code: 'BEH-01',
      scenario: '顧客踏入店內 1 公尺範圍 (3秒迎賓)',
      standard_dialogue: '您好！歡迎光臨 Feeling Tea，今天想喝點什麼清爽的好茶嗎？',
      body_language: '立刻放下手中非緊急動作，平視顧客眼睛，展現親切微笑與站姿端正。',
      psychological_impact: '消弭顧客進店的陌生與拘謹，建立專屬溫暖感，等候耐受度提升 40%。',
    },
    {
      code: 'BEH-02',
      scenario: '顧客反映甜度不對或口感不合 (30秒重調準則)',
      standard_dialogue: '真的非常不好意思讓您喝得不滿意！我立刻為您重調一杯微糖黃金比例，這杯請您先品嚐！',
      body_language: '第一時間絕不辯解或質疑客人，雙手接過杯子，以最快速度重做一杯並雙手遞上。',
      psychological_impact: '化客訴為忠誠度。顧客感受到「品牌對好茶的堅持」，回訪率提升 70%。',
    },
  ],
  coachingMethods: [
    {
      step_order: 1,
      name: '同理與肯定 (Empathy & Recognition)',
      instruction: '先肯定夥伴的付出與辛勞，消除夥伴被檢視的防衛心態。',
      example_script: '「小林，我看你剛才尖峰期一個人撐住茶湯站，動作很快很專注，辛苦了！」',
    },
    {
      step_order: 2,
      name: '客觀陳述事實 (Factual Observation)',
      instruction: '只說看見的事實與數據，不帶主觀情緒與批判。',
      example_script: '「不過我剛才注意到，果糖機出糖嘴邊緣有微量乾涸的糖滴，量杯倒糖時視線沒有平視刻度。」',
    },
    {
      step_order: 3,
      name: '啟發引導提問 (Guiding Question)',
      instruction: '用問題代替命令，讓夥伴自己說出因果關聯。',
      example_script: '「你覺得如果果糖機噴嘴有結晶積留，對客人喝到的甜度穩定度和口感會產生什麼影響呢？」',
    },
    {
      step_order: 4,
      name: '共同約定與示範 (Agreement & Demo)',
      instruction: '一起做一次 90 秒標準動作，建立肌肉記憶。',
      example_script: '「我們現在一起花 60 秒用溫水沖洗一下噴嘴，然後做一次量杯刻度平視，你調一杯我盲測看看好嗎？」',
    },
    {
      step_order: 5,
      name: '賦能激勵信任 (Empowerment & Trust)',
      instruction: '賦予信心，肯定其進步對整體門市品質的關鍵重要性。',
      example_script: '「太棒了！這杯的香氣跟甜度完全是研發標準的黃金比例，今天這站就交給你把關囉！」',
    },
  ],
  employeeCompetencies: [
    { title: '產品配方標準掌握度', category: '核心技能', observable_behavior: '無看小抄可在 10 秒內背出 Feeling Tea 前 10 名熱銷飲品配方 Brix、糖量與冰量。' },
    { title: '黃金動線與工效熟練', category: '吧檯運作', observable_behavior: '維持調茶站 45cm 圓弧作業，單杯出單移動步數小於 3 步。' },
    { title: '90秒快閃清潔執行力', category: '食安衛生', observable_behavior: '換茶與交班時自發落實 90 秒清潔法，三色抹布分色 100% 正確。' },
    { title: '服務溫度與眼神問候', category: '顧客體驗', observable_behavior: '做到 3 秒平視迎賓與雙手遞茶，遇到口感疑問主動啟動 30 秒免費重調。' },
  ],
  managerCompetencies: [
    { title: '10層問題穿透診斷力', category: '經營分析', observable_behavior: '門市遇客訴或卡單時，能迅速自 10 層矩陣找到根本原因而非單純責怪員工。' },
    { title: '五步引導式教練能力', category: '團隊培育', observable_behavior: '巡站回饋採同理 ➔ 客觀 ➔ 提問 ➔ 約定 ➔ 賦能，建立高心理安全感團隊。' },
    { title: '尖峰工效動線調度', category: '現場營運', observable_behavior: '依據小時單量及時啟動雙軌分流與機動手配置，消除瓶頸積單。' },
    { title: '研發品質標準守護', category: '品牌信仰', observable_behavior: '每週以糖度計抽檢茶湯與果糖機校準，堅持「不妥協每一杯好茶」。' },
  ],
  problemMemories: [
    {
      problem_title: '翡翠檸檬綠微糖仍太甜之客訴',
      category: 'quality',
      root_cause: '果糖定量機出糖嘴結晶造成每次多漏 3ml，調茶員未平視量杯刻度。',
      effectiveness_result: '啟動 90 秒溫水通嘴清洗並完成 3 次磅秤校正後，客訴歸零，甜度 Brix 穩定在 10.5±0.3。',
    },
    {
      problem_title: '下午茶外送暴增時出單嚴重積塞 18 杯',
      category: 'efficiency',
      root_cause: '調茶師頻繁跨站至封口機，取冰動線與點餐員碰撞。',
      effectiveness_result: '改行「前後雙人單向流水線」，一人專職調茶、一人專職封膜貼標，出杯時間降至 55 秒/杯。',
    },
  ],
  companyPrinciples: [
    {
      order_seq: 1,
      core_value: '品質絕不妥協 (Quality First)',
      philosophy_statement: '每一杯遞到顧客手中的飲品，都代表著 Feeling Tea 的靈魂與信譽。絕不因為客人沒發現就交出次級品。',
      operational_standard: '茶湯超過 4 小時堅決倒掉重煮；糖度計每週抽檢 Brix 偏差超過 0.5 即刻校準。',
    },
    {
      order_seq: 2,
      core_value: '標準是底線，溫暖是靈魂 (Standard & Warmth)',
      philosophy_statement: '標準化讓我們走得穩，但發自內心的真誠與看見，才能讓品牌走入顧客的心中。',
      operational_standard: '落實 3 秒平視眼神問候與 30 秒無條件免費重調政策。',
    },
    {
      order_seq: 3,
      core_value: '動線是效率，工效是關懷 (Flow & Ergonomics)',
      philosophy_statement: '設計良好的動線不只是為了出杯更快，更是為了讓夥伴站一整天依然感到舒適、不疲憊、被照顧。',
      operational_standard: '45cm 手肘黃金作業圓弧；消除 100% 逆向折返走位。',
    },
    {
      order_seq: 4,
      core_value: '數據是真相，教練是賦能 (Data & Coaching)',
      philosophy_statement: '不用猜測評價問題，用數據還原現場；不用指責對待同仁，用教練引導啟發潛能。',
      operational_standard: '10 層全景因果診斷矩陣；五步引導式教練對話 Playbook。',
    },
    {
      order_seq: 5,
      core_value: '在地深耕，共生共好 (Local & Community)',
      philosophy_statement: '每家門市都是社區好鄰居，透過 Zalo 官方帳號與在地特色，建立長久溫暖的熟客連結。',
      operational_standard: '門市專屬 Zalo OA 推播；在地天氣與午後茶點貼心關懷。',
    },
  ],
  zaloAccounts: [
    {
      store_code: 'TNN-01',
      oa_name: 'Feeling Tea 台南旗艦熟客俱樂部',
      status: '運營中 (Official Certified)',
      follower_count: 3840,
      auto_broadcast_rules: '氣溫超過 32°C 自動推播消暑鮮檸綠券；週三下午 15:00 推播辦公室團購優惠。',
    },
    {
      store_code: 'TPE-02',
      oa_name: 'Feeling Tea 台北信義尊榮會',
      status: '運營中 (Official Certified)',
      follower_count: 4210,
      auto_broadcast_rules: '下雨天推播暖心熱飲折扣碼；每月會員日發送新品搶先試飲兌換券。',
    },
    {
      store_code: 'KHH-03',
      oa_name: 'Feeling Tea 高雄巨蛋在地生活圈',
      status: '運營中 (Official Certified)',
      follower_count: 2980,
      auto_broadcast_rules: '演唱會與活動日發送快速取餐通告；週五歡聚夜買一送一限時活動。',
    },
  ],
}

