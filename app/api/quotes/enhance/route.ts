import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'
import { requirePlan } from '@/lib/require-plan'
import { callN8n } from '@/lib/n8n/client'

// POST /api/quotes/enhance
// Calls the n8n AI agent (NEC-aware) to suggest line items based on job type + scope notes.
// The n8n workflow calls Claude with Canadian Electrical Code context and returns
// suggested materials, labor hours, permit requirements, and safety notes.
// Requires Starter plan or above (aiQuoteGeneration feature).

export async function POST(request: NextRequest) {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  const gate = await requirePlan(user.id, 'aiQuoteGeneration')
  if (!gate.allowed) return gate.response

  const body = await request.json()
  const {
    job_type, scope_notes, province,
    customer_name, address, square_footage, panel_size, service_amps,
  } = body

  if (!job_type) {
    return NextResponse.json({ error: 'job_type is required' }, { status: 400 })
  }

  // Get user's labor rate for cost estimates
  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { default_labor_rate: true, default_tax_rate: true },
  })

  try {
    const res = await callN8n('ai-quote-enhance', {
      job_type,
      scope_notes: scope_notes || '',
      province: province || 'AB',
      labor_rate: profile?.default_labor_rate?.toNumber() ?? 95,
      tax_rate: profile?.default_tax_rate?.toNumber() ?? 0.05,
      customer_name: customer_name || '',
      address: address || '',
      square_footage: square_footage || null,
      panel_size: panel_size || '',
      service_amps: service_amps || '',
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: 'AI enhancement unavailable' },
        { status: 502 }
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    // AI enhancement is non-critical — quote builder works without it
    return NextResponse.json(
      { error: 'AI enhancement unavailable', suggested_items: [] },
      { status: 502 }
    )
  }
}
