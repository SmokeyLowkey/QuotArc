/**
 * Phone Number Provisioning API
 *
 * POST { areaCode? } — Buy a Twilio number and import it into Vapi
 *
 * Flow:
 * 1. Search Twilio for available local numbers in requested area code
 * 2. Purchase the number via Twilio API
 * 3. Import the number into Vapi (provider: "twilio") with our webhook
 * 4. Save vapi_phone_number_id on Profile
 *
 * Uses platform-owned Twilio credentials (not per-user).
 * Authenticated, gated on aiReceptionist feature.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'
import { requirePlan } from '@/lib/require-plan'

export const dynamic = 'force-dynamic'

const TWILIO_API = 'https://api.twilio.com/2010-04-01'

export async function POST(request: NextRequest) {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  // Feature gate
  const gate = await requirePlan(user.id, 'aiReceptionist')
  if (!gate.allowed) return gate.response

  // Check if already provisioned
  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { vapi_phone_number_id: true },
  })

  if (profile?.vapi_phone_number_id) {
    return NextResponse.json({ error: 'Phone number already provisioned' }, { status: 409 })
  }

  const VAPI_API_KEY = process.env.PRIVATE_VAPI_API_KEY
  const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
  const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN

  if (!VAPI_API_KEY) {
    return NextResponse.json({ error: 'Voice service not configured' }, { status: 503 })
  }
  if (!TWILIO_SID || !TWILIO_TOKEN) {
    return NextResponse.json({ error: 'Telephony service not configured' }, { status: 503 })
  }

  const body = await request.json().catch(() => ({}))
  const areaCode = (body.areaCode as string)?.trim() || undefined
  const twilioAuth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')

  try {
    // ── Step 1: Search for available numbers ───────────────────
    const searchParams = new URLSearchParams({
      VoiceEnabled: 'true',
      SmsEnabled: 'true',
      ...(areaCode && { AreaCode: areaCode }),
    })

    const searchRes = await fetch(
      `${TWILIO_API}/Accounts/${TWILIO_SID}/AvailablePhoneNumbers/US/Local.json?${searchParams}`,
      { headers: { Authorization: `Basic ${twilioAuth}` } }
    )

    if (!searchRes.ok) {
      const errText = await searchRes.text()
      console.error('[voice-provision] Twilio search error:', searchRes.status, errText)
      return NextResponse.json({ error: 'Failed to search for available numbers' }, { status: 502 })
    }

    const searchData = await searchRes.json()
    const available = searchData.available_phone_numbers

    if (!available || available.length === 0) {
      return NextResponse.json(
        { error: areaCode ? `No numbers available in area code ${areaCode}` : 'No numbers available' },
        { status: 404 }
      )
    }

    // Pick the first available number
    const chosenNumber: string = available[0].phone_number // E.164 format

    // ── Step 2: Buy the number via Twilio ──────────────────────
    const buyRes = await fetch(
      `${TWILIO_API}/Accounts/${TWILIO_SID}/IncomingPhoneNumbers.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${twilioAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          PhoneNumber: chosenNumber,
          FriendlyName: `QuotArc - ${user.id.slice(0, 8)}`,
        }),
      }
    )

    if (!buyRes.ok) {
      const errText = await buyRes.text()
      console.error('[voice-provision] Twilio buy error:', buyRes.status, errText)
      return NextResponse.json({ error: 'Failed to purchase phone number' }, { status: 502 })
    }

    const buyData = await buyRes.json()
    const twilioNumber: string = buyData.phone_number
    const twilioSid: string = buyData.sid

    console.log(`[voice-provision] Bought Twilio number ${twilioNumber} (SID: ${twilioSid}) for user ${user.id}`)

    // ── Step 3: Import into Vapi ───────────────────────────────
    const vapiRes = await fetch('https://api.vapi.ai/phone-number', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'twilio',
        number: twilioNumber,
        twilioAccountSid: TWILIO_SID,
        twilioAuthToken: TWILIO_TOKEN,
        name: `QuotArc - ${user.id.slice(0, 8)}`,
        // No assistantId — Vapi will send assistant-request to serverUrl,
        // which returns a dynamic per-user assistant config with tools.
        serverUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/voice/webhook`,
        serverUrlSecret: process.env.VAPI_SERVER_SECRET,
      }),
    })

    if (!vapiRes.ok) {
      const errBody = await vapiRes.text()
      console.error('[voice-provision] Vapi import error:', vapiRes.status, errBody)
      // Number was already bought — don't leave the user hanging
      return NextResponse.json(
        { error: 'Number purchased but failed to configure voice service. Contact support.', twilio_number: twilioNumber },
        { status: 502 }
      )
    }

    const vapiData = await vapiRes.json()
    const vapiPhoneId: string = vapiData.id

    // ── Step 5: Save to profile ────────────────────────────────
    await prisma.profile.update({
      where: { id: user.id },
      data: {
        vapi_phone_number_id: vapiPhoneId,
        vapi_phone_number: twilioNumber,
      },
    })

    console.log(`[voice-provision] Provisioned ${twilioNumber} → Vapi ${vapiPhoneId} for user ${user.id}`)

    return NextResponse.json({
      phone_number_id: vapiPhoneId,
      phone_number: twilioNumber,
    })
  } catch (err) {
    console.error('[voice-provision] Error:', err)
    return NextResponse.json({ error: 'Failed to provision phone number' }, { status: 500 })
  }
}
