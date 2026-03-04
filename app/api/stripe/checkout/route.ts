import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'
import { PLANS, type PlanTier } from '@/lib/plans'

export async function POST(request: NextRequest) {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  const { tier } = (await request.json()) as { tier: string }

  const plan = PLANS[tier as PlanTier]
  if (!plan?.stripePriceId) {
    return NextResponse.json({ error: 'Invalid plan tier' }, { status: 400 })
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
    mode: 'subscription',
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    subscription_data: {
      metadata: { user_id: user.id, tier },
    },
    success_url: `${baseUrl}/settings?billing=success`,
    cancel_url: `${baseUrl}/settings?billing=cancel`,
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
