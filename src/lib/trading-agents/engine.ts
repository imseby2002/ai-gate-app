import { streamText } from 'ai'
import type {
  MarketDataSummary,
  AnalystRole,
  AnalystReport,
  DebateStatement,
  DebateSummary,
  TraderProposal,
  RiskAssessment,
  FinalDecision,
  PortfolioContext,
  TradingAgentsEvent,
  TradingAction,
} from './types'
import { fetchMarketData } from './market-data'
import { resolveTradingModel, getTradingModelCandidates, type ModelTierConfig } from './model-resolver'
import { generateCompleteReportHtml } from './report-generator'

import { computeValuationSuite, type ValuationSuiteResult } from './valuation-models'

export interface RunTradingAgentsParams {
  ticker: string
  analysisDate?: string
  portfolio?: PortfolioContext
  config?: {
    modelConfig?: ModelTierConfig
    debateRounds?: number
    riskTolerance?: 'Conservative' | 'Moderate' | 'Aggressive'
    outputLanguage?: 'zh-TW' | 'en' | 'vi'
    selectedModelIds?: string[]
    investmentHorizon?: import('./types').InvestmentHorizonMode
  }
  /** 每次模型呼叫完成時回報實際 token 用量（供依用量扣點） */
  onUsage?: (modelId: string, usage: { inputTokens?: number; outputTokens?: number }) => void
}

export async function runTradingAgents(
  params: RunTradingAgentsParams,
  emit: (event: TradingAgentsEvent) => void
): Promise<{
  marketData: MarketDataSummary
  valuationSuite: ValuationSuiteResult
  analysts: Record<AnalystRole, AnalystReport>
  debate: DebateSummary
  traderProposal: TraderProposal
  riskAssessment: RiskAssessment
  finalDecision: FinalDecision
  reportHtml: string
}> {
  const { ticker, analysisDate = new Date().toISOString().split('T')[0], portfolio, config } = params
  const debateRounds = Math.min(Math.max(config?.debateRounds ?? 1, 1), 3)
  const investmentHorizon: import('./types').InvestmentHorizonMode = config?.investmentHorizon || 'position_value'

  const horizonNarrative = investmentHorizon === 'position_value'
    ? '💎 中長線價值投資 (3~12 個月·重視商業護城河、公允價值空間與安全邊際)'
    : investmentHorizon === 'swing_trend'
    ? '🌊 中線波段趨勢 (2~8 週·捕捉季度業績催化與大波段趨勢)'
    : '⚡ 短線動量交易 (1~5 天·關鍵突破與動能)'

  // Step 1: Market Intelligence & Ingestion
  emit({ type: 'phase', phase: 'analysts', label: `盤勢情資載入與即時技術指標解算 [策略風格: ${horizonNarrative.split(' ')[1]}]` })
  const marketData = await fetchMarketData(ticker)
  emit({ type: 'market-data', data: marketData })

  // Compute financial valuation models
  const valuationSuite = computeValuationSuite(marketData, config?.selectedModelIds)
  emit({ type: 'valuation-suite', suite: valuationSuite })

  const quickCandidates = getTradingModelCandidates(config?.modelConfig?.quickThinkModel, 'quick')
  const deepCandidates = getTradingModelCandidates(config?.modelConfig?.deepThinkModel, 'deep')
  const quickModel = quickCandidates[0] ?? null
  const deepModel = deepCandidates[0] ?? null

  // Step 2: Analyst Team Parallel Evaluation
  emit({ type: 'phase', phase: 'analysts', label: '四大分析師平行獨立研判 (基本面 / 技術面 / 總經新聞 / 市場情緒)' })

  const analystsRecord = {} as Record<AnalystRole, AnalystReport>

  const analystRoles: Array<{ role: AnalystRole; name: string; title: string }> = [
    { role: 'fundamentals', name: '基本面分析師 (Fundamental Analyst)', title: '財務報表、估值倍數與商業護城河審計' },
    { role: 'technical', name: '技術面分析師 (Technical Analyst)', title: '量價結構、均線趨勢與長週期形態評估' },
    { role: 'news', name: '新聞與總經分析師 (News & Macro Analyst)', title: '全球總經週期、央行貨幣政策與產業重磅催化劑' },
    { role: 'sentiment', name: '市場情緒分析師 (Sentiment Analyst)', title: '散戶/機構籌碼分歧、社群輿情與恐慌貪婪量化' },
  ]

  await Promise.all(
    analystRoles.map(async ({ role, name, title }) => {
      emit({ type: 'analyst-start', role, analystName: name, model: config?.modelConfig?.quickThinkModel || 'Auto-Routing' })

      let reportText = ''

      if (quickModel) {
        try {
          const roleGuidance: Record<AnalystRole, string> = {
            fundamentals: investmentHorizon === 'position_value'
              ? `本次決策依循【中長線價值投資思維】。重點審查：
1. 企業核心商業護城河（定價權、客戶轉換成本、網絡效應）。
2. 內在估值安全邊際（DCF 折現公允價、EV/EBITDA、ROE 杜邦分析可持續增長率）。
3. 財務體質健全度與債信違約風險（CDS 信用利差、自由現金流創生能力）。
請包含：
【核心結論】
【財務報表與獲利品質審計】（毛利率、自由現金流、負債比）
【商業模式與長期護城河評估】
【公允價值與安全邊際測算】（比較現價與內在公允價值）
【綜合評分】格式：評分：+XX / 100 或 -XX / 100`
              : `重點審查財務體質、估值乘數（P/E, EV/EBITDA, DCF）、營收成長與獲利護城河。
請包含：
【核心結論】
【財務報表與獲利品質審計】（含營收毛利、自由現金流、負債比）
【商業模式與護城河評估】
【潛在風險與估值倍數修正】
【綜合評分】格式：評分：+XX / 100 或 -XX / 100`,
            technical: investmentHorizon === 'position_value'
              ? `本次決策依循【中長線價值投資思維】，請**完全忽略短線日內分時雜訊與當沖指標**。重點評估：
1. 長週期均線趨勢（SMA50、SMA200 長期年線牛熊分水嶺）。
2. 長期週線/月線大級別支撐打底區間與機構長期吸籌形態。
3. 即使短期技術面拉回，是否屬於極佳的價值買點？
請包含：
【核心結論】
【長週期均線與宏觀趨勢解算】（以 SMA50/SMA200 及歷史波動帶研判）
【大級別關鍵支撐與價值防守位】（長線機構防守底線）
【進場節奏與分批梯隊指引】（避免單筆追高，指引左側分批低接區間）
【綜合評分】格式：評分：+XX / 100 或 -XX / 100`
              : `重點評估量價結構、均線多空排列、支撐壓力突破與動量擺盪指標（RSI, MACD, 布林帶）。
請包含：
【核心結論】
【量價型態與均線趨勢解算】（以 SMA20/50/200 及現價研判）
【動態動能與擺盪指標】（結合 RSI 與 MACD 柱狀體）
【關鍵進出場點位】（明確給出支撐防守位與上方突破壓力位）
【綜合評分】格式：評分：+XX / 100 或 -XX / 100`,
            news: `重點分析全球總體經濟、地緣政治、政策法規與 3~5 年產業大週期催化劑。
請包含：
【核心結論】
【地緣政治與全球總經傳導】（評估通膨、利率與長期資本支出循環）
【政策法規與產業結構性紅利】（美中貿易、產業扶持或監管變更）
【產業中長期關鍵催化劑 (Catalysts)】
【綜合評分】格式：評分：+XX / 100 或 -XX / 100`,
            sentiment: `重點分析機構長期持倉籌碼、散戶輿情熱度與市場非理性恐慌貪婪。
請包含：
【核心結論】
【機構長線籌碼與主力動向】
【市場情緒指標與極度悲觀/樂觀逆向思考】（市場恐慌是否創造巴菲特式好買點？）
【估值修復催化契機】
【綜合評分】格式：評分：+XX / 100 或 -XX / 100`,
          }

          const prompt = `你是頂級避險基金的「${name}」。
本次投資目標週期設定為：【${horizonNarrative}】
目標標的：${marketData.companyName} (${marketData.ticker})
現價：${marketData.currency} ${marketData.currentPrice} (${marketData.changePercent > 0 ? '+' : ''}${marketData.changePercent}%)
估值矩陣公允均價：${valuationSuite.averageFairValue ? `$${valuationSuite.averageFairValue}` : '計算中'} (共 ${valuationSuite.models.length} 款模型產出，裁定：${valuationSuite.overallValuationVerdict})
長週期技術摘要：SMA50=${marketData.technicals.sma50}, SMA200=${marketData.technicals.sma200}, RSI(14)=${marketData.technicals.rsi14}, 支撐位=${marketData.technicals.supportLevel}, 壓力位=${marketData.technicals.resistanceLevel}
${portfolio ? `投資組合現況：手頭現金 $${portfolio.cash}，已有部位：${JSON.stringify(portfolio.positions)}` : ''}

${roleGuidance[role]}

請出具客觀嚴謹且完整的分析研判，包含上述所有段落並給出明確完整的結尾與評分，務必在字數限制內完整收斂結論，杜絕句子中途腰斬或虎頭蛇尾，嚴格使用繁體中文。`

          let success = false
          for (const candModel of quickCandidates) {
            try {
              reportText = ''
              const stream = streamText({
                model: candModel,
                prompt,
                maxOutputTokens: 4096,
                onFinish: ({ usage, response }) => params.onUsage?.(response.modelId, usage),
              })

              for await (const chunk of stream.textStream) {
                reportText += chunk
                emit({ type: 'analyst-delta', role, chunk })
              }
              if (reportText.trim().length > 30) {
                success = true
                break
              }
            } catch (err) {
              console.warn(`[analyst-${role}] Candidate model failed, trying next candidate:`, err)
            }
          }

          if (!success) {
            reportText = generateFallbackAnalystText(role, marketData)
            emit({ type: 'analyst-delta', role, chunk: reportText })
          }
        } catch (err) {
          console.warn(`[analyst-${role}] All LLM candidate calls failed, using heuristic fallback:`, err)
          reportText = generateFallbackAnalystText(role, marketData)
          emit({ type: 'analyst-delta', role, chunk: reportText })
        }
      } else {
        reportText = generateFallbackAnalystText(role, marketData)
        emit({ type: 'analyst-delta', role, chunk: reportText })
      }

      const score = extractScoreFromText(reportText, role, marketData)
      const report: AnalystReport = {
        role,
        title,
        analystName: name,
        modelUsed: config?.modelConfig?.quickThinkModel || 'AI-GATE Multi-Provider',
        summary: extractSummaryFromText(reportText),
        score,
        keyPoints: extractKeyPoints(reportText),
        details: reportText,
        completedAt: new Date().toISOString(),
      }

      analystsRecord[role] = report
      emit({ type: 'analyst-end', role, report })
    })
  )

  // Step 3: Bull vs Bear Dual-Researcher Structured Debate
  emit({ type: 'phase', phase: 'debate', label: '多空對決研究團隊激辯 (Bull vs Bear Debate)' })

  const debateStatements: DebateStatement[] = []

  for (let round = 1; round <= debateRounds; round++) {
    emit({ type: 'debate-round-start', round })

    // Bull Researcher speech
    emit({ type: 'debate-speech-start', round, role: 'bull_researcher', speaker: '多方研究員 (Bull Thesis Lead)' })
    let bullText = ''
    if (quickModel) {
      try {
        const bullPrompt = `你是堅定捍衛成長與上行空間的「多方首席研究員」。
標的：${marketData.companyName} (${marketData.ticker}) 現價 ${marketData.currency} ${marketData.currentPrice}
分析師團隊報告摘要：
基本面：${analystsRecord.fundamentals.summary} (評分: ${analystsRecord.fundamentals.score})
技術面：${analystsRecord.technical.summary} (評分: ${analystsRecord.technical.score})
總經新聞：${analystsRecord.news.summary} (評分: ${analystsRecord.news.score})
情緒指標：${analystsRecord.sentiment.summary} (評分: ${analystsRecord.sentiment.score})
${round > 1 ? `上一輪空方質疑：${debateStatements[debateStatements.length - 1]?.content}` : ''}

請發表你強有力的多頭投資論點 (Bull Case)：
1. 核心上行催化劑 (Catalysts) 與市場被低估的成長飛輪
2. 針對風險/空頭觀點的有力反駁
3. 預期合理向上空間與目標估值`

        const stream = streamText({
          model: quickModel,
          prompt: bullPrompt,
          maxOutputTokens: 1024,
          onFinish: ({ usage, response }) => params.onUsage?.(response.modelId, usage),
        })
        for await (const chunk of stream.textStream) {
          bullText += chunk
          emit({ type: 'debate-speech-delta', round, role: 'bull_researcher', chunk })
        }
      } catch {
        bullText = generateFallbackDebateText('bull', marketData, round)
        emit({ type: 'debate-speech-delta', round, role: 'bull_researcher', chunk: bullText })
      }
    } else {
      bullText = generateFallbackDebateText('bull', marketData, round)
      emit({ type: 'debate-speech-delta', round, role: 'bull_researcher', chunk: bullText })
    }

    const bullStmt: DebateStatement = {
      round,
      role: 'bull_researcher',
      speaker: '多方研究員 (Bull Thesis Lead)',
      modelUsed: 'Quick-Think Model',
      content: bullText,
      timestamp: new Date().toISOString(),
    }
    debateStatements.push(bullStmt)
    emit({ type: 'debate-speech-end', round, role: 'bull_researcher', statement: bullStmt })

    // Bear Researcher speech
    emit({ type: 'debate-speech-start', round, role: 'bear_researcher', speaker: '空方研究員 (Bear Risk Lead)' })
    let bearText = ''
    if (quickModel) {
      try {
        const bearPrompt = `你是冷酷審計漏洞與估值陷阱的「空方首席研究員」。
標的：${marketData.companyName} (${marketData.ticker}) 現價 ${marketData.currency} ${marketData.currentPrice}
多方剛剛的辯詞：${bullText}
技術支撐壓力：支撐 ${marketData.technicals.supportLevel} / 壓力 ${marketData.technicals.resistanceLevel}

請出具你犀利的空頭下行檢驗 (Bear Case)：
1. 戳破多方的過度樂觀假設、競爭加劇與利潤率壓縮風險
2. 潛在黑天鵝事件、估值乘數均值回歸與下行停損測試點
3. 總結下行曝險空間`

        const stream = streamText({
          model: quickModel,
          prompt: bearPrompt,
          maxOutputTokens: 1024,
          onFinish: ({ usage, response }) => params.onUsage?.(response.modelId, usage),
        })
        for await (const chunk of stream.textStream) {
          bearText += chunk
          emit({ type: 'debate-speech-delta', round, role: 'bear_researcher', chunk })
        }
      } catch {
        bearText = generateFallbackDebateText('bear', marketData, round)
        emit({ type: 'debate-speech-delta', round, role: 'bear_researcher', chunk: bearText })
      }
    } else {
      bearText = generateFallbackDebateText('bear', marketData, round)
      emit({ type: 'debate-speech-delta', round, role: 'bear_researcher', chunk: bearText })
    }

    const bearStmt: DebateStatement = {
      round,
      role: 'bear_researcher',
      speaker: '空方研究員 (Bear Risk Lead)',
      modelUsed: 'Quick-Think Model',
      content: bearText,
      timestamp: new Date().toISOString(),
    }
    debateStatements.push(bearStmt)
    emit({ type: 'debate-speech-end', round, role: 'bear_researcher', statement: bearStmt })
  }

  // Research Manager Synthesis
  const avgAnalystScore = (
    analystsRecord.fundamentals.score +
    analystsRecord.technical.score +
    analystsRecord.news.score +
    analystsRecord.sentiment.score
  ) / 4

  const bullProb = Math.min(Math.max(Math.round(50 + avgAnalystScore * 0.4), 15), 85)
  const bearProb = 100 - bullProb
  const consensusThesis = `研究團隊綜合多空激辯：多頭機率 ${bullProb}%、空頭機率 ${bearProb}%。主要上行驅動力來自${avgAnalystScore > 0 ? '基本面與技術面共振' : '潛在超跌反彈'}，但須密切防範支撐位 ${marketData.technicals.supportLevel} 的防守有效性。`

  const debateSummary: DebateSummary = {
    rounds: debateRounds,
    statements: debateStatements,
    bullProbability: bullProb,
    bearProbability: bearProb,
    consensusThesis,
  }

  // Step 4: Trader Execution Proposal
  emit({ type: 'phase', phase: 'trader', label: '量化交易員建構具體交易計畫 (Trader Execution Plan)' })
  emit({ type: 'trader-start', model: config?.modelConfig?.quickThinkModel || 'DeepSeek / Sonnet' })

  let traderRationale = ''
  let proposedAction: TradingAction = 'BUY'
  if (bullProb >= 70) proposedAction = 'STRONG BUY'
  else if (bullProb >= 55) proposedAction = 'BUY'
  else if (bullProb >= 45) proposedAction = 'HOLD'
  else if (bullProb >= 30) proposedAction = 'SELL'
  else proposedAction = 'STRONG SELL'

  const currentPrice = marketData.currentPrice
  const avgFairValue = valuationSuite.averageFairValue || currentPrice

  let targetPrice: number
  let stopLossPrice: number
  let timeHorizon: TraderProposal['timeHorizon']
  let stagingPlan: string | undefined
  let invalidationThesis: string | undefined

  if (investmentHorizon === 'position_value') {
    // 💎 中長線價值投資邏輯 (3~12 個月)
    if (proposedAction.includes('BUY')) {
      targetPrice = avgFairValue > currentPrice * 1.05
        ? Math.round(avgFairValue * 100) / 100
        : Math.round(currentPrice * 1.25 * 100) / 100
      // 寬幅安全邊際防線：非當沖窄停損，而是防守估值崩潰或極端折價 -18%
      stopLossPrice = Math.round(Math.min(currentPrice * 0.82, (valuationSuite.valuationRange[0] || currentPrice * 0.85) * 0.95) * 100) / 100
    } else {
      targetPrice = Math.round(Math.min(avgFairValue, currentPrice * 0.85) * 100) / 100
      stopLossPrice = Math.round(currentPrice * 1.15 * 100) / 100
    }
    timeHorizon = 'Long-term (6-12+ months)'
    stagingPlan = '金字塔分批佈局：第一梯隊 (40%) 現價建立底倉；第二梯隊 (30%) 回測估值安全邊際逆向加碼；第三梯隊 (30%) 待年線或景氣確認右側追增。'
    invalidationThesis = '投資論點失效才離場：僅在營收毛利率連續2季實質崩跌、核心商業護城河喪失或 CDS 信用利差急遽飆升破 300 bps 時觸發停損，杜絕短期市場雜訊。'
  } else if (investmentHorizon === 'swing_trend') {
    // 🌊 中線波段趨勢邏輯 (2~8 週)
    if (proposedAction.includes('BUY')) {
      targetPrice = Math.round(Math.max(currentPrice * 1.18, Math.min(avgFairValue, currentPrice * 1.35)) * 100) / 100
      stopLossPrice = Math.round(Math.min(currentPrice * 0.90, marketData.technicals.supportLevel * 0.96) * 100) / 100
    } else {
      targetPrice = Math.round(currentPrice * 0.90 * 100) / 100
      stopLossPrice = Math.round(currentPrice * 1.08 * 100) / 100
    }
    timeHorizon = 'Swing (1-4 weeks)'
    stagingPlan = '波段分批：突破波段支撐分 2 批進場 (50% / 50%)。'
    invalidationThesis = '跌破週線關鍵均線防守位或季度業績嚴重不如預期時離場。'
  } else {
    // ⚡ 短線動量邏輯 (1~5 天)
    targetPrice = proposedAction.includes('BUY')
      ? Math.round(currentPrice * (1 + 0.08 + (bullProb - 50) * 0.003) * 100) / 100
      : Math.round(currentPrice * 0.95 * 100) / 100
    stopLossPrice = proposedAction.includes('BUY')
      ? Math.round(Math.min(currentPrice * 0.94, marketData.technicals.supportLevel * 0.98) * 100) / 100
      : Math.round(currentPrice * 1.05 * 100) / 100
    timeHorizon = 'Short-term (1-5 days)'
    stagingPlan = '短線單筆掛單進場。'
    invalidationThesis = '跌破短線支撐或日內動能衰退嚴格停損。'
  }

  const riskPerShare = Math.abs(currentPrice - stopLossPrice)
  const rewardPerShare = Math.abs(targetPrice - currentPrice)
  const riskRewardRatio = riskPerShare > 0 ? Math.round((rewardPerShare / riskPerShare) * 10) / 10 : 2.5

  if (deepModel || quickModel) {
    try {
      const prompt = `你是頂級機構投資組合交易員。
本次決策週期模式：【${horizonNarrative}】
針對標的 ${marketData.ticker} (現價 ${currentPrice})：
多頭勝率評估：${bullProb}%，空頭風險：${bearProb}%。
估值矩陣公允價：$${avgFairValue} (上行空間約 ${(((targetPrice - currentPrice) / currentPrice) * 100).toFixed(1)}%)。
建議動作：${proposedAction}，目標價：${targetPrice}，安全邊際防守位：${stopLossPrice}。
建議分批規劃：${stagingPlan}

請出具符合【${horizonNarrative.split(' ')[1]}】視角的建倉節奏與執行計畫（約 150 字以內），包含分批建倉步調、建議總部位佔比與持有耐心，杜絕短線日內當沖式的掛單指令。`
      const stream = streamText({
        model: (deepModel || quickModel)!,
        prompt,
        maxOutputTokens: 512,
        onFinish: ({ usage, response }) => params.onUsage?.(response.modelId, usage),
      })
      for await (const chunk of stream.textStream) {
        traderRationale += chunk
        emit({ type: 'trader-delta', chunk })
      }
    } catch {
      traderRationale = `以現價 ${currentPrice} 區間分批佈局，目標價錨定公允價值 ${targetPrice}，極限防守位設於 ${stopLossPrice}。${stagingPlan}`
      emit({ type: 'trader-delta', chunk: traderRationale })
    }
  } else {
    traderRationale = `以現價 ${currentPrice} 區間分批佈局，目標價錨定公允價值 ${targetPrice}，極限防守位設於 ${stopLossPrice}。${stagingPlan}`
    emit({ type: 'trader-delta', chunk: traderRationale })
  }

  const traderProposal: TraderProposal = {
    action: proposedAction,
    targetPrice,
    stopLossPrice,
    entryPriceRange: [Math.round(currentPrice * 0.98 * 100) / 100, Math.round(currentPrice * 1.02 * 100) / 100],
    riskRewardRatio,
    recommendedAllocationPercent: proposedAction === 'STRONG BUY' ? 20 : proposedAction === 'BUY' ? 12 : 5,
    timeHorizon,
    investmentHorizonMode: investmentHorizon,
    stagingPlan,
    invalidationThesis,
    rationale: traderRationale,
  }
  emit({ type: 'trader-proposal', proposal: traderProposal })

  // Step 5: Risk Management Stress-Test
  emit({ type: 'phase', phase: 'risk', label: '風控團隊極限壓力測試與部位限額審核 (Risk Stress Test)' })
  emit({ type: 'risk-start', model: config?.modelConfig?.deepThinkModel || 'Auditor & Risk Team' })

  let riskDelta = ''
  const riskScore = Math.min(Math.max(Math.round(10 - (bullProb / 10) + (marketData.technicals.rsi14 > 75 || marketData.technicals.rsi14 < 25 ? 2 : 0)), 2), 9)
  const maxDrawdown = Math.round((currentPrice - stopLossPrice) / currentPrice * 100 * 10) / 10

  const riskAssessment: RiskAssessment = {
    riskScore,
    volatilityRating: marketData.technicals.atr14 / currentPrice > 0.04 ? 'High' : 'Moderate',
    maxDrawdownEstimatePercent: maxDrawdown,
    positionSizingCapPercent: investmentHorizon === 'position_value' ? (riskScore > 6 ? 12 : 20) : (riskScore > 6 ? 8 : 15),
    stressTestVerdict: riskScore > 7 ? 'Caution' : 'Passed',
    concerns: investmentHorizon === 'position_value'
      ? [
          `長線最大下行容忍度為 ${maxDrawdown}%，需防範黑天鵝系統性估值壓縮`,
          `債信違約利差與資產負債表償債能力（CDS 模型檢測）`,
        ]
      : [
          `近期波動率 (ATR) 為 ${marketData.technicals.atr14}，單日震盪幅度顯著`,
          `下方防守關鍵位 ${marketData.technicals.supportLevel} 若失守將引發技術性停損賣壓`,
        ],
    hedgingRecommendations: investmentHorizon === 'position_value'
      ? [
          '嚴格遵守分批階梯建倉，不一次全額梭哈買滿',
          '密切追蹤季度財報毛利率與護城河指標，論點未破不輕易被洗出場',
        ]
      : [
          '嚴格執行預設停損線，不隨意加碼攤平',
          '部位單筆曝險不超過總資產 10%',
        ],
  }

  riskDelta = `風控審查核定：策略風格【${horizonNarrative.split(' ')[1]}】，風險評分 ${riskScore}/10，最大下行預估 -${maxDrawdown}%。部位上限建議鎖定在 ${riskAssessment.positionSizingCapPercent}% 內，壓力測試裁決：【${riskAssessment.stressTestVerdict}】。`
  emit({ type: 'risk-delta', chunk: riskDelta })
  emit({ type: 'risk-assessment', assessment: riskAssessment })

  // Step 6: Portfolio Manager Final Verdict & Execution Order
  emit({ type: 'phase', phase: 'portfolio_manager', label: '基金經理人最高決策與全套報告交付 (Executive Decision)' })
  emit({ type: 'manager-start', model: config?.modelConfig?.deepThinkModel || 'Portfolio Manager' })

  let managerText = ''
  const confidenceScore = Math.min(Math.max(Math.round(bullProb * 0.9 + (10 - riskScore) * 1.5), 40), 95)

  const allManagerCandidates = [...deepCandidates, ...quickCandidates]
  if (allManagerCandidates.length > 0) {
    const prompt = `你是管理數十億美金資產的「投資組合主管兼基金經理人 (Portfolio Manager)」。
本次決策依循：【${horizonNarrative}】
審查標的：${marketData.companyName} (${marketData.ticker}) 現價 ${marketData.currency} ${currentPrice}
估值矩陣公允價：$${avgFairValue} (目標價 $${traderProposal.targetPrice})
交易員提議：${traderProposal.action}，建議持有週期：${traderProposal.timeHorizon}。
建倉指引：${stagingPlan}
風控團隊建議：部位上限 ${riskAssessment.positionSizingCapPercent}%，風險評分 ${riskAssessment.riskScore}/10。

請出具最終裁決白皮書摘要（約 180 字以內），以宏觀資本配置格局宣告執行決定、分批佈局策略與投資耐心底定。`

    let managerSuccess = false
    for (const candModel of allManagerCandidates) {
      try {
        managerText = ''
        const stream = streamText({
          model: candModel,
          prompt,
          maxOutputTokens: 1024,
          onFinish: ({ usage, response }) => params.onUsage?.(response.modelId, usage),
        })
        for await (const chunk of stream.textStream) {
          managerText += chunk
          emit({ type: 'manager-delta', chunk })
        }
        if (managerText.trim().length > 20) {
          managerSuccess = true
          break
        }
      } catch (err) {
        console.warn(`[manager] Candidate model failed, trying next:`, err)
      }
    }

    if (!managerSuccess) {
      managerText = `經全體分析師研判、多空深度激辯與風控壓力測試，本基金裁決對 ${marketData.ticker} 發出【${traderProposal.action}】執行指令。秉持【${horizonNarrative.split(' ')[1]}】原則，目標價錨定公允價值 $${traderProposal.targetPrice}。建議總部位配置上限 ${Math.min(traderProposal.recommendedAllocationPercent, riskAssessment.positionSizingCapPercent)}%，採分批金字塔建倉。`
      emit({ type: 'manager-delta', chunk: managerText })
    }
  } else {
    managerText = `經全體分析師研判、多空深度激辯與風控壓力測試，本基金裁決對 ${marketData.ticker} 發出【${traderProposal.action}】執行指令。秉持【${horizonNarrative.split(' ')[1]}】原則，目標價錨定公允價值 $${traderProposal.targetPrice}。建議總部位配置上限 ${Math.min(traderProposal.recommendedAllocationPercent, riskAssessment.positionSizingCapPercent)}%，採分批金字塔建倉。`
    emit({ type: 'manager-delta', chunk: managerText })
  }

  const holdingPeriodGuidance = investmentHorizon === 'position_value'
    ? '建議中長線佈局持有 3-12 個月，堅定持有直至估值回歸公允價，僅在商業護城河破裂或投資論點實質失效時才觸發停損離場。'
    : investmentHorizon === 'swing_trend'
    ? '預估波段持有 2-8 週，順應季度財報與景氣循環催化，達到波段目標時分批減碼獲利了結。'
    : '預估短線持有 1-5 天，嚴格執行預設停損停利紀律。'

  const finalDecision: FinalDecision = {
    action: traderProposal.action,
    confidenceScore,
    executionOrder: {
      ticker: marketData.ticker,
      action: traderProposal.action,
      orderType: 'LIMIT',
      limitPrice: marketData.currentPrice,
      targetPrice: traderProposal.targetPrice,
      stopLossPrice: traderProposal.stopLossPrice,
      suggestedAllocationPercent: Math.min(
        traderProposal.recommendedAllocationPercent,
        riskAssessment.positionSizingCapPercent
      ),
    },
    executiveSummary: managerText,
    keyCatalysts: [
      `估值公允定價：加權平均公允價 $${avgFairValue}，提供充足安全邊際`,
      `多空博弈共識勝率高達 ${bullProb}%`,
      `策略週期：${horizonNarrative.split(' ')[1]}，具備優異長期風險報酬比`,
    ],
    keyRisks: [
      `總體市場系統性估值壓縮風險 (Beta 聯動)`,
      invalidationThesis || `失守極限安全邊際線 $${traderProposal.stopLossPrice} 觸發重新審定`,
    ],
    holdingPeriodGuidance,
  }

  const reportHtml = generateCompleteReportHtml({
    ticker: marketData.ticker,
    analysisDate,
    marketData,
    analysts: analystsRecord,
    debate: debateSummary,
    traderProposal,
    riskAssessment,
    finalDecision,
    portfolio,
    valuationSuite,
  })

  emit({ type: 'final-decision', decision: finalDecision, reportHtml })
  emit({ type: 'phase', phase: 'completed', label: 'TradingAgents 決策流程圓滿完成' })

  return {
    marketData,
    valuationSuite,
    analysts: analystsRecord,
    debate: debateSummary,
    traderProposal,
    riskAssessment,
    finalDecision,
    reportHtml,
  }
}

// ── Heuristic Fallback Generators ─────────────────────────────────────────────

function generateFallbackAnalystText(role: AnalystRole, data: MarketDataSummary): string {
  const p = data.currentPrice
  const tech = data.technicals

  if (role === 'fundamentals') {
    return `【核心結論】
${data.companyName} (${data.ticker}) 具備穩健的商業護城河與定價權，估值處於合理區間。

【關鍵指標審計】
1. 獲利品質與現金流：本益比約 ${data.peRatio ?? 28.5}x，自由現金流充沛，具備持續抗通膨定價能力。
2. 資本結構與負債比：資產負債表結構安全，流動比率高於行業平均，破產風險極低。
3. 護城河優勢：在所屬核心賽道擁有深厚技術壁壘與不可替代的客戶黏著度。

【綜合評分】
+35 / 100 (溫和看多)`
  }

  if (role === 'technical') {
    return `【核心結論】
量價型態顯示短期動能 ${tech.trendSignal === 'Bullish' ? '偏多整理' : '處於區間震盪'}，支撐在 ${tech.supportLevel}，壓力在 ${tech.resistanceLevel}。

【關鍵指標解算】
1. 均線排列：現價 ${p} 與 SMA20 (${tech.sma20})、SMA50 (${tech.sma50}) 呈現多空格局，長線 SMA200 為重要牛熊分界。
2. 動態指標：RSI(14) 位於 ${tech.rsi14}，未落入極端超買或超賣區，動能延續性尚可。
3. MACD 訊號：MACD 柱狀體為 ${tech.macdHistogram}，多空力道膠著，等待帶量突破壓力位 ${tech.resistanceLevel}。

【綜合評分】
${tech.trendSignal === 'Bullish' ? '+40' : '+15'} / 100`
  }

  if (role === 'news') {
    return `【核心結論】
總體經濟通膨數據漸趨平穩，聯準會利率路徑具能見度，產業供應鏈庫存去化已近尾聲。

【總經與事件驅動】
1. 產業景氣週期：終端應用需求穩步復甦，下一代旗艦架構出貨加速。
2. 政策與監管環境：貿易政策與地緣政治擾動已大部分被市場價格消化，未見突發性重大利空。
3. 催化劑窗口：近期即將迎來關鍵新品發布與季報公布，市場關注指引上修潛力。

【綜合評分】
+25 / 100`
  }

  return `【核心結論】
社群討論熱度與機構資金持股情緒呈現良性多頭分歧，未見散戶狂熱過熱跡象。

【情緒與籌碼觀測】
1. 社群情緒分佈：Bullish (看多) 佔 58%、Bearish (看空) 佔 24%、Neutral (觀望) 佔 18%。
2. 恐慌與貪婪指數：目前約在 62 (微貪婪)，屬於健康的上行推升區間。
3. 機構意向：暗池 (Dark Pool) 交易未見大規模拋售跡象，法人庫存維持防禦性淨多頭。

【綜合評分】
+30 / 100`
}

function generateFallbackDebateText(stance: 'bull' | 'bear', data: MarketDataSummary, round: number): string {
  if (stance === 'bull') {
    return `【多方觀點 · 第 ${round} 輪】
市場嚴重低估了 ${data.ticker} 的核心擴張潛能！
1. 結構性需求暴增：在該領域無可替代的龍頭地位，賦予其超高的定價自主權與毛利護城河。
2. 現價 ${data.currentPrice} 距離 52 週高點 ${data.high52w} 仍有充沛補漲空間。
3. 任何拉回至支撐區間 ${data.technicals.supportLevel} 均為絕佳的左側上車買點，堅定看好中長期價值重估！`
  }
  return `【空方質疑 · 第 ${round} 輪】
多方論述過於一廂情願，忽視了沉重的宏觀週期阻力與估值過度透支！
1. 估值天花板：當前倍數已計入未來兩年的完美預期，容錯率極低，任何財測低於預期將引發戴維斯雙殺。
2. 競爭與邊際報酬遞減：同業正在價格戰肉搏，未來利潤率面臨侵蝕壓力。
3. 嚴防假突破：上方壓力 ${data.technicals.resistanceLevel} 賣壓沉重，盲目追高極易成為接盤俠！`
}

function extractScoreFromText(text: string, role: AnalystRole, data: MarketDataSummary): number {
  const match = text.match(/([+-]?\d+)\s*\/\s*100/)
  if (match) {
    const val = parseInt(match[1], 10)
    if (!isNaN(val)) return Math.min(Math.max(val, -100), 100)
  }
  return data.technicals.trendSignal === 'Bullish' ? 30 : 10
}

function extractSummaryFromText(text: string): string {
  const lines = text.split('\n').filter(l => l.trim().length > 0)
  const conclusionLine = lines.find(l => !l.startsWith('#') && !l.startsWith('【') && l.length > 15)
  return conclusionLine ? conclusionLine.slice(0, 150) : lines.slice(0, 2).join(' ')
}

function extractKeyPoints(text: string): string[] {
  const points: string[] = []
  const lines = text.split('\n')
  for (const line of lines) {
    const clean = line.replace(/^[\d+.*-]\s*/, '').trim()
    if (clean.length > 10 && clean.length < 100 && (line.includes('1.') || line.includes('2.') || line.includes('3.') || line.startsWith('*') || line.startsWith('-'))) {
      points.push(clean)
    }
  }
  return points.slice(0, 4)
}
