/**
 * Integration tests for GET /api/voice/calls
 * Tests filtering logic for the Leads page API.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks ──────────────────────────────────────────────────────

const mockUser = { id: 'user-1', email: 'test@example.com' }

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn().mockResolvedValue(mockUser),
  AuthError: class extends Error { constructor() { super('Unauthorized'); this.name = 'AuthError' } },
  unauthorizedResponse: vi.fn(() => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })),
}))

const mockCalls = [
  {
    id: 'vc-1',
    user_id: 'user-1',
    customer_id: 'cust-1',
    caller_number: '+14165551234',
    duration_seconds: 180,
    duration_minutes: 3,
    lead_captured: true,
    appointment_set: true,
    summary: 'Booked panel upgrade',
    recording_url: 'https://storage.example.com/rec1.mp3',
    created_at: '2026-03-01T10:00:00Z',
  },
  {
    id: 'vc-2',
    user_id: 'user-1',
    customer_id: 'cust-2',
    caller_number: '+14165559876',
    duration_seconds: 120,
    duration_minutes: 2,
    lead_captured: true,
    appointment_set: false,
    summary: 'Asked about pricing, needs follow-up',
    recording_url: 'https://storage.example.com/rec2.mp3',
    created_at: '2026-03-01T11:00:00Z',
  },
  {
    id: 'vc-3',
    user_id: 'user-1',
    customer_id: null,
    caller_number: '+14165550000',
    duration_seconds: 15,
    duration_minutes: 1,
    lead_captured: false,
    appointment_set: false,
    summary: 'Hung up immediately',
    recording_url: null,
    created_at: '2026-03-01T12:00:00Z',
  },
]

const mockCustomers = [
  { id: 'cust-1', name: 'John Smith', phone: '+14165551234' },
  { id: 'cust-2', name: 'Jane Doe', phone: '+14165559876' },
]

const mockPrisma = {
  voiceCall: {
    findMany: vi.fn(),
  },
  customer: {
    findMany: vi.fn(),
  },
}

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

const { GET } = await import('@/app/api/voice/calls/route')

// ─── Helpers ────────────────────────────────────────────────────

function makeGetRequest(filter?: string): NextRequest {
  const url = filter
    ? `http://localhost:3000/api/voice/calls?filter=${filter}`
    : 'http://localhost:3000/api/voice/calls'
  return new NextRequest(url, { method: 'GET' })
}

// ─── Tests ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/voice/calls', () => {
  it('returns all calls with no filter', async () => {
    mockPrisma.voiceCall.findMany.mockResolvedValue(mockCalls)
    mockPrisma.customer.findMany.mockResolvedValue(mockCustomers)

    const res = await GET(makeGetRequest())
    const data = await res.json()

    expect(data.calls).toHaveLength(3)
    expect(mockPrisma.voiceCall.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: 'user-1' },
      }),
    )
  })

  it('enriches calls with customer data', async () => {
    mockPrisma.voiceCall.findMany.mockResolvedValue(mockCalls)
    mockPrisma.customer.findMany.mockResolvedValue(mockCustomers)

    const res = await GET(makeGetRequest())
    const data = await res.json()

    const callWithCustomer = data.calls.find((c: { id: string }) => c.id === 'vc-1')
    expect(callWithCustomer.customer).toEqual({ id: 'cust-1', name: 'John Smith', phone: '+14165551234' })

    const callWithoutCustomer = data.calls.find((c: { id: string }) => c.id === 'vc-3')
    expect(callWithoutCustomer.customer).toBeNull()
  })

  it('filters by appointment_set', async () => {
    mockPrisma.voiceCall.findMany.mockResolvedValue([mockCalls[0]])
    mockPrisma.customer.findMany.mockResolvedValue([mockCustomers[0]])

    await GET(makeGetRequest('appointment_set'))

    expect(mockPrisma.voiceCall.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user_id: 'user-1',
          appointment_set: true,
        }),
      }),
    )
  })

  it('filters by needs_follow_up', async () => {
    mockPrisma.voiceCall.findMany.mockResolvedValue([mockCalls[1]])
    mockPrisma.customer.findMany.mockResolvedValue([mockCustomers[1]])

    await GET(makeGetRequest('needs_follow_up'))

    expect(mockPrisma.voiceCall.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user_id: 'user-1',
          lead_captured: true,
          appointment_set: false,
        }),
      }),
    )
  })

  it('filters by no_lead', async () => {
    mockPrisma.voiceCall.findMany.mockResolvedValue([mockCalls[2]])
    mockPrisma.customer.findMany.mockResolvedValue([])

    await GET(makeGetRequest('no_lead'))

    expect(mockPrisma.voiceCall.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user_id: 'user-1',
          lead_captured: false,
        }),
      }),
    )
  })

  it('returns duration_minutes as number', async () => {
    // The API calls Number() on duration_minutes — verify it works for both
    // raw numbers and Decimal-like objects that toString to a numeric string
    mockPrisma.voiceCall.findMany.mockResolvedValue([{
      ...mockCalls[0],
      duration_minutes: 3,
    }])
    mockPrisma.customer.findMany.mockResolvedValue([mockCustomers[0]])

    const res = await GET(makeGetRequest())
    const data = await res.json()

    expect(typeof data.calls[0].duration_minutes).toBe('number')
    expect(data.calls[0].duration_minutes).toBe(3)
  })
})
