/**
 * Persistent Receptionist Config Assistant — LangGraph ReAct agent
 *
 * A tool-calling agent that handles both initial onboarding AND ongoing
 * receptionist config changes via natural language. Never "completes" —
 * the chat stays open indefinitely.
 *
 * Graph: __start__ → agent → [tools → agent]* → END
 */

import { StateGraph, MessagesAnnotation, END } from '@langchain/langgraph'
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt'
import { ChatOpenAI } from '@langchain/openai'
import { SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { ReceptionistService } from '@/lib/types'

// ─── Model ─────────────────────────────────────────────────────

function getAssistantModel() {
  return new ChatOpenAI({
    modelName: process.env.OPENROUTER_ONBOARDING_MODEL || 'anthropic/claude-sonnet-4-5',
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
    },
    maxTokens: 600,
    temperature: 0.4,
  })
}

// ─── Tool names that write to DB ───────────────────────────────

const WRITE_TOOL_NAMES = new Set([
  'update_services',
  'add_service',
  'remove_service',
  'update_hours',
  'clear_hours',
  'update_greeting',
  'update_transfer_number',
  'update_date_overrides',
  'update_instructions',
])

// ─── Config types ──────────────────────────────────────────────

export interface ReceptionistConfig {
  receptionist_services: ReceptionistService[]
  receptionist_hours: Record<string, { start: string; end: string }>
  receptionist_greeting: string | null
  receptionist_transfer_number: string | null
  receptionist_date_overrides: Record<string, 'closed'>
  receptionist_instructions: string | null
  receptionist_enabled: boolean
}

// ─── Tool factory ──────────────────────────────────────────────

function createConfigTools(userId: string) {
  const getConfig = tool(
    async () => {
      const profile = await prisma.profile.findUnique({
        where: { id: userId },
        select: {
          receptionist_services: true,
          receptionist_hours: true,
          receptionist_greeting: true,
          receptionist_transfer_number: true,
          receptionist_date_overrides: true,
          receptionist_instructions: true,
        },
      })
      if (!profile) return 'Profile not found'
      const services = (profile.receptionist_services as unknown as ReceptionistService[]) ?? []
      const hours = (profile.receptionist_hours as unknown as Record<string, { start: string; end: string }>) ?? {}
      const overrides = (profile.receptionist_date_overrides as unknown as Record<string, string>) ?? {}
      return JSON.stringify({
        services: services.map(s => `${s.name} (${s.priceRange})`),
        hours: Object.entries(hours).map(([d, h]) => `${d}: ${h.start}-${h.end}`),
        greeting: profile.receptionist_greeting,
        transferNumber: profile.receptionist_transfer_number,
        dateOverrides: Object.entries(overrides).map(([d, s]) => `${d}: ${s}`),
        instructions: profile.receptionist_instructions,
      })
    },
    {
      name: 'get_config',
      description: 'Read the current receptionist configuration from the database',
      schema: z.object({}),
    }
  )

  const updateServices = tool(
    async ({ services }) => {
      await prisma.profile.update({
        where: { id: userId },
        data: { receptionist_services: services },
      })
      return `Services updated — ${services.length} service(s) configured`
    },
    {
      name: 'update_services',
      description: 'Replace the entire services list with a new set of services',
      schema: z.object({
        services: z.array(z.object({
          name: z.string().describe('Service name, e.g. "Panel Upgrade"'),
          description: z.string().describe('Brief description'),
          priceRange: z.string().describe('Price range, e.g. "$2,500 - $4,500"'),
        })).describe('Complete list of services to configure'),
      }),
    }
  )

  const addService = tool(
    async ({ name, description, priceRange }) => {
      const profile = await prisma.profile.findUnique({
        where: { id: userId },
        select: { receptionist_services: true },
      })
      const existing = (profile?.receptionist_services as unknown as ReceptionistService[]) ?? []
      await prisma.profile.update({
        where: { id: userId },
        data: { receptionist_services: [...existing, { name, description, priceRange }] as unknown as Prisma.JsonArray },
      })
      return `Added service: ${name} (${priceRange})`
    },
    {
      name: 'add_service',
      description: 'Append a single new service to the existing services list',
      schema: z.object({
        name: z.string(),
        description: z.string(),
        priceRange: z.string().describe('Price range, e.g. "$800 - $1,500"'),
      }),
    }
  )

  const removeService = tool(
    async ({ name }) => {
      const profile = await prisma.profile.findUnique({
        where: { id: userId },
        select: { receptionist_services: true },
      })
      const existing = (profile?.receptionist_services as unknown as ReceptionistService[]) ?? []
      const updated = existing.filter(s => s.name.toLowerCase() !== name.toLowerCase())
      await prisma.profile.update({
        where: { id: userId },
        data: { receptionist_services: updated as unknown as Prisma.JsonArray },
      })
      return `Removed service: ${name}`
    },
    {
      name: 'remove_service',
      description: 'Remove a service from the list by name',
      schema: z.object({
        name: z.string().describe('Exact service name to remove'),
      }),
    }
  )

  const updateHours = tool(
    async ({ day, start, end }) => {
      const profile = await prisma.profile.findUnique({
        where: { id: userId },
        select: { receptionist_hours: true },
      })
      const hours = (profile?.receptionist_hours as unknown as Record<string, { start: string; end: string }>) ?? {}
      hours[day] = { start, end }
      await prisma.profile.update({
        where: { id: userId },
        data: { receptionist_hours: hours },
      })
      return `${day} hours set to ${start}–${end}`
    },
    {
      name: 'update_hours',
      description: 'Set or update the business hours for a specific day of the week',
      schema: z.object({
        day: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
        start: z.string().describe('Start time in HH:MM 24-hour format, e.g. "09:00"'),
        end: z.string().describe('End time in HH:MM 24-hour format, e.g. "17:00"'),
      }),
    }
  )

  const clearHours = tool(
    async ({ day }) => {
      const profile = await prisma.profile.findUnique({
        where: { id: userId },
        select: { receptionist_hours: true },
      })
      const hours = { ...(profile?.receptionist_hours as unknown as Record<string, { start: string; end: string }>) ?? {} }
      delete hours[day]
      await prisma.profile.update({
        where: { id: userId },
        data: { receptionist_hours: hours },
      })
      return `${day} marked as closed`
    },
    {
      name: 'clear_hours',
      description: 'Mark a specific day as closed by removing it from business hours',
      schema: z.object({
        day: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
      }),
    }
  )

  const updateGreeting = tool(
    async ({ greeting }) => {
      await prisma.profile.update({
        where: { id: userId },
        data: { receptionist_greeting: greeting },
      })
      return `Greeting updated`
    },
    {
      name: 'update_greeting',
      description: 'Update the receptionist greeting script. Use {company_name} as a placeholder.',
      schema: z.object({
        greeting: z.string().describe('The new greeting script'),
      }),
    }
  )

  const updateTransferNumber = tool(
    async ({ number }) => {
      await prisma.profile.update({
        where: { id: userId },
        data: { receptionist_transfer_number: number || null },
      })
      return number ? `Transfer number set to ${number}` : 'Transfer number cleared'
    },
    {
      name: 'update_transfer_number',
      description: 'Set or clear the phone number for transferring callers to a person',
      schema: z.object({
        number: z.string().describe('Phone number like +15551234567, or empty string to clear'),
      }),
    }
  )

  const updateDateOverrides = tool(
    async ({ add = [], remove = [] }) => {
      const profile = await prisma.profile.findUnique({
        where: { id: userId },
        select: { receptionist_date_overrides: true },
      })
      const overrides = { ...((profile?.receptionist_date_overrides as unknown as Record<string, string>) ?? {}) }
      for (const date of remove) delete overrides[date]
      for (const date of add) overrides[date] = 'closed'
      await prisma.profile.update({
        where: { id: userId },
        data: { receptionist_date_overrides: overrides },
      })
      const parts = [
        add.length > 0 ? `marked closed: ${add.join(', ')}` : '',
        remove.length > 0 ? `removed overrides: ${remove.join(', ')}` : '',
      ].filter(Boolean)
      return parts.join('; ')
    },
    {
      name: 'update_date_overrides',
      description: 'Add or remove one-time closed-date exceptions in a single operation. Pass all dates to close in `add` and all dates to unclose in `remove`. Always call this ONCE with all changes at the same time — never call it multiple times in parallel.',
      schema: z.object({
        add: z.array(z.string().describe('Date to mark closed, YYYY-MM-DD')).default([]),
        remove: z.array(z.string().describe('Date override to remove, YYYY-MM-DD')).default([]),
      }),
    }
  )

  const updateInstructions = tool(
    async ({ instructions }) => {
      await prisma.profile.update({
        where: { id: userId },
        data: { receptionist_instructions: instructions || null },
      })
      return instructions ? `Special instructions updated` : 'Special instructions cleared'
    },
    {
      name: 'update_instructions',
      description: 'Set or clear special behavioral instructions for the AI receptionist. Use this for directives like "always mention the $150 consultation fee" or "never offer weekend appointments". Pass an empty string to clear.',
      schema: z.object({
        instructions: z.string().describe('Free-form instructions for the receptionist, or empty string to clear'),
      }),
    }
  )

  return [getConfig, updateServices, addService, removeService, updateHours, clearHours, updateGreeting, updateTransferNumber, updateDateOverrides, updateInstructions]
}

// ─── System prompt ─────────────────────────────────────────────

function buildSystemPrompt(companyName: string, config: ReceptionistConfig | null): string {
  const services = config?.receptionist_services ?? []
  const hours = config?.receptionist_hours ?? {}
  const isFirstSetup = services.length === 0

  if (isFirstSetup) {
    return `You are a friendly setup assistant helping ${companyName} configure their AI phone receptionist.

This is first-time setup. Interview the owner conversationally to gather four things:
1. Services offered with typical price ranges (e.g. panel upgrades $2,500-$4,500, EV chargers $800-$1,500)
2. Business hours — which days and what times
3. Transfer phone number — their cell for when callers want to speak to a person directly
4. Greeting style — professional, casual, first name basis, etc.

Interview rules:
- Ask ONE question at a time — do not list all questions at once
- After you have answers for all four areas, immediately call the write tools to save them (update_services, then update_hours for each day, then update_greeting, then update_transfer_number)
- Be concise, 2-3 sentences max per message
- Once saved, confirm everything is set up and the assistant is ready`
  }

  const servicesSummary = services.map(s => `  • ${s.name}: ${s.priceRange}`).join('\n')
  const hoursSummary = Object.entries(hours).length > 0
    ? Object.entries(hours).map(([d, h]) => `  ${d}: ${h.start}–${h.end}`).join('\n')
    : '  Not configured'
  const overrides = config?.receptionist_date_overrides ?? {}
  const overridesSummary = Object.entries(overrides).length > 0
    ? Object.entries(overrides).map(([d, s]) => `  ${d}: ${s}`).join('\n')
    : '  None'

  return `You are a helpful assistant for ${companyName}'s AI receptionist. You have two roles:

1. **Config manager** — make changes to the receptionist settings when asked
2. **General assistant** — answer questions, give advice, and have general conversations about running the business, handling calls, pricing strategy, etc.

Current receptionist configuration:
Services:
${servicesSummary || '  None'}
Hours (recurring weekly schedule):
${hoursSummary}
One-time closed days:
${overridesSummary}
Greeting: ${config?.receptionist_greeting || 'Default'}
Transfer number: ${config?.receptionist_transfer_number || 'Not set'}
Special instructions: ${config?.receptionist_instructions || 'None'}
Today's date: ${new Date().toISOString().split('T')[0]}

When the user asks to make a change, call the right tool immediately — no confirmation needed. After the tool call, briefly confirm what was changed.

CRITICAL — choose the right tool for schedule changes:
- Specific date ("this Tuesday", "next Friday", "March 6") → update_date_overrides({ add: ["YYYY-MM-DD"] })
- Recurring day of week ("closed Sundays permanently") → clear_hours(day=...) or update_hours(day=...)
- Correction ("nvm it's next week") → update_date_overrides({ remove: ["old-dates"], add: ["new-dates"] }) — ONE call

Examples:
- "Change Friday to 9am–3pm" → update_hours(day=fri, start=09:00, end=15:00)
- "Add generator installs, $3k–$5k" → add_service
- "Always closed Sundays" → clear_hours(day=sun)
- "I'll be off Tuesday and Wednesday" → update_date_overrides({ add: ["2026-03-10", "2026-03-11"] })
- "Actually it's next week not this week" → update_date_overrides({ remove: ["2026-03-04", "2026-03-05"], add: ["2026-03-10", "2026-03-11"] })
- "What are my current settings?" → get_config
- "What's my schedule this week?" → answer from the config above (no tool call needed)
- "How should I price panel upgrades?" → give general business advice
- "Always mention the $150 consultation fee" → update_instructions
- "Clear my special instructions" → update_instructions(instructions="")

Be conversational and concise — 2–3 sentences for most replies.`
}

// ─── Graph builder ─────────────────────────────────────────────

function buildGraph(tools: ReturnType<typeof createConfigTools>) {
  const model = getAssistantModel().bindTools(tools)

  const agentNode = async (state: typeof MessagesAnnotation.State) => {
    const response = await model.invoke(state.messages)
    return { messages: [response] }
  }

  return new StateGraph(MessagesAnnotation)
    .addNode('agent', agentNode)
    .addNode('tools', new ToolNode(tools))
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', toolsCondition)
    .addEdge('tools', 'agent')
    .compile()
}

// ─── Public API ────────────────────────────────────────────────

export interface ConfigAssistantInput {
  messages: BaseMessage[]
  userId: string
  companyName: string
  currentConfig: ReceptionistConfig | null
}

export interface ConfigAssistantOutput {
  reply: string
  configUpdated: boolean
  updatedMessages: BaseMessage[]
}

export async function runConfigAssistant({
  messages,
  userId,
  companyName,
  currentConfig,
}: ConfigAssistantInput): Promise<ConfigAssistantOutput> {
  const tools = createConfigTools(userId)
  const graph = buildGraph(tools)

  // Prepend fresh system message (not stored in Redis — reflects current DB state)
  const systemMsg = new SystemMessage(buildSystemPrompt(companyName, currentConfig))
  const inputMessages = [systemMsg, ...messages]

  const result = await graph.invoke({ messages: inputMessages })

  // Extract reply from last AIMessage
  const lastMsg = result.messages[result.messages.length - 1]
  let reply = ''
  if (lastMsg instanceof AIMessage) {
    if (typeof lastMsg.content === 'string') {
      reply = lastMsg.content
    } else if (Array.isArray(lastMsg.content)) {
      reply = lastMsg.content
        .filter((c): c is { type: 'text'; text: string } => typeof c === 'object' && 'text' in c)
        .map(c => c.text)
        .join('')
    }
  }

  // Detect if any write tool was called
  const configUpdated = result.messages.some(
    m => m instanceof ToolMessage && WRITE_TOOL_NAMES.has((m as ToolMessage).name ?? '')
  )

  // Return messages without the system message for Redis storage
  const updatedMessages = result.messages.filter(m => !(m instanceof SystemMessage))

  return { reply, configUpdated, updatedMessages }
}

export { AIMessage, type BaseMessage }
