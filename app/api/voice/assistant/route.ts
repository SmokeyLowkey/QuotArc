/**
 * Persistent Receptionist Config Assistant API
 *
 * GET  — load conversation history + current config
 * POST — send message to the config assistant agent
 * DELETE — clear conversation history (config is NOT touched)
 *
 * Authenticated, gated on aiReceptionist feature.
 * Conversation history stored in Redis (30-day TTL, max 40 messages).
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'
import { requirePlan } from '@/lib/require-plan'
import {
  runConfigAssistant,
  AIMessage,
  type BaseMessage,
  type ReceptionistConfig,
} from '@/lib/voice/config-assistant'
import type { ReceptionistService } from '@/lib/types'

export const dynamic = 'force-dynamic'

const ASSISTANT_TTL = 2592000 // 30 days
const MAX_MESSAGES = 40

function stateKey(userId: string) {
  return `voice:assistant:${userId}`
}

// ─── Serialisation helpers ────────────────────────────────────

interface StoredMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  name?: string         // tool name (tool messages only)
  tool_call_id?: string // tool messages only
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool_calls?: any[]    // AI messages that invoke tools — MUST be preserved or Anthropic returns 400
}

function messagesToStored(messages: BaseMessage[]): StoredMessage[] {
  return messages.map(m => {
    const role = m._getType() as StoredMessage['role']
    const content = typeof m.content === 'string'
      ? m.content
      : JSON.stringify(m.content)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extra = m as any
    return {
      role,
      content,
      ...(extra.name ? { name: extra.name } : {}),
      ...(extra.tool_call_id ? { tool_call_id: extra.tool_call_id } : {}),
      ...(extra.tool_calls?.length ? { tool_calls: extra.tool_calls } : {}),
    }
  })
}

function storedToMessages(stored: StoredMessage[]): BaseMessage[] {
  const { HumanMessage, ToolMessage } = require('@langchain/core/messages')
  return stored.map(m => {
    if (m.role === 'user') return new HumanMessage(m.content)
    if (m.role === 'tool') {
      return new ToolMessage({
        content: m.content,
        name: m.name ?? 'unknown',
        tool_call_id: m.tool_call_id ?? 'unknown',
      })
    }
    // Restore tool_calls so Anthropic sees a valid message sequence
    if (m.tool_calls?.length) {
      return new AIMessage({ content: m.content, tool_calls: m.tool_calls })
    }
    return new AIMessage(m.content)
  })
}

// ─── Profile config helper ────────────────────────────────────

async function getReceptionistConfig(userId: string): Promise<ReceptionistConfig> {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: {
      receptionist_services: true,
      receptionist_hours: true,
      receptionist_greeting: true,
      receptionist_transfer_number: true,
      receptionist_date_overrides: true,
      receptionist_instructions: true,
      receptionist_enabled: true,
    },
  })
  return {
    receptionist_services: (profile?.receptionist_services as unknown as ReceptionistService[]) ?? [],
    receptionist_hours: (profile?.receptionist_hours as unknown as Record<string, { start: string; end: string }>) ?? {},
    receptionist_greeting: profile?.receptionist_greeting ?? null,
    receptionist_transfer_number: profile?.receptionist_transfer_number ?? null,
    receptionist_date_overrides: (profile?.receptionist_date_overrides as unknown as Record<string, 'closed'>) ?? {},
    receptionist_instructions: profile?.receptionist_instructions ?? null,
    receptionist_enabled: profile?.receptionist_enabled ?? false,
  }
}

// ─── GET: Load conversation + current config ──────────────────

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

  const [stored, config] = await Promise.all([
    redis.get<StoredMessage[]>(stateKey(user.id)),
    getReceptionistConfig(user.id),
  ])

  return NextResponse.json({
    messages: stored ?? [],
    config,
  })
}

// ─── POST: Send message to agent ──────────────────────────────

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

  if (!userMessage?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  // Load conversation history + current config + company name in parallel
  const [stored, config, profile] = await Promise.all([
    redis.get<StoredMessage[]>(stateKey(user.id)),
    getReceptionistConfig(user.id),
    prisma.profile.findUnique({
      where: { id: user.id },
      select: { company_name: true },
    }),
  ])

  // Convert stored history back to LangChain messages and append new user message
  const { HumanMessage } = require('@langchain/core/messages')
  const history = storedToMessages(stored ?? [])
  const messages = [...history, new HumanMessage(userMessage)]

  // Run the agent
  const { reply, configUpdated, updatedMessages } = await runConfigAssistant({
    messages,
    userId: user.id,
    companyName: profile?.company_name ?? 'Your Company',
    currentConfig: config,
  })

  // Trim to MAX_MESSAGES (keep the most recent)
  const trimmed = updatedMessages.length > MAX_MESSAGES
    ? updatedMessages.slice(updatedMessages.length - MAX_MESSAGES)
    : updatedMessages

  // Save back to Redis
  await redis.set(stateKey(user.id), messagesToStored(trimmed), { ex: ASSISTANT_TTL })

  // If config was updated, return fresh config for live preview
  let updatedConfig: ReceptionistConfig | null = null
  if (configUpdated) {
    updatedConfig = await getReceptionistConfig(user.id)
  }

  return NextResponse.json({
    reply,
    configUpdated,
    config: updatedConfig,
  })
}

// ─── DELETE: Clear conversation history ───────────────────────

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
