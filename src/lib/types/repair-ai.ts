/**
 * 奶茶門市與工廠設備＋門市 POS/電腦軟硬體「維修 AI 助理」領域模型與型別定義
 */

// 1. 雙模式分流
export type RepairMode = 'store' | 'technician'

// 2. 設備三大類別
export type EquipmentCategory =
  | 'bar'      // 門市吧檯設備 (封口機、果糖機、萃茶機、熱水機、製冰機)
  | 'factory'  // 中央工廠設備 (炒糖機、大容量煮茶鍋、循環泵)
  | 'it_pos'   // 資訊與電腦軟硬體 (POS主機、出單機、標籤機、網路交換機、錢箱)

// 3. 知識庫切片類型
export type KnowledgeChunkType =
  | 'error_code'           // 故障代碼表 (E01~E09)
  | 'circuit_diagram'      // 線路與電路接線圖
  | 'troubleshooting_tree' // 故障樹排查步驟
  | 'maintenance_sop'      // 清潔保養 SOP
  | 'exploded_view'        // 零件爆炸圖與料號
  | 'real_case'            // 技師修復回饋真實案例

// 4. 設備型號資料
export interface EquipmentModelInfo {
  id: string
  brand: string
  model_name: string
  category: EquipmentCategory
  description: string
  state_machine_steps?: string[]
  common_error_codes?: {
    code: string
    symptom: string
    cause: string
    store_action: string
    tech_action: string
    parts?: string
  }[]
  standard_parts?: {
    part_code: string
    name: string
    spec: string
    estimated_cost?: number
  }[]
  created_at?: string
}

// 5. RAG 知識庫切片
export interface RepairKnowledgeChunk {
  id: string
  equipment_model: string      // 如 "益芳-ET-99S", "定量果糖機-FT-16"
  category: EquipmentCategory
  chunk_type: KnowledgeChunkType
  title: string
  content: string
  source_file?: string         // 來源檔案名稱 (PDF/Excel)
  safe_for_store: boolean      // 是否適合門市人員執行 (免拆機、防呆、安全)
  tech_only: boolean           // 是否為技師專用 (拆機、測量阻值、改線路)
  tags: string[]
  created_at: string
}

// 6. 故障排查單步節點 (故障樹)
export interface DiagnosticStep {
  step_number: number
  title: string
  instruction: string
  safety_alert?: string        // "請先切斷總電源並靜置冷卻"
  check_type: 'visual' | 'cleaning' | 'consumable' | 'restart' | 'multimeter_ohms' | 'voltage' | 'mechanical_cam'
  expected_normal: string
  if_failed_action: string
  requires_technician: boolean
}

// 7. 維修對話訊息
export interface RepairAIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  mode: RepairMode
  timestamp: string
  equipment_model?: string
  error_code?: string
  image_url?: string
  diagnostic_steps?: DiagnosticStep[]
  recommended_parts?: {
    name: string
    part_code: string
    spec: string
    action: string
  }[]
  ticket_draft?: RepairTicketDraft
}

// 8. 門市一鍵轉發工單草稿
export interface RepairTicketDraft {
  store: string
  equipment_name: string
  equipment_model: string
  error_code?: string
  symptom_summary: string
  steps_already_tried: string[]
  urgency: 'low' | 'normal' | 'high' | 'urgent'
  suggested_parts_for_tech: string[]
  ready_to_submit: boolean
}

// 9. 技師修復後回饋學習閉環
export interface RepairCaseFeedback {
  id: string
  order_id?: string
  equipment_model: string
  symptom: string
  actual_root_cause: string
  parts_replaced: string
  measured_resistance_or_voltage?: string
  technician_note: string
  verified_by: string
  created_at: string
}
