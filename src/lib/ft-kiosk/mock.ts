import type { FtCategory, FtCustomization, FtMenu } from './types'

// 未設定 FT_API_BASE_URL 時使用的假菜單，結構與會員 APP 後端相同

const sugar: FtCustomization = {
  id: 'mock-sugar',
  name: 'Đường',
  min_permitted: 1,
  max_permitted: 1,
  translations: { 'zh-TW': { name: '甜度' }, en: { name: 'Sugar' } },
  options: [
    { id: 'mock-sugar-100', item_no: 'SUGAR100', item_name: '100% đường', list_price: 0, translations: { 'zh-TW': { name: '正常糖' }, en: { name: '100% sugar' } } },
    { id: 'mock-sugar-70', item_no: 'SUGAR70', item_name: '70% đường', list_price: 0, translations: { 'zh-TW': { name: '少糖' }, en: { name: '70% sugar' } } },
    { id: 'mock-sugar-50', item_no: 'SUGAR50', item_name: '50% đường', list_price: 0, translations: { 'zh-TW': { name: '半糖' }, en: { name: '50% sugar' } } },
    { id: 'mock-sugar-0', item_no: 'SUGAR0', item_name: 'Không đường', list_price: 0, translations: { 'zh-TW': { name: '無糖' }, en: { name: 'No sugar' } } },
  ],
}

const ice: FtCustomization = {
  id: 'mock-ice',
  name: 'Đá',
  min_permitted: 1,
  max_permitted: 1,
  translations: { 'zh-TW': { name: '冰塊' }, en: { name: 'Ice' } },
  options: [
    { id: 'mock-ice-normal', item_no: 'ICE100', item_name: 'Đá bình thường', list_price: 0, translations: { 'zh-TW': { name: '正常冰' }, en: { name: 'Regular ice' } } },
    { id: 'mock-ice-less', item_no: 'ICE50', item_name: 'Ít đá', list_price: 0, translations: { 'zh-TW': { name: '少冰' }, en: { name: 'Less ice' } } },
    { id: 'mock-ice-none', item_no: 'ICE0', item_name: 'Không đá', list_price: 0, translations: { 'zh-TW': { name: '去冰' }, en: { name: 'No ice' } } },
  ],
}

const topping: FtCustomization = {
  id: 'mock-topping',
  name: 'Topping',
  min_permitted: 0,
  max_permitted: 3,
  translations: { 'zh-TW': { name: '加料' }, en: { name: 'Toppings' } },
  options: [
    { id: 'mock-tp-pearl', item_no: 'TP01', item_name: 'Trân châu đen', list_price: 8000, translations: { 'zh-TW': { name: '黑珍珠' }, en: { name: 'Black pearl' } } },
    { id: 'mock-tp-white', item_no: 'TP02', item_name: 'Trân châu trắng', list_price: 8000, translations: { 'zh-TW': { name: '白玉珍珠' }, en: { name: 'White pearl' } } },
    { id: 'mock-tp-pudding', item_no: 'TP03', item_name: 'Pudding trứng', list_price: 10000, translations: { 'zh-TW': { name: '布丁' }, en: { name: 'Egg pudding' } } },
    { id: 'mock-tp-foam', item_no: 'TP04', item_name: 'Kem cheese', list_price: 12000, translations: { 'zh-TW': { name: '奶蓋' }, en: { name: 'Cheese foam' } } },
  ],
}

function sized(id: string, itemNo: string, m: number, l: number) {
  return [
    { id: `${id}-m`, item_no: `${itemNo}M`, item_name: 'Size M', list_price: m, customizations: [sugar, ice, topping], translations: { 'zh-TW': { name: '中杯' }, en: { name: 'Medium' } } },
    { id: `${id}-l`, item_no: `${itemNo}L`, item_name: 'Size L', list_price: l, customizations: [sugar, ice, topping], translations: { 'zh-TW': { name: '大杯' }, en: { name: 'Large' } } },
  ]
}

const categories: FtCategory[] = [
  {
    id: 'mock-cat-milktea',
    category_no: 'MILKTEA',
    category_name: 'Trà sữa',
    translations: { 'zh-TW': { name: '奶茶' }, en: { name: 'Milk tea' } },
    items: [
      {
        id: 'mock-classic',
        item_no: 'MT01',
        item_name: 'Trà sữa truyền thống',
        item_type: 'MILKTEA',
        description: 'Hồng trà đậm vị kết hợp sữa béo',
        list_price: 0,
        childs: sized('mock-classic', 'MT01', 35000, 42000),
        translations: {
          'zh-TW': { name: '經典奶茶', description: '濃郁紅茶搭配香濃奶味' },
          en: { name: 'Classic milk tea', description: 'Bold black tea with creamy milk' },
        },
      },
      {
        id: 'mock-oolong',
        item_no: 'MT02',
        item_name: 'Trà sữa Oolong',
        item_type: 'MILKTEA',
        description: 'Oolong rang thơm',
        list_price: 0,
        childs: sized('mock-oolong', 'MT02', 39000, 46000),
        translations: {
          'zh-TW': { name: '烏龍奶茶', description: '焙香烏龍茶' },
          en: { name: 'Oolong milk tea', description: 'Roasted oolong tea' },
        },
      },
      {
        id: 'mock-brown',
        item_no: 'MT03',
        item_name: 'Sữa tươi trân châu đường đen',
        item_type: 'MILKTEA',
        list_price: 45000,
        customizations: [ice],
        translations: {
          'zh-TW': { name: '黑糖珍珠鮮奶' },
          en: { name: 'Brown sugar pearl milk' },
        },
      },
    ],
  },
  {
    id: 'mock-cat-fruit',
    category_no: 'FRUIT',
    category_name: 'Trà trái cây',
    translations: { 'zh-TW': { name: '水果茶' }, en: { name: 'Fruit tea' } },
    items: [
      {
        id: 'mock-peach',
        item_no: 'FT01',
        item_name: 'Trà đào cam sả',
        item_type: 'FRUIT',
        description: 'Đào, cam và sả tươi',
        list_price: 0,
        childs: sized('mock-peach', 'FT01', 39000, 47000),
        translations: {
          'zh-TW': { name: '蜜桃香茅茶', description: '水蜜桃、柳橙、新鮮香茅' },
          en: { name: 'Peach lemongrass tea', description: 'Peach, orange and fresh lemongrass' },
        },
      },
      {
        id: 'mock-passion',
        item_no: 'FT02',
        item_name: 'Trà chanh dây',
        item_type: 'FRUIT',
        list_price: 35000,
        customizations: [sugar, ice],
        translations: {
          'zh-TW': { name: '百香果綠茶' },
          en: { name: 'Passion fruit tea' },
        },
      },
    ],
  },
  {
    id: 'mock-cat-coffee',
    category_no: 'COFFEE',
    category_name: 'Cà phê',
    translations: { 'zh-TW': { name: '咖啡' }, en: { name: 'Coffee' } },
    items: [
      {
        id: 'mock-bacxiu',
        item_no: 'CF01',
        item_name: 'Bạc xỉu',
        item_type: 'COFFEE',
        list_price: 32000,
        customizations: [ice],
        translations: {
          'zh-TW': { name: '越式白咖啡', description: '煉乳鮮奶咖啡' },
          en: { name: 'Bac xiu', description: 'Vietnamese white coffee' },
        },
      },
    ],
  },
]

export function mockMenu(): FtMenu {
  return { storeName: 'Feeling Tea (Demo)', categories, mock: true }
}
