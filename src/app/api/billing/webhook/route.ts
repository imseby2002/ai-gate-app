import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/server'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!
  const stripe = getStripe()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    return NextResponse.json({ error: `Webhook Error: ${String(err)}` }, { status: 400 })
  }

  const supabase = await createAdminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.supabase_user_id
      const planId = session.metadata?.plan_id
      if (!userId || !planId) break

      await supabase.from('subscriptions').update({
        stripe_sub_id: session.subscription as string,
        plan_id: planId,
        status: 'active',
      }).eq('user_id', userId)

      await supabase.from('credit_transactions').insert({
        user_id: userId,
        amount_usd: planId === 'starter' ? 50 : 200,
        type: 'purchase',
        stripe_payment_intent: session.payment_intent as string,
        description: `${planId} 方案首次充值`,
      })
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const customer = await stripe.customers.retrieve(sub.customer as string)
      if (customer.deleted) break
      const userId = (customer as Stripe.Customer).metadata?.supabase_user_id
      if (!userId) break

      // Stripe's subscription object has these as unix timestamps
      const raw = sub as unknown as Record<string, number>
      await supabase.from('subscriptions').update({
        status: sub.status as string,
        current_period_start: raw.current_period_start
          ? new Date(raw.current_period_start * 1000).toISOString()
          : null,
        current_period_end: raw.current_period_end
          ? new Date(raw.current_period_end * 1000).toISOString()
          : null,
        cancel_at_period_end: sub.cancel_at_period_end,
      }).eq('user_id', userId)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const customer = await stripe.customers.retrieve(sub.customer as string)
      if (customer.deleted) break
      const userId = (customer as Stripe.Customer).metadata?.supabase_user_id
      if (!userId) break

      await supabase.from('subscriptions').update({
        plan_id: 'free',
        status: 'canceled',
        stripe_sub_id: null,
      }).eq('user_id', userId)
      break
    }
  }

  return NextResponse.json({ received: true })
}
