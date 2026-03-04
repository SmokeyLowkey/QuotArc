/**
 * Onboarding Agent API
 *
 * POST { message } — send a message to the onboarding agent
 * GET — retrieve current onboarding conversation state
 * DELETE — reset onboarding conversation
 *
 * Authenticated, gated on aiReceptionist feature.
 * Conversation state stored in Redis (24h TTL).
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'
import { requirePlan } from '@/lib/require-plan'
import { runOnboardingAgent, extractDataFromConversation, HumanMessage, AIMessage } from '@/lib/voice/onboarding-agent'
import type { ExtractedData } from '@/lib/voice/onboarding-agent'

export const dynamic = 'force-dynamic'

const ONBOARDING_TTL = 86400 // 24 hours

interface OnboardingConversation {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  questionsAsked: number
  isComplete: boolean
  extractedData: ExtractedData | null
}

function stateKey(userId: string) {
  return `voice:onboarding:${userId}`
}

// ─── GET: Retrieve conversation state ──────────────────────────

export async function GET() {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  const gate = await requirePlan(user.id, 'aiReceptionist')
  if (!gate.allowed) return gate.response

  const state = await redis.get<OnboardingConversation>(stateKey(user.id))

  return NextResponse.json({
    messages: state?.messages ?? [],
    questionsAsked: state?.questionsAsked ?? 0,
    isComplete: state?.isComplete ?? false,
    extractedData: state?.extractedData ?? null,
  })
}

// ─── POST: Send message to onboarding agent ────────────────────

export async function POST(request: NextRequest) {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  const gate = await requirePlan(user.id, 'aiReceptionist')
  if (!gate.allowed) return gate.response

  const body = await request.json()
  const userMessage = body.message as string

  // Handle "save" action — save extracted data to profile
  if (body.action === 'save') {
    const state = await redis.get<OnboardingConversation>(stateKey(user.id))
    if (!state?.extractedData) {
      return NextResponse.json({ error: 'No extracted data to save' }, { status: 400 })
    }

    await prisma.profile.update({
      where: { id: user.id },
      data: {
        receptionist_services: state.extractedData.receptionist_services,
        receptionist_hours: state.extractedData.receptionist_hours,
        receptionist_greeting: state.extractedData.receptionist_greeting,
        receptionist_transfer_number: state.extractedData.receptionist_transfer_number,
        default_job_duration: state.extractedData.default_job_duration ?? 2,
        receptionist_enabled: true,
      },
    })

    // Clean up Redis
    await redis.del(stateKey(user.id))

    return NextResponse.json({ saved: true })
  }

  if (!userMessage) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  // Load existing conversation
  const existing = await redis.get<OnboardingConversation>(stateKey(user.id))

  // Get company name
  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { company_name: true },
  })

  // Build message history
  const messages = existing?.messages ?? []
  messages.push({ role: 'user', content: userMessage })

  // Convert to LangChain messages
  const lcMessages = messages.map(m =>
    m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
  )

  // Run the onboarding agent
  const result = await runOnboardingAgent({
    messages: lcMessages,
    userId: user.id,
    companyName: profile?.company_name ?? 'Your Company',
    questionsAsked: existing?.questionsAsked ?? 0,
    isComplete: false,
  })

  // Add assistant reply to history
  messages.push({ role: 'assistant', content: result.reply })

  // For live preview: silently extract data mid-interview once we have enough messages
  let liveExtractedData = result.extractedData
  if (!result.isComplete && messages.length >= 4) {
    const lcMessagesAll = messages.map(m =>
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
    )
    const preview = await extractDataFromConversation(
      lcMessagesAll,
      profile?.company_name ?? 'Your Company'
    )
    if (preview) liveExtractedData = preview
  }

  // Save to Redis
  const newState: OnboardingConversation = {
    messages,
    questionsAsked: result.questionsAsked,
    isComplete: result.isComplete,
    extractedData: liveExtractedData,
  }
  await redis.set(stateKey(user.id), newState, { ex: ONBOARDING_TTL })

  return NextResponse.json({
    reply: result.reply,
    isComplete: result.isComplete,
    extractedData: liveExtractedData,
    questionsAsked: result.questionsAsked,
  })
}

// ─── DELETE: Reset conversation ────────────────────────────────

export async function DELETE() {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  await redis.del(stateKey(user.id))
  return NextResponse.json({ reset: true })
}
