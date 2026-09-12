import {
  INITIAL_EQUIPMENT_MODELS,
  INITIAL_KNOWLEDGE_CHUNKS,
  INITIAL_REPAIR_CASES,
} from './knowledge-base'
import type {
  RepairMode,
  EquipmentCategory,
  RepairKnowledgeChunk,
  EquipmentModelInfo,
  RepairCaseFeedback,
  DiagnosticStep,
  RepairTicketDraft,
} from '@/lib/types/repair-ai'

export interface SearchOptions {
  query: string
  equipment_model?: string
  category?: EquipmentCategory
  mode: RepairMode
  dbChunks?: RepairKnowledgeChunk[]
  dbCases?: RepairCaseFeedback[]
  dbModels?: EquipmentModelInfo[]
}

export interface RetrievalResult {
  matched_model?: EquipmentModelInfo
  matched_chunks: RepairKnowledgeChunk[]
  matched_cases: RepairCaseFeedback[]
  error_code_hit?: string
  safety_alert?: string
  suggested_steps: DiagnosticStep[]
  ticket_draft?: RepairTicketDraft
}

/**
 * 混合檢索 (Hybrid Search)：精準代碼與型號匹配 + 語意/關鍵字比對 + 技師案例加權
 */
export function searchRepairKnowledge(options: SearchOptions): RetrievalResult {
  const { query, equipment_model, category, mode } = options
  const allModels = [...(options.dbModels || []), ...INITIAL_EQUIPMENT_MODELS]
  const allChunks = [...(options.dbChunks || []), ...INITIAL_KNOWLEDGE_CHUNKS]
  const allCases = [...(options.dbCases || []), ...INITIAL_REPAIR_CASES]

  const q = (query || '').toLowerCase().trim()

  // 1. 匹配機型 (Model Matching)
  let matched_model: EquipmentModelInfo | undefined
  if (equipment_model) {
    matched_model = allModels.find(
      m => m.id === equipment_model ||
           m.model_name.toLowerCase().includes(equipment_model.toLowerCase()) ||
           equipment_model.toLowerCase().includes(m.model_name.toLowerCase())
    )
  }
  if (!matched_model && q) {
    matched_model = allModels.find(m =>
      q.includes(m.model_name.toLowerCase()) ||
      q.includes(m.brand.toLowerCase()) ||
      (m.id && q.includes(m.id.toLowerCase()))
    )
  }

  // 2. 檢測常見故障代碼 (Error Code Exact Match: E01, E02, E03, E04, Touch-Drift, etc.)
  let error_code_hit: string | undefined
  const codeRegex = /\b(e0[1-9]|e[1-9]|touch-drift|blue-screen|vfd-oc)\b/i
  const match = q.match(codeRegex)
  if (match) {
    error_code_hit = match[1].toUpperCase()
  }

  // 3. 知識庫切片檢索 (Chunk Matching)
  let matched_chunks = allChunks.filter(chunk => {
    // 類別過濾
    if (category && chunk.category !== category) return false
    // 模式權限過濾：門市模式絕不呈現純技師拆機高危險內容
    if (mode === 'store' && chunk.tech_only) return false

    // 關鍵字與代碼比對
    const contentLower = (chunk.title + ' ' + chunk.content + ' ' + chunk.tags.join(' ')).toLowerCase()
    
    // 代碼命中優先
    if (error_code_hit && contentLower.includes(error_code_hit.toLowerCase())) return true

    // 型號命中優先
    if (matched_model) {
      const modelKeywords = [matched_model.brand, matched_model.model_name]
      const modelMatched = modelKeywords.some(kw => contentLower.includes(kw.toLowerCase()))
      if (modelMatched) return true
    }

    // 關鍵字檢索 (拆詞 match)
    const keywords = q.split(/[\s,，、。]+/).filter(w => w.length >= 2)
    const matchCount = keywords.filter(w => contentLower.includes(w)).length
    return matchCount >= 1
  })

  // 按相關度排序
  matched_chunks.sort((a, b) => {
    let scoreA = 0
    let scoreB = 0
    if (error_code_hit) {
      if (a.content.includes(error_code_hit)) scoreA += 10
      if (b.content.includes(error_code_hit)) scoreB += 10
    }
    if (mode === 'store' && a.safe_for_store) scoreA += 5
    if (mode === 'store' && b.safe_for_store) scoreB += 5
    if (mode === 'technician' && a.chunk_type === 'circuit_diagram') scoreA += 3
    if (mode === 'technician' && b.chunk_type === 'circuit_diagram') scoreB += 3
    return scoreB - scoreA
  })

  // 4. 技師真實案例學習庫檢索 (Case Matching)
  const matched_cases = allCases.filter(c => {
    const caseText = (c.equipment_model + ' ' + c.symptom + ' ' + c.actual_root_cause + ' ' + c.technician_note).toLowerCase()
    if (error_code_hit && caseText.includes(error_code_hit.toLowerCase())) return true
    if (matched_model && caseText.includes(matched_model.model_name.toLowerCase())) return true
    const keywords = q.split(/[\s,，、。]+/).filter(w => w.length >= 2)
    return keywords.some(k => caseText.includes(k))
  })

  // 5. 根據模式與情境建構推薦排查步驟與防呆安全警告
  const suggested_steps: DiagnosticStep[] = []
  let safety_alert: string | undefined

  if (mode === 'store') {
    safety_alert = '⚠️ 【門市安全防呆原則】嚴禁拆卸任何機殼螺絲或碰觸電路板！發熱模具高達 160°C 以上有燙傷危險，若有冒煙、異味或跳電，請立即拔除總電源並報修。'

    if (error_code_hit === 'E01' || q.includes('加熱') || q.includes('不熱') || q.includes('溫度')) {
      suggested_steps.push(
        {
          step_number: 1,
          title: '確認總電源與面板開關',
          instruction: '檢查面板上的「加熱開關」是否切換至 ON，且設定溫度是否在 160°C~180°C。',
          check_type: 'restart',
          expected_normal: '面板加熱指示紅燈亮起，溫度數字緩慢爬升。',
          if_failed_action: '若開關已開但溫度數字一直為 0°C 或 999°C，為感溫線失效，請直接按下方「一鍵報修」。',
          requires_technician: false,
        },
        {
          step_number: 2,
          title: '檢查機體散熱與電源線',
          instruction: '確認後方插頭未鬆動，機身散熱孔未被抹布、塑膠袋遮擋阻礙散熱。',
          check_type: 'visual',
          expected_normal: '電源線無發燙、無焦味。',
          if_failed_action: '若發燙或聞到異味，立刻切斷電源開關並拔掉插頭！',
          requires_technician: true,
        },
        {
          step_number: 3,
          title: '等待 3 分鐘重啟測試',
          instruction: '將機器電源關閉 30 秒後重新開機，觀察面板是否依然報 E01。',
          check_type: 'restart',
          expected_normal: '重啟後正常加熱至設定值。',
          if_failed_action: '若重啟 3 次仍報 E01，確認內部加熱管或繼電器損壞，觸發門市報修。',
          requires_technician: true,
        }
      )
    } else if (error_code_hit === 'E04' || q.includes('電眼') || q.includes('膠膜') || q.includes('不捲')) {
      suggested_steps.push(
        {
          step_number: 1,
          title: '檢查膠膜安裝方向與黑標位置',
          instruction: '確認膠膜黑標（光電色標）朝向機器右側（電眼側），未裝反或偏位。',
          check_type: 'consumable',
          expected_normal: '黑標正對電眼紅色感應光斑。',
          if_failed_action: '重新拆卸膠膜依機殼上穿紙示意圖重新安裝。',
          requires_technician: false,
        },
        {
          step_number: 2,
          title: '微濕無塵布清潔電眼鏡頭',
          instruction: '拿乾淨棉布或無塵紙沾極少量清水（勿滴水），仔細擦拭電眼紅色透明鏡片表面茶漬與糖液。',
          check_type: 'cleaning',
          expected_normal: '鏡面透亮無茶垢，手動拉過黑標時電眼綠色信號燈亮起。',
          if_failed_action: '若擦乾淨後綠燈仍恆亮或恆滅，請報修更換電眼模組。',
          requires_technician: false,
        },
        {
          step_number: 3,
          title: '確認進杯軌道無異物卡料',
          instruction: '檢查滑軌兩側有無掉落之吸管套、殘膠或茶湯結晶黏結。',
          check_type: 'visual',
          expected_normal: '軌道順暢無障礙物。',
          if_failed_action: '清潔擦拭軌道後重新測試。',
          requires_technician: false,
        }
      )
    } else if (q.includes('果糖') || q.includes('出糖') || q.includes('不準') || q.includes('滴糖')) {
      suggested_steps.push(
        {
          step_number: 1,
          title: '溫水浸泡出糖嘴',
          instruction: '以裝有約 60°C 溫水之馬克杯由下往外套住果糖機出糖嘴，浸泡 5~10 分鐘軟化結晶硬糖。',
          check_type: 'cleaning',
          expected_normal: '糖嘴結晶融化，下糖流暢無分叉。',
          if_failed_action: '若仍堵塞，依規範旋下十字閥在水槽以溫水沖洗。',
          requires_technician: false,
        },
        {
          step_number: 2,
          title: '電子秤單杯出糖比重校準',
          instruction: '將電子秤放於出糖口歸零，按壓「全糖 (25cc)」鍵，量測是否為 32.5g (±1g)。',
          check_type: 'consumable',
          expected_normal: '重量落在 31.5g ~ 33.5g 之間。',
          if_failed_action: '進入面板校準模式增減脈衝補正值。若重複校準仍偏差超過 3g，需技師清洗流量計。',
          requires_technician: false,
        }
      )
    } else if (q.includes('錢箱') || q.includes('出單機') || q.includes('印表機') || q.includes('印單')) {
      suggested_steps.push(
        {
          step_number: 1,
          title: '確認出單機燈號與電源',
          instruction: '檢查出單機前方面板 Power 綠燈是否恆亮。若 Error 紅燈閃爍表示缺紙或上蓋未蓋緊。',
          check_type: 'visual',
          expected_normal: 'Power 綠燈常亮，無紅燈閃爍。',
          if_failed_action: '補充熱敏紙卷（注意感熱塗層面朝上），用力壓緊上蓋發出喀答聲。',
          requires_technician: false,
        },
        {
          step_number: 2,
          title: '檢查出單機背後錢箱 RJ12 訊號線',
          instruction: '確認出單機背後的黑色 RJ12 水晶頭電話線緊密插於 Cash Drawer 連接埠，未脫落。',
          check_type: 'consumable',
          expected_normal: '接頭穩固無搖晃。',
          if_failed_action: '拔出重新插緊。',
          requires_technician: false,
        },
        {
          step_number: 3,
          title: '檢查錢箱鎖芯與滑軌異物',
          instruction: '用隨機實體鑰匙手動轉動鎖芯開鎖，拉出錢箱抽屜檢查底下是否有掉落的硬幣或迴紋針卡死滑軌。',
          check_type: 'cleaning',
          expected_normal: '抽屜手動拉出順滑無卡滯。',
          if_failed_action: '清除掉落異物並以乾布擦拭滑軌。',
          requires_technician: false,
        }
      )
    }
  } else {
    // 專業技師工程模式
    safety_alert = '⚡ 【技師機電作業規範】進行阻值量測前必須完全切斷總電源；進行帶電電壓測量時請佩戴絕緣手套，探針嚴禁搭鐵短路！'

    if (error_code_hit === 'E01' || q.includes('加熱') || q.includes('溫度')) {
      suggested_steps.push(
        {
          step_number: 1,
          title: '斷電量測加熱圈/發熱管阻值 (Ω)',
          instruction: '切斷 220V 總電源，拆下側板，將三用電表切至 2000Ω 電阻檔，探針測量加熱管兩端導線接點。',
          check_type: 'multimeter_ohms',
          expected_normal: '220V 90W 發熱管正常阻值約 520Ω~540Ω (110V 90W 約 130Ω~140Ω)。',
          if_failed_action: '若測得電阻為無窮大 (OL/開路)，確認發熱絲燒斷，更換加熱管 (料號: YF-HT-090)。',
          requires_technician: true,
        },
        {
          step_number: 2,
          title: '量測主板對 SSR 固態繼電器之直流控制電壓',
          instruction: '通電並在面板啟動加熱，以電表直流 20V 檔量測 SSR 輸入端 3/4 腳 (+ - 直流控制端)。',
          check_type: 'voltage',
          expected_normal: '主板輸出 12VDC (或 5VDC~24VDC) 觸發信號，SSR 表面指示紅燈點亮。',
          if_failed_action: '若有 12VDC 觸發信號但交流輸出端 1/2 腳無 220VAC 導通，判定 SSR 擊穿開路，更換 SSR-25DA。',
          requires_technician: true,
        }
      )
    } else if (error_code_hit === 'E02' || q.includes('凸輪') || q.includes('微動') || q.includes('下壓')) {
      suggested_steps.push(
        {
          step_number: 1,
          title: '手動逆時針手轉馬達軸心復歸',
          instruction: '斷電後以十字起子或手旋後方馬達軸芯讓凸輪機構回位至上死點。',
          check_type: 'mechanical_cam',
          expected_normal: '凸輪平順轉動，上極限微動開關觸片被壓下發出清脆喀答聲。',
          if_failed_action: '若轉動阻力極大，檢查齒輪箱有無崩齒或切刀軸承卡死。',
          requires_technician: true,
        },
        {
          step_number: 2,
          title: '三用電表蜂鳴檔測量微動開關導通性',
          instruction: '探針搭在微動開關 COM 與 NO/NC 端子，手按觸片測試導通阻值。',
          check_type: 'multimeter_ohms',
          expected_normal: '按壓時電表發出蜂鳴聲且阻值小於 0.5Ω。',
          if_failed_action: '若阻值超過 5Ω 或不響，代表接點嚴重氧化電弧燒蝕，更換凸輪微動開關 (料號: YF-SW-V15)。',
          requires_technician: true,
        }
      )
    } else if (q.includes('錢箱') || q.includes('24v') || q.includes('出單機')) {
      suggested_steps.push(
        {
          step_number: 1,
          title: '量測出單機 Cash Drawer Port 脈衝電壓',
          instruction: '三用電表直流 50V 檔，探針插入出單機 RJ12 接孔 PIN 2 與 PIN 4，於 POS 執行收銀結帳。',
          check_type: 'voltage',
          expected_normal: '結帳瞬間量測到 24VDC 脈衝訊號（約 100~200ms）。',
          if_failed_action: '若無 24V 脈衝，出單機內部驅動晶片損壞，更換出單機或更換驅動三極管。',
          requires_technician: true,
        },
        {
          step_number: 2,
          title: '量測錢箱電磁閥線圈阻值',
          instruction: '拔出 RJ12 接頭量測錢箱端線圈電阻。',
          check_type: 'multimeter_ohms',
          expected_normal: '電磁閥線圈正常阻值約在 24Ω~30Ω (24V/1A 電磁鐵)。',
          if_failed_action: '若為 0Ω (短路) 或無窮大 (開路斷線)，更換錢箱電磁吸鐵總成。',
          requires_technician: true,
        }
      )
    }
  }

  // 6. 若為門市模式且有具體故障碼或排除失敗，自動預填報修單草稿
  let ticket_draft: RepairTicketDraft | undefined
  if (mode === 'store' && (error_code_hit || q.includes('無法') || q.includes('壞') || q.includes('卡住') || q.includes('報修'))) {
    const eqName = matched_model?.model_name || '門市吧檯設備'
    ticket_draft = {
      store: 'FEELING TEA 門市',
      equipment_name: eqName,
      equipment_model: matched_model?.brand ? `${matched_model.brand} ${matched_model.model_name}` : eqName,
      error_code: error_code_hit,
      symptom_summary: `現場設備回報：${q}${error_code_hit ? ` (代碼: ${error_code_hit})` : ''}`,
      steps_already_tried: [
        '已執行門市免拆機外觀檢查與電源重啟',
        '已確認電源線穩固、插座未跳脫',
        '已落實清潔擦拭與異物排除，問題依舊存在',
      ],
      urgency: (error_code_hit === 'E01' || error_code_hit === 'E02') ? 'urgent' : 'high',
      suggested_parts_for_tech: matched_model?.standard_parts?.map(p => `${p.name} (${p.part_code})`) || [
        '相關替換備品與三用電表測量設備',
      ],
      ready_to_submit: true,
    }
  }

  return {
    matched_model,
    matched_chunks: matched_chunks.slice(0, 5),
    matched_cases: matched_cases.slice(0, 3),
    error_code_hit,
    safety_alert,
    suggested_steps,
    ticket_draft,
  }
}

/**
 * 主動冷啟動推導 (Cold Start Generator)：基於通用機電與工控狀態機公理推導
 */
export function inferColdStartEquipment(params: {
  brand: string
  model_name: string
  category: EquipmentCategory
}): EquipmentModelInfo {
  const { brand, model_name, category } = params
  const id = `eq-cold-${Date.now()}`

  if (category === 'bar') {
    return {
      id,
      brand,
      model_name,
      category,
      description: `【自動冷啟動推導】${brand} ${model_name} 門市水吧機電設備，具備加熱溫控、微電腦控制板與傳動機械結構。`,
      state_machine_steps: [
        '1. 通電待機：微電腦主板自檢，各感測器（溫度、位置微動）就緒。',
        '2. 觸發信號：人員按鍵操作或杯口接觸微動開關。',
        '3. 執行動作：馬達或電磁閥帶動機構執行密封、注糖或萃取。',
        '4. 回授檢測：極限開關或流量/光電感應器回傳終點訊號。',
        '5. 模組復歸：彈簧或逆轉機構使組件回復待機基準點。',
      ],
      common_error_codes: [
        {
          code: 'E01',
          symptom: '加熱超時 / 感溫器開路',
          cause: '加熱棒燒毀或熱敏電阻開路',
          store_action: '確認設定溫度，勿拆機，若聞到焦味立刻斷電。',
          tech_action: '量測加熱絲電阻 (正常 50~500Ω)；檢查 SSR 觸發電壓。',
          parts: '標準發熱管、固態繼電器',
        },
        {
          code: 'E02',
          symptom: '機械傳動逾時或行程卡死',
          cause: '微動開關接觸不良、齒輪卡料或同步帶斷裂',
          store_action: '檢查是否有吸管或杯料卡入齒輪縫隙，切斷電源。',
          tech_action: '手轉馬達軸心確認卡滯點，電表量測極限微動開關導通性。',
          parts: '滾輪式微動開關、減速馬達',
        },
        {
          code: 'E04',
          symptom: '感測器回授中斷',
          cause: '鏡頭髒污或信號排線脫落',
          store_action: '乾布擦拭感應頭表面糖水茶漬。',
          tech_action: '微調電位器感度，檢查主板 5V 信號線。',
          parts: '光電感測模組',
        },
      ],
      standard_parts: [
        { part_code: 'BAR-HT-STD', name: '標準電熱棒/片', spec: '220V 100W~1500W', estimated_cost: 350000 },
        { part_code: 'BAR-SW-MICRO', name: '高耐久微動開關', spec: '16A 250VAC 常開/常閉', estimated_cost: 75000 },
        { part_code: 'BAR-SSR-25A', name: '固態繼電器', spec: 'DC-AC 25A 帶指示燈', estimated_cost: 220000 },
      ],
    }
  } else if (category === 'it_pos') {
    return {
      id,
      brand,
      model_name,
      category,
      description: `【自動冷啟動推導】${brand} ${model_name} 門市商用資訊硬體，含工控主機板、觸控面板或熱感列印機芯。`,
      state_machine_steps: [
        '1. DC 供電自檢：變壓器輸出 12V/24V 純淨直流電。',
        '2. BIOS / 韌體握手：通訊序列埠或 USB 握手建立連線。',
        '3. 驅動與應用層監聽：等待 POS 點單指令或列印任務。',
        '4. 動作執行：出單機加熱印字/切刀驅動，或螢幕電容坐標回報。',
      ],
      common_error_codes: [
        {
          code: 'OFFLINE',
          symptom: '裝置斷線 / 無通訊響應',
          cause: 'USB/網線鬆脫、交換機埠口假死或驅動連接埠變更',
          store_action: '重插線路水晶頭，重新開關印表機與主機電源。',
          tech_action: 'Ping 測試 IP 封包；以專用工具測試 Virtual COM Port 狀態。',
          parts: '工業級網路線、專用變壓器',
        },
        {
          code: 'JAM / PAPER',
          symptom: '卡紙 / 缺紙燈閃爍 / 裁刀卡死',
          cause: '熱敏紙受潮變形、裁刀未復歸或紙屑纏繞膠輥',
          store_action: '手轉側邊轉輪使切刀回位，更換全新乾燥紙卷。',
          tech_action: '清理打印頭積膠，以異丙醇酒精擦拭熱敏元件。',
          parts: '自動裁刀總成、熱敏印字頭',
        },
      ],
      standard_parts: [
        { part_code: 'POS-PWR-24V', name: '商用 24V 2.5A 變壓器', spec: 'DC24V 三孔帶接地', estimated_cost: 450000 },
        { part_code: 'POS-CUT-80', name: '80mm 自動鋼刀切刀組', spec: '雙刃剪刀式壽命 150 萬次', estimated_cost: 380000 },
      ],
    }
  } else {
    return {
      id,
      brand,
      model_name,
      category,
      description: `【自動冷啟動推導】${brand} ${model_name} 中央廚房大型動力設備，含三相 380V/220V 電機、變頻調速與重型傳動。`,
      state_machine_steps: [
        '1. 迴路安全確認：急停開關 (E-Stop) 未觸發，護罩安全感知正常。',
        '2. 主接觸器吸合：變頻器上電待機，溫控儀自檢。',
        '3. 攪拌/泵浦平穩加速：變頻器依預設斜率驅動馬達。',
        '4. 連續熱工製程：溫控閉環控制燃氣閥或蒸汽比例閥。',
      ],
      common_error_codes: [
        {
          code: 'TRIP-OL',
          symptom: '馬達過載跳脫 / 異音',
          cause: '鍋底積炭阻力過大、減速機軸承磨損或變頻器過載保護',
          store_action: '立即按壓紅色急停開關 (E-Stop)，靜置等待專業工務。',
          tech_action: '量測馬達三相阻值平衡度；檢查變頻器報錯代碼與散熱風扇。',
          parts: '重型變頻器、耐磨特氟龍刮板',
        },
      ],
      standard_parts: [
        { part_code: 'FAC-ESTOP-01', name: '急停按鈕開關組', spec: '旋轉復位 1NO1NC', estimated_cost: 120000 },
        { part_code: 'FAC-VFD-22K', name: '向量型變頻器', spec: '三相 2.2KW 輕重載通用', estimated_cost: 1850000 },
      ],
    }
  }
}
