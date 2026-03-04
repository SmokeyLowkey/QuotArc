import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function POST() {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { email: true, stripe_account_id: true },
  })

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  let accountId = profile.stripe_account_id

  // Create Express account if not already created
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'CA',
      email: profile.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    })
    accountId = account.id
    await prisma.profile.update({
      where: { id: user.id },
      data: { stripe_account_id: accountId },
    })
  }

  // Create Account Link for onboarding
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    return_url: `${APP_URL}/settings?stripe_return=1`,
    refresh_url: `${APP_URL}/api/stripe/connect/refresh`,
  })

  return NextResponse.json({ url: accountLink.url })
}
