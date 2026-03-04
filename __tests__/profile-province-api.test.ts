/**
 * Tests for PATCH /api/profile — province field support
 * Verifies that 'province' is accepted in the whitelist and that
 * province + default_tax_rate can be set together at signup.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks ──────────────────────────────────────────────────────

const mockUser = { id: 'user-uuid-456', email: 'contractor@example.com' }

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn().mockResolvedValue(mockUser),
  AuthError: class extends Error {
    constructor() { super('Unauthorized'); this.name = 'AuthError' }
  },
  unauthorizedResponse: vi.fn(() => new Response(
    JSON.stringify({ error: 'Unauthorized' }), { status: 401 }
  )),
}))

// Prisma returns Decimal-like objects that must have .toNumber()
function makeDecimal(n: number) {
  return { toNumber: () => n }
}

const mockProfileRow = {
  id: 'user-uuid-456',
  email: 'contractor@example.com',
  company_name: 'ABC Electric',
  phone: null,
  address: null,
  license_number: null,
  logo_url: null,
  province: 'ON',
  default_tax_rate: makeDecimal(0.13),
  default_labor_rate: makeDecimal(95),
  follow_up_template: null,
  quick_reply_templates: [],
  plan_status: 'free',
  plan_tier: 'free',
  voice_minutes_used: 0,
  voice_minutes_reset_at: null,
  google_place_id: null,
  google_review_auto_send: true,
  google_review_delay_hours: 24,
  vapi_phone_number_id: null,
  vapi_phone_number: null,
  receptionist_enabled: false,
  receptionist_greeting: null,
  receptionist_services: [],
  receptionist_hours: {},
  receptionist_transfer_number: null,
  created_at: new Date().toISOString(),
}

const mockPrisma = {
  profile: {
    update: vi.fn().mockResolvedValue(mockProfileRow),
  },
}

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

const { PATCH } = await import('@/app/api/profile/route')

// ─── Helpers ────────────────────────────────────────────────────

function makePatchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─── Tests ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.profile.update.mockResolvedValue(mockProfileRow)
})

describe('PATCH /api/profile — province field', () => {
  it('accepts province + default_tax_rate together (Ontario signup flow)', async () => {
    const res = await PATCH(makePatchRequest({ province: 'ON', default_tax_rate: 0.13 }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(mockPrisma.profile.update).toHaveBeenCalledWith({
      where: { id: 'user-uuid-456' },
      data: { province: 'ON', default_tax_rate: 0.13 },
    })
    // Decimals are serialized to numbers in the response
    expect(typeof data.default_tax_rate).toBe('number')
  })

  it('accepts province alone', async () => {
    const res = await PATCH(makePatchRequest({ province: 'BC' }))

    expect(res.status).toBe(200)
    expect(mockPrisma.profile.update).toHaveBeenCalledWith({
      where: { id: 'user-uuid-456' },
      data: { province: 'BC' },
    })
  })

  it('strips unknown fields — province is passed but evil_field is not', async () => {
    await PATCH(makePatchRequest({ province: 'AB', evil_field: 'injected' }))

    const callArgs = mockPrisma.profile.update.mock.calls[0][0]
    expect(callArgs.data).toHaveProperty('province', 'AB')
    expect(callArgs.data).not.toHaveProperty('evil_field')
  })

  it('returns 400 when only unknown fields are provided', async () => {
    const res = await PATCH(makePatchRequest({ evil_field: 'bad', another_field: 123 }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: 'No valid fields to update' })
    expect(mockPrisma.profile.update).not.toHaveBeenCalled()
  })

  it('returns 401 when user is not authenticated', async () => {
    const { requireUser } = await import('@/lib/auth')
    const { AuthError } = await import('@/lib/auth')
    ;(requireUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new AuthError())

    const res = await PATCH(makePatchRequest({ province: 'MB' }))

    expect(res.status).toBe(401)
    expect(mockPrisma.profile.update).not.toHaveBeenCalled()
  })
})
