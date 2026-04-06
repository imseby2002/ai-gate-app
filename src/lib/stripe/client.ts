import Stripe from 'stripe'

export function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-03-31.basil',
  })
}

export const PLANS = {
  starter: {
    priceId: process.env.STRIPE_STARTER_PRICE_ID ?? '',
    name: 'Starter',
    price: 29,
    features: ['1M Token/月', '50 張圖片/月', '所有文字模型', 'Email 支援'],
  },
  pro: {
    priceId: process.env.STRIPE_PRO_PRICE_ID ?? '',
    name: 'Pro',
    price: 99,
    features: ['10M Token/月', '500 張圖片/月', '20 分鐘影片/月', '優先支援'],
  },
} as const
