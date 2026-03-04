import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { tierFromPriceId } from '@/lib/plans'

// Disable body parsing — Stripe needs the raw body for signature verification
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event = undefined as unknown as Stripe.Event

  // Try primary secret, then fallback (handles CLI vs dashboard secret mismatch in dev)
  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET_FALLBACK,
  ].filter(Boolean) as string[]

  let verified = false
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(body, signature, secret)
      verified = true
      break
    } catch {
      // Try next secret
    }
  }

  if (!verified) {
    console.error('[stripe-webhook] Signature verification failed with all secrets')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      // ── Invoice payment completed via Checkout ──────────────────
      case 'checkout.session.completed': {
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      }

      case 'checkout.session.expired': {
        await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session)
        break
      }

      // ── Payment failures ───────────────────────────────────────
      case 'payment_intent.payment_failed': {
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent)
        break
      }

      // ── Refunds ────────────────────────────────────────────────
      case 'charge.refunded': {
        await handleChargeRefunded(event.data.object as Stripe.Charge)
        break
      }

      // ── Subscription lifecycle (SaaS billing) ──────────────────
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        await handleSubscriptionChange(event.data.object as Stripe.Subscription)
        break
      }

      case 'customer.subscription.deleted': {
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      }

      case 'invoice.payment_failed': {
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break
      }

      // ── Stripe Connect — contractor account onboarding ─────────
      case 'account.updated': {
        await handleAccountUpdated(event.data.object as Stripe.Account)
        break
      }

      default:
        // Unhandled event type — log but don't error
        console.log(`[stripe-webhook] Unhandled event: ${event.type}`)
    }
  } catch (err) {
    console.error(`[stripe-webhook] Error handling ${event.type}:`, err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ─── Handlers ────────────────────────────────────────────────────────

/**
 * Customer completed a Checkout Session.
 * Handles two cases:
 *   1. Voice minute pack purchase (metadata.voice_pack set) → credit balance
 *   2. Invoice payment (metadata.invoice_id set) → mark invoice as paid
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // ── Voice minute pack purchase ──────────────────────────────
  if (session.metadata?.voice_pack) {
    const userId = session.metadata.user_id
    const minutes = parseInt(session.metadata.voice_pack, 10)

    if (!userId || isNaN(minutes)) {
      console.error('[stripe-webhook] voice_pack session missing user_id or invalid pack size')
      return
    }

    await prisma.profile.update({
      where: { id: userId },
      data: { voice_minutes_balance: { increment: minutes } },
    })

    console.log(`[stripe-webhook] User ${userId} credited ${minutes} voice minutes (balance)`)
    return
  }

  // ── Invoice payment ─────────────────────────────────────────
  const invoiceId = session.metadata?.invoice_id

  if (!invoiceId) {
    console.log('[stripe-webhook] checkout.session.completed without invoice_id metadata — skipping')
    return
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { customer: true },
  })

  if (!invoice) {
    console.error(`[stripe-webhook] Invoice ${invoiceId} not found`)
    return
  }

  if (invoice.status === 'paid') return // Already processed (idempotent)

  await prisma.$transaction([
    prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'paid',
        paid_at: new Date(),
        next_reminder: null,
      },
    }),
    prisma.activityEvent.create({
      data: {
        user_id: invoice.user_id,
        invoice_id: invoiceId,
        quote_id: invoice.quote_id,
        event_type: 'invoice_paid',
        metadata: {
          invoice_number: invoice.invoice_number,
          total: invoice.total.toNumber(),
          customer_name: invoice.customer.name,
          payment_method: session.payment_method_types?.[0] ?? 'card',
        },
      },
    }),
    prisma.notification.create({
      data: {
        user_id: invoice.user_id,
        type: 'invoice_paid',
        title: 'Invoice paid',
        body: `${invoice.customer.name} paid invoice ${invoice.invoice_number} — $${invoice.total.toNumber().toFixed(2)}`,
        link_url: `/invoices/${invoiceId}`,
        metadata: {
          invoice_id: invoiceId,
          customer_name: invoice.customer.name,
          amount: invoice.total.toNumber(),
        },
      },
    }),
  ])

  console.log(`[stripe-webhook] Invoice ${invoice.invoice_number} marked as paid`)
}

/**
 * Checkout session expired — customer didn't complete payment.
 */
async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  const invoiceId = session.metadata?.invoice_id
  if (!invoiceId) return

  console.log(`[stripe-webhook] Checkout expired for invoice ${invoiceId}`)
  // No status change needed — invoice stays "sent"
}

/**
 * Payment intent failed — log for debugging.
 */
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const invoiceId = paymentIntent.metadata?.invoice_id
  console.error(
    `[stripe-webhook] Payment failed for invoice ${invoiceId ?? 'unknown'}:`,
    paymentIntent.last_payment_error?.message ?? 'No error message',
  )
}

/**
 * Charge was refunded — revert invoice status.
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
  const invoiceId = charge.metadata?.invoice_id
  if (!invoiceId) return

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { customer: true },
  })

  if (!invoice || invoice.status !== 'paid') return

  await prisma.$transaction([
    prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'sent', paid_at: null },
    }),
    prisma.activityEvent.create({
      data: {
        user_id: invoice.user_id,
        invoice_id: invoiceId,
        quote_id: invoice.quote_id,
        event_type: 'invoice_sent', // Re-use sent event for refund visibility
        metadata: {
          invoice_number: invoice.invoice_number,
          total: invoice.total.toNumber(),
          customer_name: invoice.customer.name,
          refunded: true,
          refund_amount: charge.amount_refunded / 100,
        },
      },
    }),
  ])

  console.log(`[stripe-webhook] Invoice ${invoice.invoice_number} refunded`)
}

// ─── Subscription handlers (SaaS billing) ────────────────────────────

/**
 * Subscription created or updated.
 * Expects metadata.user_id on the Stripe Subscription.
 */
async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id
  if (!userId) return

  // Map Stripe status → plan_status
  const planStatus = mapSubscriptionStatus(subscription.status)

  // Extract tier from subscription metadata or price lookup
  let tier = subscription.metadata?.tier
  if (!tier) {
    const priceId = subscription.items?.data?.[0]?.price?.id
    if (priceId) {
      tier = tierFromPriceId(priceId)
    }
  }

  await prisma.profile.update({
    where: { id: userId },
    data: {
      stripe_subscription_id: subscription.id,
      plan_status: planStatus,
      ...(tier && tier !== 'free' ? { plan_tier: tier as 'starter' | 'pro' | 'business' } : {}),
    },
  })

  console.log(`[stripe-webhook] User ${userId} plan_status → ${planStatus}, tier → ${tier ?? 'unchanged'} (subscription ${subscription.id})`)
}

/**
 * Subscription deleted (canceled).
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id
  if (!userId) return

  await prisma.profile.update({
    where: { id: userId },
    data: {
      stripe_subscription_id: null,
      plan_status: 'canceled',
      plan_tier: 'free',
    },
  })

  console.log(`[stripe-webhook] User ${userId} subscription canceled, tier → free`)
}

/**
 * Stripe invoice payment failed (subscription billing).
 * Look up the user by stripe_customer_id and flag as past_due.
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id

  if (!customerId) return

  const profile = await prisma.profile.findUnique({
    where: { stripe_customer_id: customerId },
  })

  if (!profile) {
    console.error(`[stripe-webhook] No profile found for Stripe customer ${customerId}`)
    return
  }

  await prisma.profile.update({
    where: { id: profile.id },
    data: { plan_status: 'past_due' },
  })

  console.log(`[stripe-webhook] User ${profile.id} marked past_due (payment failed)`)
}

/**
 * Stripe Connect account updated — mark onboarding complete when charges are enabled.
 */
async function handleAccountUpdated(account: Stripe.Account) {
  if (!account.details_submitted || !account.charges_enabled) return

  await prisma.profile.updateMany({
    where: { stripe_account_id: account.id },
    data: { stripe_onboarding_complete: true },
  })

  console.log(`[stripe-webhook] Connect account ${account.id} onboarding complete`)
}

/** Map Stripe subscription status to our plan_status */
function mapSubscriptionStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
      return 'past_due'
    case 'canceled':
    case 'unpaid':
      return 'canceled'
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
      return 'free'
    default:
      return 'free'
  }
}
