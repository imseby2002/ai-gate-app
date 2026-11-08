import type {
  MarketDataSummary,
  AnalystReport,
  DebateSummary,
  TraderProposal,
  RiskAssessment,
  FinalDecision,
  PortfolioContext,
  AnalystRole,
} from './types'

export function generateCompleteReportHtml(params: {
  ticker: string
  analysisDate: string
  marketData: MarketDataSummary
  analysts: Record<AnalystRole, AnalystReport>
  debate: DebateSummary
  traderProposal?: TraderProposal
  riskAssessment?: RiskAssessment
  finalDecision: FinalDecision
  portfolio?: PortfolioContext
  valuationSuite?: import('./valuation-models').ValuationSuiteResult
}): string {
  const {
    ticker,
    analysisDate,
    marketData,
    analysts,
    debate,
    traderProposal,
    riskAssessment,
    finalDecision,
    portfolio,
    valuationSuite,
  } = params

  const actionColorMap: Record<string, string> = {
    'STRONG BUY': '#10b981',
    BUY: '#34d399',
    HOLD: '#f59e0b',
    SELL: '#f87171',
    'STRONG SELL': '#ef4444',
  }
  const badgeColor = actionColorMap[finalDecision.action] || '#6366f1'

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TradingAgents 投資研究報告 · ${ticker} (${analysisDate})</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #38bdf8;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 30px 20px;
    }
    .container { max-width: 1080px; margin: 0 auto; }
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 20px;
    }
    .title-group h1 { font-size: 28px; font-weight: 800; color: #fff; margin-bottom: 4px; }
    .title-group p { color: var(--text-muted); font-size: 14px; }
    .signal-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: ${badgeColor}22;
      border: 2px solid ${badgeColor};
      color: ${badgeColor};
      padding: 10px 24px;
      border-radius: 9999px;
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 1px;
    }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
    }
    .stat-card .label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px; }
    .stat-card .value { font-size: 20px; font-weight: 700; color: #fff; }
    .section {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 12px;
    }
    .analyst-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(480px, 1fr)); gap: 16px; }
    @media (max-width: 600px) { .analyst-grid { grid-template-columns: 1fr; } }
    .analyst-card {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
    }
    .analyst-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .analyst-name { font-weight: 700; font-size: 15px; color: #fff; }
    .score-tag {
      font-size: 12px;
      font-weight: bold;
      padding: 2px 8px;
      border-radius: 6px;
      background: rgba(56, 189, 248, 0.15);
      color: var(--primary);
    }
    .debate-box {
      background: rgba(15, 23, 42, 0.5);
      border-left: 4px solid var(--primary);
      padding: 14px 18px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 14px;
    }
    .debate-speaker { font-size: 13px; font-weight: 700; color: #38bdf8; margin-bottom: 6px; }
    .order-box {
      background: linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%);
      border: 1px solid rgba(56, 189, 248, 0.3);
      border-radius: 12px;
      padding: 20px;
      margin-top: 16px;
    }
    .order-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    .order-table th, .order-table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border); }
    .order-table th { color: var(--text-muted); font-size: 13px; }
    .order-table td { font-weight: 600; font-size: 14px; }
    .footer { text-align: center; color: var(--text-muted); font-size: 12px; margin-top: 40px; padding: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header class="header">
      <div class="title-group">
        <p>TradingAgents 多 Agent 金融決策白皮書 · im-tourist.com</p>
        <h1>${marketData.companyName} (${ticker})</h1>
        <p>分析日期：${analysisDate} | 交易所：${marketData.exchange} | 計價幣別：${marketData.currency}</p>
      </div>
      <div class="signal-badge">
        <span>★</span> ${finalDecision.action}
      </div>
    </header>

    <!-- Key Metrics Grid -->
    <div class="grid">
      <div class="stat-card">
        <div class="label">當前市價</div>
        <div class="value">${marketData.currency} ${marketData.currentPrice.toFixed(2)}</div>
      </div>
      <div class="stat-card">
        <div class="label">目標價 (Target Price)</div>
        <div class="value" style="color: #10b981;">${marketData.currency} ${finalDecision.executionOrder.targetPrice.toFixed(2)}</div>
      </div>
      <div class="stat-card">
        <div class="label">停損價 (Stop Loss)</div>
        <div class="value" style="color: #ef4444;">${marketData.currency} ${finalDecision.executionOrder.stopLossPrice.toFixed(2)}</div>
      </div>
      <div class="stat-card">
        <div class="label">決策信心度</div>
        <div class="value" style="color: #38bdf8;">${finalDecision.confidenceScore}%</div>
      </div>
      <div class="stat-card">
        <div class="label">建議部位佔比</div>
        <div class="value">${finalDecision.executionOrder.suggestedAllocationPercent}%</div>
      </div>
    </div>

    ${portfolio ? `
    <div class="stat-card" style="margin-bottom: 24px; border-color: rgba(56, 189, 248, 0.3);">
      <div class="label" style="color: var(--primary);">💼 投資組合情境 (Portfolio Context)</div>
      <div style="font-size: 14px; color: #cbd5e1; margin-top: 4px;">
        可用資金：<strong>${portfolio.currency} $${portfolio.cash.toLocaleString()}</strong> | 
        現有持股：<strong>${portfolio.positions.map(p => `${p.ticker} (${p.quantity} 股 @ $${p.averagePrice})`).join(', ') || '無部位'}</strong>
      </div>
    </div>
    ` : ''}

    <!-- Technical & Market Context -->
    <section class="section">
      <h2 class="section-title">📊 市場行情與技術指標摘要</h2>
      <div class="grid">
        <div class="stat-card">
          <div class="label">日漲跌幅</div>
          <div class="value" style="color: ${marketData.changePercent >= 0 ? '#10b981' : '#ef4444'};">
            ${marketData.changePercent >= 0 ? '+' : ''}${marketData.changePercent}%
          </div>
        </div>
        <div class="stat-card">
          <div class="label">RSI (14)</div>
          <div class="value">${marketData.technicals.rsi14}</div>
        </div>
        <div class="stat-card">
          <div class="label">MACD 柱狀圖</div>
          <div class="value">${marketData.technicals.macdHistogram}</div>
        </div>
        <div class="stat-card">
          <div class="label">支撐 / 壓力區間</div>
          <div class="value" style="font-size: 16px;">${marketData.technicals.supportLevel} ~ ${marketData.technicals.resistanceLevel}</div>
        </div>
      </div>
    </section>

    ${valuationSuite ? `
    <!-- 10 Valuation Models Matrix -->
    <section class="section">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 16px; flex-wrap: gap: 12px;">
        <h2 class="section-title" style="border-bottom: none; padding-bottom: 0; margin-bottom: 0;">
          📐 十大經典估值量化模型診斷矩陣 (10 Valuation Models Matrix)
        </h2>
        <div style="font-size: 13px; font-weight: bold; background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 4px 12px; border-radius: 9999px;">
          綜合定價裁定：${valuationSuite.overallValuationVerdict} (平均公允價: $${valuationSuite.averageFairValue})
        </div>
      </div>

      <div style="overflow-x: auto;">
        <table class="order-table" style="font-size: 13px;">
          <thead>
            <tr style="background: rgba(15, 23, 42, 0.6);">
              <th>模型名稱</th>
              <th>模型類型</th>
              <th>估算公允股價</th>
              <th>相對現價溢折價</th>
              <th>模型適用度</th>
              <th>核心參數與公式摘要</th>
            </tr>
          </thead>
          <tbody>
            ${valuationSuite.models.map(m => `
              <tr>
                <td style="font-weight: 700; color: #fff;">${m.chineseName}</td>
                <td><span style="font-size: 11px; color: var(--text-muted);">${m.category}</span></td>
                <td style="font-weight: 800; color: #38bdf8;">$${m.fairValue.toFixed(2)}</td>
                <td style="font-weight: 700; color: ${m.premiumDiscountPercent > 0 ? '#ef4444' : '#10b981'};">
                  ${m.premiumDiscountPercent > 0 ? '溢價 +' : '折價 '}${Math.abs(m.premiumDiscountPercent)}%
                </td>
                <td>
                  <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: ${m.applicability.startsWith('High') ? 'rgba(16, 185, 129, 0.2)' : m.applicability.startsWith('Moderate') ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${m.applicability.startsWith('High') ? '#10b981' : m.applicability.startsWith('Moderate') ? '#f59e0b' : '#ef4444'};">
                    ${m.applicability.split(' ')[0]}
                  </span>
                </td>
                <td style="font-size: 12px; color: #94a3b8; max-width: 320px;">
                  <div>${m.summary}</div>
                  <div style="font-family: monospace; font-size: 11px; color: #64748b; margin-top: 2px;">${m.formula}</div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
    ` : ''}

    <!-- Analyst Team Reports -->
    <section class="section">
      <h2 class="section-title">👥 四大專業分析師獨立研判報告 (Analyst Team)</h2>
      <div class="analyst-grid">
        ${Object.values(analysts).map(a => `
          <div class="analyst-card">
            <div class="analyst-header">
              <span class="analyst-name">${a.title}</span>
              <span class="score-tag">評分: ${a.score > 0 ? '+' : ''}${a.score} / 100</span>
            </div>
            <p style="font-size: 14px; margin-bottom: 12px; color: #cbd5e1;">${a.summary}</p>
            <ul style="font-size: 13px; color: var(--text-muted); padding-left: 20px;">
              ${a.keyPoints.map(p => `<li>${p}</li>`).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
    </section>

    <!-- Bull vs Bear Debate -->
    <section class="section">
      <h2 class="section-title">⚔️ 多空研究團隊激辯與共識 (Bull vs Bear Debate)</h2>
      <div style="margin-bottom: 16px; display: flex; gap: 20px;">
        <div style="flex: 1; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 12px;">
          <div style="font-size: 12px; color: #10b981;">多頭機率權重 (Bull Probability)</div>
          <div style="font-size: 24px; font-weight: 800; color: #10b981;">${debate.bullProbability}%</div>
        </div>
        <div style="flex: 1; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 12px;">
          <div style="font-size: 12px; color: #ef4444;">空頭機率權重 (Bear Probability)</div>
          <div style="font-size: 24px; font-weight: 800; color: #ef4444;">${debate.bearProbability}%</div>
        </div>
      </div>
      <div>
        ${debate.statements.map(s => `
          <div class="debate-box">
            <div class="debate-speaker">${s.speaker} · Round ${s.round}</div>
            <div style="font-size: 14px; color: #e2e8f0; white-space: pre-wrap;">${s.content}</div>
          </div>
        `).join('')}
      </div>
      <div style="background: rgba(30, 41, 59, 0.8); border: 1px solid var(--border); padding: 14px; border-radius: 8px; margin-top: 14px;">
        <strong style="color: var(--primary);">研究主管收斂共識：</strong>
        <p style="font-size: 14px; color: #cbd5e1; margin-top: 4px;">${debate.consensusThesis}</p>
      </div>
    </section>

    <!-- Trader & Risk Management -->
    ${traderProposal && riskAssessment ? `
    <section class="section">
      <h2 class="section-title">🎯 交易員策略與風控團隊壓力測試</h2>
      <div class="grid">
        <div class="stat-card">
          <div class="label">風控綜合評分</div>
          <div class="value" style="color: ${riskAssessment.riskScore > 6 ? '#ef4444' : '#10b981'};">
            ${riskAssessment.riskScore} / 10 (${riskAssessment.volatilityRating})
          </div>
        </div>
        <div class="stat-card">
          <div class="label">最大下行風險 (Max Drawdown)</div>
          <div class="value" style="color: #ef4444;">-${riskAssessment.maxDrawdownEstimatePercent}%</div>
        </div>
        <div class="stat-card">
          <div class="label">部位上限風控 (Cap)</div>
          <div class="value">${riskAssessment.positionSizingCapPercent}%</div>
        </div>
        <div class="stat-card">
          <div class="label">風控壓力測試裁決</div>
          <div class="value" style="color: #38bdf8;">${riskAssessment.stressTestVerdict}</div>
        </div>
      </div>
      <div style="font-size: 14px; color: #cbd5e1; margin-top: 12px;">
        <strong>交易員執行邏輯：</strong>
        <p style="margin-top: 4px;">${traderProposal.rationale}</p>
      </div>
    </section>
    ` : ''}

    <!-- Portfolio Manager Final Verdict -->
    <section class="section">
      <h2 class="section-title">👑 基金經理人最高決策與委託訂單 (Final Execution Order)</h2>
      <div style="font-size: 15px; color: #f1f5f9; line-height: 1.7;">
        ${finalDecision.executiveSummary}
      </div>

      <div class="order-box">
        <h3 style="font-size: 16px; font-weight: 700; color: #38bdf8; margin-bottom: 12px;">
          執行委託單據 (Simulated Order Ticket)
        </h3>
        <table class="order-table">
          <tr>
            <th>標的代號</th>
            <td>${finalDecision.executionOrder.ticker}</td>
            <th>訂單動作</th>
            <td style="color: ${badgeColor}; font-weight: bold;">${finalDecision.executionOrder.action}</td>
          </tr>
          <tr>
            <th>委託類型</th>
            <td>${finalDecision.executionOrder.orderType}</td>
            <th>建議配置比率</th>
            <td>${finalDecision.executionOrder.suggestedAllocationPercent}% 總部位</td>
          </tr>
          <tr>
            <th>目標停利價</th>
            <td style="color: #10b981;">${marketData.currency} ${finalDecision.executionOrder.targetPrice.toFixed(2)}</td>
            <th>嚴格停損價</th>
            <td style="color: #ef4444;">${marketData.currency} ${finalDecision.executionOrder.stopLossPrice.toFixed(2)}</td>
          </tr>
          <tr>
            <th>建議持有週期</th>
            <td colspan="3">${finalDecision.holdingPeriodGuidance}</td>
          </tr>
        </table>
      </div>

      <div style="margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 14px;">
          <h4 style="color: #10b981; font-size: 14px; margin-bottom: 8px;">🚀 核心上行催化劑 (Key Catalysts)</h4>
          <ul style="font-size: 13px; color: #cbd5e1; padding-left: 18px;">
            ${finalDecision.keyCatalysts.map(c => `<li>${c}</li>`).join('')}
          </ul>
        </div>
        <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; padding: 14px;">
          <h4 style="color: #ef4444; font-size: 14px; margin-bottom: 8px;">⚠️ 核心下行風險 (Key Risks)</h4>
          <ul style="font-size: 13px; color: #cbd5e1; padding-left: 18px;">
            ${finalDecision.keyRisks.map(r => `<li>${r}</li>`).join('')}
          </ul>
        </div>
      </div>
    </section>

    <footer class="footer">
      <p>TradingAgents Framework · Powered by AI-GATE (im-tourist.com)</p>
      <p style="margin-top: 4px;">免責聲明：本報告由多 Agent LLM 金融架構自動協同生成，僅供學術研究與投資策略分析參考，不構成任何個人財務、投資或交易推薦。</p>
    </footer>
  </div>
</body>
</html>`
}
