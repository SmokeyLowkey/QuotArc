import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function GET() {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { stripe_account_id: true },
  })

  if (!profile?.stripe_account_id) {
    return NextResponse.redirect(`${APP_URL}/settings`)
  }

  const accountLink = await stripe.accountLinks.create({
    account: profile.stripe_account_id,
    type: 'account_onboarding',
    return_url: `${APP_URL}/settings?stripe_return=1`,
    refresh_url: `${APP_URL}/api/stripe/connect/refresh`,
  })

  return NextResponse.redirect(accountLink.url)
}
