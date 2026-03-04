import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { config } from 'dotenv'
import { randomBytes } from 'crypto'

// Load env before anything else
config({ path: '.env.local' })

let prisma: any

// ─── Test constants ─────────────────────────────────────────────
const TEST_USER_ID = '00000000-0000-0000-0000-000000000055'
const TEST_PUBLIC_TOKEN = randomBytes(16).toString('hex')

// Minimal valid PNG data URL (1x1 transparent pixel)
const VALID_SIGNATURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

let testCustomerId: string
let testQuoteId: string

// ─── Helper: call accept endpoint ────────────────────────────────
async function callAccept(
  token: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  const { POST } = await import(
    '../app/api/quotes/public/[token]/accept/route'
  )
  const request = new Request(
    `http://localhost:3000/api/quotes/public/${token}/accept`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'TestAgent/1.0',
        'x-forwarded-for': '203.0.113.42',
        ...headers,
      },
      body: JSON.stringify(body),
    },
  )
  return POST(request as any, { params: Promise.resolve({ token }) })
}

// ─── Setup & Teardown ───────────────────────────────────────────
beforeAll(async () => {
  const prismaModule = await import('../lib/prisma')
  prisma = prismaModule.prisma

  // Clean up leftover test data
  await prisma.notification.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.activityEvent.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.quoteLineItem.deleteMany({
    where: { quote: { user_id: TEST_USER_ID } },
  })
  await prisma.quote.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.customer.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.profile.deleteMany({ where: { id: TEST_USER_ID } })

  // Fixtures
  await prisma.profile.create({
    data: {
      id: TEST_USER_ID,
      email: 'test-sig@quotarc.test',
      company_name: 'Sig Test Electric',
    },
  })

  const customer = await prisma.customer.create({
    data: {
      user_id: TEST_USER_ID,
      name: 'Jane Signer',
      email: 'jane@test.com',
    },
  })
  testCustomerId = customer.id

  const quote = await prisma.quote.create({
    data: {
      user_id: TEST_USER_ID,
      customer_id: testCustomerId,
      quote_number: 'Q-SIG-001',
      status: 'sent',
      job_type: 'Panel Upgrade',
      subtotal: 1000,
      tax_rate: 0.13,
      tax: 130,
      total: 1130,
      public_token: TEST_PUBLIC_TOKEN,
      delivery_status: 'delivered',
      sent_at: new Date(),
    },
  })
  testQuoteId = quote.id
})

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.activityEvent.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.quoteLineItem.deleteMany({
    where: { quote: { user_id: TEST_USER_ID } },
  })
  await prisma.quote.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.customer.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.profile.deleteMany({ where: { id: TEST_USER_ID } })
})

// ─── Validation tests ───────────────────────────────────────────

describe('Accept endpoint validation', () => {
  it('rejects request with no body', async () => {
    const { POST } = await import(
      '../app/api/quotes/public/[token]/accept/route'
    )
    const request = new Request(
      `http://localhost:3000/api/quotes/public/${TEST_PUBLIC_TOKEN}/accept`,
      { method: 'POST' },
    )
    const res = await POST(request as any, {
      params: Promise.resolve({ token: TEST_PUBLIC_TOKEN }),
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid request body')
  })

  it('rejects missing signature_data', async () => {
    const res = await callAccept(TEST_PUBLIC_TOKEN, {
      signature_name: 'Jane Signer',
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Signature is required')
  })

  it('rejects invalid signature format', async () => {
    const res = await callAccept(TEST_PUBLIC_TOKEN, {
      signature_data: 'not-a-valid-data-url',
      signature_name: 'Jane Signer',
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid signature format')
  })

  it('rejects oversized signature data', async () => {
    const hugeData = 'data:image/png;base64,' + 'A'.repeat(60_000)
    const res = await callAccept(TEST_PUBLIC_TOKEN, {
      signature_data: hugeData,
      signature_name: 'Jane Signer',
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Signature data too large')
  })

  it('rejects missing name', async () => {
    const res = await callAccept(TEST_PUBLIC_TOKEN, {
      signature_data: VALID_SIGNATURE,
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Full name is required')
  })

  it('rejects whitespace-only name', async () => {
    const res = await callAccept(TEST_PUBLIC_TOKEN, {
      signature_data: VALID_SIGNATURE,
      signature_name: '   ',
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Full name is required')
  })

  it('returns 404 for unknown token', async () => {
    const res = await callAccept('nonexistent_token_abc123', {
      signature_data: VALID_SIGNATURE,
      signature_name: 'Jane Signer',
    })
    expect(res.status).toBe(404)
  })
})

// ─── Successful acceptance with signature ────────────────────────

describe('Quote acceptance with signature', () => {
  it('accepts quote and stores signature fields', async () => {
    const res = await callAccept(TEST_PUBLIC_TOKEN, {
      signature_data: VALID_SIGNATURE,
      signature_name: '  Jane Signer  ',
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)

    // Verify quote was updated
    const quote = await prisma.quote.findUnique({
      where: { id: testQuoteId },
    })
    expect(quote.status).toBe('accepted')
    expect(quote.accepted_at).toBeDefined()
    expect(quote.signature_data).toBe(VALID_SIGNATURE)
    expect(quote.signature_name).toBe('Jane Signer') // trimmed
    expect(quote.signer_ip).toBe('203.0.113.42')
    expect(quote.signer_user_agent).toBe('TestAgent/1.0')
    expect(quote.signed_at).toBeDefined()
    expect(quote.next_follow_up).toBeNull()
  })

  it('created activity event with signed_by metadata', async () => {
    const events = await prisma.activityEvent.findMany({
      where: { quote_id: testQuoteId, event_type: 'quote_accepted' },
    })
    expect(events.length).toBe(1)
    expect(events[0].metadata.signed_by).toBe('Jane Signer')
  })

  it('created notification for electrician', async () => {
    const notifications = await prisma.notification.findMany({
      where: { user_id: TEST_USER_ID, type: 'quote_accepted' },
    })
    expect(notifications.length).toBe(1)
    expect(notifications[0].body).toContain('Jane Signer')
    expect(notifications[0].body).toContain('Q-SIG-001')
  })
})

// ─── Idempotency ────────────────────────────────────────────────

describe('Idempotency', () => {
  it('rejects re-acceptance of already accepted quote', async () => {
    const res = await callAccept(TEST_PUBLIC_TOKEN, {
      signature_data: VALID_SIGNATURE,
      signature_name: 'Someone Else',
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Quote cannot be accepted')
  })

  it('original signature data is preserved', async () => {
    const quote = await prisma.quote.findUnique({
      where: { id: testQuoteId },
    })
    expect(quote.signature_name).toBe('Jane Signer')
  })
})

// ─── PDF generation with signature ──────────────────────────────

describe('PDF generation with signature', () => {
  it('generates valid PDF with signature embedded', async () => {
    const { generateQuotePdf } = await import('../lib/pdf')

    const buffer = await generateQuotePdf({
      companyName: 'Sig Test Electric',
      quoteNumber: 'Q-SIG-001',
      date: new Date().toISOString(),
      customerName: 'Jane Signer',
      jobType: 'Panel Upgrade',
      lineItems: [
        {
          description: '200A Panel',
          category: 'material',
          quantity: 1,
          unit: 'ea',
          rate: 800,
          total: 800,
        },
        {
          description: 'Installation Labor',
          category: 'labor',
          quantity: 2,
          unit: 'hr',
          rate: 100,
          total: 200,
        },
      ],
      subtotal: 1000,
      taxRate: 0.13,
      tax: 130,
      total: 1130,
      signatureData: VALID_SIGNATURE,
      signatureName: 'Jane Signer',
      signedAt: new Date().toISOString(),
    })

    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('generates valid PDF without signature (unsigned quote)', async () => {
    const { generateQuotePdf } = await import('../lib/pdf')

    const buffer = await generateQuotePdf({
      companyName: 'Sig Test Electric',
      quoteNumber: 'Q-SIG-002',
      date: new Date().toISOString(),
      customerName: 'Jane Signer',
      jobType: 'Panel Upgrade',
      lineItems: [
        {
          description: '200A Panel',
          category: 'material',
          quantity: 1,
          unit: 'ea',
          rate: 800,
          total: 800,
        },
      ],
      subtotal: 800,
      taxRate: 0.13,
      tax: 104,
      total: 904,
    })

    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
  })
})
