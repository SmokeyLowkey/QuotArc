/**
 * POST /api/stripe/voice-pack
 *
 * Creates a one-time Stripe Checkout session to purchase a prepaid voice
 * minute pack (100 or 300 minutes). On successful payment, the Stripe
 * webhook credits voice_minutes_balance on the user's profile.
 *
 * Requires: Pro or Business plan (aiReceptionist feature gate).
 */

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'
import { requirePlan } from '@/lib/require-plan'

const PACK_PRICE_IDS: Record<string, string | undefined> = {
  '100': process.env.STRIPE_PRICE_ID_VOICE_100,
  '300': process.env.STRIPE_PRICE_ID_VOICE_300,
}

export async function POST(request: NextRequest) {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  // Only Pro/Business users can buy packs (aiReceptionist gate)
  const gate = await requirePlan(user.id, 'aiReceptionist')
  if (!gate.allowed) return gate.response

  const { pack } = (await request.json()) as { pack: '100' | '300' }
  const priceId = PACK_PRICE_IDS[pack]

  if (!priceId) {
    return NextResponse.json({ error: 'Invalid pack size. Choose 100 or 300.' }, { status: 400 })
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { stripe_customer_id: true, email: true, company_name: true },
  })

  // Create or reuse Stripe customer
  let customerId = profile?.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email!,
      name: profile?.company_name ?? undefined,
      metadata: { user_id: user.id },
    })
    customerId = customer.id
    await prisma.profile.update({
      where: { id: user.id },
      data: { stripe_customer_id: customerId },
    })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      user_id: user.id,
      voice_pack: pack,   // read by the webhook to credit the correct number of minutes
    },
    success_url: `${baseUrl}/settings/receptionist?pack=success`,
    cancel_url:  `${baseUrl}/settings/receptionist`,
  })

  return NextResponse.json({ url: session.url })
}
