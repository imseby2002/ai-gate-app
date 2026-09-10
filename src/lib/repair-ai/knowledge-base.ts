import type {
  EquipmentModelInfo,
  RepairKnowledgeChunk,
  RepairCaseFeedback,
} from '@/lib/types/repair-ai'

// 1. 預載標竿設備型號清單
export const INITIAL_EQUIPMENT_MODELS: EquipmentModelInfo[] = [
  // 益芳封口機
  {
    id: 'eq-yifang-et99s',
    brand: '益芳 (Y-FANG)',
    model_name: 'ET-99S 微電腦自動封口機',
    category: 'bar',
    description: '奶茶吧檯主力封口設備，採凸輪微動開關、發熱板溫控與紅外線電眼尋標。',
    state_machine_steps: [
      '1. 待機 (電眼紅燈恆亮，溫度到達 165°C)',
      '2. 進杯 (杯口微動開關觸發，滑軌馬達將承杯座送入機內)',
      '3. 壓膜與切膜 (凸輪下極限觸發，發熱模下壓保溫約 1.2 秒並切斷膠膜)',
      '4. 模組復歸 (凸輪上極限微動觸發，下壓模回升)',
      '5. 退杯 (滑軌退回出杯口，等待人員取杯)',
      '6. 捲膜 (收膜馬達運轉，電眼感測黑標阻斷信號即停)',
    ],
    common_error_codes: [
      {
        code: 'E01',
        symptom: '發熱板溫度異常或無法加熱',
        cause: '熱敏電阻開路、加熱棒燒毀或固態繼電器 (SSR) 故障',
        store_action: '檢查面板設定溫度是否在 160°C~180°C。若完全不熱且聞到異味，切斷總電源等待技師。',
        tech_action: '斷電量測加熱棒兩端阻值 (正常約 70~90Ω)；通電檢測主板對 SSR 之 12V 觸發電壓。',
        parts: '90W 加熱管 (料號: YF-HT-090)、25A 固態繼電器 (料號: SSR-25DA)',
      },
      {
        code: 'E02',
        symptom: '上模機構下壓超時或卡住無法回升',
        cause: '凸輪微動開關接點氧化、杯子太高夾杯、或減速齒輪卡死',
        store_action: '絕對禁止伸手硬扳！關閉總電源，檢查杯子是否變形卡在上模切刀處。',
        tech_action: '手動逆時針轉動後方馬達軸心讓模組復位，三用電表蜂鳴檔測量上/下極限微動開關導通性。',
        parts: '凸輪微動開關 (料號: SW-CAM-V15)、傳動同步齒輪',
      },
      {
        code: 'E04',
        symptom: '電眼尋標異常 / 膠膜持續旋轉不停',
        cause: '膠膜安裝方向反了、電眼鏡頭沾染茶漬糖水、或電眼信號線斷路',
        store_action: '檢查膠膜黑標是否朝向機器右側；拿乾淨微濕棉布擦拭電眼紅色光斑處的鏡頭。',
        tech_action: '微調電眼感度電位器（轉至黑標亮綠燈、透明處滅燈）；檢查排線第 3 PIN 對地 5V 信號。',
        parts: '光電電眼感測器 (料號: YF-EYE-SN04)',
      },
    ],
    standard_parts: [
      { part_code: 'YF-HT-090', name: '90W 環形發熱管', spec: '220V 90W 內徑95mm', estimated_cost: 350000 },
      { part_code: 'YF-SW-V15', name: '凸輪微動開關', spec: '16A 250VAC 滾輪型', estimated_cost: 85000 },
      { part_code: 'YF-EYE-01', name: '高靈敏紅光電眼', spec: 'NPN 常開型 10-30VDC', estimated_cost: 450000 },
      { part_code: 'YF-BLADE-95', name: '齒狀圓形切刀', spec: '高碳鋼直徑95mm', estimated_cost: 280000 },
    ],
  },
  // 定量果糖機
  {
    id: 'eq-fructose-ft16',
    brand: '益芳 / 宏茂',
    model_name: 'FT-16 鍵智能定量果糖機',
    category: 'bar',
    description: '茶飲甜度定量控制核心設備，採齒輪泵、流量計回饋與桶底伴熱保溫圈。',
    state_machine_steps: [
      '1. 待機 (糖溫維持於 35°C~40°C，防止結晶)',
      '2. 按鍵觸發 (點選全糖 25cc 或微糖 10cc)',
      '3. 齒輪泵啟動 (直流無刷馬達帶動齒輪吸入果糖)',
      '4. 流量計脈衝計量 (每旋轉一週輸出固定脈衝回傳主板)',
      '5. 截斷停糖 (到達目標脈衝立即逆轉微抽防止滴糖)',
    ],
    common_error_codes: [
      {
        code: 'E01 / 出糖不準',
        symptom: '出糖量明顯變少或多次出糖克數漂移超過 ±2g',
        cause: '出口糖嘴果糖結晶堵塞、保溫圈損壞導致糖液變稠、或流量計積糖黏滯',
        store_action: '以 60°C 溫水杯浸泡出糖嘴 5 分鐘溶化結晶；用量杯與電子秤重新執行單鍵出糖校準。',
        tech_action: '拆解流量計清洗內部葉輪；量測保溫矽膠加熱帶阻值 (正常約 120~150Ω)；檢查齒輪泵磨損度。',
        parts: '流量計葉輪總成 (料號: FT-FM-02)、伴熱保溫帶 (料號: FT-HT-BELT)',
      },
      {
        code: 'E03 / 馬達卡死',
        symptom: '按鍵後發出嗡嗡異音但不出糖',
        cause: '硬質糖石卡死齒輪間隙、或齒輪減速軸承磨損',
        store_action: '立刻關閉電源切勿連續按壓！避免馬達線圈燒毀，通知技師前來拆洗泵體。',
        tech_action: '手動拆卸食品級 POM 齒輪泵腔，清除異物糖石；檢查驅動馬達 24VDC 供電與電容。',
        parts: '食品級驅動齒輪組 (料號: FT-GEAR-POM)',
      },
    ],
    standard_parts: [
      { part_code: 'FT-FM-02', name: '霍爾流量計總成', spec: '0.1-1.5L/min 5V脈衝', estimated_cost: 320000 },
      { part_code: 'FT-HT-BELT', name: '矽膠外貼加熱帶', spec: '220V 45W 帶溫控器', estimated_cost: 180000 },
      { part_code: 'FT-VALVE-SIL', name: '防滴漏矽膠十字閥', spec: '耐溫矽膠 1/2牙', estimated_cost: 45000 },
    ],
  },
  // POS 機與出單設備
  {
    id: 'eq-pos-touch-j6412',
    brand: '商用觸控 POS 主機',
    model_name: 'POS-1560 雙屏電容觸控收銀機',
    category: 'it_pos',
    description: '門市收銀、點單、外送整合核心工控電腦，運行 Win10 IoT。',
    common_error_codes: [
      {
        code: 'Touch-Drift',
        symptom: '觸控失靈、亂跳或特定區域點擊無反應',
        cause: '螢幕邊框水氣油漬積累產生假觸控點、或變壓器接地不良產生靜電干擾',
        store_action: '使用純酒精乾棉布沿著螢幕邊框縫隙仔細擦拭；檢查變壓器插頭是否有三孔正確接地。',
        tech_action: '開啟 Windows 裝置管理員重新安裝 USB HID Touch 驅動；更換 12V 5A 純淨波形變壓器測試。',
        parts: '15.6吋十點電容觸控屏 (料號: POS-TP-156)',
      },
      {
        code: 'Blue-Screen',
        symptom: '頻繁當機藍底白字或自動無故重啟',
        cause: 'CPU 風扇積塵過熱 (熱保護)、記憶體金手指氧化、或固態硬碟壞軌',
        store_action: '確認主機後方散熱孔未被杯蓋、包裝袋遮擋。',
        tech_action: '拆殼清除風扇灰塵重新塗抹散熱膏；橡皮擦清潔 DDR4 記憶體金手指；檢查主板固態電容。',
        parts: 'DDR4 8GB 記憶體、工業級 128G SSD',
      },
    ],
  },
  // 熱敏出單機 / 標籤機
  {
    id: 'eq-printer-epson-t82',
    brand: 'EPSON / Xprinter',
    model_name: 'TM-T82III 80mm 熱敏出單機',
    category: 'it_pos',
    description: '櫃台結帳單與水吧廚打單據主力機，支援切刀自動裁紙與錢箱連動。',
    common_error_codes: [
      {
        code: 'Error-LED-Flash',
        symptom: '紅燈閃爍、蜂鳴器連響且裁刀卡住按不動',
        cause: '紙卷用盡、紙捲卡刀槽、或手動更換紙捲未壓緊上蓋',
        store_action: '打開出單機前蓋，順時針撥動切刀手動轉輪使裁刀回位，確認熱敏紙面朝上重新放紙壓緊。',
        tech_action: '檢測切刀微動開關（Home Sensor）；清潔打印頭膠輥表面紙屑黏膠。',
        parts: 'TM-T82 自動裁刀總成 (料號: EP-CUT-82)',
      },
      {
        code: 'Network-Offline',
        symptom: '點單後出單機完全無反應 (通訊中斷)',
        cause: 'RJ45 網路線鬆脫、交換機當機或 IP 衝突',
        store_action: '檢查出單機背後網線綠燈是否閃爍；重開印表機與吧台交換機電源。',
        tech_action: '確認固定 IP 設定 (如 192.168.1.200)；以筆電 Ping 測試封包回應；檢查驅動虛擬連接埠。',
        parts: '8 埠千兆工業交換機',
      },
    ],
  },
  // 中央工廠設備
  {
    id: 'eq-factory-sugar-cooker',
    brand: '中央廚房自動炒糖機',
    model_name: 'SC-150L 變頻刮底自動炒糖機',
    category: 'factory',
    description: '中央廚房焦糖、黑糖大批量均勻熬煮設備，配備行星刮底攪拌與自動點火溫控。',
    common_error_codes: [
      {
        code: 'VFD-OC / 變頻過載',
        symptom: '攪拌運轉數分鐘後跳脫，減速機發出異音',
        cause: '糖漿冷卻黏度過高、攪拌槳刮底特氟龍條變形卡死鍋底、或減速箱缺油',
        store_action: '立刻按壓急停開關 (E-Stop)！檢查鍋底是否有大塊焦炭硬塊卡住攪拌葉。',
        tech_action: '檢查變頻器報錯代碼 (如 OC1/OL)；檢查三相馬達繞組阻值平衡度；調整減速機潤滑油。',
        parts: '耐溫特氟龍刮底板 (料號: SC-TEF-150)、變頻器 2.2KW',
      },
    ],
  },
]

// 2. 預載 RAG 知識庫切片 (包含原廠代碼、電路、SOP、零件料號)
export const INITIAL_KNOWLEDGE_CHUNKS: RepairKnowledgeChunk[] = [
  {
    id: 'chk-yf-01',
    equipment_model: '益芳-ET-99S',
    category: 'bar',
    chunk_type: 'error_code',
    title: '益芳封口機 E01~E04 故障代碼速查手冊 (2026 原廠修訂版)',
    content: `【E01 - 發熱板異常】
- 原理：微電腦主板未在 5 分鐘內檢測到發熱模溫度上升達設定值。
- 門市人員處置 (免拆機)：確認面板加熱開關是否切至 ON；確認設定溫度為 165°C。若溫度顯示一直為 0°C 或 999°C，為感溫線斷路，請直接報修。
- 技師處置 (拆機)：
  1. 測量發熱管阻值 (R = V^2 / P)，220V 90W 發熱管正常阻值應在 530Ω 左右；110V 90W 應在 135Ω 左右。若阻值無限大表示加熱管已燒斷。
  2. 檢查主板輸出給固態繼電器 (SSR) 的直流控制端是否有 12VDC 電壓；若有 12V 觸發但 AC 輸出端未導通，更換 SSR-25DA。

【E02 - 上模切膜逾時 / 夾杯】
- 門市處置：立刻關閉總電源防高溫燙手，等待 3 分鐘散熱，確認有無膠膜纏繞在切刀或杯身破損卡死。
- 技師處置：檢查上極限與下極限凸輪微動開關 (Cam Switch)。手撥開關聽是否有清脆喀答聲，電表量測常開/常閉接點阻值是否小於 0.5Ω。

【E04 - 電眼尋標異常】
- 門市處置：膠膜黑標必須朝向機身電眼側。以無塵布沾微量清水擦拭電眼紅色透明鏡片表面糖水茶污。
- 技師處置：電眼感度微調紐順時針調敏、逆時針調鈍。若綠燈恆亮或恆滅無反應，更換電眼接收模組。`,
    source_file: '益芳原廠維修作業規範_V4.pdf',
    safe_for_store: true,
    tech_only: false,
    tags: ['益芳', '封口機', 'E01', 'E02', 'E04', '電眼', '發熱管'],
    created_at: '2026-09-10T08:00:00Z',
  },
  {
    id: 'chk-ft-02',
    equipment_model: '定量果糖機-FT-16',
    category: 'bar',
    chunk_type: 'maintenance_sop',
    title: '定量果糖機每週出糖校準與出糖嘴熱水浸泡清洗 SOP',
    content: `【門市免拆機每週保養流程】：
1. 準備工具：量杯、精準度 0.1g 之電子秤、60°C 溫水 (禁止使用滾燙沸水以免矽膠閥變形)。
2. 出糖嘴浸泡：將裝有溫水的馬克杯套入果糖機出糖嘴，浸泡 5-10 分鐘使殘留乾涸糖蜜充分融化。
3. 拆卸清洗防滴漏十字閥：將出糖嘴前端旋開，取出透明矽膠十字閥沖水清洗後裝回。
4. 電子秤校準程序：
   - 長按面板「校準/設定」鍵 3 秒進入校準模式。
   - 拿電子秤去皮，按壓「全糖 (25cc)」出糖。
   - 秤得實際克數 (如 32.5g，果糖比重約 1.3g/cc，25cc 應為 32.5g)。
   - 若重量不足或過量，透過 ▲ ▼ 按鍵增減脈衝補正值，再按確定儲存。`,
    source_file: '門市果糖機日常清潔與精準校準手冊.docx',
    safe_for_store: true,
    tech_only: false,
    tags: ['果糖機', '校準', '出糖嘴', '清潔SOP', '門市端'],
    created_at: '2026-09-10T08:00:00Z',
  },
  {
    id: 'chk-pos-03',
    equipment_model: 'POS-1560',
    category: 'it_pos',
    chunk_type: 'circuit_diagram',
    title: 'POS 主機與出單機錢箱連動排線與供電排查指南',
    content: `【錢箱彈不開排查順序】：
1. 錢箱驅動並非由 POS 主機主板直接輸出 24V，而是由 POS 透過 USB 送指令給「出單機」，出單機後方的 RJ12 錢箱接口輸出瞬間 24V 脈衝將錢箱電磁閥吸合彈開。
2. 門市排查：
   - 檢查出單機是否正常開機且未報錯（出單機若缺紙紅燈閃爍，錢箱就不會彈開！）。
   - 檢查出單機背面連接到錢箱的黑線 (RJ12 水晶頭) 是否鬆脫。
   - 用實體鑰匙轉動錢箱鎖芯測試有無卡死，拉出抽屜檢查底層是否有硬幣、迴紋針掉入滑軌縫隙卡死。
3. 技師排查：
   - 電表直流檔探針插入出單機 Cash Drawer Port 的 PIN 2 與 PIN 4，在 POS 按結帳測試有無 24V 脈衝。
   - 若無脈衝 ➔ 出單機驅動晶片損壞；若有脈衝但錢箱不彈 ➔ 錢箱電磁鐵線圈斷路，更換電磁閥組件。`,
    source_file: 'IT硬體工程維修筆記_錢箱與出單機篇.xlsx',
    safe_for_store: true,
    tech_only: false,
    tags: ['POS', '錢箱', '出單機', 'RJ12', '24V', '電磁閥'],
    created_at: '2026-09-10T08:00:00Z',
  },
]

// 3. 技師修復真實案例學習庫 (回饋閉環)
export const INITIAL_REPAIR_CASES: RepairCaseFeedback[] = [
  {
    id: 'case-20260901-01',
    order_id: 'RO-202609-0012',
    equipment_model: '益芳-ET-99S',
    symptom: '門市回報 E04 電眼報警，且門市已用酒精擦拭鏡面 3 次仍無效。',
    actual_root_cause: '電眼排線遭機身內部金屬邊緣磨損，造成 5V 供電線間歇性搭鐵短路。',
    parts_replaced: '更換 4-PIN 防磨屏蔽電眼排線 (料號: YF-CB-4P)',
    measured_resistance_or_voltage: '更換前供電電壓降至 1.8V，更換後恢復標準 5.02V。',
    technician_note: '此機型內部走線易受振動摩擦，已加套耐磨螺旋管保護。已將此情境歸檔至 AI 故障樹。',
    verified_by: '資深機電技師 王建國',
    created_at: '2026-09-01T15:30:00Z',
  },
  {
    id: 'case-20260905-02',
    order_id: 'RO-202609-0038',
    equipment_model: '定量果糖機-FT-16',
    symptom: '出糖持續偏少，多次校準後隔日又失準。',
    actual_root_cause: '伴熱帶發熱絲斷路，糖桶溫度降至室溫，低溫高黏度果糖造成齒輪泵打滑。',
    parts_replaced: '更換 45W 矽膠伴熱加熱帶 (料號: FT-HT-BELT)',
    measured_resistance_or_voltage: '原伴熱帶測得電阻為無窮大 (開路斷線)，新品阻值 135Ω。',
    technician_note: '秋冬季氣溫下降時，果糖流速變慢請優先量測伴熱帶電阻。',
    verified_by: '工務組長 李明遠',
    created_at: '2026-09-05T18:00:00Z',
  },
]
