/**
 * Voice Call Sync — Polls Vapi API for recent calls and backfills missing records.
 *
 * Fetches calls by the user's phoneNumberId from Vapi, then creates VoiceCall
 * records for any not already in the database. This is a fallback for when
 * the end-of-call-report webhook doesn't fire.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const VAPI_API_KEY = process.env.PRIVATE_VAPI_API_KEY

interface VapiCall {
  id: string
  orgId: string
  type: string
  status: string
  endedReason?: string
  startedAt?: string
  endedAt?: string
  cost?: number
  phoneNumberId?: string
  customer?: { number?: string }
  artifact?: {
    messages?: Array<{ role: string; message?: string; content?: string }>
    transcript?: string
    recordingUrl?: string
    stereoRecordingUrl?: string
  }
  analysis?: {
    summary?: string
  }
}

/**
 * Detect if a lead was captured and/or appointment was set from the transcript.
 * Looks for patterns: caller giving their name + phone number, scheduling language.
 */
function detectLeadFromTranscript(
  messages: Array<{ role: string; message?: string; content?: string }>
): { leadCaptured: boolean; appointmentSet: boolean } {
  const fullText = messages
    .map(m => `${m.role}: ${m.message || m.content || ''}`)
    .join('\n')
    .toLowerCase()

  // Lead captured: bot confirmed getting name/number, or caller gave digits
  const phonePattern = /\d[\d\s\-]{6,}/
  const nameConfirmPattern = /got it|perfect|saved|thank you.*name|i('ve| have) (got|saved)/
  const callerGaveInfo = messages.some(m =>
    m.role === 'user' && phonePattern.test(m.message || m.content || '')
  )
  const botConfirmed = messages.some(m =>
    (m.role === 'bot' || m.role === 'assistant') &&
    nameConfirmPattern.test((m.message || m.content || '').toLowerCase())
  )
  const leadCaptured = callerGaveInfo && botConfirmed

  // Appointment set: scheduling language confirmed
  const schedulePattern = /schedul|appointment|booked|see you (then|at|on)|tomorrow at|we('ll| will) see you/
  const appointmentSet = schedulePattern.test(fullText)

  return { leadCaptured, appointmentSet }
}

export async function POST() {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  if (!VAPI_API_KEY) {
    return NextResponse.json({ error: 'Vapi API key not configured' }, { status: 500 })
  }

  // Get the user's Vapi phone number ID
  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { vapi_phone_number_id: true },
  })

  if (!profile?.vapi_phone_number_id) {
    return NextResponse.json({ synced: 0, message: 'No phone number configured' })
  }

  // Fetch recent calls from Vapi API for this phone number
  const url = new URL('https://api.vapi.ai/call')
  url.searchParams.set('phoneNumberId', profile.vapi_phone_number_id)
  url.searchParams.set('limit', '50')

  const vapiRes = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${VAPI_API_KEY}` },
  })

  if (!vapiRes.ok) {
    const errText = await vapiRes.text()
    console.error('[voice-sync] Vapi API error:', vapiRes.status, errText)
    return NextResponse.json({ error: 'Failed to fetch from Vapi' }, { status: 502 })
  }

  const vapiCalls: VapiCall[] = await vapiRes.json()

  // Filter to ended calls only
  const endedCalls = vapiCalls.filter(c => c.status === 'ended')

  if (endedCalls.length === 0) {
    return NextResponse.json({ synced: 0 })
  }

  // Get existing call IDs to skip duplicates
  const vapiCallIds = endedCalls.map(c => c.id)
  const existing = await prisma.voiceCall.findMany({
    where: { vapi_call_id: { in: vapiCallIds } },
    select: { vapi_call_id: true },
  })
  const existingIds = new Set(existing.map((e: (typeof existing)[number]) => e.vapi_call_id))

  // Patch existing records — update lead detection + backfill recordings
  for (const call of endedCalls.filter(c => existingIds.has(c.id))) {
    const { leadCaptured, appointmentSet } = detectLeadFromTranscript(
      call.artifact?.messages ?? []
    )
    const recordingUrl = call.artifact?.stereoRecordingUrl
      || call.artifact?.recordingUrl
      || null

    const updates: Record<string, unknown> = {}
    if (leadCaptured) updates.lead_captured = true
    if (appointmentSet) updates.appointment_set = true
    if (recordingUrl) updates.recording_url = recordingUrl

    if (Object.keys(updates).length > 0) {
      await prisma.voiceCall.update({
        where: { vapi_call_id: call.id },
        data: updates,
      })
    }
  }

  // Create records for missing calls
  const newCalls = endedCalls.filter(c => !existingIds.has(c.id))

  let synced = 0
  for (const call of newCalls) {
    const startedAt = call.startedAt ? new Date(call.startedAt) : null
    const endedAt = call.endedAt ? new Date(call.endedAt) : null
    const durationSeconds = startedAt && endedAt
      ? Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)
      : 0
    const durationMinutes = Math.ceil(durationSeconds / 60)

    // Extract transcript from artifact messages
    const transcript = call.artifact?.messages
      ?.filter(m => (m.role === 'bot' || m.role === 'user') && (m.message || m.content))
      .map(m => ({ role: m.role, message: m.message || m.content })) ?? null

    const recordingUrl = call.artifact?.stereoRecordingUrl
      || call.artifact?.recordingUrl
      || null

    const summary = call.analysis?.summary ?? null

    // Detect lead capture and appointment from transcript
    const { leadCaptured, appointmentSet } = detectLeadFromTranscript(
      call.artifact?.messages ?? []
    )

    try {
      await prisma.voiceCall.create({
        data: {
          user_id: user.id,
          vapi_call_id: call.id,
          caller_number: call.customer?.number ?? null,
          duration_seconds: durationSeconds,
          duration_minutes: durationMinutes,
          status: 'completed',
          summary,
          transcript: transcript as unknown as undefined,
          recording_url: recordingUrl,
          lead_captured: leadCaptured,
          transferred: false,
          appointment_set: appointmentSet,
          ended_reason: call.endedReason ?? null,
          ended_at: endedAt,
          metadata: {},
        },
      })
      synced++
    } catch (err) {
      // Skip duplicate constraint errors
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.includes('Unique constraint')) {
        console.error(`[voice-sync] Failed to create call ${call.id}:`, msg)
      }
    }
  }

  if (synced > 0) {
    // Update voice_minutes_used
    const totalMinutes = newCalls.reduce((sum, call) => {
      const s = call.startedAt ? new Date(call.startedAt) : null
      const e = call.endedAt ? new Date(call.endedAt) : null
      return sum + (s && e ? Math.ceil((e.getTime() - s.getTime()) / 60000) : 0)
    }, 0)

    if (totalMinutes > 0) {
      await prisma.profile.update({
        where: { id: user.id },
        data: { voice_minutes_used: { increment: totalMinutes } },
      })
    }

    console.log(`[voice-sync] Synced ${synced} calls for user ${user.id}`)
  }

  return NextResponse.json({ synced, total: vapiCalls.length })
}
