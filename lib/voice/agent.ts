/**
 * LangGraph Voice Agent — Single-Model Architecture
 *
 * Optimized for real-time voice: one fast LLM call per turn.
 * Uses Haiku via OpenRouter for low-latency responses (<2s TTFT target).
 *
 * The single model handles phase detection, steering, and response generation
 * in one pass via structured system prompt.
 *
 * Graph: __start__ → agent → END (or → transfer)
 */

import { StateGraph, Annotation, END } from '@langchain/langgraph'
import { ChatOpenAI } from '@langchain/openai'
import type { BaseMessage } from '@langchain/core/messages'
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages'

// ─── State Schema ──────────────────────────────────────────────

export type ConversationPhase =
  | 'greeting'
  | 'discovery'
  | 'info'
  | 'scheduling'
  | 'transfer'
  | 'closing'

const lastValue = <T>(a: T, b: T) => b ?? a

export const VoiceState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: (a, b) => [...a, ...b], default: () => [] }),
  callId: Annotation<string>({ reducer: lastValue, default: () => '' }),
  userId: Annotation<string>({ reducer: lastValue, default: () => '' }),
  companyName: Annotation<string>({ reducer: lastValue, default: () => '' }),
  services: Annotation<{ name: string; description: string; priceRange: string }[]>({ reducer: lastValue, default: () => [] }),
  hours: Annotation<Record<string, { start: string; end: string }>>({ reducer: lastValue, default: () => ({}) }),
  transferNumber: Annotation<string | null>({ reducer: lastValue, default: () => null }),
  conversationPhase: Annotation<ConversationPhase>({ reducer: lastValue, default: () => 'greeting' as ConversationPhase }),
  offTrackCount: Annotation<number>({ reducer: lastValue, default: () => 0 }),
  leadCaptured: Annotation<boolean>({ reducer: lastValue, default: () => false }),
  shouldTransfer: Annotation<boolean>({ reducer: lastValue, default: () => false }),
  responseText: Annotation<string>({ reducer: lastValue, default: () => '' }),
  toolCalls: Annotation<Array<{ name: string; arguments: Record<string, unknown> }>>({ reducer: lastValue, default: () => [] }),
})

export type VoiceStateType = typeof VoiceState.State

// ─── Model ────────────────────────────────────────────────────

function getVoiceModel() {
  return new ChatOpenAI({
    modelName: process.env.OPENROUTER_VOICE_MODEL || 'anthropic/claude-haiku-4.5',
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
    },
    maxTokens: 100,
    temperature: 0.5,
  })
}

// ─── Agent Node (single model) ────────────────────────────────

async function agentNode(state: VoiceStateType): Promise<Partial<VoiceStateType>> {
  const model = getVoiceModel()

  const servicesList = state.services
    .map(s => `• ${s.name}: ${s.description} (${s.priceRange})`)
    .join('\n')

  const hoursText = Object.entries(state.hours)
    .map(([day, h]) => `${day}: ${h.start}–${h.end}`)
    .join(', ')

  let steeringNote = ''
  if (state.offTrackCount >= 2) {
    steeringNote = `\nIMPORTANT: The caller has gone off-topic ${state.offTrackCount} times. Gently redirect them.`
  }

  const systemPrompt = `You are the phone receptionist for ${state.companyName}.

VOICE RULES (STRICT):
- MAXIMUM 2 SHORT sentences per response. Never more.
- NEVER use "um", "uh", "er", or any filler/hesitation words
- Use contractions (I'm, we're, you'll, that's)
- Never reveal you're an AI
- Sound warm, professional, helpful
- Don't repeat information you already told the caller
- If you don't know something, offer to have someone call them back

SERVICES & PRICING:
${servicesList || '(No services listed — ask what they need and offer to have someone call them back with details.)'}

HOURS: ${hoursText || 'Contact us for availability'}
${state.transferNumber ? 'Transfer to the owner is available if they request it.' : 'Direct transfer is not available right now — take a message instead.'}

CALL FLOW:
1. Listen to their need, give a SHORT answer with pricing if relevant
2. Ask if they'd like to schedule an appointment or leave their info for a callback
3. If scheduling: offer to check availability, then book the appointment
4. If not scheduling: capture name and number for callback
5. Once done, wrap up quickly

SCHEDULING:
- If the caller wants to schedule, the system will check availability and book it automatically
- Always get their name and phone number BEFORE scheduling

ENDING THE CALL:
- NEVER end the call abruptly. Always confirm what was discussed first.
- If an appointment was discussed, confirm the date, time, and service before ending.
- If lead info was captured, confirm their name and that someone will call them back.
- Say a warm ONE sentence goodbye, THEN add [END_CALL] at the very end.
- Only add [END_CALL] when the caller explicitly says goodbye, "that's all", thanks you and seems done, or you've confirmed all details.
- NEVER call [END_CALL] in the middle of scheduling or while the caller is still talking.

TRANSFER:
If the caller asks to speak with someone directly or it's an emergency, say you'll transfer them and add [TRANSFER] at the very end.
${steeringNote}
Current phase: ${state.conversationPhase}`

  const lastMessages = state.messages.slice(-8)

  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    ...lastMessages,
  ])

  const rawText = typeof response.content === 'string' ? response.content : ''

  // Parse control signals from the response
  const shouldEndCall = rawText.includes('[END_CALL]')
  const shouldTransfer = rawText.includes('[TRANSFER]')
  const text = rawText.replace(/\[END_CALL\]/g, '').replace(/\[TRANSFER\]/g, '').trim()

  // Detect phase from response signals + content
  let phase: ConversationPhase = state.conversationPhase
  if (shouldEndCall) {
    phase = 'closing'
  } else if (shouldTransfer) {
    phase = 'transfer'
  } else if (state.conversationPhase === 'greeting') {
    phase = 'discovery'
  }

  const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = []
  if (shouldEndCall) {
    toolCalls.push({ name: 'endCall', arguments: {} })
  }
  if (shouldTransfer && state.transferNumber) {
    toolCalls.push({ name: 'transfer_call', arguments: { destination: state.transferNumber } })
  }

  return {
    responseText: text,
    toolCalls,
    conversationPhase: phase,
    shouldTransfer,
  }
}

// ─── Build Graph ───────────────────────────────────────────────

function buildVoiceGraph() {
  const graph = new StateGraph(VoiceState)
    .addNode('agent', agentNode)
    .addEdge('__start__', 'agent')
    .addEdge('agent', END)

  return graph.compile()
}

// Singleton
let _graph: ReturnType<typeof buildVoiceGraph> | null = null

function getGraph() {
  if (!_graph) _graph = buildVoiceGraph()
  return _graph
}

// ─── Public API ────────────────────────────────────────────────

export interface RunVoiceAgentInput {
  messages: BaseMessage[]
  callId: string
  userId: string
  companyName: string
  services: { name: string; description: string; priceRange: string }[]
  hours: Record<string, { start: string; end: string }>
  transferNumber: string | null
  // Restored state from Redis
  conversationPhase?: ConversationPhase
  offTrackCount?: number
  leadCaptured?: boolean
}

export interface RunVoiceAgentOutput {
  responseText: string
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>
  conversationPhase: ConversationPhase
  offTrackCount: number
  leadCaptured: boolean
  shouldTransfer: boolean
}

export async function runVoiceAgent(input: RunVoiceAgentInput): Promise<RunVoiceAgentOutput> {
  const graph = getGraph()

  const result = await graph.invoke({
    messages: input.messages,
    callId: input.callId,
    userId: input.userId,
    companyName: input.companyName,
    services: input.services,
    hours: input.hours,
    transferNumber: input.transferNumber,
    conversationPhase: input.conversationPhase ?? 'greeting',
    offTrackCount: input.offTrackCount ?? 0,
    leadCaptured: input.leadCaptured ?? false,
    shouldTransfer: false,
    responseText: '',
    toolCalls: [],
  })

  return {
    responseText: result.responseText,
    toolCalls: result.toolCalls,
    conversationPhase: result.conversationPhase,
    offTrackCount: result.offTrackCount,
    leadCaptured: result.leadCaptured,
    shouldTransfer: result.shouldTransfer,
  }
}

export { HumanMessage, AIMessage, SystemMessage }
