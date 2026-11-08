'use client'

import React, { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Globe, Sparkles, TrendingUp, Cpu, Coins, BarChart3, Building2 } from 'lucide-react'

export interface TickerItem {
  symbol: string
  name: string
  category: 'us_tech' | 'taiwan' | 'semi_ai' | 'crypto' | 'etf' | 'traditional'
  marketLabel: string
  desc: string
  isHot?: boolean
}

const TICKER_CATALOG: TickerItem[] = [
  // 🇺🇸 美股科技巨擘
  { symbol: 'NVDA', name: '輝達 (NVIDIA)', category: 'us_tech', marketLabel: '美股科技', desc: '全球 AI 算力 GPU 與加速運算霸主', isHot: true },
  { symbol: 'AAPL', name: '蘋果 (Apple)', category: 'us_tech', marketLabel: '美股科技', desc: '消費性電子與生態系軟硬整合龍頭', isHot: true },
  { symbol: 'MSFT', name: '微軟 (Microsoft)', category: 'us_tech', marketLabel: '美股科技', desc: 'Azure 雲端運算與 OpenAI 生態整合者', isHot: true },
  { symbol: 'GOOGL', name: 'Alphabet / Google', category: 'us_tech', marketLabel: '美股科技', desc: '全球搜尋引擎、YouTube 與 Gemini AI', isHot: true },
  { symbol: 'AMZN', name: '亞馬遜 (Amazon)', category: 'us_tech', marketLabel: '美股科技', desc: 'AWS 全球雲端霸主與跨境電商巨頭' },
  { symbol: 'META', name: 'Meta Platforms', category: 'us_tech', marketLabel: '美股科技', desc: '社群網路龍頭與 Llama 開源大模型' },
  { symbol: 'TSLA', name: '特斯拉 (Tesla)', category: 'us_tech', marketLabel: '美股科技', desc: '電動車、FSD 自動駕駛與人形機器人', isHot: true },
  { symbol: 'PLTR', name: 'Palantir', category: 'us_tech', marketLabel: '美股科技', desc: '企業級與國防軍工大數據 AI 分析平台' },
  { symbol: 'NFLX', name: '網飛 (Netflix)', category: 'us_tech', marketLabel: '美股科技', desc: '全球頂尖串流影音訂閱娛樂龍頭' },

  // 🇹🇼 台灣權值與高股息
  { symbol: '2330.TW', name: '台積電 (TSMC)', category: 'taiwan', marketLabel: '台股權值', desc: '全球晶圓代工市占第一·半導體心臟', isHot: true },
  { symbol: '2317.TW', name: '鴻海 (Foxconn)', category: 'taiwan', marketLabel: '台股權值', desc: '全球電子代工巨擘·AI 伺服器機櫃整合', isHot: true },
  { symbol: '2454.TW', name: '聯發科 (MediaTek)', category: 'taiwan', marketLabel: '台股權值', desc: '5G 手機晶片與邊緣 AI 解決方案龍頭' },
  { symbol: '2382.TW', name: '廣達 (Quanta)', category: 'taiwan', marketLabel: '台股權值', desc: '全球 AI 白牌伺服器製造領航者' },
  { symbol: '2308.TW', name: '台達電 (Delta)', category: 'taiwan', marketLabel: '台股權值', desc: '高效能 AI 電源與散熱液冷系統領導者' },
  { symbol: '2603.TW', name: '長榮 (Evergreen)', category: 'taiwan', marketLabel: '台股權值', desc: '全球前十大貨櫃海運巨頭' },
  { symbol: '0050.TW', name: '元大台灣50', category: 'taiwan', marketLabel: '台股 ETF', desc: '追蹤台灣市值前 50 大藍籌權值股', isHot: true },
  { symbol: '0056.TW', name: '元大高股息', category: 'taiwan', marketLabel: '台股 ETF', desc: '精選高現金殖利率標的長期存股首選' },
  { symbol: '00878.TW', name: '國泰永續高股息', category: 'taiwan', marketLabel: '台股 ETF', desc: '結合 ESG 與高股息穩健型季配息 ETF' },
  { symbol: '00919.TW', name: '群益台灣精選高息', category: 'taiwan', marketLabel: '台股 ETF', desc: '高配息現金流導向之熱門台灣高息 ETF' },

  // 🔬 全球半導體與 AI 供應鏈
  { symbol: 'TSM', name: '台積電 ADR (TSMC)', category: 'semi_ai', marketLabel: '全球半導體', desc: '美股 ADR·晶圓代工絕對壟斷優勢', isHot: true },
  { symbol: 'ASML', name: '艾司摩爾 (ASML)', category: 'semi_ai', marketLabel: '全球半導體', desc: '全球唯一 EUV 極紫外光微影設備製造商', isHot: true },
  { symbol: 'AVGO', name: '博通 (Broadcom)', category: 'semi_ai', marketLabel: '全球半導體', desc: '資料中心網路晶片與客製化 ASIC 領先者' },
  { symbol: 'ARM', name: '安謀 (Arm Holdings)', category: 'semi_ai', marketLabel: '全球半導體', desc: '全球低功耗行動與伺服器晶片架構核心' },
  { symbol: 'AMD', name: '超微半導體 (AMD)', category: 'semi_ai', marketLabel: '全球半導體', desc: 'x86 CPU 與 Instinct AI 加速晶片' },
  { symbol: 'MU', name: '美光 (Micron)', category: 'semi_ai', marketLabel: '全球半導體', desc: '高頻寬記憶體 (HBM) 與先進 DRAM/NAND' },
  { symbol: 'QCOM', name: '高通 (Qualcomm)', category: 'semi_ai', marketLabel: '全球半導體', desc: '行動通訊 Snapdragon 與邊緣 AI 晶片' },

  // 🪙 加密貨幣資產
  { symbol: 'BTC-USD', name: '比特幣 (Bitcoin)', category: 'crypto', marketLabel: '加密貨幣', desc: '數位黃金·去中心化價值儲存與抗通膨資產', isHot: true },
  { symbol: 'ETH-USD', name: '以太坊 (Ethereum)', category: 'crypto', marketLabel: '加密貨幣', desc: '智慧合約公鏈之王·去中心化金融與生態底層', isHot: true },
  { symbol: 'SOL-USD', name: '索拉納 (Solana)', category: 'crypto', marketLabel: '加密貨幣', desc: '高輸送量、超低延遲高效能新興 Layer 1', isHot: true },
  { symbol: 'BNB-USD', name: '幣安幣 (BNB)', category: 'crypto', marketLabel: '加密貨幣', desc: '全球最大交易所幣安生態治理資產' },

  // 📈 全球指數與商品 ETF
  { symbol: 'SPY', name: '標普 500 ETF (SPY)', category: 'etf', marketLabel: '美股大盤 ETF', desc: '追蹤美股標普 500 核心權重指數', isHot: true },
  { symbol: 'QQQ', name: '那斯達克 100 ETF (QQQ)', category: 'etf', marketLabel: '美股科技 ETF', desc: '追蹤那斯達克非金融前百大頂尖科技', isHot: true },
  { symbol: 'SOXX', name: '費城半導體 ETF', category: 'etf', marketLabel: '行業 ETF', desc: '直投美股 30 大半導體設計與晶圓製造巨擘' },
  { symbol: 'GLD', name: 'SPDR 黃金信託 (GLD)', category: 'etf', marketLabel: '大宗商品', desc: '實體黃金現貨儲備抗地緣與通膨避險工具' },
  { symbol: 'TLT', name: '美國20年期長天期國債 ETF', category: 'etf', marketLabel: '固定收益', desc: '長天期美債資產·降息循環彈性大' },

  // 🏭 傳統藍籌與金融能源
  { symbol: 'BRK-B', name: '波克夏·海瑟威 (Berkshire)', category: 'traditional', marketLabel: '價值投資', desc: '巴菲特旗艦價值投資控股集團', isHot: true },
  { symbol: 'JPM', name: '摩根大通 (JPMorgan)', category: 'traditional', marketLabel: '金融巨頭', desc: '全美資產規模第一全球綜合金融航母' },
  { symbol: 'XOM', name: '埃克森美孚 (ExxonMobil)', category: 'traditional', marketLabel: '傳統能源', desc: '全球頂級跨國石油與天然氣探勘開採龍頭' },
  { symbol: 'LMT', name: '洛克希德·馬丁 (Lockheed)', category: 'traditional', marketLabel: '國防軍工', desc: 'F-35 戰機與高精尖軍事防務供應商' },
]

const CATEGORY_TABS = [
  { id: 'all', label: '🔥 熱門推薦', icon: Sparkles },
  { id: 'us_tech', label: '🇺🇸 美股科技', icon: TrendingUp },
  { id: 'taiwan', label: '🇹🇼 台灣權值', icon: Building2 },
  { id: 'semi_ai', label: '🔬 半導體 AI', icon: Cpu },
  { id: 'crypto', label: '🪙 加密貨幣', icon: Coins },
  { id: 'etf', label: '📈 指數與 ETF', icon: BarChart3 },
  { id: 'traditional', label: '🏭 藍籌與能源', icon: Globe },
] as const

interface TickerSelectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectTicker: (symbol: string) => void
  currentTicker?: string
}

export function TickerSelectModal({
  open,
  onOpenChange,
  onSelectTicker,
  currentTicker,
}: TickerSelectModalProps) {
  const [activeTab, setActiveTab] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return TICKER_CATALOG.filter(item => {
      // 搜尋文字過濾
      if (q) {
        const matchSymbol = item.symbol.toLowerCase().includes(q)
        const matchName = item.name.toLowerCase().includes(q)
        const matchDesc = item.desc.toLowerCase().includes(q)
        const matchMarket = item.marketLabel.toLowerCase().includes(q)
        if (!matchSymbol && !matchName && !matchDesc && !matchMarket) {
          return false
        }
      }

      // 分類標籤過濾
      if (activeTab === 'all') {
        return q ? true : item.isHot
      }
      return item.category === activeTab
    })
  }, [activeTab, searchQuery])

  const handleSelect = (symbol: string) => {
    onSelectTicker(symbol)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border/80">
        <DialogHeader className="p-5 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <DialogTitle className="text-lg font-bold">選擇投資市場與標的代號</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            點選市場分類或搜尋熱門美股、台股權值、全球半導體、加密貨幣與大盤 ETF
          </DialogDescription>

          {/* 搜尋列 */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜尋代號、股票中文名稱、關鍵字 (例如: 輝達, 2330, BTC, 半導體)"
              className="pl-9 pr-3 text-sm h-9 bg-muted/40"
              autoFocus
            />
          </div>
        </DialogHeader>

        {/* 分類切換 Tabs */}
        <div className="flex items-center gap-1 px-5 py-2.5 border-b border-border/50 bg-muted/20 overflow-x-auto text-xs shrink-0">
          {CATEGORY_TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id)
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* 標的清單列表 */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filteredItems.length === 0 ? (
            <div className="col-span-2 py-12 text-center text-muted-foreground text-xs">
              查無符合「{searchQuery}」的標的，您可以直接在上方輸入自訂股票代號後按 Enter。
            </div>
          ) : (
            filteredItems.map(item => {
              const isSelected = currentTicker === item.symbol
              return (
                <button
                  key={item.symbol}
                  type="button"
                  onClick={() => handleSelect(item.symbol)}
                  className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-1.5 group ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border/60 bg-card hover:border-primary/50 hover:bg-accent/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                          {item.symbol}
                        </span>
                        {item.isHot && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-500/40 text-amber-500 bg-amber-500/10">
                            HOT
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs font-medium text-foreground/90 mt-0.5 line-clamp-1">
                        {item.name}
                      </div>
                    </div>

                    <Badge variant="secondary" className="text-[10px] shrink-0 font-medium">
                      {item.marketLabel}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {item.desc}
                  </p>
                </button>
              )
            })
          )}
        </div>

        {/* 底部輔助 */}
        <div className="p-3 bg-muted/30 border-t border-border/50 text-center text-[11px] text-muted-foreground">
          支援台股 (加 .TW 代號)、美股各大指數與所有主流加密貨幣 (加 -USD)
        </div>
      </DialogContent>
    </Dialog>
  )
}
