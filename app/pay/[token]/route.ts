import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * Public invoice payment route.
 * Creates a fresh Stripe Checkout Session on every visit so the link never expires.
 * The URL /pay/[token] is permanent and safe to embed in emails.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const invoice = await prisma.invoice.findUnique({
    where: { public_token: token },
    include: {
      customer: true,
      user: {
        select: {
          company_name: true,
          stripe_account_id: true,
          stripe_onboarding_complete: true,
        },
      },
    },
  })

  if (!invoice) {
    return NextResponse.redirect(`${APP_URL}/pay/invalid`)
  }

  // Already paid — show a confirmation page instead of creating another session
  if (invoice.status === 'paid') {
    return NextResponse.redirect(`${APP_URL}/pay/${token}/paid`)
  }

  // Stripe not connected — show a fallback page
  if (!invoice.user.stripe_account_id || !invoice.user.stripe_onboarding_complete) {
    return NextResponse.redirect(`${APP_URL}/pay/${token}/no-stripe`)
  }

  const totalCents = Math.round(invoice.total.toNumber() * 100)

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'cad',
          unit_amount: totalCents,
          product_data: {
            name: `Invoice ${invoice.invoice_number}`,
            description: invoice.user.company_name || undefined,
          },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      transfer_data: { destination: invoice.user.stripe_account_id },
      metadata: { invoice_id: invoice.id },
    },
    metadata: { invoice_id: invoice.id },
    customer_email: invoice.customer.email || undefined,
    success_url: `${APP_URL}/pay/${token}/success`,
    cancel_url: `${APP_URL}/pay/${token}`,
  })

  return NextResponse.redirect(session.url!)
}
