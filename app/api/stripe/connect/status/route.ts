import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'

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
    select: { stripe_account_id: true, stripe_onboarding_complete: true },
  })

  if (!profile?.stripe_account_id) {
    return NextResponse.json({ connected: false })
  }

  const account = await stripe.accounts.retrieve(profile.stripe_account_id)
  const complete = account.details_submitted && account.charges_enabled

  // Update DB if status changed
  if (complete !== profile.stripe_onboarding_complete) {
    await prisma.profile.update({
      where: { id: user.id },
      data: { stripe_onboarding_complete: complete },
    })
  }

  return NextResponse.json({
    connected: true,
    charges_enabled: account.charges_enabled,
    details_submitted: account.details_submitted,
    complete,
  })
}
