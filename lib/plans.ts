// Plan tier configuration — single source of truth for feature gating

export type PlanTier = 'free' | 'starter' | 'pro' | 'business'

export interface PlanFeatures {
  quoting: boolean
  scheduling: boolean
  invoicing: boolean
  email: boolean
  aiQuoteGeneration: boolean
  aiReceptionist: boolean
  googleReviews: boolean
  prioritySupport: boolean
  multiUser: boolean
}

export interface PlanConfig {
  tier: PlanTier
  name: string
  price: number
  stripePriceId: string | null
  voiceMinutes: number
  features: PlanFeatures
}

export const PLANS: Record<PlanTier, PlanConfig> = {
  free: {
    tier: 'free',
    name: 'Free Trial',
    price: 0,
    stripePriceId: null,
    voiceMinutes: 0,
    features: {
      quoting: true,
      scheduling: true,
      invoicing: true,
      email: true,
      aiQuoteGeneration: false,
      aiReceptionist: false,
      googleReviews: false,
      prioritySupport: false,
      multiUser: false,
    },
  },
  starter: {
    tier: 'starter',
    name: 'Starter',
    price: 59,
    stripePriceId: process.env.STRIPE_PRICE_ID_STARTER ?? null,
    voiceMinutes: 0,
    features: {
      quoting: true,
      scheduling: true,
      invoicing: true,
      email: true,
      aiQuoteGeneration: true,
      aiReceptionist: false,
      googleReviews: true,
      prioritySupport: false,
      multiUser: false,
    },
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    price: 119,
    stripePriceId: process.env.STRIPE_PRICE_ID_PRO ?? null,
    voiceMinutes: 100,
    features: {
      quoting: true,
      scheduling: true,
      invoicing: true,
      email: true,
      aiQuoteGeneration: true,
      aiReceptionist: true,
      googleReviews: true,
      prioritySupport: false,
      multiUser: false,
    },
  },
  business: {
    tier: 'business',
    name: 'Business',
    price: 189,
    stripePriceId: process.env.STRIPE_PRICE_ID_BUSINESS ?? null,
    voiceMinutes: 350,
    features: {
      quoting: true,
      scheduling: true,
      invoicing: true,
      email: true,
      aiQuoteGeneration: true,
      aiReceptionist: true,
      googleReviews: true,
      prioritySupport: true,
      multiUser: true,
    },
  },
}

/** Look up tier from a Stripe Price ID */
export function tierFromPriceId(priceId: string): PlanTier {
  for (const [tier, config] of Object.entries(PLANS)) {
    if (config.stripePriceId === priceId) return tier as PlanTier
  }
  return 'free'
}

/** Get plan config for a tier */
export function getPlan(tier: PlanTier): PlanConfig {
  return PLANS[tier] ?? PLANS.free
}

/** Check if a tier has a specific feature */
export function hasFeature(tier: PlanTier, feature: keyof PlanFeatures): boolean {
  return PLANS[tier]?.features[feature] ?? false
}
