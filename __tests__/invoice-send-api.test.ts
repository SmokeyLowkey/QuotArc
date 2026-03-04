/**
 * Tests for POST /api/invoices/[id]/send
 * Covers Stripe Payment Link generation (new in this sprint), PDF + email delivery,
 * and non-fatal failure paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

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

// Decimal-like helper matching Prisma's Decimal type
const dec = (n: number) => ({ toNumber: () => n })

const mockDraftInvoice = {
  id: 'inv-1',
  user_id: 'user-1',
  status: 'draft',
  invoice_number: 'INV-001',
  quote_id: null,
  sent_at: null,
  created_at: new Date('2026-03-01'),
  due_date: new Date('2026-03-31'),
  subtotal: dec(100),
  tax_rate: dec(0.13),
  tax: dec(13),
  total: dec(113),
  customer: {
    id: 'cust-1',
    name: 'Acme Corp',
    email: 'customer@acme.com',
    address: '100 Customer Ave',
  },
  line_items: [
    {
      description: 'Labour',
      category: 'labour',
      quantity: dec(2),
      unit: 'hr',
      rate: dec(50),
      total: dec(100),
      sort_order: 0,
    },
  ],
}

const mockUpdatedInvoice = { ...mockDraftInvoice, status: 'sent', sent_at: new Date() }

const mockPrisma = {
  invoice: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  activityEvent: {
    create: vi.fn().mockResolvedValue({}),
  },
  profile: {
    findUnique: vi.fn(),
  },
}

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

const mockStripe = {
  prices: {
    create: vi.fn().mockResolvedValue({ id: 'price_test123' }),
  },
  paymentLinks: {
    create: vi.fn().mockResolvedValue({ id: 'plink_test123', url: 'https://buy.stripe.com/test' }),
  },
}

vi.mock('@/lib/stripe', () => ({ stripe: mockStripe }))

const mockGeneratePdf = vi.fn().mockResolvedValue(Buffer.from('pdf-content'))

vi.mock('@/lib/pdf', () => ({ generateInvoicePdf: mockGeneratePdf }))

const mockSendInvoiceEmail = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/email', () => ({ sendInvoiceEmail: mockSendInvoiceEmail }))

const { POST } = await import('@/app/api/invoices/[id]/send/route')

// ─── Helpers ────────────────────────────────────────────────────

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/invoices/inv-1/send', {
    method: 'POST',
  })
}

function makeParams(id = 'inv-1') {
  return { params: Promise.resolve({ id }) }
}

const profileStripeConnected = {
  company_name: 'ACME Electric',
  phone: '555-1234',
  address: '123 Main St',
  stripe_account_id: 'acct_test123',
  stripe_onboarding_complete: true,
}

const profileNoStripe = {
  company_name: 'ACME Electric',
  phone: '555-1234',
  address: '123 Main St',
  stripe_account_id: null,
  stripe_onboarding_complete: false,
}

// ─── Tests ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.invoice.update.mockResolvedValue(mockUpdatedInvoice)
  mockPrisma.activityEvent.create.mockResolvedValue({})
  mockStripe.prices.create.mockResolvedValue({ id: 'price_test123' })
  mockStripe.paymentLinks.create.mockResolvedValue({ id: 'plink_test123', url: 'https://buy.stripe.com/test' })
  mockGeneratePdf.mockResolvedValue(Buffer.from('pdf-content'))
  mockSendInvoiceEmail.mockResolvedValue(undefined)
})

describe('POST /api/invoices/[id]/send', () => {
  it('creates payment link and sends email when Stripe is connected', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(mockDraftInvoice)
    mockPrisma.profile.findUnique.mockResolvedValue(profileStripeConnected)

    const res = await POST(makeRequest(), makeParams())

    expect(res.status).toBe(200)

    // Payment link creation
    expect(mockStripe.prices.create).toHaveBeenCalledOnce()
    expect(mockStripe.paymentLinks.create).toHaveBeenCalledOnce()

    // DB update to store payment link
    expect(mockPrisma.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ payment_link: 'https://buy.stripe.com/test' }),
    }))

    // Email sent with payment link
    expect(mockSendInvoiceEmail).toHaveBeenCalledWith(expect.objectContaining({
      paymentLink: 'https://buy.stripe.com/test',
      to: 'customer@acme.com',
    }))
  })

  it('skips Stripe and sends email without payment link when Stripe is not connected', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(mockDraftInvoice)
    mockPrisma.profile.findUnique.mockResolvedValue(profileNoStripe)

    const res = await POST(makeRequest(), makeParams())

    expect(res.status).toBe(200)
    expect(mockStripe.prices.create).not.toHaveBeenCalled()
    expect(mockStripe.paymentLinks.create).not.toHaveBeenCalled()
    expect(mockSendInvoiceEmail).toHaveBeenCalledWith(expect.objectContaining({
      paymentLink: null,
    }))
  })

  it('marks invoice as sent and logs activity when customer has no email', async () => {
    const invoiceNoEmail = {
      ...mockDraftInvoice,
      customer: { ...mockDraftInvoice.customer, email: null },
    }
    mockPrisma.invoice.findFirst.mockResolvedValue(invoiceNoEmail)

    const res = await POST(makeRequest(), makeParams())

    expect(res.status).toBe(200)
    // Invoice marked sent
    expect(mockPrisma.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'sent' }),
    }))
    // Activity logged
    expect(mockPrisma.activityEvent.create).toHaveBeenCalledOnce()
    // No email sent
    expect(mockSendInvoiceEmail).not.toHaveBeenCalled()
    expect(mockStripe.prices.create).not.toHaveBeenCalled()
    expect(mockGeneratePdf).not.toHaveBeenCalled()
  })

  it('returns 400 when invoice is already sent', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue({ ...mockDraftInvoice, status: 'sent' })

    const res = await POST(makeRequest(), makeParams())
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: 'Invoice already sent' })
    expect(mockPrisma.invoice.update).not.toHaveBeenCalled()
  })

  it('returns 404 when invoice is not found', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(null)

    const res = await POST(makeRequest(), makeParams())
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data).toEqual({ error: 'Invoice not found' })
  })

  it('returns 401 when user is not authenticated', async () => {
    const { requireUser, AuthError } = await import('@/lib/auth')
    ;(requireUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new (AuthError as new () => Error)())

    const res = await POST(makeRequest(), makeParams())

    expect(res.status).toBe(401)
    expect(mockPrisma.invoice.findFirst).not.toHaveBeenCalled()
  })

  it('still sends email and returns 200 when payment link creation fails (non-fatal)', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(mockDraftInvoice)
    mockPrisma.profile.findUnique.mockResolvedValue(profileStripeConnected)
    mockStripe.paymentLinks.create.mockRejectedValueOnce(new Error('Stripe unavailable'))

    const res = await POST(makeRequest(), makeParams())

    expect(res.status).toBe(200)
    // Email still sent, but with null payment link
    expect(mockSendInvoiceEmail).toHaveBeenCalledWith(expect.objectContaining({
      paymentLink: null,
    }))
    // Second update (save payment_link to DB) was NOT called — only the first (status: sent)
    const updateCalls = mockPrisma.invoice.update.mock.calls
    const paymentLinkUpdateCall = updateCalls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).data && ((call[0] as Record<string, Record<string, unknown>>).data as Record<string, unknown>).payment_link
    )
    expect(paymentLinkUpdateCall).toBeUndefined()
  })
})
