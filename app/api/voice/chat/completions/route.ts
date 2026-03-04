/**
 * Custom LLM endpoint for Vapi — OpenAI-compatible /chat/completions with SSE.
 *
 * Supports native tool calling: when the model wants to call a tool (e.g.
 * check_availability), we return tool_calls in the SSE response. Vapi
 * executes them via the tool-calls webhook, then sends the results back
 * here for the model to generate the final response.
 *
 * Latency optimizations:
 * 1. First turn (greeting) → instant canned response, no LLM call
 * 2. Text responses → stream filler phrase immediately, then LLM response
 * 3. Tool call responses → stream "Let me check..." filler, then tool_calls
 */

import { NextRequest } from 'next/server'
import { redis } from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'
import { hasFeature, PLANS, type PlanTier } from '@/lib/plans'

export const dynamic = 'force-dynamic'

interface VapiMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool'
  content: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  name?: string
}

interface VapiTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

interface VapiChatRequest {
  messages: VapiMessage[]
  model: string
  stream: boolean
  tools?: VapiTool[]
  call?: {
    id?: string
    phoneNumberId?: string
    customer?: { number?: string }
    metadata?: Record<string, unknown>
  }
}

interface RedisState {
  messageCount: number
}

const STATE_TTL = 1800 // 30 minutes

// Fillers only for scheduling tool calls — covers LLM + tool execution latency
// No text fillers: Claude Haiku responds fast enough that pre-emptive affirmations sound robotic
const TOOL_FILLERS = ['Let me check on that.', 'One moment.', 'Let me look that up.']

const GREETING_PATTERNS = /^(hello|hi|hey|good\s+(morning|afternoon|evening)|what's up|howdy|yo)\b/i

function getVoiceModel() {
  return new ChatOpenAI({
    modelName: process.env.OPENROUTER_VOICE_MODEL || 'anthropic/claude-haiku-4.5',
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
    },
    maxTokens: 150,
    temperature: 0.5,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as VapiChatRequest

    const callId = body.call?.id ?? 'unknown'
    const phoneNumberId = body.call?.phoneNumberId
    const metadata = body.call?.metadata as Record<string, unknown> | undefined

    // ── Look up electrician profile ───────────────────────────────
    // Try metadata first (set by assistant-request), fall back to phoneNumberId lookup
    let companyName = (metadata?.company_name as string) || 'Our Company'
    let services: { name: string; description: string; priceRange: string }[] =
      (metadata?.services as typeof services) ?? []
    let hours: Record<string, { start: string; end: string }> =
      (metadata?.hours as typeof hours) ?? {}
    let transferNumber: string | null = (metadata?.transfer_number as string) ?? null
    let userId = (metadata?.user_id as string) ?? ''

    // If no metadata, look up by phoneNumberId (fallback for direct calls)
    if (!userId && phoneNumberId) {
      const profile = await prisma.profile.findFirst({
        where: { vapi_phone_number_id: phoneNumberId },
        select: {
          id: true,
          company_name: true,
          plan_tier: true,
          plan_status: true,
          voice_minutes_used: true,
          voice_minutes_balance: true,
          receptionist_services: true,
          receptionist_hours: true,
          receptionist_transfer_number: true,
        },
      })

      if (profile) {
        userId = profile.id
        companyName = profile.company_name
        services = (profile.receptionist_services as typeof services) ?? []
        hours = (profile.receptionist_hours as typeof hours) ?? {}
        transferNumber = profile.receptionist_transfer_number

        const tier = profile.plan_tier as PlanTier
        if (!hasFeature(tier, 'aiReceptionist')) {
          return sseResponse("I'm sorry, the receptionist service isn't available right now. Please call back during business hours or leave a message.")
        }

        const plan = PLANS[tier]
        const totalAvailable = plan.voiceMinutes + (profile.voice_minutes_balance ?? 0)
        if (plan.voiceMinutes > 0 && profile.voice_minutes_used >= totalAvailable) {
          return sseResponse("I'm sorry, we've reached our call handling limit for this period. Please call back or leave a message and someone will get back to you.")
        }
      }
    }

    if (!userId) {
      console.warn(`[voice-chat] No profile found for phoneNumberId: ${phoneNumberId}`)
      console.warn(`[voice-chat] call metadata: ${JSON.stringify(metadata ?? null)}`)
    }

    // ── Load state from Redis ────────────────────────────────────
    const stateKey = `voice:state:${callId}`
    const savedState = await redis.get<RedisState>(stateKey)

    // ── Get the last user message ─────────────────────────────────
    const messages = body.messages ?? []
    const userMessages = messages.filter(m => m.role === 'user' && m.content)
    const lastUserMessage = userMessages[userMessages.length - 1]?.content ?? ''

    // ── Check if this is a tool result turn ────────────────────────
    const hasToolResults = messages.some(m => m.role === 'tool')

    // ── OPTIMIZATION 1: Instant greeting (no LLM call) ────────────
    const isFirstTurn = !savedState && !hasToolResults
    const isGreeting = GREETING_PATTERNS.test(lastUserMessage.trim())

    if (isFirstTurn && isGreeting) {
      const greeting = `Hi there! Thanks for calling ${companyName}. How can I help you today?`

      await redis.set(stateKey, { messageCount: 1 } satisfies RedisState, { ex: STATE_TTL })

      console.log(`[voice-chat] Call ${callId} | INSTANT greeting for ${companyName}`)
      return sseResponse(greeting)
    }

    // ── Build system prompt ──────────────────────────────────────
    const servicesList = services
      .map(s => `• ${s.name}: ${s.description} (${s.priceRange})`)
      .join('\n')

    const hoursText = Object.entries(hours)
      .map(([day, h]) => `${day}: ${h.start}–${h.end}`)
      .join(', ')

    const systemPrompt = `You are the phone receptionist for ${companyName}.

VOICE RULES (STRICT):
- MAXIMUM 2 SHORT sentences per response. Never more.
- Use contractions (I'm, we're, you'll, that's)
- Never reveal you're an AI
- Sound warm, professional, helpful
- Don't repeat information you already told the caller

SERVICES & PRICING:
${servicesList || '(No services listed — ask what they need and offer to have someone call them back.)'}

HOURS: ${hoursText || 'Contact us for availability'}
${transferNumber ? 'Transfer to the owner is available if they request it.' : 'Direct transfer is not available — take a message instead.'}

CALL FLOW:
1. Listen to their need, give a SHORT answer with pricing if relevant
2. Ask if they'd like to schedule or leave their info for a callback
3. Collect their info naturally: name, best callback number, street address, and city — one question at a time
4. Use capture_lead to save name, phone, address, city, and job type
5. If scheduling: use check_availability to find REAL openings — NEVER make up times
6. After they pick a slot: use schedule_appointment to book it
7. Confirm details and wrap up

SCHEDULING RULES:
- ALWAYS use check_availability before suggesting times — never guess
- ALWAYS use capture_lead before schedule_appointment
- Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} (${new Date().toISOString().split('T')[0]})

ENDING THE CALL:
- Confirm what was discussed before ending
- If an appointment was booked, confirm date, time, and service
- If lead info was captured, confirm their name and that someone will call back
- Only end when the caller is clearly done`

    // ── Convert Vapi messages → LangChain messages ───────────────
    const lcMessages: BaseMessage[] = [new SystemMessage(systemPrompt)]

    for (const msg of messages) {
      if (msg.role === 'system') continue // We use our own system prompt
      if (msg.role === 'user' && msg.content) {
        lcMessages.push(new HumanMessage(msg.content))
      } else if (msg.role === 'assistant') {
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          // Assistant message that contained tool calls
          lcMessages.push(new AIMessage({
            content: msg.content || '',
            tool_calls: msg.tool_calls.map(tc => ({
              id: tc.id,
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments || '{}'),
              type: 'tool_call' as const,
            })),
          }))
        } else if (msg.content) {
          lcMessages.push(new AIMessage(msg.content))
        }
      } else if (msg.role === 'tool' && msg.tool_call_id) {
        lcMessages.push(new ToolMessage({
          content: msg.content,
          tool_call_id: msg.tool_call_id,
        }))
      }
    }

    // ── Call the model ─────────────────────────────────────────────
    const model = getVoiceModel()

    // Override tool definitions — always use our canonical schemas so
    // address/city/etc. stay in sync even if the static Vapi assistant
    // has stale definitions in the dashboard.
    const tools: VapiTool[] = [
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
    ]

    const boundModel = model.bindTools(tools.map(t => ({
      type: 'function' as const,
      function: t.function,
    })))

    // Filler only for explicit scheduling intents — covers LLM + tool execution latency
    // Text responses skip filler entirely: Claude Haiku is fast enough
    const filler = hasToolResults
      ? null
      : (lastUserMessage.match(/schedul|book|appointment|avail.*slot|open.*slot|time.*slot/i)
          ? TOOL_FILLERS[Math.floor(Math.random() * TOOL_FILLERS.length)]
          : null)

    console.log(`[voice-chat] Call ${callId} | User: ${userId} | Company: ${companyName} | Tools: ${tools.length} | ToolResults: ${hasToolResults} | Filler: "${filler}"`)

    return sseStreamWithFiller(filler, async () => {
      const response = await boundModel.invoke(lcMessages)

      // Update state
      const newState: RedisState = {
        messageCount: (savedState?.messageCount ?? 0) + 1,
      }
      await redis.set(stateKey, newState, { ex: STATE_TTL })

      // Check if model returned tool calls
      const toolCalls = response.tool_calls ?? []
      const responseText = typeof response.content === 'string' ? response.content : ''

      return { responseText, toolCalls }
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[voice-chat] Error:', errMsg)
    return sseResponse("I'm sorry, I'm having trouble right now. Please try calling back in a moment.")
  }
}

// ─── SSE Helpers ───────────────────────────────────────────────

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
} as const

function sseChunk(content: string, finish?: boolean): string {
  return JSON.stringify({
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    choices: [{
      index: 0,
      delta: finish ? {} : { role: 'assistant', content },
      finish_reason: finish ? 'stop' : null,
    }],
  })
}

/** Instant complete response — used for greetings and error messages */
function sseResponse(text: string): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${sseChunk(text)}\n\n`))
      controller.enqueue(encoder.encode(`data: ${sseChunk('', true)}\n\n`))
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })
  return new Response(stream, { headers: SSE_HEADERS })
}

/**
 * Stream a filler phrase immediately, then the LLM response.
 * If the model returns tool_calls, they're formatted in OpenAI SSE format
 * so Vapi can execute them via the tool-calls webhook.
 */
function sseStreamWithFiller(
  filler: string | null,
  getResult: () => Promise<{
    responseText: string
    toolCalls: Array<{ id?: string; name: string; args: Record<string, unknown> }>
  }>,
): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ① Send filler immediately (if any)
        if (filler) {
          controller.enqueue(encoder.encode(`data: ${sseChunk(filler + ' ')}\n\n`))
        }

        // ② Run LLM
        const result = await getResult()

        // ③ Send the response
        if (result.toolCalls.length > 0) {
          // Model wants to call tools — format as OpenAI tool_calls
          const chunk = JSON.stringify({
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            choices: [{
              index: 0,
              delta: {
                role: 'assistant',
                content: result.responseText || null,
                tool_calls: result.toolCalls.map((tc, i) => ({
                  id: tc.id || `call_${Date.now()}_${i}`,
                  type: 'function',
                  function: {
                    name: tc.name,
                    arguments: JSON.stringify(tc.args),
                  },
                })),
              },
              finish_reason: 'tool_calls',
            }],
          })
          controller.enqueue(encoder.encode(`data: ${chunk}\n\n`))
        } else {
          // Regular text response
          controller.enqueue(encoder.encode(`data: ${sseChunk(result.responseText)}\n\n`))
        }

        // ④ Done
        controller.enqueue(encoder.encode(`data: ${sseChunk('', true)}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        console.error('[voice-chat] Stream error:', err)
        controller.enqueue(encoder.encode(`data: ${sseChunk("I'm sorry, could you repeat that?")}\n\n`))
        controller.enqueue(encoder.encode(`data: ${sseChunk('', true)}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })
  return new Response(stream, { headers: SSE_HEADERS })
}
