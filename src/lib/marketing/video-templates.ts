export type VideoCategory =
  | 'all'
  | 'ad_conversion'
  | 'product_display'
  | 'social_viral'
  | 'trust_authority'
  | 'tutorial_sop'
  | 'tech_structure'
  | 'events_campaigns'

export interface ScriptTimelineItem {
  time: string
  content: string
}

export interface VideoTemplate {
  id: string
  command: string
  title: string
  category: VideoCategory
  applicability: string
  scriptTimeline: ScriptTimelineItem[]
  rawScript: string
  params: string
  defaultAspect: '9:16' | '16:9' | '1:1' | '4:5'
  recommendedSeconds: number
  badge?: string
  gradient: string
  tags: string[]
  positivePrompt: string
  negativePrompt: string
}

export const VIDEO_CATEGORIES: { key: VideoCategory; label: string; icon: string; desc: string }[] = [
  { key: 'all',              label: '全部影片模板', icon: 'Video',        desc: '匯聚 185 種行銷落地與產品展示影片指令模板' },
  { key: 'ad_conversion',    label: '廣告與高轉換', icon: 'Zap',          desc: '3秒鉤子、痛點放大、前後對比、A/B測試、6s~60s廣告' },
  { key: 'product_display',  label: '展品與產品展示', icon: 'Box',        desc: '展區攤位、360°產品、微距細節、情境使用、包裝陳列' },
  { key: 'social_viral',     label: '社群爆款短影', icon: 'Flame',        desc: 'UGC開箱、ASMR飲品、療癒循環、Reels/TikTok/Shorts' },
  { key: 'trust_authority',  label: '品牌信任證言', icon: 'ShieldCheck',  desc: '15秒證言、創辦人寄語、品牌故事、案例研究、專家背書' },
  { key: 'tutorial_sop',     label: '教學配方SOP',  icon: 'BookOpen',     desc: '15秒教學、配方SOP、60秒流程、倒入序列、問答指南' },
  { key: 'tech_structure',   label: '結構動效實測', icon: 'Layers',       desc: '分割視圖、X光、爆炸動畫、品檢、耐摔防水壓力測試' },
  { key: 'events_campaigns', label: '活動檔期營運', icon: 'Gift',         desc: '黑五週年慶、新店開幕、抽獎得獎、節慶祝福、加盟徵才' },
]

export const VIDEO_TEMPLATES: VideoTemplate[] = [
  {
    "id": "hook3sec",
    "command": "/hook3sec",
    "title": "3 秒鉤子",
    "category": "ad_conversion",
    "applicability": "短影片開頭，提升停留。",
    "scriptTimeline": [
      {
        "time": "0–1s",
        "content": "大字鉤子（例：「這杯讓你多賣 30%」）＋產品特寫"
      },
      {
        "time": "1–2s",
        "content": "痛點一句（例：「客人總說沒特色？」）"
      },
      {
        "time": "2–3s",
        "content": "承諾一句（例：「3 步打造招牌飲」）"
      }
    ],
    "rawScript": "0–1s：大字鉤子（例：「這杯讓你多賣 30%」）＋產品特寫\n\n1–2s：痛點一句（例：「客人總說沒特色？」）\n\n2–3s：承諾一句（例：「3 步打造招牌飲」）",
    "params": "9:16；字大、對比高；前 3 秒不超過 12 字。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": "核心爆款",
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "3 秒鉤子",
      "9:16比例",
      "3秒",
      "開頭停留"
    ],
    "positivePrompt": "cinematic commercial video, hook3sec style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "problemagitate",
    "command": "/problemagitate",
    "title": "痛點放大",
    "category": "ad_conversion",
    "applicability": "教育型投放、著陸頁影片。",
    "scriptTimeline": [
      {
        "time": "0–2s",
        "content": "痛點場景（空杯/冷場）"
      },
      {
        "time": "2–5s",
        "content": "數據一句（例：「同質化＝比價」）"
      },
      {
        "time": "5–8s",
        "content": "過渡到解法"
      }
    ],
    "rawScript": "0–2s：痛點場景（空杯/冷場）\n\n2–5s：數據一句（例：「同質化＝比價」）\n\n5–8s：過渡到解法",
    "params": "9:16 或 16:9；BGM 低、旁白清楚。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": "核心爆款",
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "痛點放大",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, problemagitate style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "solutionreveal",
    "command": "/solutionreveal",
    "title": "解法揭曉",
    "category": "ad_conversion",
    "applicability": "新品/功能發表。",
    "scriptTimeline": [
      {
        "time": "0–2s",
        "content": "產品登場（hero shot）"
      },
      {
        "time": "2–5s",
        "content": "利益點 1 句（例：「3 層口感，記憶點強」）"
      },
      {
        "time": "5–8s",
        "content": "CTA（例：「留言拿配方」）"
      }
    ],
    "rawScript": "0–2s：產品登場（hero shot）\n\n2–5s：利益點 1 句（例：「3 層口感，記憶點強」）\n\n5–8s：CTA（例：「留言拿配方」）",
    "params": "9:16；主體居中、CTA 在下 1/3。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": "核心爆款",
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "解法揭曉",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, solutionreveal style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "beforeaftervid",
    "command": "/beforeaftervid",
    "title": "前後對比影片",
    "category": "ad_conversion",
    "applicability": "功效/轉換提升。",
    "scriptTimeline": [
      {
        "time": "0–2s",
        "content": "Before 標籤＋舊畫面"
      },
      {
        "time": "2–4s",
        "content": "轉場（wipe/滑動）"
      },
      {
        "time": "4–6s",
        "content": "After 標籤＋新畫面"
      },
      {
        "time": "6–8s",
        "content": "數據或結論一句"
      }
    ],
    "rawScript": "0–2s：Before 標籤＋舊畫面\n\n2–4s：轉場（wipe/滑動）\n\n4–6s：After 標籤＋新畫面\n\n6–8s：數據或結論一句",
    "params": "9:16；轉場乾脆、對比明顯。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": "核心爆款",
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "前後對比影片",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, beforeaftervid style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "testimonial15s",
    "command": "/testimonial15s",
    "title": "15 秒證言",
    "category": "trust_authority",
    "applicability": "信任建立、投放素材。",
    "scriptTimeline": [
      {
        "time": "0–2s",
        "content": "人像＋職稱"
      },
      {
        "time": "2–8s",
        "content": "金句 1 句（例：「這招讓我們回購＋40%」）"
      },
      {
        "time": "8–12s",
        "content": "佐證 1 個（數據/畫面）"
      },
      {
        "time": "12–15s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–2s：人像＋職稱\n\n2–8s：金句 1 句（例：「這招讓我們回購＋40%」）\n\n8–12s：佐證 1 個（數據/畫面）\n\n12–15s：CTA",
    "params": "9:16；字幕大字、背景不搶。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": "核心爆款",
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "15 秒證言",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, testimonial15s style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "ugcreview",
    "command": "/ugcreview",
    "title": "UGC 開箱",
    "category": "social_viral",
    "applicability": "降低廣告感、提高信任。",
    "scriptTimeline": [
      {
        "time": "0–2s",
        "content": "手持產品（POV）"
      },
      {
        "time": "2–6s",
        "content": "第一印象 1 句"
      },
      {
        "time": "6–10s",
        "content": "亮點 1 個"
      },
      {
        "time": "10–15s",
        "content": "是否推薦＋CTA"
      }
    ],
    "rawScript": "0–2s：手持產品（POV）\n\n2–6s：第一印象 1 句\n\n6–10s：亮點 1 個\n\n10–15s：是否推薦＋CTA",
    "params": "9:16；自然光、生活感。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": "真實信任",
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "UGC 開箱",
      "9:16比例",
      "15秒",
      "真實感"
    ],
    "positivePrompt": "cinematic commercial video, ugcreview style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "unboxing15s",
    "command": "/unboxing15s",
    "title": "15 秒開箱",
    "category": "product_display",
    "applicability": "新品、套組。",
    "scriptTimeline": [
      {
        "time": "0–2s",
        "content": "盒封特寫"
      },
      {
        "time": "2–6s",
        "content": "開箱動作"
      },
      {
        "time": "6–10s",
        "content": "內容物平鋪"
      },
      {
        "time": "10–15s",
        "content": "推薦理由 1 句"
      }
    ],
    "rawScript": "0–2s：盒封特寫\n\n2–6s：開箱動作\n\n6–10s：內容物平鋪\n\n10–15s：推薦理由 1 句",
    "params": "9:16；頂視角＋45 度角混剪。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "15 秒開箱",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, unboxing15s style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "featurebenefit",
    "command": "/featurebenefit",
    "title": "功能→利益",
    "category": "tutorial_sop",
    "applicability": "功能說明、B2B。",
    "scriptTimeline": [
      {
        "time": "0–2s",
        "content": "功能名稱"
      },
      {
        "time": "2–5s",
        "content": "功能畫面"
      },
      {
        "time": "5–8s",
        "content": "對應利益 1 句"
      },
      {
        "time": "8–12s",
        "content": "情境使用"
      }
    ],
    "rawScript": "0–2s：功能名稱\n\n2–5s：功能畫面\n\n5–8s：對應利益 1 句\n\n8–12s：情境使用",
    "params": "16:9 或 9:16；一功能一影片。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "功能→利益",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, featurebenefit style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "howto15s",
    "command": "/howto15s",
    "title": "15 秒教學",
    "category": "tutorial_sop",
    "applicability": "快速秘訣、飲品調製。",
    "scriptTimeline": [
      {
        "time": "0–1s",
        "content": "標題（例：「3 步做出分層」）"
      },
      {
        "time": "1–5s",
        "content": "Step1"
      },
      {
        "time": "5–9s",
        "content": "Step2"
      },
      {
        "time": "9–13s",
        "content": "Step3＋成品"
      }
    ],
    "rawScript": "0–1s：標題（例：「3 步做出分層」）\n\n1–5s：Step1\n\n5–9s：Step2\n\n9–13s：Step3＋成品",
    "params": "9:16；每步不超過 4 字。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "15 秒教學",
      "9:16比例",
      "15秒",
      "SOP教學"
    ],
    "positivePrompt": "cinematic commercial video, howto15s style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "recipe15s",
    "command": "/recipe15s",
    "title": "15 秒配方",
    "category": "tutorial_sop",
    "applicability": "飲品教學、門市 SOP。",
    "scriptTimeline": [
      {
        "time": "0–2s",
        "content": "成品特寫"
      },
      {
        "time": "2–5s",
        "content": "材料 3 項內"
      },
      {
        "time": "5–10s",
        "content": "關鍵步驟 2 步"
      },
      {
        "time": "10–15s",
        "content": "成品＋CTA"
      }
    ],
    "rawScript": "0–2s：成品特寫\n\n2–5s：材料 3 項內\n\n5–10s：關鍵步驟 2 步\n\n10–15s：成品＋CTA",
    "params": "9:16；材料用 icon＋文字。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "15 秒配方",
      "9:16比例",
      "15秒",
      "SOP教學"
    ],
    "positivePrompt": "cinematic commercial video, recipe15s style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "process60s",
    "command": "/process60s",
    "title": "60 秒流程",
    "category": "tutorial_sop",
    "applicability": "完整製作流程、教育內容。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "標題＋成品"
      },
      {
        "time": "3–15s",
        "content": "備料"
      },
      {
        "time": "15–35s",
        "content": "製作（分鏡 3–4 鏡）"
      },
      {
        "time": "35–50s",
        "content": "裝杯/裝飾"
      },
      {
        "time": "50–60s",
        "content": "成品＋成本/毛利一句"
      }
    ],
    "rawScript": "0–3s：標題＋成品\n\n3–15s：備料\n\n15–35s：製作（分鏡 3–4 鏡）\n\n35–50s：裝杯/裝飾\n\n50–60s：成品＋成本/毛利一句",
    "params": "9:16 或 16:9；加時間軸字幕。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 60,
    "badge": null,
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "60 秒流程",
      "9:16比例",
      "60秒"
    ],
    "positivePrompt": "cinematic commercial video, process60s style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "poursequence",
    "command": "/poursequence",
    "title": "倒入序列影片",
    "category": "tutorial_sop",
    "applicability": "分層飲品、視覺系。",
    "scriptTimeline": [
      {
        "time": "0–2s",
        "content": "杯空特寫"
      },
      {
        "time": "2–6s",
        "content": "第一層倒入"
      },
      {
        "time": "6–10s",
        "content": "第二層倒入"
      },
      {
        "time": "10–14s",
        "content": "第三層/裝飾"
      },
      {
        "time": "14–18s",
        "content": "成品 360°"
      }
    ],
    "rawScript": "0–2s：杯空特寫\n\n2–6s：第一層倒入\n\n6–10s：第二層倒入\n\n10–14s：第三層/裝飾\n\n14–18s：成品 360°",
    "params": "9:16；逆光顯色、慢動作。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 60,
    "badge": null,
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "倒入序列影片",
      "9:16比例",
      "60秒"
    ],
    "positivePrompt": "cinematic commercial video, poursequence style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "asmrdrink",
    "command": "/asmrdrink",
    "title": "ASMR 飲品",
    "category": "social_viral",
    "applicability": "感官吸引、短影片。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "冰塊入杯"
      },
      {
        "time": "3–8s",
        "content": "倒液體聲"
      },
      {
        "time": "8–12s",
        "content": "攪拌/氣泡"
      },
      {
        "time": "12–18s",
        "content": "第一口"
      }
    ],
    "rawScript": "0–3s：冰塊入杯\n\n3–8s：倒液體聲\n\n8–12s：攪拌/氣泡\n\n12–18s：第一口",
    "params": "9:16；收聲乾淨、少 BGM。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": "感官沉浸",
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "ASMR 飲",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, asmrdrink style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "satisfyingloop",
    "command": "/satisfyingloop",
    "title": "療癒循環",
    "category": "social_viral",
    "applicability": "提高完播率。",
    "scriptTimeline": [
      {
        "time": "0–2s",
        "content": "動作起點（例：倒奶）"
      },
      {
        "time": "2–6s",
        "content": "過程"
      },
      {
        "time": "6–8s",
        "content": "回到起點畫面（無縫循環）"
      }
    ],
    "rawScript": "0–2s：動作起點（例：倒奶）\n\n2–6s：過程\n\n6–8s：回到起點畫面（無縫循環）",
    "params": "9:16；首尾帧一致。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "療癒循環",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, satisfyingloop style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "mythbust15s",
    "command": "/mythbust15s",
    "title": "迷思破解",
    "category": "tutorial_sop",
    "applicability": "教育內容。",
    "scriptTimeline": [
      {
        "time": "0–2s",
        "content": "迷思大字"
      },
      {
        "time": "2–6s",
        "content": "錯誤示範"
      },
      {
        "time": "6–10s",
        "content": "正確做法"
      },
      {
        "time": "10–15s",
        "content": "結論一句"
      }
    ],
    "rawScript": "0–2s：迷思大字\n\n2–6s：錯誤示範\n\n6–10s：正確做法\n\n10–15s：結論一句",
    "params": "9:16；對比清楚。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "迷思破解",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, mythbust15s style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "faq15s",
    "command": "/faq15s",
    "title": "15 秒 QA",
    "category": "tutorial_sop",
    "applicability": "投放教育、客服減負。",
    "scriptTimeline": [
      {
        "time": "0–2s",
        "content": "問題大字"
      },
      {
        "time": "2–8s",
        "content": "答案 1 句＋畫面"
      },
      {
        "time": "8–12s",
        "content": "補充 1 句"
      },
      {
        "time": "12–15s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–2s：問題大字\n\n2–8s：答案 1 句＋畫面\n\n8–12s：補充 1 句\n\n12–15s：CTA",
    "params": "9:16；一題一影片。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "15 秒 Q",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, faq15s style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "priceexplain",
    "command": "/priceexplain",
    "title": "價格說明",
    "category": "ad_conversion",
    "applicability": "高單價、套組。",
    "scriptTimeline": [
      {
        "time": "0–2s",
        "content": "價格大字"
      },
      {
        "time": "2–6s",
        "content": "包含內容 3 項"
      },
      {
        "time": "6–10s",
        "content": "價值對比（原價/市價）"
      },
      {
        "time": "10–15s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–2s：價格大字\n\n2–6s：包含內容 3 項\n\n6–10s：價值對比（原價/市價）\n\n10–15s：CTA",
    "params": "9:16；數字大、條列清楚。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "價格說明",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, priceexplain style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "offerreveal",
    "command": "/offerreveal",
    "title": "優惠揭曉",
    "category": "ad_conversion",
    "applicability": "促銷檔期。",
    "scriptTimeline": [
      {
        "time": "0–2s",
        "content": "倒數/遮罩"
      },
      {
        "time": "2–5s",
        "content": "優惠揭開"
      },
      {
        "time": "5–10s",
        "content": "條件一句"
      },
      {
        "time": "10–15s",
        "content": "截止日＋CTA"
      }
    ],
    "rawScript": "0–2s：倒數/遮罩\n\n2–5s：優惠揭開\n\n5–10s：條件一句\n\n10–15s：截止日＋CTA",
    "params": "9:16；節奏快。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "優惠揭曉",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, offerreveal style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "countdownvid",
    "command": "/countdownvid",
    "title": "倒數影片",
    "category": "ad_conversion",
    "applicability": "限時優惠、活動開始。",
    "scriptTimeline": [
      {
        "time": "0–2s",
        "content": "現在時間/日期"
      },
      {
        "time": "2–6s",
        "content": "倒數數字動畫"
      },
      {
        "time": "6–10s",
        "content": "優惠內容"
      },
      {
        "time": "10–15s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–2s：現在時間/日期\n\n2–6s：倒數數字動畫\n\n6–10s：優惠內容\n\n10–15s：CTA",
    "params": "9:16；數字超大。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "倒數影片",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, countdownvid style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "launchtrailer",
    "command": "/launchtrailer",
    "title": "發表預告",
    "category": "events_campaigns",
    "applicability": "新品/活動。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "品牌 logo＋年份"
      },
      {
        "time": "3–8s",
        "content": "痛點/願景一句"
      },
      {
        "time": "8–15s",
        "content": "產品剪影"
      },
      {
        "time": "15–30s",
        "content": "日期＋CTA"
      }
    ],
    "rawScript": "0–3s：品牌 logo＋年份\n\n3–8s：痛點/願景一句\n\n8–15s：產品剪影\n\n15–30s：日期＋CTA",
    "params": "16:9 或 9:16；音樂鋪陳。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "發表預告",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, launchtrailer style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "brandstory30s",
    "command": "/brandstory30s",
    "title": "30 秒品牌故事",
    "category": "trust_authority",
    "applicability": "形象影片、官網。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "起源一句"
      },
      {
        "time": "5–15s",
        "content": "核心價值 1 句＋畫面"
      },
      {
        "time": "15–25s",
        "content": "成果/影響 1 句"
      },
      {
        "time": "25–30s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–5s：起源一句\n\n5–15s：核心價值 1 句＋畫面\n\n15–25s：成果/影響 1 句\n\n25–30s：CTA",
    "params": "16:9；旁白溫暖。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "30 秒品牌",
      "16:9比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, brandstory30s style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "foundernote",
    "command": "/foundernote",
    "title": "創辦人寄語",
    "category": "trust_authority",
    "applicability": "信任建立、募資。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "自我介紹"
      },
      {
        "time": "5–15s",
        "content": "為什麼做"
      },
      {
        "time": "15–25s",
        "content": "承諾一句"
      },
      {
        "time": "25–30s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–5s：自我介紹\n\n5–15s：為什麼做\n\n15–25s：承諾一句\n\n25–30s：CTA",
    "params": "9:16 或 16:9；眼神直視。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "創辦人寄語",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, foundernote style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "teamintro",
    "command": "/teamintro",
    "title": "團隊介紹",
    "category": "product_display",
    "applicability": "徵才、品牌親和。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "團隊合照"
      },
      {
        "time": "3–10s",
        "content": "角色輪替（2–3 人）"
      },
      {
        "time": "10–20s",
        "content": "文化一句"
      },
      {
        "time": "20–30s",
        "content": "CTA（加入/關注）"
      }
    ],
    "rawScript": "0–3s：團隊合照\n\n3–10s：角色輪替（2–3 人）\n\n10–20s：文化一句\n\n20–30s：CTA（加入/關注）",
    "params": "9:16；人名職稱字幕。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "團隊介紹",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, teamintro style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "behindthescenes",
    "command": "/behindthescenes",
    "title": "幕後",
    "category": "social_viral",
    "applicability": "親和力、內容系列。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "標題（幕後）"
      },
      {
        "time": "3–10s",
        "content": "準備過程"
      },
      {
        "time": "10–20s",
        "content": "關鍵瞬間"
      },
      {
        "time": "20–30s",
        "content": "成品一瞥"
      }
    ],
    "rawScript": "0–3s：標題（幕後）\n\n3–10s：準備過程\n\n10–20s：關鍵瞬間\n\n20–30s：成品一瞥",
    "params": "9:16；手持感。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "幕後",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, behindthescenes style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "dayinlife",
    "command": "/dayinlife",
    "title": "一日日常",
    "category": "social_viral",
    "applicability": "人員/IP 塑造。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "起床/開店"
      },
      {
        "time": "3–10s",
        "content": "工作片段 2–3 鏡"
      },
      {
        "time": "10–20s",
        "content": "亮點時刻"
      },
      {
        "time": "20–30s",
        "content": "收尾一句"
      }
    ],
    "rawScript": "0–3s：起床/開店\n\n3–10s：工作片段 2–3 鏡\n\n10–20s：亮點時刻\n\n20–30s：收尾一句",
    "params": "9:16；快剪。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "一日日常",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, dayinlife style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "eventhighlight",
    "command": "/eventhighlight",
    "title": "活動精華",
    "category": "events_campaigns",
    "applicability": "回顧、招生。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "活動名＋日期"
      },
      {
        "time": "3–10s",
        "content": "精彩片段 3 鏡"
      },
      {
        "time": "10–20s",
        "content": "參與者反應"
      },
      {
        "time": "20–30s",
        "content": "下一場日期＋CTA"
      }
    ],
    "rawScript": "0–3s：活動名＋日期\n\n3–10s：精彩片段 3 鏡\n\n10–20s：參與者反應\n\n20–30s：下一場日期＋CTA",
    "params": "9:16 或 16:9；音樂節奏強。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "活動精華",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, eventhighlight style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "workshoprecapvid",
    "command": "/workshoprecapvid",
    "title": "課程回顧影片",
    "category": "tutorial_sop",
    "applicability": "教育內容、招生。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "課程名"
      },
      {
        "time": "3–10s",
        "content": "學員操作"
      },
      {
        "time": "10–20s",
        "content": "成果展示"
      },
      {
        "time": "20–30s",
        "content": "學員一句＋下期日期"
      }
    ],
    "rawScript": "0–3s：課程名\n\n3–10s：學員操作\n\n10–20s：成果展示\n\n20–30s：學員一句＋下期日期",
    "params": "9:16；重點 3 條字幕。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "課程回顧影片",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, workshoprecapvid style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "casestudy30s",
    "command": "/casestudy30s",
    "title": "30 秒案例",
    "category": "trust_authority",
    "applicability": "B2B、加盟。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "客戶名/產業"
      },
      {
        "time": "3–10s",
        "content": "挑戰一句"
      },
      {
        "time": "10–20s",
        "content": "做法 1 句＋畫面"
      },
      {
        "time": "20–30s",
        "content": "結果數據＋CTA"
      }
    ],
    "rawScript": "0–3s：客戶名/產業\n\n3–10s：挑戰一句\n\n10–20s：做法 1 句＋畫面\n\n20–30s：結果數據＋CTA",
    "params": "16:9；數據大字。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "30 秒案例",
      "16:9比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, casestudy30s style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "resultsreveal",
    "command": "/resultsreveal",
    "title": "結果揭曉",
    "category": "trust_authority",
    "applicability": "投放、信任。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "問題"
      },
      {
        "time": "3–8s",
        "content": "做法"
      },
      {
        "time": "8–15s",
        "content": "結果數字"
      },
      {
        "time": "15–20s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：問題\n\n3–8s：做法\n\n8–15s：結果數字\n\n15–20s：CTA",
    "params": "9:16；只強調一個指標。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "結果揭曉",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, resultsreveal style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "productdemo30s",
    "command": "/productdemo30s",
    "title": "30 秒產品演示",
    "category": "product_display",
    "applicability": "官網、投放。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "產品登場"
      },
      {
        "time": "3–10s",
        "content": "功能 1"
      },
      {
        "time": "10–20s",
        "content": "功能 2"
      },
      {
        "time": "20–30s",
        "content": "利益總結＋CTA"
      }
    ],
    "rawScript": "0–3s：產品登場\n\n3–10s：功能 1\n\n10–20s：功能 2\n\n20–30s：利益總結＋CTA",
    "params": "16:9；一功能一鏡頭。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "30 秒產品",
      "16:9比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, productdemo30s style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "comparisonvid",
    "command": "/comparisonvid",
    "title": "對比影片",
    "category": "ad_conversion",
    "applicability": "產品差異化。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "A vs B 標題"
      },
      {
        "time": "3–10s",
        "content": "A 特點 1"
      },
      {
        "time": "10–18s",
        "content": "B 特點 1"
      },
      {
        "time": "18–25s",
        "content": "結論一句"
      }
    ],
    "rawScript": "0–3s：A vs B 標題\n\n3–10s：A 特點 1\n\n10–18s：B 特點 1\n\n18–25s：結論一句",
    "params": "9:16 或 16:9；公平表述。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "對比影片",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, comparisonvid style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "vscompetitorvid",
    "command": "/vscompetitorvid",
    "title": "VS 競品影片",
    "category": "ad_conversion",
    "applicability": "差異溝通（注意合規）。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "對比維度"
      },
      {
        "time": "3–10s",
        "content": "我方優勢"
      },
      {
        "time": "10–18s",
        "content": "對方限制（客觀）"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：對比維度\n\n3–10s：我方優勢\n\n10–18s：對方限制（客觀）\n\n18–25s：CTA",
    "params": "16:9；避免貶抑用詞。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "VS 競品影",
      "16:9比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, vscompetitorvid style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "tierexplain",
    "command": "/tierexplain",
    "title": "方案說明",
    "category": "ad_conversion",
    "applicability": "Basic/Pro/Enterprise。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "三方案名"
      },
      {
        "time": "3–10s",
        "content": "各方案核心差異"
      },
      {
        "time": "10–20s",
        "content": "推薦方案理由"
      },
      {
        "time": "20–30s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：三方案名\n\n3–10s：各方案核心差異\n\n10–20s：推薦方案理由\n\n20–30s：CTA",
    "params": "16:9；表格動畫。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "方案說明",
      "16:9比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, tierexplain style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "bundleexplain",
    "command": "/bundleexplain",
    "title": "套組說明",
    "category": "product_display",
    "applicability": "電商、門市。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "套組名"
      },
      {
        "time": "3–10s",
        "content": "內容物"
      },
      {
        "time": "10–20s",
        "content": "省多少"
      },
      {
        "time": "20–30s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：套組名\n\n3–10s：內容物\n\n10–20s：省多少\n\n20–30s：CTA",
    "params": "9:16；數字大。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "套組說明",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, bundleexplain style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "upsellvid",
    "command": "/upsellvid",
    "title": "加購說明",
    "category": "ad_conversion",
    "applicability": "結帳頁、門市。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "主商品"
      },
      {
        "time": "3–8s",
        "content": "加購品"
      },
      {
        "time": "8–15s",
        "content": "加購價/省多少"
      },
      {
        "time": "15–20s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：主商品\n\n3–8s：加購品\n\n8–15s：加購價/省多少\n\n15–20s：CTA",
    "params": "9:16；簡單數學。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "加購說明",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, upsellvid style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "referralvid",
    "command": "/referralvid",
    "title": "推薦說明",
    "category": "events_campaigns",
    "applicability": "老帶新。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "你得到 X"
      },
      {
        "time": "3–8s",
        "content": "朋友得到 Y"
      },
      {
        "time": "8–15s",
        "content": "如何操作 1 句"
      },
      {
        "time": "15–20s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：你得到 X\n\n3–8s：朋友得到 Y\n\n8–15s：如何操作 1 句\n\n15–20s：CTA",
    "params": "9:16；流程 3 步內。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "推薦說明",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, referralvid style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "affiliatepitch",
    "command": "/affiliatepitch",
    "title": "聯盟招募",
    "category": "events_campaigns",
    "applicability": "分潤計畫。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "你能賺多少"
      },
      {
        "time": "3–10s",
        "content": "如何開始 2 步"
      },
      {
        "time": "10–20s",
        "content": "支援資源"
      },
      {
        "time": "20–30s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：你能賺多少\n\n3–10s：如何開始 2 步\n\n10–20s：支援資源\n\n20–30s：CTA",
    "params": "16:9；避免過度承諾。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "聯盟招募",
      "16:9比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, affiliatepitch style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "franchisevid",
    "command": "/franchisevid",
    "title": "加盟說明",
    "category": "events_campaigns",
    "applicability": "加盟招募。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "投資區間"
      },
      {
        "time": "5–15s",
        "content": "支援 3 項"
      },
      {
        "time": "15–25s",
        "content": "成功案例一句"
      },
      {
        "time": "25–30s",
        "content": "說明會日期＋CTA"
      }
    ],
    "rawScript": "0–5s：投資區間\n\n5–15s：支援 3 項\n\n15–25s：成功案例一句\n\n25–30s：說明會日期＋CTA",
    "params": "16:9；數據真實。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "加盟說明",
      "16:9比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, franchisevid style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "hiringvid",
    "command": "/hiringvid",
    "title": "徵才影片",
    "category": "events_campaigns",
    "applicability": "門市、辦公室。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "職稱"
      },
      {
        "time": "3–10s",
        "content": "工作內容 2 點"
      },
      {
        "time": "10–20s",
        "content": "福利 2 點"
      },
      {
        "time": "20–30s",
        "content": "_apply CTA"
      }
    ],
    "rawScript": "0–3s：職稱\n\n3–10s：工作內容 2 點\n\n10–20s：福利 2 點\n\n20–30s：_apply CTA",
    "params": "9:16；環境鏡頭。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "徵才影片",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, hiringvid style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "culturevid",
    "command": "/culturevid",
    "title": "文化影片",
    "category": "trust_authority",
    "applicability": "雇主品牌。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "文化一句"
      },
      {
        "time": "5–15s",
        "content": "日常片段 3 鏡"
      },
      {
        "time": "15–25s",
        "content": "成員一句"
      },
      {
        "time": "25–30s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–5s：文化一句\n\n5–15s：日常片段 3 鏡\n\n15–25s：成員一句\n\n25–30s：CTA",
    "params": "16:9；真實感。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "文化影片",
      "16:9比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, culturevid style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "eventteaser",
    "command": "/eventteaser",
    "title": "活動預告",
    "category": "events_campaigns",
    "applicability": "講座、快閃。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "活動名"
      },
      {
        "time": "3–8s",
        "content": "亮點 2 點"
      },
      {
        "time": "8–15s",
        "content": "講者/嘉賓"
      },
      {
        "time": "15–20s",
        "content": "日期地點＋CTA"
      }
    ],
    "rawScript": "0–3s：活動名\n\n3–8s：亮點 2 點\n\n8–15s：講者/嘉賓\n\n15–20s：日期地點＋CTA",
    "params": "9:16；節奏快。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "活動預告",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, eventteaser style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "speakerintro",
    "command": "/speakerintro",
    "title": "講者介紹",
    "category": "product_display",
    "applicability": "活動宣傳。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "講者名"
      },
      {
        "time": "3–10s",
        "content": "頭銜/成就"
      },
      {
        "time": "10–18s",
        "content": "分享主題"
      },
      {
        "time": "18–25s",
        "content": "日期＋CTA"
      }
    ],
    "rawScript": "0–3s：講者名\n\n3–10s：頭銜/成就\n\n10–18s：分享主題\n\n18–25s：日期＋CTA",
    "params": "9:16；肖像清晰。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "講者介紹",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, speakerintro style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "countdownseries",
    "command": "/countdownseries",
    "title": "倒數系列",
    "category": "ad_conversion",
    "applicability": "活動/上市前 3–5 支。",
    "scriptTimeline": [
      {
        "time": "階段",
        "content": "每支：天數大字＋一個亮點"
      }
    ],
    "rawScript": "每支：天數大字＋一個亮點",
    "params": "9:16；視覺一致。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "倒數系列",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, countdownseries style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "livestreamopen",
    "command": "/livestreamopen",
    "title": "直播開場",
    "category": "social_viral",
    "applicability": "帶貨、Q&A。",
    "scriptTimeline": [
      {
        "time": "0–10s",
        "content": "自我介紹＋主題"
      },
      {
        "time": "10–20s",
        "content": "流程 3 點"
      },
      {
        "time": "20–30s",
        "content": "福利/抽獎說明"
      }
    ],
    "rawScript": "0–10s：自我介紹＋主題\n\n10–20s：流程 3 點\n\n20–30s：福利/抽獎說明",
    "params": "9:16；字幕大。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "直播開場",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, livestreamopen style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "livestreamclose",
    "command": "/livestreamclose",
    "title": "直播結尾",
    "category": "social_viral",
    "applicability": "收尾、再行銷。",
    "scriptTimeline": [
      {
        "time": "0–10s",
        "content": "重點回顧 3 點"
      },
      {
        "time": "10–20s",
        "content": "優惠最後提醒"
      },
      {
        "time": "20–30s",
        "content": "CTA（追蹤/下單）"
      }
    ],
    "rawScript": "0–10s：重點回顧 3 點\n\n10–20s：優惠最後提醒\n\n20–30s：CTA（追蹤/下單）",
    "params": "9:16；連結置頂。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "直播結尾",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, livestreamclose style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "qanda15s",
    "command": "/qanda15s",
    "title": "15 秒 QA",
    "category": "social_viral",
    "applicability": "社群互動。",
    "scriptTimeline": [
      {
        "time": "0–2s",
        "content": "問題"
      },
      {
        "time": "2–10s",
        "content": "答案"
      },
      {
        "time": "10–15s",
        "content": "邀請下一題"
      }
    ],
    "rawScript": "0–2s：問題\n\n2–10s：答案\n\n10–15s：邀請下一題",
    "params": "9:16；一題一影片。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "15 秒 Q",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, qanda15s style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "pollvideo",
    "command": "/pollvideo",
    "title": "投票影片",
    "category": "social_viral",
    "applicability": "互動、市場測試。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "問題"
      },
      {
        "time": "3–10s",
        "content": "選項 A/B 畫面"
      },
      {
        "time": "10–15s",
        "content": "請投票"
      }
    ],
    "rawScript": "0–3s：問題\n\n3–10s：選項 A/B 畫面\n\n10–15s：請投票",
    "params": "9:16；選項大字。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "投票影片",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, pollvideo style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "challengekickoff",
    "command": "/challengekickoff",
    "title": "挑戰開跑",
    "category": "events_campaigns",
    "applicability": "30 天挑戰。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "挑戰名"
      },
      {
        "time": "3–10s",
        "content": "規則 3 條"
      },
      {
        "time": "10–20s",
        "content": "獎品"
      },
      {
        "time": "20–30s",
        "content": "如何參加"
      }
    ],
    "rawScript": "0–3s：挑戰名\n\n3–10s：規則 3 條\n\n10–20s：獎品\n\n20–30s：如何參加",
    "params": "9:16；規則簡化。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "挑戰開跑",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, challengekickoff style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "progresscheck",
    "command": "/progresscheck",
    "title": "進度檢查",
    "category": "events_campaigns",
    "applicability": "挑戰中段。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "第 X 天"
      },
      {
        "time": "3–10s",
        "content": "常見問題"
      },
      {
        "time": "10–20s",
        "content": "小技巧"
      },
      {
        "time": "20–30s",
        "content": "鼓勵一句"
      }
    ],
    "rawScript": "0–3s：第 X 天\n\n3–10s：常見問題\n\n10–20s：小技巧\n\n20–30s：鼓勵一句",
    "params": "9:16；正向語氣。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "進度檢查",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, progresscheck style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "finalreveal",
    "command": "/finalreveal",
    "title": "最終揭曉",
    "category": "events_campaigns",
    "applicability": "挑戰結束。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "成果總覽"
      },
      {
        "time": "5–15s",
        "content": "優勝者"
      },
      {
        "time": "15–25s",
        "content": "關鍵學習"
      },
      {
        "time": "25–30s",
        "content": "下一場預告"
      }
    ],
    "rawScript": "0–5s：成果總覽\n\n5–15s：優勝者\n\n15–25s：關鍵學習\n\n25–30s：下一場預告",
    "params": "9:16；節奏歡快。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "最終揭曉",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, finalreveal style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "giveawayvid",
    "command": "/giveawayvid",
    "title": "抽獎影片",
    "category": "events_campaigns",
    "applicability": "增粉、互動。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "獎品"
      },
      {
        "time": "3–10s",
        "content": "參加步驟 3 條"
      },
      {
        "time": "10–15s",
        "content": "截止日"
      },
      {
        "time": "15–20s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：獎品\n\n3–10s：參加步驟 3 條\n\n10–15s：截止日\n\n15–20s：CTA",
    "params": "9:16；步驟清晰。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "抽獎影片",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, giveawayvid style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "winnerannounce",
    "command": "/winnerannounce",
    "title": "得獎公布",
    "category": "events_campaigns",
    "applicability": "抽獎結束。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "恭喜"
      },
      {
        "time": "5–10s",
        "content": "得獎者（打碼或同意）"
      },
      {
        "time": "10–15s",
        "content": "下一波預告"
      }
    ],
    "rawScript": "0–5s：恭喜\n\n5–10s：得獎者（打碼或同意）\n\n10–15s：下一波預告",
    "params": "9:16；隱私注意。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "得獎公布",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, winnerannounce style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "holidaygreet",
    "command": "/holidaygreet",
    "title": "節慶祝福",
    "category": "events_campaigns",
    "applicability": "春節、中秋、聖誕。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "祝福語"
      },
      {
        "time": "5–10s",
        "content": "品牌元素"
      },
      {
        "time": "10–15s",
        "content": "小優惠（可選）"
      }
    ],
    "rawScript": "0–5s：祝福語\n\n5–10s：品牌元素\n\n10–15s：小優惠（可選）",
    "params": "9:16；色調應景。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "節慶祝福",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, holidaygreet style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "newyearplan",
    "command": "/newyearplan",
    "title": "新年計畫",
    "category": "events_campaigns",
    "applicability": "年度目標、產品線。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "回顧一句"
      },
      {
        "time": "5–15s",
        "content": "新目標 2 點"
      },
      {
        "time": "15–25s",
        "content": "對用戶好處"
      },
      {
        "time": "25–30s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–5s：回顧一句\n\n5–15s：新目標 2 點\n\n15–25s：對用戶好處\n\n25–30s：CTA",
    "params": "16:9；正向。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "新年計畫",
      "16:9比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, newyearplan style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "blackfridayvid",
    "command": "/blackfridayvid",
    "title": "黑五影片",
    "category": "events_campaigns",
    "applicability": "年末大促。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "Black Friday 大字"
      },
      {
        "time": "3–10s",
        "content": "折扣內容"
      },
      {
        "time": "10–18s",
        "content": "條件一句"
      },
      {
        "time": "18–25s",
        "content": "截止＋CTA"
      }
    ],
    "rawScript": "0–3s：Black Friday 大字\n\n3–10s：折扣內容\n\n10–18s：條件一句\n\n18–25s：截止＋CTA",
    "params": "9:16；節奏快。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "黑五影片",
      "9:16比例",
      "3秒",
      "檔期優惠"
    ],
    "positivePrompt": "cinematic commercial video, blackfridayvid style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "cybermondayvid",
    "command": "/cybermondayvid",
    "title": "網一影片",
    "category": "events_campaigns",
    "applicability": "電商。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "Cyber Monday"
      },
      {
        "time": "3–10s",
        "content": "線上專屬優惠"
      },
      {
        "time": "10–18s",
        "content": "免運/加碼"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：Cyber Monday\n\n3–10s：線上專屬優惠\n\n10–18s：免運/加碼\n\n18–25s：CTA",
    "params": "9:16；數位感。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "網一影片",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, cybermondayvid style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "anniversaryvid",
    "command": "/anniversaryvid",
    "title": "週年慶",
    "category": "events_campaigns",
    "applicability": "品牌/門市週年。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "幾年"
      },
      {
        "time": "5–15s",
        "content": "感謝一句"
      },
      {
        "time": "15–25s",
        "content": "優惠"
      },
      {
        "time": "25–30s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–5s：幾年\n\n5–15s：感謝一句\n\n15–25s：優惠\n\n25–30s：CTA",
    "params": "9:16；年數大。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "週年慶",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, anniversaryvid style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "grandopeningvid",
    "command": "/grandopeningvid",
    "title": "開幕影片",
    "category": "events_campaigns",
    "applicability": "新店。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "店名＋地點"
      },
      {
        "time": "5–15s",
        "content": "開幕優惠"
      },
      {
        "time": "15–25s",
        "content": "環境 3 鏡"
      },
      {
        "time": "25–30s",
        "content": "日期＋CTA"
      }
    ],
    "rawScript": "0–5s：店名＋地點\n\n5–15s：開幕優惠\n\n15–25s：環境 3 鏡\n\n25–30s：日期＋CTA",
    "params": "9:16；地圖簡短。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "開幕影片",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, grandopeningvid style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "softopeningvid",
    "command": "/softopeningvid",
    "title": "試營運",
    "category": "events_campaigns",
    "applicability": "試賣。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "試營運日期"
      },
      {
        "time": "5–15s",
        "content": "限定內容"
      },
      {
        "time": "15–25s",
        "content": "回饋邀請"
      },
      {
        "time": "25–30s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–5s：試營運日期\n\n5–15s：限定內容\n\n15–25s：回饋邀請\n\n25–30s：CTA",
    "params": "9:16；範圍清楚。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "試營運",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, softopeningvid style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "relocationvid",
    "command": "/relocationvid",
    "title": "搬遷通知",
    "category": "events_campaigns",
    "applicability": "門市搬遷。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "我們搬家了"
      },
      {
        "time": "5–15s",
        "content": "新地址＋地圖"
      },
      {
        "time": "15–25s",
        "content": "開店日"
      },
      {
        "time": "25–30s",
        "content": "感謝"
      }
    ],
    "rawScript": "0–5s：我們搬家了\n\n5–15s：新地址＋地圖\n\n15–25s：開店日\n\n25–30s：感謝",
    "params": "9:16；路線簡化。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "搬遷通知",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, relocationvid style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "tempclosevid",
    "command": "/tempclosevid",
    "title": "暫時休息",
    "category": "events_campaigns",
    "applicability": "裝修/假期。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "休息原因"
      },
      {
        "time": "5–15s",
        "content": "日期區間"
      },
      {
        "time": "15–25s",
        "content": "替代管道"
      },
      {
        "time": "25–30s",
        "content": "感謝"
      }
    ],
    "rawScript": "0–5s：休息原因\n\n5–15s：日期區間\n\n15–25s：替代管道\n\n25–30s：感謝",
    "params": "9:16；資訊明確。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "暫時休息",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, tempclosevid style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "systemmaintvid",
    "command": "/systemmaintvid",
    "title": "系統維護",
    "category": "events_campaigns",
    "applicability": "網站/APP。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "維護時段"
      },
      {
        "time": "5–15s",
        "content": "影響範圍"
      },
      {
        "time": "15–25s",
        "content": "建議做法"
      },
      {
        "time": "25–30s",
        "content": "致歉"
      }
    ],
    "rawScript": "0–5s：維護時段\n\n5–15s：影響範圍\n\n15–25s：建議做法\n\n25–30s：致歉",
    "params": "16:9；時間清楚。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "系統維護",
      "16:9比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, systemmaintvid style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "appupdatevid",
    "command": "/appupdatevid",
    "title": "APP 更新",
    "category": "events_campaigns",
    "applicability": "版本更新。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "版本號"
      },
      {
        "time": "3–10s",
        "content": "新功能 2 項"
      },
      {
        "time": "10–20s",
        "content": "好處一句"
      },
      {
        "time": "20–25s",
        "content": "更新 CTA"
      }
    ],
    "rawScript": "0–3s：版本號\n\n3–10s：新功能 2 項\n\n10–20s：好處一句\n\n20–25s：更新 CTA",
    "params": "9:16；畫面錄屏。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "APP 更新",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, appupdatevid style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "featurelaunchvid",
    "command": "/featurelaunchvid",
    "title": "功能上線",
    "category": "events_campaigns",
    "applicability": "新功能。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "功能名"
      },
      {
        "time": "3–10s",
        "content": "使用情境"
      },
      {
        "time": "10–20s",
        "content": "利益一句"
      },
      {
        "time": "20–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：功能名\n\n3–10s：使用情境\n\n10–20s：利益一句\n\n20–25s：CTA",
    "params": "16:9；一句話價值。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "功能上線",
      "16:9比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, featurelaunchvid style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "betarecruit",
    "command": "/betarecruit",
    "title": "測試招募",
    "category": "events_campaigns",
    "applicability": "內測/公测。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "招募對象"
      },
      {
        "time": "5–15s",
        "content": "你能得到"
      },
      {
        "time": "15–25s",
        "content": "如何申請"
      },
      {
        "time": "25–30s",
        "content": "截止日"
      }
    ],
    "rawScript": "0–5s：招募對象\n\n5–15s：你能得到\n\n15–25s：如何申請\n\n25–30s：截止日",
    "params": "9:16；資格清楚。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "測試招募",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, betarecruit style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "csrvid",
    "command": "/csrvid",
    "title": "CSR 影片",
    "category": "trust_authority",
    "applicability": "企業社會責任。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "計畫名"
      },
      {
        "time": "5–15s",
        "content": "行動內容"
      },
      {
        "time": "15–25s",
        "content": "影響數據"
      },
      {
        "time": "25–30s",
        "content": "CTA（支持/關注）"
      }
    ],
    "rawScript": "0–5s：計畫名\n\n5–15s：行動內容\n\n15–25s：影響數據\n\n25–30s：CTA（支持/關注）",
    "params": "16:9；數據真實。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "CSR 影片",
      "16:9比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, csrvid style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "esgvid",
    "command": "/esgvid",
    "title": "ESG 影片",
    "category": "trust_authority",
    "applicability": "投資人、官網。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "E/S/G 面向"
      },
      {
        "time": "5–15s",
        "content": "指標 1–2 個"
      },
      {
        "time": "15–25s",
        "content": "進展一句"
      },
      {
        "time": "25–30s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–5s：E/S/G 面向\n\n5–15s：指標 1–2 個\n\n15–25s：進展一句\n\n25–30s：CTA",
    "params": "16:9；避免空話。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "ESG 影片",
      "16:9比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, esgvid style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "impactvid",
    "command": "/impactvid",
    "title": "影響力影片",
    "category": "trust_authority",
    "applicability": "年度/季度報告。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "主題"
      },
      {
        "time": "5–15s",
        "content": "數字 2 個"
      },
      {
        "time": "15–25s",
        "content": "故事一句"
      },
      {
        "time": "25–30s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–5s：主題\n\n5–15s：數字 2 個\n\n15–25s：故事一句\n\n25–30s：CTA",
    "params": "16:9；一主題一影片。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "影響力影片",
      "16:9比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, impactvid style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "yearinreviewvid",
    "command": "/yearinreviewvid",
    "title": "年度回顧影片",
    "category": "events_campaigns",
    "applicability": "年底總結。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "年份"
      },
      {
        "time": "5–15s",
        "content": "3 大時刻"
      },
      {
        "time": "15–25s",
        "content": "感謝"
      },
      {
        "time": "25–30s",
        "content": "明年預告"
      }
    ],
    "rawScript": "0–5s：年份\n\n5–15s：3 大時刻\n\n15–25s：感謝\n\n25–30s：明年預告",
    "params": "16:9；節奏溫暖。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 30,
    "badge": "真實信任",
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "年度回顧影片",
      "16:9比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, yearinreviewvid style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "milestonevid",
    "command": "/milestonevid",
    "title": "里程碑",
    "category": "trust_authority",
    "applicability": "達成目標。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "數字大"
      },
      {
        "time": "5–15s",
        "content": "意義一句"
      },
      {
        "time": "15–25s",
        "content": "感謝"
      },
      {
        "time": "25–30s",
        "content": "下一步"
      }
    ],
    "rawScript": "0–5s：數字大\n\n5–15s：意義一句\n\n15–25s：感謝\n\n25–30s：下一步",
    "params": "9:16；數字最大。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "里程碑",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, milestonevid style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "thankyouvid",
    "command": "/thankyouvid",
    "title": "感謝影片",
    "category": "trust_authority",
    "applicability": "活動後、節慶。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "謝謝"
      },
      {
        "time": "5–15s",
        "content": "照片/片段"
      },
      {
        "time": "15–25s",
        "content": "一句話"
      },
      {
        "time": "25–30s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–5s：謝謝\n\n5–15s：照片/片段\n\n15–25s：一句話\n\n25–30s：CTA",
    "params": "9:16；真誠。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "感謝影片",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, thankyouvid style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "adsafe15s",
    "command": "/adsafe15s",
    "title": "15 秒安全廣告",
    "category": "ad_conversion",
    "applicability": "投放合規版本。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "利益一句"
      },
      {
        "time": "3–10s",
        "content": "證據/畫面"
      },
      {
        "time": "10–15s",
        "content": "CTA（避免絕對詞）"
      }
    ],
    "rawScript": "0–3s：利益一句\n\n3–10s：證據/畫面\n\n10–15s：CTA（避免絕對詞）",
    "params": "9:16；避免「最」「保證」。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "15 秒安全",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, adsafe15s style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "adhook3var",
    "command": "/adhook3var",
    "title": "3 版鉤子 A/B",
    "category": "ad_conversion",
    "applicability": "投放測試。",
    "scriptTimeline": [
      {
        "time": "階段",
        "content": "各 15s：不同鉤子句＋同主體"
      }
    ],
    "rawScript": "各 15s：不同鉤子句＋同主體",
    "params": "9:16；同光同色。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": "高完播率",
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "3 版鉤子 ",
      "9:16比例",
      "15秒",
      "開頭停留"
    ],
    "positivePrompt": "cinematic commercial video, adhook3var style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "adcta3var",
    "command": "/adcta3var",
    "title": "3 版 CTA A/B",
    "category": "ad_conversion",
    "applicability": "投放測試。",
    "scriptTimeline": [
      {
        "time": "階段",
        "content": "各 15s：同內容、CTA 不同（立即購買/了解更多/領取優惠）"
      }
    ],
    "rawScript": "各 15s：同內容、CTA 不同（立即購買/了解更多/領取優惠）",
    "params": "9:16；文案差異明確。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": "A/B測試",
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "3 版 CT",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, adcta3var style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "retarget15s",
    "command": "/retarget15s",
    "title": "再行銷 15 秒",
    "category": "ad_conversion",
    "applicability": "棄購/瀏覽未購。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "你看过這個？"
      },
      {
        "time": "3–10s",
        "content": "誘因（免運/折扣）"
      },
      {
        "time": "10–15s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：你看过這個？\n\n3–10s：誘因（免運/折扣）\n\n10–15s：CTA",
    "params": "9:16；誘因一句。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "再行銷 15",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, retarget15s style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "cartrecovery",
    "command": "/cartrecovery",
    "title": "棄購挽回",
    "category": "ad_conversion",
    "applicability": "Email/投放。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "購物車縮圖"
      },
      {
        "time": "3–10s",
        "content": "優惠"
      },
      {
        "time": "10–15s",
        "content": "截止＋CTA"
      }
    ],
    "rawScript": "0–3s：購物車縮圖\n\n3–10s：優惠\n\n10–15s：截止＋CTA",
    "params": "9:16；時效感。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "棄購挽回",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, cartrecovery style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "winbackvid",
    "command": "/winbackvid",
    "title": "回流影片",
    "category": "ad_conversion",
    "applicability": "沉睡會員。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "我們想你"
      },
      {
        "time": "3–10s",
        "content": "專屬優惠"
      },
      {
        "time": "10–15s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：我們想你\n\n3–10s：專屬優惠\n\n10–15s：CTA",
    "params": "9:16；情感＋誘因。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "回流影片",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, winbackvid style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "socialproof15s",
    "command": "/socialproof15s",
    "title": "15 秒社會證明",
    "category": "trust_authority",
    "applicability": "信任建立。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "用戶數/評分"
      },
      {
        "time": "3–10s",
        "content": "證言一句"
      },
      {
        "time": "10–15s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：用戶數/評分\n\n3–10s：證言一句\n\n10–15s：CTA",
    "params": "9:16；數字大。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "15 秒社會",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, socialproof15s style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "pressmention",
    "command": "/pressmention",
    "title": "媒體露出",
    "category": "trust_authority",
    "applicability": "信任區影片。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "媒體 logo 輪播"
      },
      {
        "time": "3–10s",
        "content": "標題一句"
      },
      {
        "time": "10–15s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：媒體 logo 輪播\n\n3–10s：標題一句\n\n10–15s：CTA",
    "params": "16:9；logo 統一色。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "媒體露出",
      "16:9比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, pressmention style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "awardvid",
    "command": "/awardvid",
    "title": "得獎影片",
    "category": "trust_authority",
    "applicability": "信任建立。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "獎項名"
      },
      {
        "time": "5–10s",
        "content": "年份/類別"
      },
      {
        "time": "10–15s",
        "content": "感謝"
      }
    ],
    "rawScript": "0–5s：獎項名\n\n5–10s：年份/類別\n\n10–15s：感謝",
    "params": "9:16；徽章清晰。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "得獎影片",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, awardvid style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "certificationvid",
    "command": "/certificationvid",
    "title": "認證影片",
    "category": "trust_authority",
    "applicability": "有機/清真等。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "認證名"
      },
      {
        "time": "5–10s",
        "content": "意義一句"
      },
      {
        "time": "10–15s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–5s：認證名\n\n5–10s：意義一句\n\n10–15s：CTA",
    "params": "9:16；標章可讀。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "認證影片",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, certificationvid style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "sustainabilityvid",
    "command": "/sustainabilityvid",
    "title": "永續影片",
    "category": "trust_authority",
    "applicability": "環保主張。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "承諾一句"
      },
      {
        "time": "5–15s",
        "content": "行動 1 項"
      },
      {
        "time": "15–25s",
        "content": "數據"
      },
      {
        "time": "25–30s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–5s：承諾一句\n\n5–15s：行動 1 項\n\n15–25s：數據\n\n25–30s：CTA",
    "params": "16:9；避免漂綠。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "永續影片",
      "16:9比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, sustainabilityvid style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "communityvid",
    "command": "/communityvid",
    "title": "社群影片",
    "category": "events_campaigns",
    "applicability": "社團、會員。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "社群名"
      },
      {
        "time": "5–15s",
        "content": "活動片段"
      },
      {
        "time": "15–25s",
        "content": "加入好處"
      },
      {
        "time": "25–30s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–5s：社群名\n\n5–15s：活動片段\n\n15–25s：加入好處\n\n25–30s：CTA",
    "params": "9:16；互動感。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "社群影片",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, communityvid style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "ugccompilation",
    "command": "/ugccompilation",
    "title": "UGC 合集",
    "category": "social_viral",
    "applicability": "信任、活動。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "標題"
      },
      {
        "time": "3–15s",
        "content": "用戶片段 3–5 段"
      },
      {
        "time": "15–20s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：標題\n\n3–15s：用戶片段 3–5 段\n\n15–20s：CTA",
    "params": "9:16；授權注意。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": "真實信任",
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "UGC 合集",
      "9:16比例",
      "15秒",
      "真實感"
    ],
    "positivePrompt": "cinematic commercial video, ugccompilation style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "duetreact",
    "command": "/duetreact",
    "title": "合拍/反應",
    "category": "social_viral",
    "applicability": "TikTok/Reels 互動。",
    "scriptTimeline": [
      {
        "time": "階段",
        "content": "左：原影片；右：你反應 3 點"
      }
    ],
    "rawScript": "左：原影片；右：你反應 3 點",
    "params": "9:16；評論有價值。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "合拍/反應",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, duetreact style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "stitchexplain",
    "command": "/stitchexplain",
    "title": "接龍說明",
    "category": "social_viral",
    "applicability": "回應熱門話題。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "原話題"
      },
      {
        "time": "3–10s",
        "content": "你的觀點"
      },
      {
        "time": "10–15s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：原話題\n\n3–10s：你的觀點\n\n10–15s：CTA",
    "params": "9:16；簡潔。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "接龍說明",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, stitchexplain style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "trendadapt",
    "command": "/trendadapt",
    "title": "趨勢改編",
    "category": "social_viral",
    "applicability": "跟熱門 BGM/挑戰。",
    "scriptTimeline": [
      {
        "time": "階段",
        "content": "套用趨勢結構＋你的產品 1 點"
      }
    ],
    "rawScript": "套用趨勢結構＋你的產品 1 點",
    "params": "9:16；注意版權。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "趨勢改編",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, trendadapt style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "soundon",
    "command": "/soundon",
    "title": "開聲提示",
    "category": "social_viral",
    "applicability": "有重要旁白/音效。",
    "scriptTimeline": [
      {
        "time": "0–2s",
        "content": "Sound On 圖示"
      },
      {
        "time": "2–15s",
        "content": "內容"
      }
    ],
    "rawScript": "0–2s：Sound On 圖示\n\n2–15s：內容",
    "params": "9:16；前 2 秒提示。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "開聲提示",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, soundon style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "captionfirst",
    "command": "/captionfirst",
    "title": "字幕優先",
    "category": "social_viral",
    "applicability": "無聲播放環境。",
    "scriptTimeline": [
      {
        "time": "階段",
        "content": "全片大字字幕＋關鍵詞高亮"
      }
    ],
    "rawScript": "全片大字字幕＋關鍵詞高亮",
    "params": "9:16；字大、對比高。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "字幕優先",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, captionfirst style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "loopable",
    "command": "/loopable",
    "title": "可循環",
    "category": "social_viral",
    "applicability": "提高完播。",
    "scriptTimeline": [
      {
        "time": "階段",
        "content": "首尾動作/畫面一致"
      }
    ],
    "rawScript": "首尾動作/畫面一致",
    "params": "9:16；無縫。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "可循環",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, loopable style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "chaptered60s",
    "command": "/chaptered60s",
    "title": "60 秒分章",
    "category": "tutorial_sop",
    "applicability": "YouTube 教學。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "目錄"
      },
      {
        "time": "階段",
        "content": "每 10–15s 一章標題"
      }
    ],
    "rawScript": "0–5s：目錄\n\n每 10–15s 一章標題",
    "params": "16:9；時間碼清晰。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 60,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "60 秒分章",
      "16:9比例",
      "60秒"
    ],
    "positivePrompt": "cinematic commercial video, chaptered60s style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "ytshorts15s",
    "command": "/ytshorts15s",
    "title": "YouTube Shorts 15 秒",
    "category": "social_viral",
    "applicability": "快速觸及。",
    "scriptTimeline": [
      {
        "time": "0–2s",
        "content": "鉤子"
      },
      {
        "time": "2–10s",
        "content": "重點"
      },
      {
        "time": "10–15s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–2s：鉤子\n\n2–10s：重點\n\n10–15s：CTA",
    "params": "9:16；標題 40 字內。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "YouTub",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, ytshorts15s style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "reels30s",
    "command": "/reels30s",
    "title": "Reels 30 秒",
    "category": "social_viral",
    "applicability": "日常貼文。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "鉤子"
      },
      {
        "time": "3–20s",
        "content": "內容"
      },
      {
        "time": "20–30s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：鉤子\n\n3–20s：內容\n\n20–30s：CTA",
    "params": "9:16；封面圖清晰。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "Reels ",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, reels30s style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "tiktok15s",
    "command": "/tiktok15s",
    "title": "TikTok 15 秒",
    "category": "social_viral",
    "applicability": "快速觸及。",
    "scriptTimeline": [
      {
        "time": "0–2s",
        "content": "鉤子"
      },
      {
        "time": "2–10s",
        "content": "內容"
      },
      {
        "time": "10–15s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–2s：鉤子\n\n2–10s：內容\n\n10–15s：CTA",
    "params": "9:16；BGM 熱門。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "TikTok",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, tiktok15s style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "ad15s",
    "command": "/ad15s",
    "title": "15 秒廣告",
    "category": "ad_conversion",
    "applicability": "投放主力。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "痛點/鉤子"
      },
      {
        "time": "3–10s",
        "content": "解法＋證據"
      },
      {
        "time": "10–15s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：痛點/鉤子\n\n3–10s：解法＋證據\n\n10–15s：CTA",
    "params": "9:16；避免絕對詞。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "15 秒廣告",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, ad15s style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "ad30s",
    "command": "/ad30s",
    "title": "30 秒廣告",
    "category": "ad_conversion",
    "applicability": "投放/YouTube。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "鉤子"
      },
      {
        "time": "5–15s",
        "content": "問題放大"
      },
      {
        "time": "15–25s",
        "content": "解法＋證據"
      },
      {
        "time": "25–30s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–5s：鉤子\n\n5–15s：問題放大\n\n15–25s：解法＋證據\n\n25–30s：CTA",
    "params": "16:9 或 9:16。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "30 秒廣告",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, ad30s style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "ad60s",
    "command": "/ad60s",
    "title": "60 秒廣告",
    "category": "ad_conversion",
    "applicability": "深度說服。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "鉤子"
      },
      {
        "time": "5–20s",
        "content": "問題"
      },
      {
        "time": "20–40s",
        "content": "解法"
      },
      {
        "time": "40–55s",
        "content": "證據"
      },
      {
        "time": "55–60s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–5s：鉤子\n\n5–20s：問題\n\n20–40s：解法\n\n40–55s：證據\n\n55–60s：CTA",
    "params": "16:9。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 60,
    "badge": null,
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "60 秒廣告",
      "16:9比例",
      "60秒"
    ],
    "positivePrompt": "cinematic commercial video, ad60s style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "bumper6s",
    "command": "/bumper6s",
    "title": "6 秒不可跳",
    "category": "ad_conversion",
    "applicability": "YouTube Bumper。",
    "scriptTimeline": [
      {
        "time": "0–2s",
        "content": "品牌/產品"
      },
      {
        "time": "2–4s",
        "content": "利益一句"
      },
      {
        "time": "4–6s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–2s：品牌/產品\n\n2–4s：利益一句\n\n4–6s：CTA",
    "params": "16:9；極簡。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 6,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "6 秒不可跳",
      "16:9比例",
      "6秒"
    ],
    "positivePrompt": "cinematic commercial video, bumper6s style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "storyads15s",
    "command": "/storyads15s",
    "title": "Story 廣告",
    "category": "ad_conversion",
    "applicability": "IG/FB Stories。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "鉤子"
      },
      {
        "time": "3–10s",
        "content": "利益"
      },
      {
        "time": "10–15s",
        "content": "滑動 CTA"
      }
    ],
    "rawScript": "0–3s：鉤子\n\n3–10s：利益\n\n10–15s：滑動 CTA",
    "params": "9:16；避開 UI 區。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "Story ",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, storyads15s style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "feedads15s",
    "command": "/feedads15s",
    "title": "Feed 廣告",
    "category": "ad_conversion",
    "applicability": "IG/FB 動態。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "鉤子"
      },
      {
        "time": "3–10s",
        "content": "利益"
      },
      {
        "time": "10–15s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：鉤子\n\n3–10s：利益\n\n10–15s：CTA",
    "params": "1:1 或 4:5。",
    "defaultAspect": "1:1",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "Feed 廣",
      "1:1比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, feedads15s style for product promotion, 1:1 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "exhibitwalk",
    "command": "/exhibitwalk",
    "title": "展區導覽",
    "category": "product_display",
    "applicability": "展會、快閃店、美術館式陳列。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "展區名＋入口"
      },
      {
        "time": "3–10s",
        "content": "全景緩推"
      },
      {
        "time": "10–18s",
        "content": "重點展品 2 件"
      },
      {
        "time": "18–25s",
        "content": "CTA（參觀/預約）"
      }
    ],
    "rawScript": "0–3s：展區名＋入口\n\n3–10s：全景緩推\n\n10–18s：重點展品 2 件\n\n18–25s：CTA（參觀/預約）",
    "params": "16:9 或 9:16；穩定器慢推。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "展區導覽",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, exhibitwalk style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "boothtour",
    "command": "/boothtour",
    "title": "攤位導覽",
    "category": "product_display",
    "applicability": "展會攤位、市集攤位。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "攤位號＋品牌"
      },
      {
        "time": "3–10s",
        "content": "攤位全景"
      },
      {
        "time": "10–18s",
        "content": "主打展品 2–3 件"
      },
      {
        "time": "18–25s",
        "content": "活動/優惠"
      }
    ],
    "rawScript": "0–3s：攤位號＋品牌\n\n3–10s：攤位全景\n\n10–18s：主打展品 2–3 件\n\n18–25s：活動/優惠",
    "params": "9:16；口語導覽感。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "攤位導覽",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, boothtour style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "producthero360",
    "command": "/producthero360",
    "title": "360° 產品英雄",
    "category": "product_display",
    "applicability": "官網 hero、展場螢幕。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "產品登場"
      },
      {
        "time": "3–12s",
        "content": "360° 旋轉"
      },
      {
        "time": "12–18s",
        "content": "細節特寫 2 處"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：產品登場\n\n3–12s：360° 旋轉\n\n12–18s：細節特寫 2 處\n\n18–25s：CTA",
    "params": "16:9 或 1:1；轉盤或 3D。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 60,
    "badge": "360°展示",
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "360° 產",
      "16:9比例",
      "60秒",
      "產品特寫"
    ],
    "positivePrompt": "cinematic commercial video, producthero360 style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "detailmacro",
    "command": "/detailmacro",
    "title": "微距細節",
    "category": "product_display",
    "applicability": "材質、工藝、包裝細節。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "產品名"
      },
      {
        "time": "3–10s",
        "content": "微距掃過表面"
      },
      {
        "time": "10–18s",
        "content": "另一個細節"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：產品名\n\n3–10s：微距掃過表面\n\n10–18s：另一個細節\n\n18–25s：CTA",
    "params": "9:16；淺景深、光線柔。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "微距細節",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, detailmacro style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "colorvariants",
    "command": "/colorvariants",
    "title": "色系展示",
    "category": "product_display",
    "applicability": "多色產品、季節色。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "產品名"
      },
      {
        "time": "3–10s",
        "content": "色 A"
      },
      {
        "time": "10–18s",
        "content": "色 B"
      },
      {
        "time": "18–25s",
        "content": "色 C＋CTA"
      }
    ],
    "rawScript": "0–3s：產品名\n\n3–10s：色 A\n\n10–18s：色 B\n\n18–25s：色 C＋CTA",
    "params": "9:16；背景一致。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "色系展示",
      "9:16比例",
      "3秒",
      "產品特寫"
    ],
    "positivePrompt": "cinematic commercial video, colorvariants style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "sizecompare",
    "command": "/sizecompare",
    "title": "尺寸比較",
    "category": "product_display",
    "applicability": "多尺寸、套組。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "產品名"
      },
      {
        "time": "3–10s",
        "content": "S/M/L 並排"
      },
      {
        "time": "10–18s",
        "content": "與常見物比較（手機/硬幣）"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：產品名\n\n3–10s：S/M/L 並排\n\n10–18s：與常見物比較（手機/硬幣）\n\n18–25s：CTA",
    "params": "9:16；比例清楚。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "尺寸比較",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, sizecompare style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "incontext",
    "command": "/incontext",
    "title": "情境展示",
    "category": "product_display",
    "applicability": "居家、門市、辦公情境。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "情境名（客廳/吧台）"
      },
      {
        "time": "3–10s",
        "content": "產品放入情境"
      },
      {
        "time": "10–18s",
        "content": "使用動作"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：情境名（客廳/吧台）\n\n3–10s：產品放入情境\n\n10–18s：使用動作\n\n18–25s：CTA",
    "params": "16:9 或 9:16；光線自然。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "情境展示",
      "9:16比例",
      "3秒",
      "產品特寫"
    ],
    "positivePrompt": "cinematic commercial video, incontext style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "lifestyleuse",
    "command": "/lifestyleuse",
    "title": "生活使用",
    "category": "product_display",
    "applicability": "日常使用場景。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "人物＋產品"
      },
      {
        "time": "3–10s",
        "content": "使用動作 1"
      },
      {
        "time": "10–18s",
        "content": "使用動作 2"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：人物＋產品\n\n3–10s：使用動作 1\n\n10–18s：使用動作 2\n\n18–25s：CTA",
    "params": "9:16；生活感。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "生活使用",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, lifestyleuse style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "handson",
    "command": "/handson",
    "title": "實手操作",
    "category": "product_display",
    "applicability": "需要操作說明的產品。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "產品"
      },
      {
        "time": "3–10s",
        "content": "開關/按鈕"
      },
      {
        "time": "10–18s",
        "content": "功能演示"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：產品\n\n3–10s：開關/按鈕\n\n10–18s：功能演示\n\n18–25s：CTA",
    "params": "9:16；手部清楚。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "實手操作",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, handson style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "modedemo",
    "command": "/modedemo",
    "title": "模式演示",
    "category": "product_display",
    "applicability": "多模式/多檔位產品。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "模式名"
      },
      {
        "time": "3–10s",
        "content": "模式 A"
      },
      {
        "time": "10–18s",
        "content": "模式 B"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：模式名\n\n3–10s：模式 A\n\n10–18s：模式 B\n\n18–25s：CTA",
    "params": "9:16；每模式一句話。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "模式演示",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, modedemo style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "accessoryshow",
    "command": "/accessoryshow",
    "title": "配件展示",
    "category": "product_display",
    "applicability": "主商品＋配件。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "主機"
      },
      {
        "time": "3–10s",
        "content": "配件 1"
      },
      {
        "time": "10–18s",
        "content": "配件 2"
      },
      {
        "time": "18–25s",
        "content": "套組 CTA"
      }
    ],
    "rawScript": "0–3s：主機\n\n3–10s：配件 1\n\n10–18s：配件 2\n\n18–25s：套組 CTA",
    "params": "9:16；配件一一亮相。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "配件展示",
      "9:16比例",
      "3秒",
      "產品特寫"
    ],
    "positivePrompt": "cinematic commercial video, accessoryshow style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "bundleflatlay",
    "command": "/bundleflatlay",
    "title": "套組平鋪",
    "category": "product_display",
    "applicability": "電商套組、禮盒。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "套組名"
      },
      {
        "time": "3–10s",
        "content": "俯拍平鋪"
      },
      {
        "time": "10–18s",
        "content": "局部特寫"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：套組名\n\n3–10s：俯拍平鋪\n\n10–18s：局部特寫\n\n18–25s：CTA",
    "params": "1:1 或 4:5；構圖整齊。",
    "defaultAspect": "1:1",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "套組平鋪",
      "1:1比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, bundleflatlay style for product promotion, 1:1 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "packagingtour",
    "command": "/packagingtour",
    "title": "包裝導覽",
    "category": "product_display",
    "applicability": "包裝設計、開箱體驗。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "外盒"
      },
      {
        "time": "3–10s",
        "content": "開啟動作"
      },
      {
        "time": "10–18s",
        "content": "內托/配件"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：外盒\n\n3–10s：開啟動作\n\n10–18s：內托/配件\n\n18–25s：CTA",
    "params": "9:16；動作流暢。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "包裝導覽",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, packagingtour style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "labelclose",
    "command": "/labelclose",
    "title": "標籤特寫",
    "category": "product_display",
    "applicability": "成分、容量、認證標章。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "產品"
      },
      {
        "time": "3–10s",
        "content": "標籤掃過"
      },
      {
        "time": "10–18s",
        "content": "關鍵資訊放大"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：產品\n\n3–10s：標籤掃過\n\n10–18s：關鍵資訊放大\n\n18–25s：CTA",
    "params": "9:16；字要可讀。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "標籤特寫",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, labelclose style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "certificationclose",
    "command": "/certificationclose",
    "title": "認證特寫",
    "category": "trust_authority",
    "applicability": "有機、清真、素食等。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "產品"
      },
      {
        "time": "3–8s",
        "content": "證章特寫"
      },
      {
        "time": "8–15s",
        "content": "意義一句"
      },
      {
        "time": "15–20s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：產品\n\n3–8s：證章特寫\n\n8–15s：意義一句\n\n15–20s：CTA",
    "params": "9:16；證章清晰。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "認證特寫",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, certificationclose style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "materialstory",
    "command": "/materialstory",
    "title": "材質故事",
    "category": "product_display",
    "applicability": "高端、工藝感。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "材質名"
      },
      {
        "time": "3–10s",
        "content": "來源/特性"
      },
      {
        "time": "10–18s",
        "content": "成品畫面"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：材質名\n\n3–10s：來源/特性\n\n10–18s：成品畫面\n\n18–25s：CTA",
    "params": "16:9；語氣故事感。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "材質故事",
      "16:9比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, materialstory style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "craftprocess",
    "command": "/craftprocess",
    "title": "工藝流程",
    "category": "tutorial_sop",
    "applicability": "手作、限量。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "工藝名"
      },
      {
        "time": "3–10s",
        "content": "步驟 1"
      },
      {
        "time": "10–18s",
        "content": "步驟 2"
      },
      {
        "time": "18–25s",
        "content": "成品"
      }
    ],
    "rawScript": "0–3s：工藝名\n\n3–10s：步驟 1\n\n10–18s：步驟 2\n\n18–25s：成品",
    "params": "16:9；步驟簡化。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "工藝流程",
      "16:9比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, craftprocess style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "beforepack",
    "command": "/beforepack",
    "title": "包裝前",
    "category": "product_display",
    "applicability": "製程記錄。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "半成品"
      },
      {
        "time": "3–10s",
        "content": "檢驗/整理"
      },
      {
        "time": "10–18s",
        "content": "入盒"
      },
      {
        "time": "18–25s",
        "content": "成品"
      }
    ],
    "rawScript": "0–3s：半成品\n\n3–10s：檢驗/整理\n\n10–18s：入盒\n\n18–25s：成品",
    "params": "16:9；乾淨背景。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "包裝前",
      "16:9比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, beforepack style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "afterpack",
    "command": "/afterpack",
    "title": "包裝後",
    "category": "product_display",
    "applicability": "出貨前狀態。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "成品盒"
      },
      {
        "time": "3–10s",
        "content": "封箱/貼標"
      },
      {
        "time": "10–18s",
        "content": "堆疊/貨架"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：成品盒\n\n3–10s：封箱/貼標\n\n10–18s：堆疊/貨架\n\n18–25s：CTA",
    "params": "9:16；整齊感。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "包裝後",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, afterpack style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "shelfdisplay",
    "command": "/shelfdisplay",
    "title": "貨架陳列",
    "category": "product_display",
    "applicability": "通路提案、門市。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "貨架全景"
      },
      {
        "time": "3–10s",
        "content": "產品排面"
      },
      {
        "time": "10–18s",
        "content": "標籤/價格"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：貨架全景\n\n3–10s：產品排面\n\n10–18s：標籤/價格\n\n18–25s：CTA",
    "params": "9:16；排面整齊。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "貨架陳列",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, shelfdisplay style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "endcap",
    "command": "/endcap",
    "title": "端架展示",
    "category": "product_display",
    "applicability": "門市端架、促銷區。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "端架全景"
      },
      {
        "time": "3–10s",
        "content": "主打品"
      },
      {
        "time": "10–18s",
        "content": "促銷標"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：端架全景\n\n3–10s：主打品\n\n10–18s：促銷標\n\n18–25s：CTA",
    "params": "9:16；促銷感強。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "端架展示",
      "9:16比例",
      "3秒",
      "產品特寫"
    ],
    "positivePrompt": "cinematic commercial video, endcap style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "dumpbin",
    "command": "/dumpbin",
    "title": "堆頭展示",
    "category": "product_display",
    "applicability": "量販、促銷堆頭。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "堆頭全景"
      },
      {
        "time": "3–10s",
        "content": "產品特寫"
      },
      {
        "time": "10–18s",
        "content": "價格/活動"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：堆頭全景\n\n3–10s：產品特寫\n\n10–18s：價格/活動\n\n18–25s：CTA",
    "params": "9:16；量感足。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "堆頭展示",
      "9:16比例",
      "3秒",
      "產品特寫"
    ],
    "positivePrompt": "cinematic commercial video, dumpbin style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "windowdisplay",
    "command": "/windowdisplay",
    "title": "櫥窗展示",
    "category": "product_display",
    "applicability": "門市櫥窗、快閃。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "櫥窗全景"
      },
      {
        "time": "3–10s",
        "content": "主題佈置"
      },
      {
        "time": "10–18s",
        "content": "主打品"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：櫥窗全景\n\n3–10s：主題佈置\n\n10–18s：主打品\n\n18–25s：CTA",
    "params": "16:9；主題明確。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "櫥窗展示",
      "16:9比例",
      "3秒",
      "產品特寫"
    ],
    "positivePrompt": "cinematic commercial video, windowdisplay style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "tabletopdisplay",
    "command": "/tabletopdisplay",
    "title": "桌面陳列",
    "category": "product_display",
    "applicability": "展場桌面、門市小陳列。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "桌面全景"
      },
      {
        "time": "3–10s",
        "content": "產品組"
      },
      {
        "time": "10–18s",
        "content": "細節"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：桌面全景\n\n3–10s：產品組\n\n10–18s：細節\n\n18–25s：CTA",
    "params": "9:16；構圖乾淨。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "桌面陳列",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, tabletopdisplay style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "hangingdisplay",
    "command": "/hangingdisplay",
    "title": "吊掛展示",
    "category": "product_display",
    "applicability": "吊卡、吊掛陳列。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "吊掛全景"
      },
      {
        "time": "3–10s",
        "content": "產品特寫"
      },
      {
        "time": "10–18s",
        "content": "標籤"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：吊掛全景\n\n3–10s：產品特寫\n\n10–18s：標籤\n\n18–25s：CTA",
    "params": "9:16；高度適中。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "吊掛展示",
      "9:16比例",
      "3秒",
      "產品特寫"
    ],
    "positivePrompt": "cinematic commercial video, hangingdisplay style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "lightboxshow",
    "command": "/lightboxshow",
    "title": "燈箱展示",
    "category": "product_display",
    "applicability": "高對比產品照。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "產品登場"
      },
      {
        "time": "3–10s",
        "content": "旋轉/移動"
      },
      {
        "time": "10–18s",
        "content": "細節"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：產品登場\n\n3–10s：旋轉/移動\n\n10–18s：細節\n\n18–25s：CTA",
    "params": "1:1 或 16:9；背景純。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "燈箱展示",
      "16:9比例",
      "3秒",
      "產品特寫"
    ],
    "positivePrompt": "cinematic commercial video, lightboxshow style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "turntable",
    "command": "/turntable",
    "title": "轉盤展示",
    "category": "product_display",
    "applicability": "電商、官網。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "產品"
      },
      {
        "time": "3–12s",
        "content": "緩慢旋轉"
      },
      {
        "time": "12–18s",
        "content": "停格特寫"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：產品\n\n3–12s：緩慢旋轉\n\n12–18s：停格特寫\n\n18–25s：CTA",
    "params": "1:1；光線均勻。",
    "defaultAspect": "1:1",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "轉盤展示",
      "1:1比例",
      "3秒",
      "產品特寫"
    ],
    "positivePrompt": "cinematic commercial video, turntable style for product promotion, 1:1 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "splitview",
    "command": "/splitview",
    "title": "分割視圖",
    "category": "tech_structure",
    "applicability": "內外結構、前後對比。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "標題"
      },
      {
        "time": "3–10s",
        "content": "左 A 右 B"
      },
      {
        "time": "10–18s",
        "content": "重點標註"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：標題\n\n3–10s：左 A 右 B\n\n10–18s：重點標註\n\n18–25s：CTA",
    "params": "16:9；分割清楚。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "分割視圖",
      "16:9比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, splitview style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "xrayview",
    "command": "/xrayview",
    "title": "X 光視圖",
    "category": "tech_structure",
    "applicability": "結構展示、教育。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "產品"
      },
      {
        "time": "3–10s",
        "content": "X 光效果"
      },
      {
        "time": "10–18s",
        "content": "內部結構"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：產品\n\n3–10s：X 光效果\n\n10–18s：內部結構\n\n18–25s：CTA",
    "params": "16:9；色調冷。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "X 光視圖",
      "16:9比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, xrayview style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "explodedanim",
    "command": "/explodedanim",
    "title": "爆炸動畫",
    "category": "tech_structure",
    "applicability": "結構分解。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "產品完整"
      },
      {
        "time": "3–10s",
        "content": "零件分離"
      },
      {
        "time": "10–18s",
        "content": "標註"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：產品完整\n\n3–10s：零件分離\n\n10–18s：標註\n\n18–25s：CTA",
    "params": "16:9；3D 或 2.5D。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "爆炸動畫",
      "16:9比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, explodedanim style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "assemblyanim",
    "command": "/assemblyanim",
    "title": "組裝動畫",
    "category": "tech_structure",
    "applicability": "需要組裝的產品。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "零件"
      },
      {
        "time": "3–10s",
        "content": "步驟 1"
      },
      {
        "time": "10–18s",
        "content": "步驟 2"
      },
      {
        "time": "18–25s",
        "content": "成品"
      }
    ],
    "rawScript": "0–3s：零件\n\n3–10s：步驟 1\n\n10–18s：步驟 2\n\n18–25s：成品",
    "params": "16:9；步驟 2–3 步。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "組裝動畫",
      "16:9比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, assemblyanim style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "usecase3",
    "command": "/usecase3",
    "title": "3 種用法",
    "category": "tutorial_sop",
    "applicability": "多用途產品。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "產品"
      },
      {
        "time": "3–8s",
        "content": "用法 A"
      },
      {
        "time": "8–15s",
        "content": "用法 B"
      },
      {
        "time": "15–22s",
        "content": "用法 C"
      },
      {
        "time": "22–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：產品\n\n3–8s：用法 A\n\n8–15s：用法 B\n\n15–22s：用法 C\n\n22–25s：CTA",
    "params": "9:16；每用法一句。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "3 種用法",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, usecase3 style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "problemfit",
    "command": "/problemfit",
    "title": "問題契合",
    "category": "tutorial_sop",
    "applicability": "問題→產品契合。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "痛點"
      },
      {
        "time": "3–10s",
        "content": "產品登場"
      },
      {
        "time": "10–18s",
        "content": "如何解決"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：痛點\n\n3–10s：產品登場\n\n10–18s：如何解決\n\n18–25s：CTA",
    "params": "9:16；邏輯清楚。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "問題契合",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, problemfit style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "featuretour",
    "command": "/featuretour",
    "title": "功能導覽",
    "category": "tutorial_sop",
    "applicability": "多功能產品。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "產品"
      },
      {
        "time": "3–8s",
        "content": "功能 1"
      },
      {
        "time": "8–15s",
        "content": "功能 2"
      },
      {
        "time": "15–22s",
        "content": "功能 3"
      },
      {
        "time": "22–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：產品\n\n3–8s：功能 1\n\n8–15s：功能 2\n\n15–22s：功能 3\n\n22–25s：CTA",
    "params": "9:16；3 功能內。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "功能導覽",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, featuretour style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "benefitstack",
    "command": "/benefitstack",
    "title": "利益疊加",
    "category": "tutorial_sop",
    "applicability": "強化價值感。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "利益 1"
      },
      {
        "time": "3–8s",
        "content": "利益 2"
      },
      {
        "time": "8–15s",
        "content": "利益 3"
      },
      {
        "time": "15–22s",
        "content": "總結"
      },
      {
        "time": "22–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：利益 1\n\n3–8s：利益 2\n\n8–15s：利益 3\n\n15–22s：總結\n\n22–25s：CTA",
    "params": "9:16；每利益一句。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "利益疊加",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, benefitstack style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "testimonialproduct",
    "command": "/testimonialproduct",
    "title": "用戶證言＋產品",
    "category": "trust_authority",
    "applicability": "信任＋展示。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "用戶＋產品"
      },
      {
        "time": "3–10s",
        "content": "證言一句"
      },
      {
        "time": "10–18s",
        "content": "產品特寫"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：用戶＋產品\n\n3–10s：證言一句\n\n10–18s：產品特寫\n\n18–25s：CTA",
    "params": "9:16；人像清晰。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "用戶證言＋產",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, testimonialproduct style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "expertreview",
    "command": "/expertreview",
    "title": "專家評測",
    "category": "trust_authority",
    "applicability": "專業背書。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "專家＋頭銜"
      },
      {
        "time": "3–10s",
        "content": "評價一句"
      },
      {
        "time": "10–18s",
        "content": "亮點 1"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：專家＋頭銜\n\n3–10s：評價一句\n\n10–18s：亮點 1\n\n18–25s：CTA",
    "params": "16:9；專業感。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 3,
    "badge": "真實信任",
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "專家評測",
      "16:9比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, expertreview style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "sidebyside",
    "command": "/sidebyside",
    "title": "並排比較",
    "category": "product_display",
    "applicability": "自家系列比較。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "A vs B"
      },
      {
        "time": "3–10s",
        "content": "A 特點"
      },
      {
        "time": "10–18s",
        "content": "B 特點"
      },
      {
        "time": "18–25s",
        "content": "建議"
      }
    ],
    "rawScript": "0–3s：A vs B\n\n3–10s：A 特點\n\n10–18s：B 特點\n\n18–25s：建議",
    "params": "9:16；公平。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "並排比較",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, sidebyside style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "rangeoverview",
    "command": "/rangeoverview",
    "title": "系列總覽",
    "category": "product_display",
    "applicability": "整系列展示。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "系列名"
      },
      {
        "time": "3–10s",
        "content": "全排面"
      },
      {
        "time": "10–18s",
        "content": "主打 2 款"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：系列名\n\n3–10s：全排面\n\n10–18s：主打 2 款\n\n18–25s：CTA",
    "params": "16:9；排面整齊。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "系列總覽",
      "16:9比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, rangeoverview style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "flagshipfocus",
    "command": "/flagshipfocus",
    "title": "旗艦聚焦",
    "category": "product_display",
    "applicability": "旗艦款主打。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "旗艦名"
      },
      {
        "time": "3–10s",
        "content": "外觀"
      },
      {
        "time": "10–18s",
        "content": "核心技術"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：旗艦名\n\n3–10s：外觀\n\n10–18s：核心技術\n\n18–25s：CTA",
    "params": "9:16；技術一句。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "旗艦聚焦",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, flagshipfocus style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "entrylevel",
    "command": "/entrylevel",
    "title": "入門款介紹",
    "category": "product_display",
    "applicability": "拉低門檻。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "入門款名"
      },
      {
        "time": "3–10s",
        "content": "價格"
      },
      {
        "time": "10–18s",
        "content": "足夠的功能"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：入門款名\n\n3–10s：價格\n\n10–18s：足夠的功能\n\n18–25s：CTA",
    "params": "9:16；價格清楚。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "入門款介紹",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, entrylevel style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "premiumfeel",
    "command": "/premiumfeel",
    "title": "高端質感",
    "category": "product_display",
    "applicability": "高單價產品。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "產品"
      },
      {
        "time": "3–10s",
        "content": "材質特寫"
      },
      {
        "time": "10–18s",
        "content": "細節工藝"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：產品\n\n3–10s：材質特寫\n\n10–18s：細節工藝\n\n18–25s：CTA",
    "params": "16:9；光線戲劇化。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "高端質感",
      "16:9比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, premiumfeel style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "giftguide",
    "command": "/giftguide",
    "title": "送禮指南",
    "category": "product_display",
    "applicability": "節慶檔期。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "送誰"
      },
      {
        "time": "3–10s",
        "content": "推薦 1"
      },
      {
        "time": "10–18s",
        "content": "推薦 2"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：送誰\n\n3–10s：推薦 1\n\n10–18s：推薦 2\n\n18–25s：CTA",
    "params": "9:16；受眾明確。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "送禮指南",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, giftguide style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "top3picks",
    "command": "/top3picks",
    "title": "精選 3 款",
    "category": "product_display",
    "applicability": "編輯推薦。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "主題"
      },
      {
        "time": "3–8s",
        "content": "第 1 名"
      },
      {
        "time": "8–15s",
        "content": "第 2 名"
      },
      {
        "time": "15–22s",
        "content": "第 3 名"
      },
      {
        "time": "22–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：主題\n\n3–8s：第 1 名\n\n8–15s：第 2 名\n\n15–22s：第 3 名\n\n22–25s：CTA",
    "params": "9:16；理由一句。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "精選 3 款",
      "9:16比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, top3picks style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "newvsold",
    "command": "/newvsold",
    "title": "新舊比較",
    "category": "product_display",
    "applicability": "改版、新一代。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "新 vs 舊"
      },
      {
        "time": "3–10s",
        "content": "改進 1"
      },
      {
        "time": "10–18s",
        "content": "改進 2"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：新 vs 舊\n\n3–10s：改進 1\n\n10–18s：改進 2\n\n18–25s：CTA",
    "params": "9:16；改進具體。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "新舊比較",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, newvsold style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "generationchange",
    "command": "/generationchange",
    "title": "世代更替",
    "category": "product_display",
    "applicability": "新一代產品。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "世代名"
      },
      {
        "time": "3–10s",
        "content": "新技術"
      },
      {
        "time": "10–18s",
        "content": "體驗提升"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：世代名\n\n3–10s：新技術\n\n10–18s：體驗提升\n\n18–25s：CTA",
    "params": "16:9；避免貶舊。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "世代更替",
      "16:9比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, generationchange style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "limitedcolor",
    "command": "/limitedcolor",
    "title": "限定色",
    "category": "product_display",
    "applicability": "季節/聯名色。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "色名"
      },
      {
        "time": "3–10s",
        "content": "特寫"
      },
      {
        "time": "10–18s",
        "content": "情境"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：色名\n\n3–10s：特寫\n\n10–18s：情境\n\n18–25s：CTA",
    "params": "9:16；色準正確。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "限定色",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, limitedcolor style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "seasonalset",
    "command": "/seasonalset",
    "title": "季節套組",
    "category": "product_display",
    "applicability": "節慶/季節套組。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "套組名"
      },
      {
        "time": "3–10s",
        "content": "內容物"
      },
      {
        "time": "10–18s",
        "content": "使用情境"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：套組名\n\n3–10s：內容物\n\n10–18s：使用情境\n\n18–25s：CTA",
    "params": "9:16；季節感。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "季節套組",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, seasonalset style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "giftsetopen",
    "command": "/giftsetopen",
    "title": "禮盒開啟",
    "category": "product_display",
    "applicability": "送禮檔期。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "禮盒"
      },
      {
        "time": "3–10s",
        "content": "開啟"
      },
      {
        "time": "10–18s",
        "content": "內容"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：禮盒\n\n3–10s：開啟\n\n10–18s：內容\n\n18–25s：CTA",
    "params": "9:16；動作順。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "禮盒開啟",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, giftsetopen style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "customengrave",
    "command": "/customengrave",
    "title": "客製刻字",
    "category": "product_display",
    "applicability": "客製化產品。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "產品"
      },
      {
        "time": "3–10s",
        "content": "刻字過程"
      },
      {
        "time": "10–18s",
        "content": "成品"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：產品\n\n3–10s：刻字過程\n\n10–18s：成品\n\n18–25s：CTA",
    "params": "9:16；字清晰。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "客製刻字",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, customengrave style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "personalize",
    "command": "/personalize",
    "title": "個人化",
    "category": "product_display",
    "applicability": "客製選項。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "選項名"
      },
      {
        "time": "3–10s",
        "content": "選擇過程"
      },
      {
        "time": "10–18s",
        "content": "成品"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：選項名\n\n3–10s：選擇過程\n\n10–18s：成品\n\n18–25s：CTA",
    "params": "9:16；流程簡化。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "個人化",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, personalize style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "madetoorder",
    "command": "/madetoorder",
    "title": "接單生產",
    "category": "product_display",
    "applicability": "高單價客製。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "流程名"
      },
      {
        "time": "3–10s",
        "content": "下單"
      },
      {
        "time": "10–18s",
        "content": "製作"
      },
      {
        "time": "18–25s",
        "content": "出貨"
      }
    ],
    "rawScript": "0–3s：流程名\n\n3–10s：下單\n\n10–18s：製作\n\n18–25s：出貨",
    "params": "16:9；時程一句。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "接單生產",
      "16:9比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, madetoorder style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "qualitycheck",
    "command": "/qualitycheck",
    "title": "品檢",
    "category": "tech_structure",
    "applicability": "信任建立。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "品檢站"
      },
      {
        "time": "3–10s",
        "content": "檢查項目"
      },
      {
        "time": "10–18s",
        "content": "合格標準"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：品檢站\n\n3–10s：檢查項目\n\n10–18s：合格標準\n\n18–25s：CTA",
    "params": "16:9；標準具體。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "品檢",
      "16:9比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, qualitycheck style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "stresstest",
    "command": "/stresstest",
    "title": "壓力測試",
    "category": "tech_structure",
    "applicability": "耐用性展示。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "測試名"
      },
      {
        "time": "3–10s",
        "content": "測試過程"
      },
      {
        "time": "10–18s",
        "content": "結果"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：測試名\n\n3–10s：測試過程\n\n10–18s：結果\n\n18–25s：CTA",
    "params": "16:9；安全第一。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "壓力測試",
      "16:9比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, stresstest style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "waterresist",
    "command": "/waterresist",
    "title": "防水測試",
    "category": "tech_structure",
    "applicability": "防水產品。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "等級"
      },
      {
        "time": "3–10s",
        "content": "測試"
      },
      {
        "time": "10–18s",
        "content": "結果"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：等級\n\n3–10s：測試\n\n10–18s：結果\n\n18–25s：CTA",
    "params": "9:16；安全。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "防水測試",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, waterresist style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "droptest",
    "command": "/droptest",
    "title": "摔落測試",
    "category": "tech_structure",
    "applicability": "耐摔產品。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "高度"
      },
      {
        "time": "3–10s",
        "content": "摔落"
      },
      {
        "time": "10–18s",
        "content": "檢查"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：高度\n\n3–10s：摔落\n\n10–18s：檢查\n\n18–25s：CTA",
    "params": "9:16；安全。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "摔落測試",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, droptest style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "warrantyinfo",
    "command": "/warrantyinfo",
    "title": "保固說明",
    "category": "tech_structure",
    "applicability": "信任建立。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "保固年限"
      },
      {
        "time": "3–10s",
        "content": "涵蓋範圍"
      },
      {
        "time": "10–18s",
        "content": "不涵蓋"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：保固年限\n\n3–10s：涵蓋範圍\n\n10–18s：不涵蓋\n\n18–25s：CTA",
    "params": "16:9；條列清楚。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "保固說明",
      "16:9比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, warrantyinfo style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "supportshow",
    "command": "/supportshow",
    "title": "售後支援",
    "category": "tech_structure",
    "applicability": "服務展示。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "管道"
      },
      {
        "time": "3–10s",
        "content": "回應速度"
      },
      {
        "time": "10–18s",
        "content": "解決方案"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：管道\n\n3–10s：回應速度\n\n10–18s：解決方案\n\n18–25s：CTA",
    "params": "16:9；具體。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "售後支援",
      "16:9比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, supportshow style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "returnprocess",
    "command": "/returnprocess",
    "title": "退貨流程",
    "category": "tutorial_sop",
    "applicability": "降低購買疑慮。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "條件"
      },
      {
        "time": "3–10s",
        "content": "步驟 1"
      },
      {
        "time": "10–18s",
        "content": "步驟 2"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：條件\n\n3–10s：步驟 1\n\n10–18s：步驟 2\n\n18–25s：CTA",
    "params": "9:16；步驟 2–3 步。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "退貨流程",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, returnprocess style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "shippinginfo",
    "command": "/shippinginfo",
    "title": "運送說明",
    "category": "tech_structure",
    "applicability": "電商。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "運送方式"
      },
      {
        "time": "3–10s",
        "content": "時效"
      },
      {
        "time": "10–18s",
        "content": "運費"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：運送方式\n\n3–10s：時效\n\n10–18s：運費\n\n18–25s：CTA",
    "params": "9:16；資訊明確。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "運送說明",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, shippinginfo style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "trackorder",
    "command": "/trackorder",
    "title": "訂單追蹤",
    "category": "tech_structure",
    "applicability": "電商體驗。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "介面"
      },
      {
        "time": "3–10s",
        "content": "查詢步驟"
      },
      {
        "time": "10–18s",
        "content": "狀態說明"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：介面\n\n3–10s：查詢步驟\n\n10–18s：狀態說明\n\n18–25s：CTA",
    "params": "9:16；錄屏。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "訂單追蹤",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, trackorder style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "appcontrol",
    "command": "/appcontrol",
    "title": "APP 控制",
    "category": "tech_structure",
    "applicability": "智慧產品。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "APP 介面"
      },
      {
        "time": "3–10s",
        "content": "功能 1"
      },
      {
        "time": "10–18s",
        "content": "功能 2"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：APP 介面\n\n3–10s：功能 1\n\n10–18s：功能 2\n\n18–25s：CTA",
    "params": "9:16；錄屏＋實機。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "APP 控制",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, appcontrol style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "smartfeature",
    "command": "/smartfeature",
    "title": "智慧功能",
    "category": "tech_structure",
    "applicability": "AI/智慧產品。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "功能名"
      },
      {
        "time": "3–10s",
        "content": "情境"
      },
      {
        "time": "10–18s",
        "content": "效果"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：功能名\n\n3–10s：情境\n\n10–18s：效果\n\n18–25s：CTA",
    "params": "9:16；效果具體。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "智慧功能",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, smartfeature style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "voicecontrol",
    "command": "/voicecontrol",
    "title": "語音控制",
    "category": "tech_structure",
    "applicability": "語音助理整合。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "指令"
      },
      {
        "time": "3–10s",
        "content": "反應"
      },
      {
        "time": "10–18s",
        "content": "結果"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：指令\n\n3–10s：反應\n\n10–18s：結果\n\n18–25s：CTA",
    "params": "9:16；指令簡單。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "語音控制",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, voicecontrol style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "ecosystem",
    "command": "/ecosystem",
    "title": "生態系",
    "category": "tech_structure",
    "applicability": "多裝置連動。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "裝置 A"
      },
      {
        "time": "3–10s",
        "content": "裝置 B"
      },
      {
        "time": "10–18s",
        "content": "連動效果"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：裝置 A\n\n3–10s：裝置 B\n\n10–18s：連動效果\n\n18–25s：CTA",
    "params": "16:9；流程清楚。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "生態系",
      "16:9比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, ecosystem style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "compatibility",
    "command": "/compatibility",
    "title": "相容性",
    "category": "tech_structure",
    "applicability": "配件/平台。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "支援列表"
      },
      {
        "time": "3–10s",
        "content": "示範 1"
      },
      {
        "time": "10–18s",
        "content": "示範 2"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：支援列表\n\n3–10s：示範 1\n\n10–18s：示範 2\n\n18–25s：CTA",
    "params": "9:16；列表簡化。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "相容性",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, compatibility style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "setupguide",
    "command": "/setupguide",
    "title": "設定指南",
    "category": "tutorial_sop",
    "applicability": "新用戶。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "開箱"
      },
      {
        "time": "3–10s",
        "content": "設定 1"
      },
      {
        "time": "10–18s",
        "content": "設定 2"
      },
      {
        "time": "18–25s",
        "content": "完成"
      }
    ],
    "rawScript": "0–3s：開箱\n\n3–10s：設定 1\n\n10–18s：設定 2\n\n18–25s：完成",
    "params": "9:16；步驟 2–3 步。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "設定指南",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, setupguide style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "firstuse",
    "command": "/firstuse",
    "title": "首次使用",
    "category": "tutorial_sop",
    "applicability": "新手體驗。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "開機"
      },
      {
        "time": "3–10s",
        "content": "第一次操作"
      },
      {
        "time": "10–18s",
        "content": "結果"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：開機\n\n3–10s：第一次操作\n\n10–18s：結果\n\n18–25s：CTA",
    "params": "9:16；感受一句。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "首次使用",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, firstuse style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "30daycheck",
    "command": "/30daycheck",
    "title": "30 天回顧",
    "category": "tech_structure",
    "applicability": "長期使用感。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "第 1 天"
      },
      {
        "time": "3–10s",
        "content": "第 7 天"
      },
      {
        "time": "10–18s",
        "content": "第 30 天"
      },
      {
        "time": "18–25s",
        "content": "結論"
      }
    ],
    "rawScript": "0–3s：第 1 天\n\n3–10s：第 7 天\n\n10–18s：第 30 天\n\n18–25s：結論",
    "params": "9:16；變化具體。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 30,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "30 天回顧",
      "9:16比例",
      "30秒"
    ],
    "positivePrompt": "cinematic commercial video, 30daycheck style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "longterm",
    "command": "/longterm",
    "title": "長期使用",
    "category": "tech_structure",
    "applicability": "耐用/穩定性。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "使用時長"
      },
      {
        "time": "3–10s",
        "content": "狀態"
      },
      {
        "time": "10–18s",
        "content": "維護"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：使用時長\n\n3–10s：狀態\n\n10–18s：維護\n\n18–25s：CTA",
    "params": "16:9；真實。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "長期使用",
      "16:9比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, longterm style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "maintenance",
    "command": "/maintenance",
    "title": "保養教學",
    "category": "tutorial_sop",
    "applicability": "需要保養的產品。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "保養頻率"
      },
      {
        "time": "3–10s",
        "content": "步驟 1"
      },
      {
        "time": "10–18s",
        "content": "步驟 2"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：保養頻率\n\n3–10s：步驟 1\n\n10–18s：步驟 2\n\n18–25s：CTA",
    "params": "9:16；步驟簡化。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "保養教學",
      "9:16比例",
      "3秒",
      "SOP教學"
    ],
    "positivePrompt": "cinematic commercial video, maintenance style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "cleaning",
    "command": "/cleaning",
    "title": "清潔教學",
    "category": "tutorial_sop",
    "applicability": "食器、家電。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "清潔劑"
      },
      {
        "time": "3–10s",
        "content": "步驟 1"
      },
      {
        "time": "10–18s",
        "content": "步驟 2"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：清潔劑\n\n3–10s：步驟 1\n\n10–18s：步驟 2\n\n18–25s：CTA",
    "params": "9:16；安全。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "清潔教學",
      "9:16比例",
      "3秒",
      "SOP教學"
    ],
    "positivePrompt": "cinematic commercial video, cleaning style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "storage",
    "command": "/storage",
    "title": "收納建議",
    "category": "tutorial_sop",
    "applicability": "產品收納。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "收納位置"
      },
      {
        "time": "3–10s",
        "content": "方式 1"
      },
      {
        "time": "10–18s",
        "content": "方式 2"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：收納位置\n\n3–10s：方式 1\n\n10–18s：方式 2\n\n18–25s：CTA",
    "params": "9:16；整齊。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "收納建議",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, storage style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "travelcarry",
    "command": "/travelcarry",
    "title": "攜帶展示",
    "category": "tech_structure",
    "applicability": "便攜產品。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "包包/行李箱"
      },
      {
        "time": "3–10s",
        "content": "放入"
      },
      {
        "time": "10–18s",
        "content": "取出使用"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：包包/行李箱\n\n3–10s：放入\n\n10–18s：取出使用\n\n18–25s：CTA",
    "params": "9:16；輕便感。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "攜帶展示",
      "9:16比例",
      "3秒",
      "產品特寫"
    ],
    "positivePrompt": "cinematic commercial video, travelcarry style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "compactshow",
    "command": "/compactshow",
    "title": "小巧展示",
    "category": "tech_structure",
    "applicability": "小型產品。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "與手機比較"
      },
      {
        "time": "3–10s",
        "content": "放口袋"
      },
      {
        "time": "10–18s",
        "content": "使用"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：與手機比較\n\n3–10s：放口袋\n\n10–18s：使用\n\n18–25s：CTA",
    "params": "9:16；比例清楚。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "小巧展示",
      "9:16比例",
      "3秒",
      "產品特寫"
    ],
    "positivePrompt": "cinematic commercial video, compactshow style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "weightfeel",
    "command": "/weightfeel",
    "title": "重量感",
    "category": "tech_structure",
    "applicability": "需要強調輕/重。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "手持"
      },
      {
        "time": "3–10s",
        "content": "動作"
      },
      {
        "time": "10–18s",
        "content": "對比"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：手持\n\n3–10s：動作\n\n10–18s：對比\n\n18–25s：CTA",
    "params": "9:16；對比物明確。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "重量感",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, weightfeel style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "sounddemo",
    "command": "/sounddemo",
    "title": "聲音演示",
    "category": "tech_structure",
    "applicability": "音響、鍵盤、飲品氣泡聲。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "環境安靜"
      },
      {
        "time": "3–10s",
        "content": "聲音 1"
      },
      {
        "time": "10–18s",
        "content": "聲音 2"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：環境安靜\n\n3–10s：聲音 1\n\n10–18s：聲音 2\n\n18–25s：CTA",
    "params": "9:16；收聲乾淨。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "聲音演示",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, sounddemo style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "lighteffect",
    "command": "/lighteffect",
    "title": "燈光效果",
    "category": "tech_structure",
    "applicability": "RGB、氛圍燈。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "关灯"
      },
      {
        "time": "3–10s",
        "content": "模式 A"
      },
      {
        "time": "10–18s",
        "content": "模式 B"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：关灯\n\n3–10s：模式 A\n\n10–18s：模式 B\n\n18–25s：CTA",
    "params": "9:16；暗環境。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "燈光效果",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, lighteffect style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "apptheme",
    "command": "/apptheme",
    "title": "APP 主題",
    "category": "tech_structure",
    "applicability": "可換主題產品。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "主題名"
      },
      {
        "time": "3–10s",
        "content": "切換"
      },
      {
        "time": "10–18s",
        "content": "效果"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：主題名\n\n3–10s：切換\n\n10–18s：效果\n\n18–25s：CTA",
    "params": "9:16；切換順。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
    "tags": [
      "APP 主題",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, apptheme style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "limitedbundle",
    "command": "/limitedbundle",
    "title": "限量套組",
    "category": "events_campaigns",
    "applicability": "稀缺感。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "數量/時間"
      },
      {
        "time": "3–10s",
        "content": "內容"
      },
      {
        "time": "10–18s",
        "content": "價值"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：數量/時間\n\n3–10s：內容\n\n10–18s：價值\n\n18–25s：CTA",
    "params": "9:16；資訊明確。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-violet-600 via-purple-600 to-fuchsia-600",
    "tags": [
      "限量套組",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, limitedbundle style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "exclusivecolor",
    "command": "/exclusivecolor",
    "title": "專屬色",
    "category": "events_campaigns",
    "applicability": "通路/會員專屬。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "色名"
      },
      {
        "time": "3–10s",
        "content": "特寫"
      },
      {
        "time": "10–18s",
        "content": "哪裡買"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：色名\n\n3–10s：特寫\n\n10–18s：哪裡買\n\n18–25s：CTA",
    "params": "9:16；渠道清楚。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-sky-500 via-blue-600 to-indigo-700",
    "tags": [
      "專屬色",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, exclusivecolor style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "regionlaunch",
    "command": "/regionlaunch",
    "title": "區域上市",
    "category": "events_campaigns",
    "applicability": "分區發行。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "地區"
      },
      {
        "time": "3–10s",
        "content": "日期"
      },
      {
        "time": "10–18s",
        "content": "通路"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：地區\n\n3–10s：日期\n\n10–18s：通路\n\n18–25s：CTA",
    "params": "9:16；資訊準。",
    "defaultAspect": "9:16",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-fuchsia-500 via-rose-500 to-amber-500",
    "tags": [
      "區域上市",
      "9:16比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, regionlaunch style for product promotion, 9:16 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "globallaunch",
    "command": "/globallaunch",
    "title": "全球上市",
    "category": "events_campaigns",
    "applicability": "國際發表。",
    "scriptTimeline": [
      {
        "time": "0–3s",
        "content": "全球同步"
      },
      {
        "time": "3–10s",
        "content": "重點市場"
      },
      {
        "time": "10–18s",
        "content": "產品"
      },
      {
        "time": "18–25s",
        "content": "CTA"
      }
    ],
    "rawScript": "0–3s：全球同步\n\n3–10s：重點市場\n\n10–18s：產品\n\n18–25s：CTA",
    "params": "16:9；格局大。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 3,
    "badge": null,
    "gradient": "from-rose-500 via-pink-500 to-purple-600",
    "tags": [
      "全球上市",
      "16:9比例",
      "3秒"
    ],
    "positivePrompt": "cinematic commercial video, globallaunch style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "pressscreen",
    "command": "/pressscreen",
    "title": "媒體螢幕",
    "category": "product_display",
    "applicability": "發表會背景影片。",
    "scriptTimeline": [
      {
        "time": "0–5s",
        "content": "logo"
      },
      {
        "time": "5–15s",
        "content": "產品輪播"
      },
      {
        "time": "15–25s",
        "content": "資訊"
      }
    ],
    "rawScript": "0–5s：logo\n\n5–15s：產品輪播\n\n15–25s：資訊",
    "params": "16:9；低動態。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 15,
    "badge": null,
    "gradient": "from-blue-600 via-indigo-600 to-purple-600",
    "tags": [
      "媒體螢幕",
      "16:9比例",
      "15秒"
    ],
    "positivePrompt": "cinematic commercial video, pressscreen style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  },
  {
    "id": "loopdisplay",
    "command": "/loopdisplay",
    "title": "循環展示",
    "category": "product_display",
    "applicability": "展場螢幕、門市電視。",
    "scriptTimeline": [
      {
        "time": "階段",
        "content": "15–30s 無聲循環：產品 360°＋文字輪播"
      }
    ],
    "rawScript": "15–30s 無聲循環：產品 360°＋文字輪播",
    "params": "16:9；無縫循環。",
    "defaultAspect": "16:9",
    "recommendedSeconds": 60,
    "badge": null,
    "gradient": "from-amber-500 via-orange-500 to-rose-600",
    "tags": [
      "循環展示",
      "16:9比例",
      "60秒",
      "產品特寫"
    ],
    "positivePrompt": "cinematic commercial video, loopdisplay style for product promotion, 16:9 aspect ratio, smooth motion, high dynamic range, professional color grading, studio lighting, hyper-detailed 4k",
    "negativePrompt": "low quality, blurry, text watermark, jerky motion, distorted limbs, flickering artifacts"
  }
]
