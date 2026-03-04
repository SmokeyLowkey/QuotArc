/**
 * Tests for GET /api/cron/overdue-invoices
 * Covers auth guard, date filter correctness, and partial transaction failures.
 *
 * Note: The route captures CRON_SECRET at module load time, so each describe
 * block sets process.env.CRON_SECRET then calls vi.resetModules() + re-imports
 * to pick up the new env value.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks ──────────────────────────────────────────────────────

const dec = (n: number) => ({ toNumber: () => n })

const mockPrisma = {
  invoice: {
    findMany: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  },
  activityEvent: {
    create: vi.fn().mockResolvedValue({}),
  },
  $transaction: vi.fn().mockResolvedValue([]),
}

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

// ─── Helpers ────────────────────────────────────────────────────

function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (authHeader) headers['authorization'] = authHeader
  return new NextRequest('http://localhost:3000/api/cron/overdue-invoices', { headers })
}

function makeInvoices(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `inv-${i + 1}`,
    user_id: 'user-1',
    invoice_number: `INV-00${i + 1}`,
    total: dec((i + 1) * 100),
    customer_id: 'cust-1',
  }))
}

// ─── Tests: no CRON_SECRET set ────────────────────────────────────

describe('GET /api/cron/overdue-invoices — no CRON_SECRET', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let GET: (req: NextRequest) => Promise<any>

  beforeAll(async () => {
    delete process.env.CRON_SECRET
    vi.resetModules()
    const mod = await import('@/app/api/cron/overdue-invoices/route')
    GET = mod.GET
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.invoice.findMany.mockResolvedValue([])
    mockPrisma.$transaction.mockResolvedValue([])
  })

  afterAll(() => {
    vi.resetModules()
  })

  it('returns { processed: 0 } when no overdue invoices exist (auth bypassed)', async () => {
    const res = await GET(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ processed: 0 })
    expect(mockPrisma.invoice.findMany).toHaveBeenCalledOnce()
  })
})

// ─── Tests: CRON_SECRET set ──────────────────────────────────────

describe('GET /api/cron/overdue-invoices — with CRON_SECRET', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let GET: (req: NextRequest) => Promise<any>

  beforeAll(async () => {
    process.env.CRON_SECRET = 'test-secret'
    vi.resetModules()
    const mod = await import('@/app/api/cron/overdue-invoices/route')
    GET = mod.GET
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.invoice.findMany.mockResolvedValue([])
    mockPrisma.$transaction.mockResolvedValue([])
  })

  afterAll(() => {
    delete process.env.CRON_SECRET
    vi.resetModules()
  })

  it('marks 2 overdue invoices and returns correct counts', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue(makeInvoices(2))

    const res = await GET(makeRequest('Bearer test-secret'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ processed: 2, marked: 2, failed: 0 })
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2)
  })

  it('returns 401 when Authorization header is missing', async () => {
    const res = await GET(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data).toEqual({ error: 'Unauthorized' })
    expect(mockPrisma.invoice.findMany).not.toHaveBeenCalled()
  })

  it('returns 401 when Authorization header has wrong secret', async () => {
    const res = await GET(makeRequest('Bearer wrong-secret'))
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data).toEqual({ error: 'Unauthorized' })
    expect(mockPrisma.invoice.findMany).not.toHaveBeenCalled()
  })

  it('counts partial failures — 3 invoices, 1 transaction failure → { processed: 3, marked: 2, failed: 1 }', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue(makeInvoices(3))
    mockPrisma.$transaction
      .mockResolvedValueOnce([])          // inv-1: success
      .mockRejectedValueOnce(new Error('DB write error'))  // inv-2: fails
      .mockResolvedValueOnce([])          // inv-3: success

    const res = await GET(makeRequest('Bearer test-secret'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ processed: 3, marked: 2, failed: 1 })
  })

  it('uses start of today (not current time) for the due_date lt filter', async () => {
    const res = await GET(makeRequest('Bearer test-secret'))

    expect(res.status).toBe(200)
    expect(mockPrisma.invoice.findMany).toHaveBeenCalledOnce()

    const callArg = mockPrisma.invoice.findMany.mock.calls[0][0] as {
      where: { due_date: { lt: Date } }
    }
    const ltDate = callArg.where.due_date.lt

    expect(ltDate).toBeInstanceOf(Date)
    expect(ltDate.getHours()).toBe(0)
    expect(ltDate.getMinutes()).toBe(0)
    expect(ltDate.getSeconds()).toBe(0)
    expect(ltDate.getMilliseconds()).toBe(0)
  })
})
