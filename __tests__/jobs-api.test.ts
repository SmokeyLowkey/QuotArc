/**
 * Integration tests for GET /api/jobs
 * Verifies voice_call data is included in job responses.
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

vi.mock('@/lib/email', () => ({
  sendScheduleNotification: vi.fn().mockResolvedValue(undefined),
}))

const mockJobs = [
  {
    id: 'job-1',
    user_id: 'user-1',
    customer_id: 'cust-1',
    job_type: 'Panel Upgrade',
    status: 'scheduled',
    scheduled_date: new Date('2026-03-02T00:00:00Z'),
    start_time: '10:00',
    estimated_hours: 2,
    voice_call_id: 'vc-1',
    customer: { name: 'John Smith', phone: '+14165551234', address: '123 Main St' },
    voice_call: {
      id: 'vc-1',
      caller_number: '+14165551234',
      duration_seconds: 180,
      summary: 'Panel upgrade scheduled',
      recording_url: 'https://storage.example.com/rec1.mp3',
      created_at: '2026-03-01T10:00:00Z',
    },
  },
  {
    id: 'job-2',
    user_id: 'user-1',
    customer_id: 'cust-2',
    job_type: 'Outlet Install',
    status: 'in_progress',
    scheduled_date: new Date('2026-03-02T00:00:00Z'),
    start_time: '14:00',
    estimated_hours: 1,
    voice_call_id: null,
    customer: { name: 'Jane Doe', phone: '+14165559876', address: null },
    voice_call: null,
  },
]

const mockPrisma = {
  job: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  quote: {
    findFirst: vi.fn(),
  },
  customer: {
    findFirst: vi.fn(),
  },
  profile: {
    findUnique: vi.fn(),
  },
  activityEvent: {
    create: vi.fn(),
  },
  quoteMessage: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

const { GET } = await import('@/app/api/jobs/route')

// ─── Helpers ────────────────────────────────────────────────────

function makeGetRequest(params?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/jobs')
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
  }
  return new NextRequest(url.toString(), { method: 'GET' })
}

// ─── Tests ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/jobs', () => {
  it('returns jobs with voice_call included', async () => {
    mockPrisma.job.findMany.mockResolvedValue(mockJobs)

    const res = await GET(makeGetRequest())
    const data = await res.json()

    expect(data.jobs).toHaveLength(2)

    // Job from voice call should include voice_call data
    const jobFromCall = data.jobs.find((j: { id: string }) => j.id === 'job-1')
    expect(jobFromCall.voice_call).toBeDefined()
    expect(jobFromCall.voice_call.id).toBe('vc-1')
    expect(jobFromCall.voice_call.recording_url).toBe('https://storage.example.com/rec1.mp3')
    expect(jobFromCall.voice_call.caller_number).toBe('+14165551234')

    // Job without voice call should have null
    const regularJob = data.jobs.find((j: { id: string }) => j.id === 'job-2')
    expect(regularJob.voice_call).toBeNull()
  })

  it('includes customer data', async () => {
    mockPrisma.job.findMany.mockResolvedValue(mockJobs)

    const res = await GET(makeGetRequest())
    const data = await res.json()

    const job = data.jobs[0]
    expect(job.customer).toEqual({
      name: 'John Smith',
      phone: '+14165551234',
      address: '123 Main St',
    })
  })

  it('includes voice_call in the prisma query', async () => {
    mockPrisma.job.findMany.mockResolvedValue([])

    await GET(makeGetRequest())

    expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          voice_call: expect.objectContaining({
            select: expect.objectContaining({
              id: true,
              caller_number: true,
              duration_seconds: true,
              summary: true,
              recording_url: true,
              created_at: true,
            }),
          }),
        }),
      }),
    )
  })

  it('filters by date range', async () => {
    mockPrisma.job.findMany.mockResolvedValue([])

    await GET(makeGetRequest({ from: '2026-03-01', to: '2026-03-31' }))

    expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user_id: 'user-1',
          scheduled_date: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      }),
    )
  })

  it('orders by scheduled_date and start_time ascending', async () => {
    mockPrisma.job.findMany.mockResolvedValue([])

    await GET(makeGetRequest())

    expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ scheduled_date: 'asc' }, { start_time: 'asc' }],
      }),
    )
  })
})
