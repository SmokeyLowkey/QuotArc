/**
 * Vapi Server Event Webhook
 *
 * Receives all Vapi server events. Authenticates via Bearer token.
 * Routes by message.type:
 *   - assistant-request → return dynamic assistant config
 *   - tool-calls → execute tool call handlers
 *   - end-of-call-report → save VoiceCall record, update minutes
 *   - status-update → log call state changes
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { sendCallSummaryEmail } from '@/lib/email'
import { recognizeCallerByPhone } from '@/lib/voice/customer-recognition'
import {
  timeToMinutes,
  minutesToTime,
  formatTimeForSpeech,
  DAY_NAMES,
  findAvailableSlots,
  filterSlotsByPreference,
  formatSlotsForSpeech,
} from '@/lib/voice/scheduling'
import { normalizePhone, phonesMatch } from '@/lib/voice/phone'

export const dynamic = 'force-dynamic'

const VAPI_SERVER_SECRET = process.env.VAPI_SERVER_SECRET

// ─── Auth ──────────────────────────────────────────────────────

function verifyAuth(request: NextRequest): boolean {
  if (!VAPI_SERVER_SECRET) {
    console.log('[vapi-webhook] No VAPI_SERVER_SECRET set, skipping auth')
    return true
  }
  const auth = request.headers.get('authorization')
  const valid = auth === `Bearer ${VAPI_SERVER_SECRET}`
  if (!valid) {
    console.warn(`[vapi-webhook] Auth failed — received: "${auth?.slice(0, 20)}…", expected: "Bearer ${VAPI_SERVER_SECRET.slice(0, 4)}…"`)
  }
  return valid
}

// ─── Main Handler ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const messageType = body.message?.type

  try {
    switch (messageType) {
      case 'assistant-request':
        return handleAssistantRequest(body.message)

      case 'tool-calls':
        return handleToolCalls(body.message)

      case 'end-of-call-report':
        return handleEndOfCallReport(body.message)

      case 'status-update': {
        const status = body.message?.status as string | undefined
        const callIdForStatus = body.message?.call?.id as string | undefined
        console.log(`[vapi-webhook] Status: ${status} for call ${callIdForStatus}`)

        // Fallback: if the static Vapi assistant doesn't fire end-of-call-report,
        // process the ended status-update to create a basic VoiceCall record
        if (status === 'ended' && callIdForStatus) {
          await handleStatusEnded(body.message).catch(err =>
            console.error('[vapi-webhook] Error in status-ended fallback:', err)
          )
        }
        return NextResponse.json({})
      }

      default:
        console.log(`[vapi-webhook] Unhandled message type: ${messageType}`)
        return NextResponse.json({})
    }
  } catch (err) {
    console.error(`[vapi-webhook] Error handling ${messageType}:`, err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ─── Assistant Request ─────────────────────────────────────────

async function handleAssistantRequest(message: Record<string, unknown>) {
  const call = message.call as Record<string, unknown> | undefined
  const phoneNumberId = (call?.phoneNumberId as string) ?? ''

  // Look up the electrician by their Vapi phone number
  const profile = await prisma.profile.findFirst({
    where: { vapi_phone_number_id: phoneNumberId },
    select: {
      id: true,
      company_name: true,
      receptionist_enabled: true,
      receptionist_greeting: true,
      receptionist_services: true,
      receptionist_hours: true,
      receptionist_transfer_number: true,
      receptionist_date_overrides: true,
      receptionist_instructions: true,
    },
  })

  if (!profile || !profile.receptionist_enabled) {
    return NextResponse.json({
      assistant: {
        firstMessage: "Hi, you've reached our voicemail. Please leave a message after the tone and we'll get back to you as soon as possible.",
        model: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: 'You are a simple voicemail system. Take a message and end the call.' }],
        },
        voice: { provider: '11labs', voiceId: 'sarah' },
      },
    })
  }

  // ── Caller recognition ─────────────────────────────────────────
  const callerNumber = (call?.customer as Record<string, unknown>)?.number as string | undefined
  const recognized = await recognizeCallerByPhone(profile.id, callerNumber)

  let greeting: string
  if (recognized) {
    const firstName = recognized.name.split(' ')[0]
    greeting = `Hi ${firstName}, thanks for calling ${profile.company_name}. How can I help you today?`
  } else {
    greeting = (profile.receptionist_greeting ?? 'Hi, thanks for calling {company_name}. How can I help you today?')
      .replace(/{company_name}/g, profile.company_name)
  }

  const services = profile.receptionist_services as { name: string; description: string; priceRange: string }[]
  const hours = profile.receptionist_hours as Record<string, { start: string; end: string }>

  const servicesList = services
    .map(s => `• ${s.name}: ${s.description} (${s.priceRange})`)
    .join('\n')

  const hoursText = Object.entries(hours)
    .map(([day, h]) => `${day}: ${h.start}–${h.end}`)
    .join(', ')

  const dateOverrides = (profile.receptionist_date_overrides as Record<string, string>) ?? {}
  const todayStr = new Date().toISOString().split('T')[0]
  const closedToday = dateOverrides[todayStr] === 'closed'

  const systemPrompt = `You are the phone receptionist for ${profile.company_name}.

VOICE RULES (STRICT):
- MAXIMUM 2 SHORT sentences per response. Never more.
- Use contractions (I'm, we're, you'll, that's)
- Never reveal you're an AI
- Sound warm, professional, helpful
- Don't repeat information you already told the caller
- If you don't know something, offer to have someone call them back

SERVICES & PRICING:
${servicesList || '(No services listed — ask what they need and offer to have someone call them back with details.)'}

HOURS: ${hoursText || 'Contact us for availability'}
${profile.receptionist_transfer_number ? 'Transfer to the owner is available if they request it.' : 'Direct transfer is not available — take a message instead.'}
${profile.receptionist_instructions ? `\nSPECIAL INSTRUCTIONS (FOLLOW STRICTLY):\n${profile.receptionist_instructions}\n` : ''}${recognized ? `\nCALLER CONTEXT (use to personalize — don't recite it all):\n${recognized.contextSummary}\n- Greet by first name. If they have an open quote or upcoming job, ask if that's why they're calling.\n` : ''}${closedToday ? `
DAY OFF TODAY (${todayStr}): The owner is unavailable today (one-time exception). Do NOT check availability or schedule appointments. Instead: use capture_lead to save the caller's name and phone number, set notes to "Follow-up needed: called on day off", and let them know someone will call back soon.` : ''}

CRITICAL RULES:
- ALWAYS call capture_lead as soon as you have the caller's name and phone — even if they're not scheduling. Every caller must be saved.
- NEVER say "I don't have access to appointments" — use lookup_customer_jobs to find their existing bookings.
- NEVER make up appointment times — ALWAYS use check_availability first.
- If a tool fails or you truly can't help, offer to transfer (if available) or take a message for a callback.

CALL FLOW:
1. Listen to their need, give a SHORT answer with pricing if relevant
2. Collect their info naturally: name, best callback number, street address, and city — one question at a time
3. Call capture_lead to save their info AS SOON as you have name + phone (don't wait until the end)
4. If scheduling: use check_availability to find REAL openings, let them pick, then schedule_appointment
5. If cancelling/rescheduling: use lookup_customer_jobs to find their appointment, then help accordingly
6. Confirm details and wrap up

SCHEDULING RULES:
- ALWAYS use check_availability before suggesting any times — never guess or make up availability
- ALWAYS use capture_lead before schedule_appointment
- Today's date is ${new Date().toISOString().split('T')[0]}

CANCELLATION / RESCHEDULING:
- If the caller wants to cancel or reschedule, use lookup_customer_jobs with their name or phone to find their appointments
- Confirm which appointment they mean
- You cannot directly cancel or modify — note the request via capture_lead (set notes to the cancellation/reschedule details) and let them know the owner will confirm

ENDING THE CALL:
- NEVER end the call abruptly. Always confirm what was discussed first.
- If an appointment was booked, confirm the date, time, and service.
- If lead info was captured, confirm their name and that someone will call them back.
- Only end when the caller is clearly done.`

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return NextResponse.json({
    assistant: {
      firstMessage: greeting,
      model: {
        provider: 'custom-llm',
        url: `${baseUrl}/api/voice`,
        model: 'quotarc-receptionist',
        messages: [{ role: 'system', content: systemPrompt }],
      },
      voice: {
        provider: '11labs',
        voiceId: 'sarah',
      },
      endCallFunctionEnabled: true,
      metadata: {
        user_id: profile.id,
        company_name: profile.company_name,
        services,
        hours,
        transfer_number: profile.receptionist_transfer_number,
        instructions: profile.receptionist_instructions,
        recognized_customer: recognized
          ? { id: recognized.id, name: recognized.name, contextSummary: recognized.contextSummary }
          : null,
      },
      serverMessages: ['tool-calls', 'end-of-call-report', 'status-update'],
      tools: [
        {
          type: 'function',
          function: {
            name: 'check_availability',
            description: 'Check if the electrician is available on a specific date and find open time slots',
            parameters: {
              type: 'object',
              properties: {
                date: { type: 'string', description: 'The date to check (YYYY-MM-DD format)' },
                time_preference: { type: 'string', description: 'Morning, afternoon, or any', enum: ['morning', 'afternoon', 'any'] },
              },
              required: ['date'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'capture_lead',
            description: 'Capture caller information as a lead',
            parameters: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Caller full name' },
                phone: { type: 'string', description: 'Best callback number' },
                address: { type: 'string', description: 'Street address of the property' },
                city: { type: 'string', description: 'City' },
                job_type: { type: 'string', description: 'Type of electrical work needed' },
                notes: { type: 'string', description: 'Additional details about the request' },
              },
              required: ['name', 'phone', 'address'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'schedule_appointment',
            description: 'Schedule an appointment for the caller on a specific date and time. Must capture lead info first.',
            parameters: {
              type: 'object',
              properties: {
                date: { type: 'string', description: 'Appointment date (YYYY-MM-DD format)' },
                time: { type: 'string', description: 'Start time (HH:MM, 24-hour format)' },
                job_type: { type: 'string', description: 'Type of electrical work' },
                notes: { type: 'string', description: 'Additional details' },
              },
              required: ['date', 'job_type'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'transfer_call',
            description: 'Transfer the call to the electrician',
            parameters: {
              type: 'object',
              properties: {
                reason: { type: 'string', description: 'Reason for transfer' },
              },
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'lookup_customer_jobs',
            description: 'Look up existing appointments for a customer by name or phone number. Use when caller asks about cancelling, rescheduling, or checking an existing appointment.',
            parameters: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Customer name to search for' },
                phone: { type: 'string', description: 'Customer phone number to search for' },
              },
            },
          },
        },
      ],
    },
  })
}

// ─── Tool Calls ────────────────────────────────────────────────

async function handleToolCalls(message: Record<string, unknown>) {
  const call = message.call as Record<string, unknown> | undefined
  const metadata = (call?.metadata ?? {}) as Record<string, unknown>
  let userId = metadata.user_id as string | undefined
  const callId = call?.id as string | undefined
  let transferNumber = metadata.transfer_number as string | undefined

  // Fallback: look up user from phoneNumberId when metadata is missing
  // (happens when using static assistantId instead of assistant-request)
  const phoneNumberId = call?.phoneNumberId as string | undefined
  if (!userId && phoneNumberId) {
    const profile = await prisma.profile.findFirst({
      where: { vapi_phone_number_id: phoneNumberId },
      select: { id: true, receptionist_transfer_number: true },
    })
    if (profile) {
      userId = profile.id
      transferNumber = transferNumber ?? profile.receptionist_transfer_number ?? undefined
    }
  }

  console.log(`[vapi-webhook] tool-calls | userId: ${userId} | phoneNumberId: ${phoneNumberId} | callId: ${callId}`)

  const toolCalls = (message.toolCallList ?? []) as Array<{
    id: string
    function: { name: string; arguments: Record<string, unknown> }
  }>

  const results = []

  for (const tc of toolCalls) {
    const { name, arguments: args } = tc.function

    switch (name) {
      case 'check_availability': {
        const result = await toolCheckAvailability(userId, args)
        results.push({ toolCallId: tc.id, result: JSON.stringify(result) })
        break
      }
      case 'capture_lead': {
        const recognizedCustomer = metadata.recognized_customer as { id: string; name: string } | null | undefined
        const result = await toolCaptureLead(userId, callId, args, recognizedCustomer)
        results.push({ toolCallId: tc.id, result: JSON.stringify(result) })
        break
      }
      case 'schedule_appointment': {
        const result = await toolScheduleAppointment(userId, callId, args)
        results.push({ toolCallId: tc.id, result: JSON.stringify(result) })
        break
      }
      case 'transfer_call': {
        if (transferNumber) {
          results.push({ toolCallId: tc.id, result: 'Transferring now' })
          // Return Vapi destination at the response level to trigger actual SIP transfer
          return NextResponse.json({
            results,
            destination: {
              type: 'number',
              number: transferNumber,
              message: 'Please hold while I transfer you.',
            },
          })
        }
        results.push({
          toolCallId: tc.id,
          result: JSON.stringify({ message: 'Transfer not available — take a message instead.' }),
        })
        break
      }
      case 'lookup_customer_jobs': {
        const result = await toolLookupCustomerJobs(userId, args)
        results.push({ toolCallId: tc.id, result: JSON.stringify(result) })
        break
      }
      default:
        results.push({ toolCallId: tc.id, result: JSON.stringify({ error: 'Unknown tool' }) })
    }
  }

  return NextResponse.json({ results })
}

// ─── Tool: Check Availability (time-slot-based) ────────────────

async function toolCheckAvailability(
  userId: string | undefined,
  args: Record<string, unknown>,
) {
  if (!userId) return { available: false, message: 'Unable to check schedule right now.' }

  const dateStr = args.date as string
  const date = new Date(dateStr + 'T00:00:00')
  if (isNaN(date.getTime())) {
    return { available: false, message: "I couldn't understand that date. Could you try again?" }
  }

  const timePref = args.time_preference as string | undefined

  // Fetch profile for business hours, date overrides, and default job duration
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: {
      receptionist_hours: true,
      receptionist_date_overrides: true,
      default_job_duration: true,
    },
  })

  const hours = (profile?.receptionist_hours ?? {}) as Record<string, { start: string; end: string }>
  const dateOverrides = (profile?.receptionist_date_overrides ?? {}) as Record<string, string>
  const jobDuration = Number(profile?.default_job_duration ?? 2) * 60 // convert to minutes

  // Check one-time date override first (takes priority over recurring hours)
  if (dateOverrides[dateStr] === 'closed') {
    const dayDisplay = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    return { available: false, message: `We're not available on ${dayDisplay} — it's a day off. Would you like to try another date?` }
  }

  // Get business hours for this day of week
  const dayKey = DAY_NAMES[date.getDay()]
  const dayHours = hours[dayKey]

  if (!dayHours) {
    return { available: false, message: `We're not open on ${date.toLocaleDateString('en-US', { weekday: 'long' })}s. Would you like to try another day?` }
  }

  const businessStart = timeToMinutes(dayHours.start)
  const businessEnd = timeToMinutes(dayHours.end)

  // Fetch existing jobs on that date with time info
  const startOfDay = new Date(dateStr + 'T00:00:00')
  const endOfDay = new Date(dateStr + 'T23:59:59')

  const existingJobs = await prisma.job.findMany({
    where: {
      user_id: userId,
      scheduled_date: { gte: startOfDay, lte: endOfDay },
      status: { in: ['scheduled', 'in_progress'] },
    },
    select: { start_time: true, estimated_hours: true },
  })

  // Build occupied time windows
  const occupied = existingJobs
    .filter((job: (typeof existingJobs)[number]) => job.start_time)
    .map((job: (typeof existingJobs)[number]) => ({
      start: timeToMinutes(job.start_time!),
      end: timeToMinutes(job.start_time!) + Number(job.estimated_hours) * 60,
    }))

  // Find open slots and filter by preference
  const slots = findAvailableSlots(businessStart, businessEnd, jobDuration, occupied)
  const filteredSlots = filterSlotsByPreference(slots, timePref)

  if (filteredSlots.length === 0) {
    // No slots available — find next day with openings
    let suggestion = ''
    for (let i = 1; i <= 7; i++) {
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + i)
      const nextDayKey = DAY_NAMES[nextDate.getDay()]
      const nextDayHours = hours[nextDayKey]
      if (!nextDayHours) continue

      const nextStart = new Date(nextDate.toISOString().split('T')[0] + 'T00:00:00')
      const nextEnd = new Date(nextDate.toISOString().split('T')[0] + 'T23:59:59')

      const count = await prisma.job.count({
        where: {
          user_id: userId,
          scheduled_date: { gte: nextStart, lte: nextEnd },
          status: { in: ['scheduled', 'in_progress'] },
        },
      })

      // Rough check — if fewer jobs than could fit, suggest this day
      const maxSlots = Math.floor((timeToMinutes(nextDayHours.end) - timeToMinutes(nextDayHours.start)) / jobDuration)
      if (count < maxSlots) {
        suggestion = nextDate.toISOString().split('T')[0]
        break
      }
    }

    return {
      available: false,
      slots: [],
      message: `That day is fully booked.${suggestion ? ` The next available day is ${new Date(suggestion + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.` : ' Please try another date.'}`,
    }
  }

  const slotText = formatSlotsForSpeech(filteredSlots)

  return {
    available: true,
    slots: filteredSlots.slice(0, 3),
    message: `We have openings at ${slotText}. Which works best for you?`,
  }
}

// ─── Tool: Capture Lead ────────────────────────────────────────

async function toolCaptureLead(
  userId: string | undefined,
  callId: string | undefined,
  args: Record<string, unknown>,
  recognizedCustomer?: { id: string; name: string } | null,
) {
  if (!userId) return { success: false, message: 'Unable to save details right now.' }

  const name = args.name as string
  const phone = args.phone as string | undefined
  const address = args.address as string | undefined
  const city = args.city as string | undefined
  const jobType = args.job_type as string | undefined
  const notes = args.notes as string | undefined

  // Try pre-recognized customer first (matched by caller ID at call start)
  let customer = recognizedCustomer
    ? await prisma.customer.findUnique({ where: { id: recognizedCustomer.id } })
    : null

  // Fall back to phone-based lookup
  if (!customer && phone) {
    customer = await prisma.customer.findFirst({
      where: { user_id: userId, phone },
    })
  }

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        user_id: userId,
        name,
        phone: phone ?? null,
        address: address ?? null,
        city: city ?? null,
        property_notes: notes ?? null,
      },
    })
  } else if (address || city) {
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        ...(address ? { address } : {}),
        ...(city ? { city } : {}),
      },
    })
  }

  // Store lead info in Redis for end-of-call processing
  if (callId) {
    await redis.set(
      `voice:lead:${callId}`,
      {
        customer_id: customer.id,
        customer_name: name,
        job_type: jobType,
        notes,
      },
      { ex: 1800 },
    )
  }

  return {
    success: true,
    message: `Got it, I've saved ${name}'s information. ${jobType ? `They need help with ${jobType}.` : ''} Someone will follow up soon.`,
  }
}

// ─── Tool: Schedule Appointment ────────────────────────────────

async function toolScheduleAppointment(
  userId: string | undefined,
  callId: string | undefined,
  args: Record<string, unknown>,
) {
  if (!userId) return { success: false, message: 'Unable to schedule right now.' }

  const dateStr = args.date as string
  const time = args.time as string | undefined
  const jobType = args.job_type as string
  const notes = args.notes as string | undefined

  // Get lead data from Redis (need customer_id)
  const leadData = callId
    ? await redis.get<{ customer_id: string; customer_name: string; job_type?: string }>(`voice:lead:${callId}`)
    : null

  if (!leadData) {
    return {
      success: false,
      message: "I need to get your name and number first before I can schedule an appointment. Could you give me those?",
    }
  }

  // Fetch profile for default job duration and customer for address
  const [profile, customer] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: userId },
      select: { default_job_duration: true },
    }),
    prisma.customer.findUnique({
      where: { id: leadData.customer_id },
      select: { address: true, city: true },
    }),
  ])

  // Require address before booking — forces agent to collect it via capture_lead first
  if (!customer?.address) {
    return {
      success: false,
      message: "I still need the street address for the job before I can book the appointment. Could you ask for their address?",
    }
  }

  const estimatedHours = Number(profile?.default_job_duration ?? 2)

  // Create the job
  const scheduledDate = new Date(dateStr + 'T00:00:00')
  if (isNaN(scheduledDate.getTime())) {
    return { success: false, message: "I couldn't understand that date. Could you try again?" }
  }

  const job = await prisma.job.create({
    data: {
      user_id: userId,
      customer_id: leadData.customer_id,
      job_type: jobType,
      status: 'scheduled',
      scheduled_date: scheduledDate,
      start_time: time ?? null,
      estimated_hours: estimatedHours,
      notes: notes ?? null,
      address: customer?.address ?? null,
    },
  })

  // Store job_id in Redis for end-of-call linking to VoiceCall
  if (callId) {
    await redis.set(`voice:appointment:${callId}`, { job_id: job.id }, { ex: 1800 })
  }

  // Create activity event
  await prisma.activityEvent.create({
    data: {
      user_id: userId,
      event_type: 'voice_call_appointment_set',
      metadata: {
        customer_name: leadData.customer_name,
        job_type: jobType,
        date: dateStr,
        time: time ?? null,
      },
    },
  })

  const dateDisplay = scheduledDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const timeDisplay = time ? ` at ${formatTimeForSpeech(time)}` : ''

  console.log(`[vapi-webhook] Appointment scheduled: ${jobType} on ${dateStr} for ${leadData.customer_name}`)

  return {
    success: true,
    message: `I've scheduled your ${jobType} appointment for ${dateDisplay}${timeDisplay}. We'll see you then!`,
  }
}

// ─── Tool: Lookup Customer Jobs ─────────────────────────────────

async function toolLookupCustomerJobs(
  userId: string | undefined,
  args: Record<string, unknown>,
) {
  if (!userId) return { success: false, message: 'Unable to look up appointments right now.' }

  const name = args.name as string | undefined
  const phone = args.phone as string | undefined

  if (!name && !phone) {
    return { success: false, message: "I need a name or phone number to look up appointments." }
  }

  const customerIds: string[] = []

  // Name-based search (case-insensitive)
  if (name) {
    const byName = await prisma.customer.findMany({
      where: {
        user_id: userId,
        name: { contains: name, mode: 'insensitive' },
      },
      select: { id: true },
      take: 5,
    })
    customerIds.push(...byName.map(c => c.id))
  }

  // Phone-based search (normalize and compare)
  if (phone && normalizePhone(phone)) {
    const withPhone = await prisma.customer.findMany({
      where: {
        user_id: userId,
        phone: { not: null },
      },
      select: { id: true, phone: true },
    })
    for (const c of withPhone) {
      if (c.phone && phonesMatch(phone, c.phone)) {
        customerIds.push(c.id)
      }
    }
  }

  const uniqueIds = [...new Set(customerIds)]

  if (uniqueIds.length === 0) {
    return {
      success: false,
      message: "I couldn't find any customer records with that information. Let me take your details and have someone call you back.",
    }
  }

  // Fetch upcoming jobs for matched customers
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const jobs = await prisma.job.findMany({
    where: {
      user_id: userId,
      customer_id: { in: uniqueIds },
      status: { in: ['scheduled', 'in_progress'] },
      scheduled_date: { gte: today },
    },
    select: {
      job_type: true,
      status: true,
      scheduled_date: true,
      start_time: true,
    },
    orderBy: { scheduled_date: 'asc' },
    take: 5,
  })

  if (jobs.length === 0) {
    return {
      success: true,
      jobs: [],
      message: "I found the customer but they don't have any upcoming appointments.",
    }
  }

  const jobList = jobs.map(j => {
    const date = j.scheduled_date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    const time = j.start_time ? ` at ${formatTimeForSpeech(j.start_time)}` : ''
    return `${j.job_type} on ${date}${time} (${j.status === 'in_progress' ? 'in progress' : j.status})`
  })

  return {
    success: true,
    jobs: jobList,
    message: `Found ${jobs.length} upcoming appointment${jobs.length !== 1 ? 's' : ''}: ${jobList.join('; ')}`,
  }
}

// ─── End of Call Report ────────────────────────────────────────

async function handleEndOfCallReport(message: Record<string, unknown>) {
  const call = message.call as Record<string, unknown> | undefined
  const callId = call?.id as string | undefined
  const metadata = (call?.metadata ?? {}) as Record<string, unknown>
  const userId = metadata.user_id as string | undefined

  if (!callId || !userId) {
    console.log('[vapi-webhook] end-of-call-report missing callId or userId')
    return NextResponse.json({})
  }

  const durationSeconds = (message.durationSeconds as number) ?? 0
  const durationMinutes = Math.ceil(durationSeconds / 60)
  const summary = message.summary as string | undefined
  const transcript = message.transcript as Record<string, unknown>[] | undefined
  const recordingUrl = message.recordingUrl as string | undefined
  const endedReason = message.endedReason as string | undefined
  const callerNumber = (call?.customer as Record<string, unknown>)?.number as string | undefined

  // Check for captured lead and appointment
  const [leadData, appointmentData] = await Promise.all([
    redis.get<{
      customer_id: string
      customer_name: string
      job_type?: string
      notes?: string
    }>(`voice:lead:${callId}`),
    redis.get<{ job_id: string }>(`voice:appointment:${callId}`),
  ])

  // Create VoiceCall record — idempotent: Vapi can retry end-of-call-report
  let voiceCall: { id: string }
  try {
    voiceCall = await prisma.voiceCall.create({
      data: {
        user_id: userId,
        vapi_call_id: callId,
        caller_number: callerNumber ?? null,
        duration_seconds: durationSeconds,
        duration_minutes: durationMinutes,
        status: 'completed',
        summary: summary ?? null,
        transcript: (transcript as unknown as undefined) ?? undefined,
        recording_url: recordingUrl ?? null,
        customer_id: leadData?.customer_id ?? null,
        lead_captured: !!leadData,
        transferred: false,
        appointment_set: !!appointmentData,
        ended_reason: endedReason ?? null,
        // Merge call metadata with lead job_type so leads page can display it
        metadata: {
          ...(metadata as Record<string, string>),
          ...(leadData?.job_type ? { job_type: leadData.job_type } : {}),
        },
      },
    })
  } catch (err: unknown) {
    const e = err as { code?: string }
    if (e?.code === 'P2002') {
      // Duplicate vapi_call_id — Vapi retried the webhook, safe to ignore
      console.log(`[vapi-webhook] Duplicate end-of-call-report for ${callId}, ignoring`)
      return NextResponse.json({})
    }
    throw err
  }

  // Link job to voice call if appointment was scheduled
  if (appointmentData?.job_id) {
    await prisma.job.update({
      where: { id: appointmentData.job_id },
      data: { voice_call_id: voiceCall.id },
    })
  }

  // Increment voice_minutes_used
  await prisma.profile.update({
    where: { id: userId },
    data: { voice_minutes_used: { increment: durationMinutes } },
  })

  // Create activity events and notifications
  const activityEvents = [
    prisma.activityEvent.create({
      data: {
        user_id: userId,
        event_type: 'voice_call_received',
        metadata: {
          caller_number: callerNumber,
          duration_seconds: durationSeconds,
          summary: summary?.slice(0, 200),
        },
      },
    }),
  ]

  if (leadData) {
    activityEvents.push(
      prisma.activityEvent.create({
        data: {
          user_id: userId,
          event_type: 'voice_call_lead_captured',
          metadata: {
            customer_name: leadData.customer_name,
            job_type: leadData.job_type,
            caller_number: callerNumber,
          },
        },
      }),
    )

    // Notify about new lead
    await prisma.notification.create({
      data: {
        user_id: userId,
        type: 'voice_call_lead',
        title: appointmentData ? 'Appointment booked from call' : 'New lead from call',
        body: `${leadData.customer_name}${leadData.job_type ? ` needs ${leadData.job_type}` : ''} — ${durationMinutes} min call`,
        link_url: '/leads',
        metadata: {
          customer_name: leadData.customer_name,
          job_type: leadData.job_type,
          caller_number: callerNumber,
          appointment_set: !!appointmentData,
        },
      },
    })
  }

  await Promise.all(activityEvents)

  // Send call summary email to electrician
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { email: true, company_name: true },
  })

  if (profile?.email) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    await sendCallSummaryEmail({
      to: profile.email,
      companyName: profile.company_name,
      callerName: leadData?.customer_name ?? callerNumber ?? 'Unknown caller',
      callerNumber: callerNumber ?? 'Unknown',
      jobType: leadData?.job_type ?? 'General inquiry',
      duration: `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`,
      summary: summary ?? 'No summary available.',
      dashboardUrl: `${baseUrl}/leads`,
    }).catch(err => console.error('[vapi-webhook] Failed to send call summary email:', err))
  }

  // Clean up Redis state
  await Promise.all([
    redis.del(`voice:state:${callId}`),
    redis.del(`voice:lead:${callId}`),
    redis.del(`voice:appointment:${callId}`),
  ])

  console.log(`[vapi-webhook] Call ${callId} processed: ${durationMinutes}min, lead=${!!leadData}, appointment=${!!appointmentData}`)

  return NextResponse.json({})
}

// ─── Status Ended Fallback ─────────────────────────────────────
// When the static Vapi assistant doesn't have end-of-call-report in
// its serverMessages, we use the "ended" status-update as a fallback
// to create a basic VoiceCall record and clean up Redis state.

async function handleStatusEnded(message: Record<string, unknown>) {
  const call = message.call as Record<string, unknown> | undefined
  const callId = call?.id as string | undefined
  if (!callId) return

  // Skip if end-of-call-report already created this record
  const existing = await prisma.voiceCall.findFirst({
    where: { vapi_call_id: callId },
    select: { id: true },
  })
  if (existing) return

  const metadata = (call?.metadata ?? {}) as Record<string, unknown>
  let userId = metadata.user_id as string | undefined
  const phoneNumberId = call?.phoneNumberId as string | undefined

  if (!userId && phoneNumberId) {
    const profile = await prisma.profile.findFirst({
      where: { vapi_phone_number_id: phoneNumberId },
      select: { id: true },
    })
    if (profile) userId = profile.id
  }
  if (!userId) return

  const endedReason = message.endedReason as string | undefined
  const callerNumber = (call?.customer as Record<string, unknown>)?.number as string | undefined
  const artifact = message.artifact as Record<string, unknown> | undefined
  const artifactMessages = (artifact?.messages ?? []) as Array<{ role: string; message: string; time: number }>

  // Estimate duration from first/last message timestamps
  let durationSeconds = 0
  if (artifactMessages.length >= 2) {
    const first = artifactMessages[0].time
    const last = artifactMessages[artifactMessages.length - 1].time
    durationSeconds = Math.round((last - first) / 1000)
  }
  const durationMinutes = Math.ceil(durationSeconds / 60)

  // Build basic transcript from artifact messages
  const transcript = artifactMessages
    .filter(m => m.role === 'user' || m.role === 'bot')
    .map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', message: m.message }))

  // Check for captured lead and appointment
  const [leadData, appointmentData] = await Promise.all([
    redis.get<{
      customer_id: string
      customer_name: string
      job_type?: string
    }>(`voice:lead:${callId}`),
    redis.get<{ job_id: string }>(`voice:appointment:${callId}`),
  ])

  try {
    const voiceCall = await prisma.voiceCall.create({
      data: {
        user_id: userId,
        vapi_call_id: callId,
        caller_number: callerNumber ?? null,
        duration_seconds: durationSeconds,
        duration_minutes: durationMinutes,
        status: 'completed',
        summary: null,
        transcript: (transcript as unknown as undefined) ?? undefined,
        recording_url: null,
        customer_id: leadData?.customer_id ?? null,
        lead_captured: !!leadData,
        transferred: false,
        appointment_set: !!appointmentData,
        ended_reason: endedReason ?? null,
        metadata: {
          source: 'status-update-fallback',
          ...(leadData?.job_type ? { job_type: leadData.job_type } : {}),
        },
      },
    })

    // Link job to voice call
    if (appointmentData?.job_id) {
      await prisma.job.update({
        where: { id: appointmentData.job_id },
        data: { voice_call_id: voiceCall.id },
      })
    }

    // Increment voice_minutes_used
    await prisma.profile.update({
      where: { id: userId },
      data: { voice_minutes_used: { increment: durationMinutes } },
    })

    // Create activity event
    await prisma.activityEvent.create({
      data: {
        user_id: userId,
        event_type: 'voice_call_received',
        metadata: {
          caller_number: callerNumber,
          duration_seconds: durationSeconds,
          source: 'status-update-fallback',
        },
      },
    })

    // Notify about new lead
    if (leadData) {
      await prisma.notification.create({
        data: {
          user_id: userId,
          type: 'voice_call_lead',
          title: appointmentData ? 'Appointment booked from call' : 'New lead from call',
          body: `${leadData.customer_name}${leadData.job_type ? ` needs ${leadData.job_type}` : ''} — ${durationMinutes} min call`,
          link_url: '/leads',
          metadata: {
            customer_name: leadData.customer_name,
            job_type: leadData.job_type,
            caller_number: callerNumber,
            appointment_set: !!appointmentData,
          },
        },
      })
    }

    console.log(`[vapi-webhook] Status-ended fallback: created VoiceCall for ${callId} (${durationMinutes}min, lead=${!!leadData}, appt=${!!appointmentData})`)
  } catch (err: unknown) {
    const e = err as { code?: string }
    if (e?.code === 'P2002') return // Duplicate — end-of-call-report beat us
    throw err
  }

  // Clean up Redis
  await Promise.all([
    redis.del(`voice:state:${callId}`),
    redis.del(`voice:lead:${callId}`),
    redis.del(`voice:appointment:${callId}`),
  ])
}
