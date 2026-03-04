/**
 * Tests for Stripe Connect routes:
 *   POST /api/stripe/connect/onboard  — create/resume Express account + account link
 *   GET  /api/stripe/connect/status   — check onboarding completion
 *   GET  /api/stripe/connect/refresh  — refresh expired account link
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────

const mockUser = { id: 'user-1', email: 'contractor@example.com' }

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn().mockResolvedValue(mockUser),
  AuthError: class extends Error {
    constructor() { super('Unauthorized'); this.name = 'AuthError' }
  },
  unauthorizedResponse: vi.fn(() => new Response(
    JSON.stringify({ error: 'Unauthorized' }), { status: 401 }
  )),
}))

const mockPrisma = {
  profile: {
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  },
}

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

const mockStripe = {
  accounts: {
    create: vi.fn().mockResolvedValue({ id: 'acct_new123' }),
    retrieve: vi.fn(),
  },
  accountLinks: {
    create: vi.fn().mockResolvedValue({ url: 'https://connect.stripe.com/onboarding/test' }),
  },
}

vi.mock('@/lib/stripe', () => ({ stripe: mockStripe }))

const { POST: onboardPOST } = await import('@/app/api/stripe/connect/onboard/route')
const { GET: statusGET } = await import('@/app/api/stripe/connect/status/route')
const { GET: refreshGET } = await import('@/app/api/stripe/connect/refresh/route')

// ─── Tests ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.profile.update.mockResolvedValue({})
  mockStripe.accounts.create.mockResolvedValue({ id: 'acct_new123' })
  mockStripe.accountLinks.create.mockResolvedValue({ url: 'https://connect.stripe.com/onboarding/test' })
})

// ─── Onboard ─────────────────────────────────────────────────────

describe('POST /api/stripe/connect/onboard', () => {
  it('creates Express account and returns account link URL when no account exists', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      email: 'contractor@example.com',
      stripe_account_id: null,
    })

    const res = await onboardPOST()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ url: 'https://connect.stripe.com/onboarding/test' })
    expect(mockStripe.accounts.create).toHaveBeenCalledOnce()
    expect(mockStripe.accounts.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'express',
      country: 'CA',
      email: 'contractor@example.com',
    }))
    expect(mockPrisma.profile.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { stripe_account_id: 'acct_new123' },
    })
    expect(mockStripe.accountLinks.create).toHaveBeenCalledOnce()
  })

  it('skips account creation and returns account link when account already exists', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      email: 'contractor@example.com',
      stripe_account_id: 'acct_existing',
    })

    const res = await onboardPOST()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ url: 'https://connect.stripe.com/onboarding/test' })
    expect(mockStripe.accounts.create).not.toHaveBeenCalled()
    expect(mockStripe.accountLinks.create).toHaveBeenCalledWith(expect.objectContaining({
      account: 'acct_existing',
      type: 'account_onboarding',
    }))
  })

  it('returns 404 when profile is not found', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null)

    const res = await onboardPOST()
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data).toEqual({ error: 'Profile not found' })
    expect(mockStripe.accounts.create).not.toHaveBeenCalled()
  })

  it('returns 401 when user is not authenticated', async () => {
    const { requireUser, AuthError } = await import('@/lib/auth')
    ;(requireUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new (AuthError as new () => Error)())

    const res = await onboardPOST()

    expect(res.status).toBe(401)
    expect(mockPrisma.profile.findUnique).not.toHaveBeenCalled()
  })
})

// ─── Status ──────────────────────────────────────────────────────

describe('GET /api/stripe/connect/status', () => {
  it('returns connected:false when no stripe_account_id on profile', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      stripe_account_id: null,
      stripe_onboarding_complete: false,
    })

    const res = await statusGET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ connected: false })
    expect(mockStripe.accounts.retrieve).not.toHaveBeenCalled()
  })

  it('returns complete:true and updates DB when onboarding just completed', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      stripe_account_id: 'acct_test',
      stripe_onboarding_complete: false,
    })
    mockStripe.accounts.retrieve.mockResolvedValue({
      details_submitted: true,
      charges_enabled: true,
    })

    const res = await statusGET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toMatchObject({ connected: true, complete: true })
    expect(mockPrisma.profile.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { stripe_onboarding_complete: true },
    })
  })

  it('returns complete:false and skips DB update when onboarding still incomplete', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      stripe_account_id: 'acct_test',
      stripe_onboarding_complete: false,
    })
    mockStripe.accounts.retrieve.mockResolvedValue({
      details_submitted: false,
      charges_enabled: false,
    })

    const res = await statusGET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toMatchObject({ connected: true, complete: false })
    expect(mockPrisma.profile.update).not.toHaveBeenCalled()
  })

  it('returns 401 when user is not authenticated', async () => {
    const { requireUser, AuthError } = await import('@/lib/auth')
    ;(requireUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new (AuthError as new () => Error)())

    const res = await statusGET()

    expect(res.status).toBe(401)
    expect(mockPrisma.profile.findUnique).not.toHaveBeenCalled()
  })
})

// ─── Refresh ─────────────────────────────────────────────────────

describe('GET /api/stripe/connect/refresh', () => {
  it('regenerates account link and redirects when account exists', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      stripe_account_id: 'acct_test',
    })
    mockStripe.accountLinks.create.mockResolvedValue({
      url: 'https://connect.stripe.com/onboarding/test',
    })

    const res = await refreshGET()

    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)
    expect(res.headers.get('location')).toBe('https://connect.stripe.com/onboarding/test')
    expect(mockStripe.accountLinks.create).toHaveBeenCalledWith(expect.objectContaining({
      account: 'acct_test',
      type: 'account_onboarding',
    }))
  })

  it('redirects to /settings when no stripe_account_id on profile', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      stripe_account_id: null,
    })

    const res = await refreshGET()

    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)
    expect(res.headers.get('location')).toContain('/settings')
    expect(mockStripe.accountLinks.create).not.toHaveBeenCalled()
  })

  it('returns 401 when user is not authenticated', async () => {
    const { requireUser, AuthError } = await import('@/lib/auth')
    ;(requireUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new (AuthError as new () => Error)())

    const res = await refreshGET()

    expect(res.status).toBe(401)
    expect(mockPrisma.profile.findUnique).not.toHaveBeenCalled()
  })
})
