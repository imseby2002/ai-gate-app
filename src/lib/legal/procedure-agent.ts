/**
 * Application / Procedure Agent (行政審批手續引導代理)
 *
 * 專門負責：
 * 1. 互動式收集企業設立、落地門市與進口經營意向
 * 2. 解析行政審批流程 DAG (有向無環圖) 與前置相依步驟
 * 3. 輸出包含法定主管機關、應備文件清單、官方表格代碼、規費與工作天數之循序 Checklist
 */

export interface ProcedurePlanRequest {
  industry: 'beverage' | 'restaurant' | 'trading' | 'manufacturing' | 'retail' | string
  entity_type: '100_FOE' | 'JOINT_VENTURE' | 'LOCAL_HOUSEHOLD' | string // 100%外資、合資、個人戶
  province?: string
  include_import?: boolean // 是否需要自外國進口原料/設備
}

export interface StepDetail {
  step_number: number
  title: string
  responsible_authority: string
  governing_ministry: string
  legal_basis: string
  processing_days: number
  official_fee: string
  online_url: string
  prerequisites: string
  dossier_items: string[]
  official_forms: string[]
  practical_notes: string
}

export interface ProcedurePlanResult {
  industry_name: string
  entity_type_name: string
  province_name: string
  total_estimated_days: number
  total_official_fee_estimate: string
  sequential_steps: StepDetail[]
  summary_guidance: string
}

export class ApplicationProcedureAgent {
  /**
   * 根據使用者需求動態生成循序審批路徑 DAG
   */
  public generateBusinessEstablishmentPlan(req: ProcedurePlanRequest): ProcedurePlanResult {
    const province = req.province || 'Hồ Chí Minh / Hà Nội'
    const isBeverage = req.industry === 'beverage' || req.industry === 'restaurant'
    const isForeign = req.entity_type === '100_FOE' || req.entity_type === 'JOINT_VENTURE'

    const steps: StepDetail[] = []
    let stepCount = 1

    // ─────────────────────────────────────────────────────────────
    // 外資前期核准：Step 1 IRC
    // ─────────────────────────────────────────────────────────────
    if (isForeign) {
      steps.push({
        step_number: stepCount++,
        title: '申請投資登記證 (Giấy chứng nhận đăng ký đầu tư - IRC)',
        responsible_authority: `Sở Kế hoạch và Đầu tư (Sở KH&ĐT) tỉnh/thành phố ${province}`,
        governing_ministry: 'Bộ Kế hoạch và Đầu tư (MPI)',
        legal_basis: 'Luật Đầu tư số 61/2020/QH14, Điều 37 & Điều 38',
        processing_days: 15,
        official_fee: '免官方規費（不含第三方公證認證費）',
        online_url: 'https://fdi.gov.vn / https://dichvucong.gov.vn',
        prerequisites: '【無前置步驟】（第一道審批）',
        dossier_items: [
          '投資項目實施提議書 (Văn bản đề nghị thực hiện dự án đầu tư)',
          '外國投資人之合法身份證明（個人附護照；法人母公司附設立登記執照，需完成台灣外交部與越南駐台代表處認證）',
          '投資人財務能力證明（最近兩年審計財報或銀行餘額證明）',
          '門市或辦公室租賃備忘錄/意向書與產權證明文件 (MOU / Hợp đồng thuê địa điểm)',
        ],
        official_forms: ['Mẫu A.I.1 (Ban hành kèm theo Thông tư 03/2021/TT-BKHĐT)'],
        practical_notes: '外國公務文件必須於母國完成「駐外使館認證 (Hợp pháp hóa lãnh sự)」並於越南翻譯成越文公證，否則計劃投資廳一律退件。',
      })
    }

    // ─────────────────────────────────────────────────────────────
    // 公司登記：Step 2 ERC
    // ─────────────────────────────────────────────────────────────
    steps.push({
      step_number: stepCount++,
      title: '申請企業登記證 (Giấy chứng nhận đăng ký doanh nghiệp - ERC)',
      responsible_authority: `Phòng Đăng ký kinh doanh - Sở KH&ĐT ${province}`,
      governing_ministry: 'Bộ Kế hoạch và Đầu tư',
      legal_basis: 'Luật Doanh nghiệp số 59/2020/QH14, Điều 27 & Nghị định 01/2021/NĐ-CP',
      processing_days: 3,
      official_fee: '50,000 VND (線上規費) + 100,000 VND (全國企業入口登報費)',
      online_url: 'https://dangkykinhdoanh.gov.vn',
      prerequisites: isForeign ? '必須先取得 Step 1 之 IRC 投資許可證' : '【無前置步驟】',
      dossier_items: [
        '企業登記申請書 (Giấy đề nghị đăng ký doanh nghiệp)',
        '公司章程 (Điều lệ công ty)',
        '成員名冊 (有限責任公司) 或股東名冊 (股份公司)',
        '法定代表人護照或身份證明副本',
        isForeign ? 'IRC 投資登記證副本' : '',
      ].filter(Boolean),
      official_forms: ['Phụ lục II-1 (Nghị định 01/2021/NĐ-CP)'],
      practical_notes: '取得 ERC 即代表公司正式成立並取得單一稅籍代碼 (Mã số thuế)，可刻製印章與開立銀行帳戶。',
    })

    // ─────────────────────────────────────────────────────────────
    // 銀行開戶與驗資
    // ─────────────────────────────────────────────────────────────
    if (isForeign) {
      steps.push({
        step_number: stepCount++,
        title: '刻製公司印章、開立投資資本專戶 (DICA) 與注資驗資',
        responsible_authority: '在越南核准營業之商業銀行 (Vietcombank, BIDV, 第一銀行, 兆豐等)',
        governing_ministry: 'Ngân hàng Nhà nước Việt Nam (越南國家銀行)',
        legal_basis: 'Thông tư 06/2019/TT-NHNN',
        processing_days: 5,
        official_fee: '依各銀行開戶標準收費',
        online_url: '各銀行實體臨櫃辦理',
        prerequisites: '必須完成 Step 2 取得 ERC 與公司印章',
        dossier_items: [
          'ERC 與 IRC 原本及公證本',
          '法定代表人指派書與授權書',
          '印章備查資料與稅籍證明',
        ],
        official_forms: ['各家銀行之外幣/越盾投資資本專戶申請表格'],
        practical_notes: '重要：外國投資人必須自境外帳戶匯入資本金至 DICA 專戶，且自 ERC 簽發日起【90 天內】必須 100% 繳足章程資本額，逾期將面臨罰款。',
      })
    }

    // ─────────────────────────────────────────────────────────────
    // 門市消防安全 (PCCC)
    // ─────────────────────────────────────────────────────────────
    steps.push({
      step_number: stepCount++,
      title: '門市消防安全備查與合格證明 (PCCC)',
      responsible_authority: `Đội Cảnh sát PCCC và CNCH - Công an quận/huyện sở tại`,
      governing_ministry: 'Bộ Công an (公安部)',
      legal_basis: 'Luật Phòng cháy và chữa cháy & Nghị định 136/2020/NĐ-CP',
      processing_days: 7,
      official_fee: '現場檢查免費，滅火設備器材自行添購',
      online_url: 'https://dichvucong.bocongan.gov.vn',
      prerequisites: '門市店面裝修完工、滅火器配置完畢後進行',
      dossier_items: [
        '消防安全管理責任承諾書',
        '門市平面消防逃生圖',
        '滅火器材清單與檢驗合格證明',
      ],
      official_forms: ['Mẫu PC17 / Nghị định 136/2020/NĐ-CP'],
      practical_notes: '門市面積若超過法定規模需經消防設計審查 (Thẩm duyệt)，一般手搖飲料外帶店需備足滅火器與逃生通道告示備查。',
    })

    // ─────────────────────────────────────────────────────────────
    // 餐飲食安特定：體檢 + 培訓 + ATTP
    // ─────────────────────────────────────────────────────────────
    if (isBeverage) {
      steps.push({
        step_number: stepCount++,
        title: '員工健康檢查合格證明與食品安全衛生培訓',
        responsible_authority: '地方指定合格之醫療院所 / 衛生中心 (Trung tâm Y tế quận/huyện)',
        governing_ministry: 'Bộ Y tế',
        legal_basis: 'Thông tư 14/2013/TT-BYT & Nghị định 15/2018/NĐ-CP',
        processing_days: 3,
        official_fee: '約 300,000 ~ 500,000 VND / 人 (體檢規費)',
        online_url: '臨櫃預約體檢',
        prerequisites: '員工進駐門市培訓前完成',
        dossier_items: ['大頭照 4x6', '門市員工健康檢查表 (Giấy khám sức khỏe theo Thông tư 14)'],
        official_forms: ['Mẫu giấy khám sức khỏe cho người trực tiếp chế biến thực phẩm'],
        practical_notes: '所有直接接觸茶飲調製的員工與店長，不得患有傳染性痢疾、皮膚病或肺結核，體檢報告效期為 1 年。',
      })

      steps.push({
        step_number: stepCount++,
        title: '申請食品安全合格機構證書 (Giấy chứng nhận ATTP)',
        responsible_authority: `Chi cục An toàn vệ sinh thực phẩm (Sở Y tế ${province}) hoặc Ban Quản lý ATTP`,
        governing_ministry: 'Bộ Y tế',
        legal_basis: 'Luật An toàn thực phẩm số 55/2010/QH12, Điều 34 & Nghị định 15/2018/NĐ-CP, Điều 12',
        processing_days: 15,
        official_fee: '700,000 VND / 次 (現場審查評定費)',
        online_url: 'https://dichvucong.gov.vn',
        prerequisites: '必須完成消防 PCCC 配置、員工體檢與場所水質檢驗報告',
        dossier_items: [
          '申請書 (Đơn đề nghị cấp Giấy chứng nhận ATTP theo Mẫu số 01)',
          'ERC 營業執照公證本',
          '門市設施平面圖、設備清單與單向流作業說明書 (Bản thuyết minh cơ sở vật chất)',
          '調製作業用水之檢驗報告（符合 QCVN 01-1:2018/BYT 飲用水標準）',
          '員工體檢與食安知識受訓清單',
        ],
        official_forms: ['Mẫu số 01 (Ban hành kèm theo Nghị định 15/2018/NĐ-CP)'],
        practical_notes: '送件後 15 天內稽查人員將實地至門市抽驗：重點檢查「生熟分區、防蟲防鼠紗窗、水源濾芯與員工工作服帽子口罩」。',
      })

      steps.push({
        step_number: stepCount++,
        title: '產品成分配方自主公告 (Tự công bố sản phẩm)',
        responsible_authority: `Ban Quản lý An toàn thực phẩm / Sở Y tế ${province}`,
        governing_ministry: 'Bộ Y tế / Bộ Công Thương',
        legal_basis: 'Nghị định 15/2018/NĐ-CP, Điều 4 & Điều 5',
        processing_days: 1,
        official_fee: '免官方規費（第三方實驗室成分檢驗報告費約 1,500,000 ~ 3,000,000 VND / 樣品）',
        online_url: '線上上傳或雙掛號郵寄送交地方衛生主管機關',
        prerequisites: '需取得第三方公認檢驗所之原物料/茶品檢驗合格報告 (Phiếu kết quả kiểm nghiệm)',
        dossier_items: [
          '產品自主公告表 (Bản tự công bố sản phẩm theo Mẫu số 01 Phụ lục I)',
          '12 個月內出具之食品安全檢驗成果報告書（符合 QCVN 標準）',
          '產品標籤圖樣或標籤草案',
        ],
        official_forms: ['Mẫu số 01 Phụ lục I (Nghị định 15/2018/NĐ-CP)'],
        practical_notes: '完成上傳或郵寄收執後，企業即享有自主銷售權利，主管機關會將名單登載於官網公開資訊系統。',
      })
    }

    // ─────────────────────────────────────────────────────────────
    // 稅務與門牌招牌：Step Final
    // ─────────────────────────────────────────────────────────────
    steps.push({
      step_number: stepCount++,
      title: '稅籍初始登記、購買電子發票 (Hóa đơn điện tử) 與門市門牌設置',
      responsible_authority: `Chi cục Thuế quận/huyện sở tại`,
      governing_ministry: 'Bộ Tài chính (財政部)',
      legal_basis: 'Luật Quản lý thuế số 38/2019/QH14 & Nghị định 123/2020/NĐ-CP',
      processing_days: 3,
      official_fee: '數位簽章 (Token) 與電子發票系統費（向 Viettel, VNPT 等購買，約 2,000,000 VND/年）',
      online_url: 'https://thuedientu.gdt.gov.vn',
      prerequisites: '取得 ERC 與銀行帳戶後 10 天內必須完成',
      dossier_items: [
        '初次稅籍申報表 (Tờ khai đăng ký thuế)',
        '銀行帳戶向稅局登記備查表 (Mẫu 08-MST)',
        '電子發票樣式與使用通知書',
      ],
      official_forms: ['Mẫu số 01/ĐKT-TĐ (Thông tư 78/2021/TT-BTC)'],
      practical_notes: '門市招牌外語面積不得超過越文面積的 50%，且越文必須置於上方；每筆結帳必須開立合規電子發票傳輸至稅務局系統。',
    })

    const totalDays = steps.reduce((sum, s) => sum + s.processing_days, 0)

    return {
      industry_name: req.industry === 'beverage' ? '手搖飲料 / 茶飲連鎖門市' : '一般餐飲/商業門市',
      entity_type_name: isForeign ? '100% 外資企業 (100% Foreign-Owned Enterprise)' : '當地內資企業',
      province_name: province,
      total_estimated_days: totalDays,
      total_official_fee_estimate: isForeign ? '約 1,000,000 ~ 1,500,000 VND (僅官方規費，不含公證、體檢與檢驗)' : '約 850,000 VND',
      sequential_steps: steps,
      summary_guidance: `針對【${isForeign ? '外商' : '本國'}】在【${province}】設立【${req.industry === 'beverage' ? '手搖飲料門市' : '商業門市'}】，整體流程依序涵蓋 ${steps.length} 個主要步驟，整體法定審查與作業時程累計約需 ${totalDays} 個工作日（建議預留 1.5 ~ 2 個月籌備期）。完成前置步驟後始得辦理後續許可，切勿跳步進行。`,
    }
  }
}
