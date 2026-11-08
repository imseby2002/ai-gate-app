import type { HistoricalBar, TechnicalStats } from './types'

export function computeIndicators(bars: HistoricalBar[]): TechnicalStats {
  if (!bars || bars.length < 5) {
    return {
      rsi14: 50,
      sma20: 100,
      sma50: 100,
      sma200: 100,
      ema12: 100,
      ema26: 100,
      macdLine: 0,
      macdSignal: 0,
      macdHistogram: 0,
      bollingerUpper: 105,
      bollingerMiddle: 100,
      bollingerLower: 95,
      atr14: 2,
      supportLevel: 95,
      resistanceLevel: 105,
      trendSignal: 'Neutral',
    }
  }

  const closes = bars.map(b => b.close)
  const highs = bars.map(b => b.high)
  const lows = bars.map(b => b.low)
  const currentPrice = closes[closes.length - 1]

  // SMA helper
  const calcSMA = (period: number): number => {
    if (closes.length < period) return closes.reduce((a, b) => a + b, 0) / closes.length
    const slice = closes.slice(-period)
    return slice.reduce((a, b) => a + b, 0) / period
  }

  // EMA series
  const calcEMAArray = (period: number): number[] => {
    const k = 2 / (period + 1)
    const emaArr: number[] = [closes[0]]
    for (let i = 1; i < closes.length; i++) {
      emaArr.push(closes[i] * k + emaArr[i - 1] * (1 - k))
    }
    return emaArr
  }

  const ema12Arr = calcEMAArray(12)
  const ema26Arr = calcEMAArray(26)
  const ema12 = ema12Arr[ema12Arr.length - 1]
  const ema26 = ema26Arr[ema26Arr.length - 1]

  // MACD
  const macdLineSeries = ema12Arr.map((v, i) => v - ema26Arr[i])
  const macdLine = macdLineSeries[macdLineSeries.length - 1]
  // 9-period EMA of MACD Line
  const k9 = 2 / (9 + 1)
  let macdSignal = macdLineSeries[0]
  for (let i = 1; i < macdLineSeries.length; i++) {
    macdSignal = macdLineSeries[i] * k9 + macdSignal * (1 - k9)
  }
  const macdHistogram = macdLine - macdSignal

  // RSI 14
  const calcRSI = (period = 14): number => {
    if (closes.length <= period) return 50
    let gains = 0
    let losses = 0
    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1]
      if (diff >= 0) gains += diff
      else losses += Math.abs(diff)
    }
    let avgGain = gains / period
    let avgLoss = losses / period

    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1]
      const currentGain = diff > 0 ? diff : 0
      const currentLoss = diff < 0 ? Math.abs(diff) : 0
      avgGain = (avgGain * (period - 1) + currentGain) / period
      avgLoss = (avgLoss * (period - 1) + currentLoss) / period
    }

    if (avgLoss === 0) return 100
    const rs = avgGain / avgLoss
    return 100 - 100 / (1 + rs)
  }

  const rsi14 = calcRSI(14)
  const sma20 = calcSMA(20)
  const sma50 = calcSMA(50)
  const sma200 = calcSMA(200)

  // Bollinger Bands (20-day, 2 std dev)
  const recent20 = closes.slice(-20)
  const bbMean = sma20
  const bbVariance = recent20.reduce((acc, val) => acc + Math.pow(val - bbMean, 2), 0) / recent20.length
  const bbStdDev = Math.sqrt(bbVariance)
  const bollingerUpper = bbMean + 2 * bbStdDev
  const bollingerMiddle = bbMean
  const bollingerLower = bbMean - 2 * bbStdDev

  // ATR 14
  let atrSum = 0
  const atrPeriod = Math.min(14, bars.length - 1)
  for (let i = bars.length - atrPeriod; i < bars.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    )
    atrSum += tr
  }
  const atr14 = atrPeriod > 0 ? atrSum / atrPeriod : currentPrice * 0.02

  // Support & Resistance (recent 30-day pivot lows / highs)
  const recentBars = bars.slice(-30)
  const minLow = Math.min(...recentBars.map(b => b.low))
  const maxHigh = Math.max(...recentBars.map(b => b.high))

  // Trend determination
  let trendScore = 0
  if (currentPrice > sma20) trendScore += 1
  if (currentPrice > sma50) trendScore += 1
  if (sma20 > sma50) trendScore += 1
  if (macdHistogram > 0) trendScore += 1
  if (rsi14 > 50 && rsi14 < 75) trendScore += 1

  let trendSignal: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral'
  if (trendScore >= 4) trendSignal = 'Bullish'
  else if (trendScore <= 1) trendSignal = 'Bearish'

  return {
    rsi14: Math.round(rsi14 * 10) / 10,
    sma20: Math.round(sma20 * 100) / 100,
    sma50: Math.round(sma50 * 100) / 100,
    sma200: Math.round(sma200 * 100) / 100,
    ema12: Math.round(ema12 * 100) / 100,
    ema26: Math.round(ema26 * 100) / 100,
    macdLine: Math.round(macdLine * 100) / 100,
    macdSignal: Math.round(macdSignal * 100) / 100,
    macdHistogram: Math.round(macdHistogram * 100) / 100,
    bollingerUpper: Math.round(bollingerUpper * 100) / 100,
    bollingerMiddle: Math.round(bollingerMiddle * 100) / 100,
    bollingerLower: Math.round(bollingerLower * 100) / 100,
    atr14: Math.round(atr14 * 100) / 100,
    supportLevel: Math.round(minLow * 100) / 100,
    resistanceLevel: Math.round(maxHigh * 100) / 100,
    trendSignal,
  }
}
