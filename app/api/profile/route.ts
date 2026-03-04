import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'

export async function GET() {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  })

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Serialize Decimals to numbers
  return NextResponse.json({
    ...profile,
    default_tax_rate: profile.default_tax_rate.toNumber(),
    default_labor_rate: profile.default_labor_rate.toNumber(),
  })
}

export async function PATCH(request: NextRequest) {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  const body = await request.json()

  // Whitelist: only allow safe profile fields to be updated
  const allowed = [
    'company_name', 'phone', 'address', 'license_number', 'logo_url',
    'default_tax_rate', 'default_labor_rate', 'follow_up_template',
    'quick_reply_templates',
    'google_place_id', 'google_review_auto_send', 'google_review_delay_hours',
    'receptionist_enabled', 'receptionist_greeting', 'receptionist_services',
    'receptionist_hours', 'receptionist_transfer_number',
    'province',
  ] as const

  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const profile = await prisma.profile.update({
    where: { id: user.id },
    data: updates,
  })

  return NextResponse.json({
    ...profile,
    default_tax_rate: profile.default_tax_rate.toNumber(),
    default_labor_rate: profile.default_labor_rate.toNumber(),
  })
}
