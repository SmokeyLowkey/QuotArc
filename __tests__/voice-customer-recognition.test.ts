/**
 * Tests for pre-call customer recognition.
 * Mocks: prisma
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────

const mockPrisma = {
  customer: { findMany: vi.fn() },
  quote: { findMany: vi.fn() },
  job: { findMany: vi.fn() },
  invoice: { findMany: vi.fn() },
  voiceCall: { count: vi.fn() },
}

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

// Import after mocks
const { recognizeCallerByPhone } = await import('@/lib/voice/customer-recognition')

// ─── Tests ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('recognizeCallerByPhone', () => {
  it('returns null when callerNumber is undefined', async () => {
    const result = await recognizeCallerByPhone('user-1', undefined)
    expect(result).toBeNull()
    expect(mockPrisma.customer.findMany).not.toHaveBeenCalled()
  })

  it('returns null when no customer phone matches', async () => {
    mockPrisma.customer.findMany.mockResolvedValue([
      { id: 'c-1', name: 'John', phone: '(416) 555-0000', address: null, city: null, property_notes: null, panel_size: null, service_amps: null },
    ])

    const result = await recognizeCallerByPhone('user-1', '+14165559999')
    expect(result).toBeNull()
  })

  it('returns recognized customer with context summary when matched', async () => {
    mockPrisma.customer.findMany.mockResolvedValue([
      { id: 'c-1', name: 'Sarah Chen', phone: '(416) 555-1234', address: '123 Main St', city: 'Toronto', property_notes: null, panel_size: '200A', service_amps: '200A' },
    ])
    mockPrisma.quote.findMany.mockResolvedValue([
      { job_type: 'Panel Upgrade', status: 'viewed', total: 4500, created_at: new Date() },
    ])
    mockPrisma.job.findMany.mockResolvedValue([])
    mockPrisma.invoice.findMany.mockResolvedValue([])
    mockPrisma.voiceCall.count.mockResolvedValue(2)

    const result = await recognizeCallerByPhone('user-1', '+14165551234')

    expect(result).not.toBeNull()
    expect(result!.id).toBe('c-1')
    expect(result!.name).toBe('Sarah Chen')
    expect(result!.contextSummary).toContain('RETURNING CUSTOMER: Sarah Chen')
    expect(result!.contextSummary).toContain('123 Main St, Toronto')
    expect(result!.contextSummary).toContain('panel: 200A')
    expect(result!.contextSummary).toContain('Panel Upgrade (viewed, $4500)')
    expect(result!.contextSummary).toContain('Previous calls: 2')
  })

  it('matches E.164 caller number against formatted DB phone', async () => {
    mockPrisma.customer.findMany.mockResolvedValue([
      { id: 'c-1', name: 'Bob', phone: '416-555-7777', address: null, city: null, property_notes: null, panel_size: null, service_amps: null },
    ])
    mockPrisma.quote.findMany.mockResolvedValue([])
    mockPrisma.job.findMany.mockResolvedValue([])
    mockPrisma.invoice.findMany.mockResolvedValue([])
    mockPrisma.voiceCall.count.mockResolvedValue(0)

    const result = await recognizeCallerByPhone('user-1', '+14165557777')

    expect(result).not.toBeNull()
    expect(result!.name).toBe('Bob')
  })

  it('includes upcoming job info in summary', async () => {
    mockPrisma.customer.findMany.mockResolvedValue([
      { id: 'c-1', name: 'Alice', phone: '+14165551111', address: null, city: null, property_notes: null, panel_size: null, service_amps: null },
    ])
    mockPrisma.quote.findMany.mockResolvedValue([])
    mockPrisma.job.findMany.mockResolvedValue([
      { job_type: 'EV Charger Install', status: 'scheduled', scheduled_date: new Date('2026-03-15') },
    ])
    mockPrisma.invoice.findMany.mockResolvedValue([])
    mockPrisma.voiceCall.count.mockResolvedValue(0)

    const result = await recognizeCallerByPhone('user-1', '+14165551111')

    expect(result!.contextSummary).toMatch(/Upcoming job: EV Charger Install on Mar \d+/)
  })

  it('includes outstanding invoice info in summary', async () => {
    mockPrisma.customer.findMany.mockResolvedValue([
      { id: 'c-1', name: 'Dave', phone: '+14165552222', address: null, city: null, property_notes: null, panel_size: null, service_amps: null },
    ])
    mockPrisma.quote.findMany.mockResolvedValue([])
    mockPrisma.job.findMany.mockResolvedValue([])
    mockPrisma.invoice.findMany.mockResolvedValue([
      { status: 'sent', total: 1200 },
      { status: 'overdue', total: 800 },
    ])
    mockPrisma.voiceCall.count.mockResolvedValue(0)

    const result = await recognizeCallerByPhone('user-1', '+14165552222')

    expect(result!.contextSummary).toContain('Outstanding balance: $2000 (2 invoices)')
  })

  it('handles customer with no history gracefully', async () => {
    mockPrisma.customer.findMany.mockResolvedValue([
      { id: 'c-1', name: 'Eve', phone: '+14165553333', address: null, city: null, property_notes: null, panel_size: null, service_amps: null },
    ])
    mockPrisma.quote.findMany.mockResolvedValue([])
    mockPrisma.job.findMany.mockResolvedValue([])
    mockPrisma.invoice.findMany.mockResolvedValue([])
    mockPrisma.voiceCall.count.mockResolvedValue(0)

    const result = await recognizeCallerByPhone('user-1', '+14165553333')

    expect(result).not.toBeNull()
    expect(result!.name).toBe('Eve')
    // Only the name line, no history lines
    expect(result!.contextSummary).toBe('RETURNING CUSTOMER: Eve')
  })
})
