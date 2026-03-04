import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { config } from 'dotenv'
import Stripe from 'stripe'

// Load env before anything else
config({ path: '.env.local' })

let prisma: any
let stripe: Stripe

// ─── Test constants ─────────────────────────────────────────────
const TEST_USER_ID = '00000000-0000-0000-0000-000000000088'
const TEST_STRIPE_CUSTOMER_ID = 'cus_test_QuotArc_088'
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!

let testCustomerId: string
let testInvoiceId: string

// ─── Helpers ────────────────────────────────────────────────────

/** Build a fake Stripe event payload and valid signature header */
function buildSignedEvent(event: Record<string, unknown>) {
  const payload = JSON.stringify(event)
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
  })
  return { payload, header }
}

/** Build a minimal Stripe Checkout Session event */
function checkoutSessionEvent(
  invoiceId: string | undefined,
  type: 'checkout.session.completed' | 'checkout.session.expired' = 'checkout.session.completed',
) {
  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    type,
    data: {
      object: {
        id: `cs_test_${Date.now()}`,
        object: 'checkout.session',
        payment_status: 'paid',
        payment_method_types: ['card'],
        metadata: invoiceId ? { invoice_id: invoiceId } : {},
      },
    },
  }
}

/** Build a minimal Stripe Subscription event */
function subscriptionEvent(
  userId: string,
  status: string,
  type: 'customer.subscription.created' | 'customer.subscription.updated' | 'customer.subscription.deleted',
) {
  return {
    id: `evt_test_sub_${Date.now()}`,
    object: 'event',
    type,
    data: {
      object: {
        id: `sub_test_${Date.now()}`,
        object: 'subscription',
        status,
        metadata: { user_id: userId },
      },
    },
  }
}

/** Build a minimal Stripe Invoice payment_failed event (subscription billing) */
function stripeInvoiceFailedEvent(stripeCustomerId: string) {
  return {
    id: `evt_test_inv_fail_${Date.now()}`,
    object: 'event',
    type: 'invoice.payment_failed',
    data: {
      object: {
        id: `in_test_${Date.now()}`,
        object: 'invoice',
        customer: stripeCustomerId,
      },
    },
  }
}

/** Build a minimal Stripe Charge refunded event */
function chargeRefundedEvent(invoiceId: string) {
  return {
    id: `evt_test_refund_${Date.now()}`,
    object: 'event',
    type: 'charge.refunded',
    data: {
      object: {
        id: `ch_test_${Date.now()}`,
        object: 'charge',
        amount_refunded: 15000, // $150.00
        metadata: { invoice_id: invoiceId },
      },
    },
  }
}

/** Call the webhook route handler directly */
async function callWebhook(payload: string, signature: string) {
  const { POST } = await import('../app/api/stripe/webhook/route')
  const request = new Request('http://localhost:3000/api/stripe/webhook', {
    method: 'POST',
    headers: {
      'stripe-signature': signature,
      'content-type': 'application/json',
    },
    body: payload,
  })
  // NextRequest extends Request, so we cast
  return POST(request as any)
}

// ─── Setup & Teardown ───────────────────────────────────────────

beforeAll(async () => {
  const prismaModule = await import('../lib/prisma')
  prisma = prismaModule.prisma
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  // Clean up any leftover test data
  await prisma.notification.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.activityEvent.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.invoice.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.customer.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.profile.deleteMany({ where: { id: TEST_USER_ID } })

  // Create test profile with Stripe customer ID
  await prisma.profile.create({
    data: {
      id: TEST_USER_ID,
      email: 'test-stripe@quotarc.test',
      company_name: 'Stripe Test Electric',
      stripe_customer_id: TEST_STRIPE_CUSTOMER_ID,
    },
  })

  // Create test customer
  const customer = await prisma.customer.create({
    data: {
      user_id: TEST_USER_ID,
      name: 'Jane Doe',
      email: 'jane@test.com',
      phone: '555-0123',
    },
  })
  testCustomerId = customer.id

  // Create test invoice (status: sent)
  const invoice = await prisma.invoice.create({
    data: {
      user_id: TEST_USER_ID,
      customer_id: testCustomerId,
      invoice_number: 'INV-TEST-001',
      status: 'sent',
      subtotal: 142.86,
      tax_rate: 0.05,
      tax: 7.14,
      total: 150.00,
      sent_at: new Date(),
    },
  })
  testInvoiceId = invoice.id
})

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.activityEvent.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.invoice.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.customer.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.profile.deleteMany({ where: { id: TEST_USER_ID } })
})

// ─── Tests ──────────────────────────────────────────────────────

describe('Stripe Webhook — Signature Verification', () => {
  it('rejects requests without stripe-signature header', async () => {
    const { POST } = await import('../app/api/stripe/webhook/route')
    const request = new Request('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    const response = await POST(request as any)
    expect(response.status).toBe(400)

    const json = await response.json()
    expect(json.error).toBe('Missing stripe-signature header')
  })

  it('rejects requests with invalid signature', async () => {
    const response = await callWebhook('{"type":"test"}', 'invalid_signature')
    expect(response.status).toBe(400)

    const json = await response.json()
    expect(json.error).toBe('Invalid signature')
  })

  it('accepts requests with valid signature', async () => {
    const event = {
      id: 'evt_test_unhandled',
      object: 'event',
      type: 'some.unhandled.event',
      data: { object: {} },
    }
    const { payload, header } = buildSignedEvent(event)
    const response = await callWebhook(payload, header)
    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json.received).toBe(true)
  })
})

describe('Stripe Webhook — checkout.session.completed', () => {
  it('marks invoice as paid and creates activity + notification', async () => {
    const event = checkoutSessionEvent(testInvoiceId)
    const { payload, header } = buildSignedEvent(event)

    const response = await callWebhook(payload, header)
    expect(response.status).toBe(200)

    // Verify invoice status changed to paid
    const invoice = await prisma.invoice.findUnique({ where: { id: testInvoiceId } })
    expect(invoice.status).toBe('paid')
    expect(invoice.paid_at).not.toBeNull()

    // Verify activity event created
    const activity = await prisma.activityEvent.findFirst({
      where: {
        user_id: TEST_USER_ID,
        invoice_id: testInvoiceId,
        event_type: 'invoice_paid',
      },
    })
    expect(activity).not.toBeNull()
    expect(activity.metadata.invoice_number).toBe('INV-TEST-001')
    expect(activity.metadata.total).toBe(150)
    expect(activity.metadata.customer_name).toBe('Jane Doe')

    // Verify notification created
    const notification = await prisma.notification.findFirst({
      where: {
        user_id: TEST_USER_ID,
        type: 'invoice_paid',
      },
    })
    expect(notification).not.toBeNull()
    expect(notification.title).toBe('Invoice paid')
    expect(notification.body).toContain('Jane Doe')
    expect(notification.body).toContain('INV-TEST-001')
    expect(notification.body).toContain('$150.00')
    expect(notification.link_url).toBe(`/invoices/${testInvoiceId}`)
  })

  it('is idempotent — calling twice does not duplicate records', async () => {
    // Count existing records
    const activityCountBefore = await prisma.activityEvent.count({
      where: { user_id: TEST_USER_ID, invoice_id: testInvoiceId, event_type: 'invoice_paid' },
    })
    const notifCountBefore = await prisma.notification.count({
      where: { user_id: TEST_USER_ID, type: 'invoice_paid' },
    })

    // Call again — invoice is already paid, should skip
    const event = checkoutSessionEvent(testInvoiceId)
    const { payload, header } = buildSignedEvent(event)
    const response = await callWebhook(payload, header)
    expect(response.status).toBe(200)

    // Counts should not change
    const activityCountAfter = await prisma.activityEvent.count({
      where: { user_id: TEST_USER_ID, invoice_id: testInvoiceId, event_type: 'invoice_paid' },
    })
    const notifCountAfter = await prisma.notification.count({
      where: { user_id: TEST_USER_ID, type: 'invoice_paid' },
    })

    expect(activityCountAfter).toBe(activityCountBefore)
    expect(notifCountAfter).toBe(notifCountBefore)
  })

  it('skips gracefully when invoice_id metadata is missing', async () => {
    const event = checkoutSessionEvent(undefined)
    const { payload, header } = buildSignedEvent(event)

    const response = await callWebhook(payload, header)
    expect(response.status).toBe(200)
  })

  it('skips gracefully when invoice does not exist', async () => {
    const event = checkoutSessionEvent('00000000-0000-0000-0000-000000000000')
    const { payload, header } = buildSignedEvent(event)

    const response = await callWebhook(payload, header)
    expect(response.status).toBe(200)
  })
})

describe('Stripe Webhook — charge.refunded', () => {
  it('reverts paid invoice back to sent', async () => {
    // Confirm invoice is currently paid from previous test
    const before = await prisma.invoice.findUnique({ where: { id: testInvoiceId } })
    expect(before.status).toBe('paid')

    const event = chargeRefundedEvent(testInvoiceId)
    const { payload, header } = buildSignedEvent(event)

    const response = await callWebhook(payload, header)
    expect(response.status).toBe(200)

    // Invoice should be reverted to sent
    const after = await prisma.invoice.findUnique({ where: { id: testInvoiceId } })
    expect(after.status).toBe('sent')
    expect(after.paid_at).toBeNull()

    // Activity event should have refund metadata
    const activity = await prisma.activityEvent.findFirst({
      where: {
        user_id: TEST_USER_ID,
        invoice_id: testInvoiceId,
      },
      orderBy: { created_at: 'desc' },
    })
    expect(activity.metadata.refunded).toBe(true)
    expect(activity.metadata.refund_amount).toBe(150)
  })

  it('does not revert if invoice is not paid', async () => {
    // Invoice is now "sent" from the refund above — calling refund again should be a no-op
    const event = chargeRefundedEvent(testInvoiceId)
    const { payload, header } = buildSignedEvent(event)

    const response = await callWebhook(payload, header)
    expect(response.status).toBe(200)

    const invoice = await prisma.invoice.findUnique({ where: { id: testInvoiceId } })
    expect(invoice.status).toBe('sent')
  })
})

describe('Stripe Webhook — checkout.session.expired', () => {
  it('handles expired session without changing invoice status', async () => {
    const event = checkoutSessionEvent(testInvoiceId, 'checkout.session.expired')
    const { payload, header } = buildSignedEvent(event)

    const response = await callWebhook(payload, header)
    expect(response.status).toBe(200)

    // Invoice should still be sent
    const invoice = await prisma.invoice.findUnique({ where: { id: testInvoiceId } })
    expect(invoice.status).toBe('sent')
  })
})

// ─── Subscription Lifecycle Tests ───────────────────────────────

describe('Stripe Webhook — customer.subscription.created', () => {
  it('activates plan when subscription is created with active status', async () => {
    // Verify initial state is free
    const before = await prisma.profile.findUnique({ where: { id: TEST_USER_ID } })
    expect(before.plan_status).toBe('free')

    const event = subscriptionEvent(TEST_USER_ID, 'active', 'customer.subscription.created')
    const { payload, header } = buildSignedEvent(event)

    const response = await callWebhook(payload, header)
    expect(response.status).toBe(200)

    const after = await prisma.profile.findUnique({ where: { id: TEST_USER_ID } })
    expect(after.plan_status).toBe('active')
    expect(after.stripe_subscription_id).toBeTruthy()
  })
})

describe('Stripe Webhook — customer.subscription.updated', () => {
  it('sets plan to past_due when subscription becomes past_due', async () => {
    const event = subscriptionEvent(TEST_USER_ID, 'past_due', 'customer.subscription.updated')
    const { payload, header } = buildSignedEvent(event)

    const response = await callWebhook(payload, header)
    expect(response.status).toBe(200)

    const profile = await prisma.profile.findUnique({ where: { id: TEST_USER_ID } })
    expect(profile.plan_status).toBe('past_due')
  })

  it('re-activates plan when subscription returns to active', async () => {
    const event = subscriptionEvent(TEST_USER_ID, 'active', 'customer.subscription.updated')
    const { payload, header } = buildSignedEvent(event)

    const response = await callWebhook(payload, header)
    expect(response.status).toBe(200)

    const profile = await prisma.profile.findUnique({ where: { id: TEST_USER_ID } })
    expect(profile.plan_status).toBe('active')
  })

  it('maps trialing status to active', async () => {
    const event = subscriptionEvent(TEST_USER_ID, 'trialing', 'customer.subscription.updated')
    const { payload, header } = buildSignedEvent(event)

    const response = await callWebhook(payload, header)
    expect(response.status).toBe(200)

    const profile = await prisma.profile.findUnique({ where: { id: TEST_USER_ID } })
    expect(profile.plan_status).toBe('active')
  })

  it('skips gracefully when user_id metadata is missing', async () => {
    const event = {
      id: `evt_test_sub_no_user_${Date.now()}`,
      object: 'event',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: `sub_test_${Date.now()}`,
          object: 'subscription',
          status: 'active',
          metadata: {},
        },
      },
    }
    const { payload, header } = buildSignedEvent(event)

    const response = await callWebhook(payload, header)
    expect(response.status).toBe(200)
  })
})

describe('Stripe Webhook — customer.subscription.deleted', () => {
  it('cancels plan and clears subscription ID', async () => {
    const event = subscriptionEvent(TEST_USER_ID, 'canceled', 'customer.subscription.deleted')
    const { payload, header } = buildSignedEvent(event)

    const response = await callWebhook(payload, header)
    expect(response.status).toBe(200)

    const profile = await prisma.profile.findUnique({ where: { id: TEST_USER_ID } })
    expect(profile.plan_status).toBe('canceled')
    expect(profile.stripe_subscription_id).toBeNull()
  })
})

describe('Stripe Webhook — invoice.payment_failed (subscription billing)', () => {
  it('marks user as past_due when subscription payment fails', async () => {
    // First restore to active for this test
    await prisma.profile.update({
      where: { id: TEST_USER_ID },
      data: { plan_status: 'active' },
    })

    const event = stripeInvoiceFailedEvent(TEST_STRIPE_CUSTOMER_ID)
    const { payload, header } = buildSignedEvent(event)

    const response = await callWebhook(payload, header)
    expect(response.status).toBe(200)

    const profile = await prisma.profile.findUnique({ where: { id: TEST_USER_ID } })
    expect(profile.plan_status).toBe('past_due')
  })

  it('skips gracefully when Stripe customer is not linked to any profile', async () => {
    const event = stripeInvoiceFailedEvent('cus_unknown_does_not_exist')
    const { payload, header } = buildSignedEvent(event)

    const response = await callWebhook(payload, header)
    expect(response.status).toBe(200)
  })
})
