import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hasFeature, type PlanTier, type PlanFeatures } from '@/lib/plans'

type GateResult =
  | { allowed: true; tier: PlanTier }
  | { allowed: false; response: NextResponse }

/**
 * Server-side feature gate — checks if a user's plan includes a feature.
 * Returns { allowed: true, tier } or { allowed: false, response: NextResponse(403) }.
 */
export async function requirePlan(
  userId: string,
  feature: keyof PlanFeatures,
): Promise<GateResult> {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { plan_tier: true, plan_status: true },
  })

  if (!profile) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 },
      ),
    }
  }

  const tier = profile.plan_tier as PlanTier

  // Free trial users get access to free-tier features regardless of plan_status
  if (tier === 'free') {
    if (hasFeature('free', feature)) {
      return { allowed: true, tier }
    }
    return {
      allowed: false,
      response: NextResponse.json(
        { error: 'Subscription required', upgrade_url: '/settings#billing' },
        { status: 403 },
      ),
    }
  }

  // Paid tiers require active subscription
  if (profile.plan_status !== 'active') {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: 'Subscription inactive', upgrade_url: '/settings#billing' },
        { status: 403 },
      ),
    }
  }

  if (!hasFeature(tier, feature)) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: 'Feature not available on your plan', upgrade_url: '/settings#billing' },
        { status: 403 },
      ),
    }
  }

  return { allowed: true, tier }
}
