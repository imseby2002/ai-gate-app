export type GeopoliticalRiskLevel = 'Low (低曝險)' | 'Moderate (中度敏感)' | 'High (高度敏感)' | 'Severe (極度脆弱/風暴核心)'

export interface GeopoliticalChannelImpact {
  name: string
  impactLevel: 'Mild' | 'Moderate' | 'Severe' | 'Beneficiary'
  summary: string
  mechanism: string
}

export interface GeopoliticalProfile {
  ticker: string
  overallLevel: GeopoliticalRiskLevel
  badgeColor: string
  cdsSpreadPenaltyBps: number // CDS 信用違約利差加成 (bps)
  capmRiskPremiumAddon: number // 股權成本風險溢酬加成 (%)
  valuationDiscountPercent: number // 估值公允價折價修正 (%)
  channels: {
    exportControls: GeopoliticalChannelImpact // 行政命令與出口管制
    energyCommodity: GeopoliticalChannelImpact // 能源與大宗商品通膨
    supplyChainReshoring: GeopoliticalChannelImpact // 供應鏈在地化與高 Capex 負擔
    creditSovereign: GeopoliticalChannelImpact // 主權債信與違約利差衝擊
  }
  keyExposures: string[]
  mitigationFactors: string[]
}

/**
 * 依據標的與產業屬性，量化解析地緣政治 4 大實質傳導管道
 */
export function evaluateGeopoliticalProfile(ticker: string, companyName: string): GeopoliticalProfile {
  const sym = ticker.toUpperCase()
  const name = companyName.toLowerCase()

  // 1. 半導體、AI 算力、先進製程 (NVDA, TSM, ASML, AMD, 2330.TW, AVGO, ARM, QCOM, MU)
  const isSemiconductorOrAI =
    sym.includes('NVDA') ||
    sym.includes('TSM') ||
    sym.includes('2330') ||
    sym.includes('ASML') ||
    sym.includes('AMD') ||
    sym.includes('AVGO') ||
    sym.includes('ARM') ||
    sym.includes('MU') ||
    sym.includes('QCOM') ||
    sym.includes('2454') ||
    name.includes('semiconductor') ||
    name.includes('nvidia')

  // 2. 傳統能源、大宗商品與海運航運 (XOM, CVX, 2603.TW, USO, GLD)
  const isEnergyOrShipping =
    sym.includes('XOM') ||
    sym.includes('CVX') ||
    sym.includes('2603') ||
    sym.includes('USO') ||
    sym.includes('GLD') ||
    name.includes('energy') ||
    name.includes('marine') ||
    name.includes('shipping')

  // 3. 台灣權值製造與代工機櫃 (2317.TW, 2382.TW, 2308.TW, 0050.TW)
  const isTaiwanHardware =
    sym.endsWith('.TW') ||
    sym.endsWith('.TWO') ||
    sym.includes('2317') ||
    sym.includes('2382')

  // 4. 加密貨幣 (BTC, ETH, SOL)
  const isCrypto = sym.includes('BTC') || sym.includes('ETH') || sym.includes('SOL')

  if (isSemiconductorOrAI) {
    const isTSMC = sym.includes('TSM') || sym.includes('2330')
    return {
      ticker: sym,
      overallLevel: isTSMC ? 'Severe (極度脆弱/風暴核心)' : 'High (高度敏感)',
      badgeColor: isTSMC ? '#ef4444' : '#f97316',
      cdsSpreadPenaltyBps: isTSMC ? 65 : 45,
      capmRiskPremiumAddon: isTSMC ? 1.2 : 0.8,
      valuationDiscountPercent: isTSMC ? 12 : 9,
      channels: {
        exportControls: {
          name: '行政命令與科技出口管制 (Export Controls)',
          impactLevel: 'Severe',
          summary: '美國 BIS 對高階 AI 加速晶片與 EUV/DUV 設備對華禁令持續收緊，直接封閉大中華區高利潤市場份額。',
          mechanism: '中國區營收上限受壓制，需投入高昂研發成本開發生產合規「降規版」晶片，稀釋整體毛利率。',
        },
        energyCommodity: {
          name: '能源與晶圓製造電力成本 (Energy & Power)',
          impactLevel: 'Moderate',
          summary: '先進晶圓廠與超級資料中心屬於用電與冷卻怪獸，綠電成本與全球能源波動推升晶圓代工報價。',
          mechanism: '電費與綠電溢價直接推高每片晶圓 (Wafer) 製造現金成本。',
        },
        supplyChainReshoring: {
          name: '供應鏈在地化與海外擴產 Capex 負擔 (Reshoring Capex)',
          impactLevel: isTSMC ? 'Severe' : 'Moderate',
          summary: isTSMC
            ? '赴美（亞利桑那）、日本熊本與德國德勒斯登海外建廠，海外建廠營運成本比本島高出 30%~50%。'
            : '推動供應鏈「China+1」與亞太多元分散，產生短期供應鏈摩擦成本。',
          mechanism: '資本支出 (Capex) 劇增將在未來 3~5 年大幅壓抑自由現金流 (FCF) 與折舊攤銷獲利表現。',
        },
        creditSovereign: {
          name: '台海地緣主權與防衛利差 (Sovereign Risk Premium)',
          impactLevel: isTSMC ? 'Severe' : 'Moderate',
          summary: '外資機構法人模型將地緣溢酬 (Country Risk Premium) 納入折現率，造成股價相對於美系同行之折價。',
          mechanism: '隱含 CDS 信用利差被動上浮 45~65 bps，使 WACC 攀升約 0.8%~1.2%。',
        },
      },
      keyExposures: [
        '美國商務部 (BIS) 半導體實體清單與雙重用途禁令',
        '台海地緣防衛與亞太關鍵海上生命線通航風險',
        '海外多地晶圓建廠造成初期毛利率稀釋',
      ],
      mitigationFactors: [
        '全球先進製程與 AI GPU 運算具絕對壟斷性護城河，擁有極強定價權',
        '全球科技巨擘（CSP 雲端大廠）資本支出依然強勁，自研與軍備競賽剛需難以替代',
      ],
    }
  }

  if (isEnergyOrShipping) {
    const isGold = sym.includes('GLD')
    return {
      ticker: sym,
      overallLevel: 'High (高度敏感)',
      badgeColor: '#eab308',
      cdsSpreadPenaltyBps: 35,
      capmRiskPremiumAddon: 0.6,
      valuationDiscountPercent: 6,
      channels: {
        exportControls: {
          name: '原油出口制裁與金融 SWIFT 封鎖 (Sanctions & OFAC)',
          impactLevel: 'Moderate',
          summary: '俄羅斯石油價格上限、伊朗原油禁運政策直接改變全球油輪航線與貿易版圖。',
          mechanism: '形成原油現貨雙軌市場，增加合規保險與運輸中介成本。',
        },
        energyCommodity: {
          name: '中東戰事與關鍵海峽封鎖風險 (Chokepoint Shocks)',
          impactLevel: isGold ? 'Beneficiary' : 'Severe',
          summary: isGold
            ? '地緣衝突引發全球央行儲備去美元化，實體黃金現貨買盤迎來歷史級避險大順風。'
            : '荷姆茲海峽、紅海危機引發曼德海峽商船繞道好望角，全球航行里程 (Ton-Miles) 與油價雙雙暴衝。',
          mechanism: isGold ? '避險溢價推升公允價值' : '燃油成本暴增，海運運價劇烈震盪，加劇全球停滯性通膨預期。',
        },
        supplyChainReshoring: {
          name: '戰略原物料儲備與貿易壁壘 (Strategic Stockpiles)',
          impactLevel: 'Moderate',
          summary: '各國建立關鍵礦物與石油戰略儲備，推高全球現貨倉儲與週轉庫存資金成本。',
          mechanism: '企業營運資金 (Working Capital) 佔用率上升。',
        },
        creditSovereign: {
          name: '新興市場與高負債航運 CDS 利差 (Credit Volatility)',
          impactLevel: 'Moderate',
          summary: '運價與油價劇烈波動對高槓桿航運與非一線油企債信造成壓力。',
          mechanism: '融資租賃成本推升，資本成本上升約 35 bps。',
        },
      },
      keyExposures: [
        '中東區域擴大化威脅荷姆茲海峽原油通航',
        '紅海航道安全危機推升航運保費與繞行成本',
        '全球央行應對輸入性通膨推遲降息進程',
      ],
      mitigationFactors: [
        '黃金與上游油企在地緣衝突爆發期具備天然的抗通膨與通脹避險受益特性',
        '合約長約鎖價機制降低短期現貨市場極端波動風險',
      ],
    }
  }

  if (isTaiwanHardware) {
    return {
      ticker: sym,
      overallLevel: 'High (高度敏感)',
      badgeColor: '#f97316',
      cdsSpreadPenaltyBps: 50,
      capmRiskPremiumAddon: 0.9,
      valuationDiscountPercent: 10,
      channels: {
        exportControls: {
          name: '美系終端品牌關稅壁壘與出口審查 (Tariff & Tech Ban)',
          impactLevel: 'Moderate',
          summary: '北美科技終端大廠要求代工體系避開中國製造產能，以符合美方國防與政府採購標準。',
          mechanism: '加速產能外移至越南、墨西哥、印度與泰國。',
        },
        energyCommodity: {
          name: '台灣本地電力供應與國際天然氣波動 (Domestic Power Grid)',
          impactLevel: 'Moderate',
          summary: '製造業高度依賴穩定電網，進口天然氣與綠電政策變動影響工業用電費率。',
          mechanism: '推升單機組裝與測試之生產邊際成本。',
        },
        supplyChainReshoring: {
          name: '全球產能多重佈局 Capex 與管理重疊 (China+1 Capex)',
          impactLevel: 'Severe',
          summary: '同時在東南亞與美洲建置伺服器組裝廠，固定資產投入與在地勞工管理成本攀升。',
          mechanism: '稀釋初期代工毛利率，使自由現金流回收週期拉長。',
        },
        creditSovereign: {
          name: '台海地緣折價 (Taiwan Strait Geopolitical Discount)',
          impactLevel: 'High',
          summary: '外資投行模型長年對台灣本土硬件製造商套用地緣防衛折價。',
          mechanism: '股本成本 Ke 疊加地緣溢酬，公允本益比倍數折讓 10%~15%。',
        },
      },
      keyExposures: [
        '美中科技供應鏈脫鉤要求代工廠跨國多點備援',
        '海外新廠良率與學習曲線成本攀升',
      ],
      mitigationFactors: [
        '全球 AI 伺服器機櫃與關鍵零組件具備不可替代的工程技術整合壁壘',
        '全球 Tier-1 雲端巨頭指定合作夥伴，訂單能見度高',
      ],
    }
  }

  if (isCrypto) {
    return {
      ticker: sym,
      overallLevel: 'Moderate (中度敏感)',
      badgeColor: '#a855f7',
      cdsSpreadPenaltyBps: 80,
      capmRiskPremiumAddon: 1.5,
      valuationDiscountPercent: 5,
      channels: {
        exportControls: {
          name: '全球反洗錢與跨境資本管制 (Crypto Sanctions Enforcement)',
          impactLevel: 'Moderate',
          summary: '各國政府對受制裁實體利用虛擬資產規避 SWIFT 進行嚴密鏈上監控。',
          mechanism: '合規交易所對大額金流審查趨嚴，短期抑制部分邊際流動性。',
        },
        energyCommodity: {
          name: 'PoW 挖礦電力監管與主權能源爭奪 (Hashrate Energy Politics)',
          impactLevel: 'Moderate',
          summary: '部分主權國家（如俄羅斯、中東）利用過剩水電或伴生天然氣挖礦，引發跨國能源監管爭議。',
          mechanism: '全網算力遷移與出塊成本重構。',
        },
        supplyChainReshoring: {
          name: '主權儲備去美元化與數位黃金敘事 (De-dollarization Channel)',
          impactLevel: 'Beneficiary',
          summary: '地緣衝突催化各國央行與跨國資本尋求不依賴特定主權法幣的去中心化資產。',
          mechanism: '比特幣作為「抗制裁、抗沒收、抗通膨」的無國界儲備資產價值獲得深化。',
        },
        creditSovereign: {
          name: '主權債務信任危機溢價 (Sovereign Debt Hedge)',
          impactLevel: 'Beneficiary',
          summary: '西方制裁凍結外匯存底案例促使全球新興主權檢討美元資產集中度。',
          mechanism: '為非主權硬資產注入結構性長期增量流動性。',
        },
      },
      keyExposures: [
        'G7 與 FATF 針對去中心化金融 (DeFi) 與隱私幣之跨國監管收緊',
        '地緣黑天鵝引發美元短缺時的去槓桿流動性拋售',
      ],
      mitigationFactors: [
        '去中心化抗審查特質與 2100 萬顆硬上限提供天然地緣保護傘',
        '全球主權與上市公司戰略儲備接受度持續躍升',
      ],
    }
  }

  // 一般美股與跨國企業 (Default Multinationals)
  return {
    ticker: sym,
    overallLevel: 'Moderate (中度敏感)',
    badgeColor: '#38bdf8',
    cdsSpreadPenaltyBps: 20,
    capmRiskPremiumAddon: 0.4,
    valuationDiscountPercent: 4,
    channels: {
      exportControls: {
        name: '全球貿易壁壘與反傾銷關稅 (Tariffs & Trade Barriers)',
        impactLevel: 'Mild',
        summary: '保護主義抬頭，跨國貿易壁壘可能影響海外終端銷量。',
        mechanism: '銷貨成本與關稅負擔溫和上升。',
      },
      energyCommodity: {
        name: '通膨二次反彈與聯準會降息路徑 (Inflation & Fed Policy)',
        impactLevel: 'Moderate',
        summary: '地緣事件牽動油價與航運，可能迫使全球央行拉長高利率時間 (Higher for Longer)。',
        mechanism: '整體市場權益折現率居高不下，相對估值倍數承壓。',
      },
      supplyChainReshoring: {
        name: '跨國供應鏈在地化佈局 (Nearshoring)',
        impactLevel: 'Mild',
        summary: '供應鏈逐步向友岸外包 (Friendshoring) 與近岸外包靠攏。',
        mechanism: '庫存安全存量提高，營運週轉天數微增。',
      },
      creditSovereign: {
        name: '全球信用利差與美元指數波動 (Dollar Index & CDS Spreads)',
        impactLevel: 'Mild',
        summary: '美元走強造成跨國企業海外營收換算匯損 (FX Headwinds)。',
        mechanism: '美元計價毛利率受匯率折算衝擊。',
      },
    },
    keyExposures: [
      '全球通膨韌性與高利率環境維持時間延長',
      '外幣匯率波動造成的跨國匯兌損失',
    ],
    mitigationFactors: [
      '跨國多元化市場分散單一地區地緣衝突衝擊',
      '完善的外匯避險工具與在地化銷售策略',
    ],
  }
}
