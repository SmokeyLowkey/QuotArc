/**
 * Onboarding Agent — LangGraph interviewer + extractor
 *
 * Interviews electricians conversationally to populate their AI receptionist config.
 * Uses a smart model (Sonnet) since this isn't real-time voice — accuracy matters.
 *
 * Graph: __start__ → interviewer → [interviewer (loop) | extractor] → END
 */

import { StateGraph, Annotation, END } from '@langchain/langgraph'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'

// ─── State ─────────────────────────────────────────────────────

const lastValue = <T>(a: T, b: T) => b ?? a

export const OnboardingState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: (a, b) => [...a, ...b], default: () => [] }),
  userId: Annotation<string>({ reducer: lastValue, default: () => '' }),
  companyName: Annotation<string>({ reducer: lastValue, default: () => '' }),
  questionsAsked: Annotation<number>({ reducer: lastValue, default: () => 0 }),
  isComplete: Annotation<boolean>({ reducer: lastValue, default: () => false }),
  extractedData: Annotation<ExtractedData | null>({ reducer: lastValue, default: () => null }),
  reply: Annotation<string>({ reducer: lastValue, default: () => '' }),
})

export type OnboardingStateType = typeof OnboardingState.State

export interface ExtractedData {
  receptionist_services: Array<{
    name: string
    description: string
    priceRange: string
  }>
  receptionist_hours: Record<string, { start: string; end: string }>
  receptionist_greeting: string
  receptionist_transfer_number: string | null
  default_job_duration: number
}

// ─── Model ─────────────────────────────────────────────────────

function getOnboardingModel() {
  return new ChatOpenAI({
    modelName: process.env.OPENROUTER_ONBOARDING_MODEL || 'anthropic/claude-sonnet-4.5',
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
    },
    maxTokens: 500,
    temperature: 0.6,
  })
}

function getExtractorModel() {
  return new ChatOpenAI({
    modelName: process.env.OPENROUTER_ONBOARDING_MODEL || 'anthropic/claude-sonnet-4.5',
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
    },
    maxTokens: 1000,
    temperature: 0,
  })
}

// ─── Interviewer Node ──────────────────────────────────────────

export const INTERVIEW_TOPICS = [
  'services: What types of electrical work do you mainly do, and what are your typical price ranges? (e.g., panel upgrades $2,000-$4,000, EV chargers $800-$1,200)',
  'hours: What are your business hours? Do you work weekends?',
  'transfer: What\'s your cell number for call transfers, and when should calls be transferred vs. taking a message?',
  'greeting: How would you like the AI to greet callers? Professional, casual, or somewhere in between?',
]

async function interviewerNode(state: OnboardingStateType): Promise<Partial<OnboardingStateType>> {
  const model = getOnboardingModel()

  const systemPrompt = `You are an onboarding assistant helping ${state.companyName} set up their AI phone receptionist.

Your job is to interview the electrician naturally to gather the information the AI receptionist needs to answer calls effectively. Be conversational and friendly — this should feel like a quick chat, not a form.

Topics to cover (ask about ones not yet discussed):
${INTERVIEW_TOPICS.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Rules:
- Ask ONE question at a time
- Adapt follow-ups based on their answers
- If they give vague answers, ask clarifying follow-ups
- After covering all topics (usually 4–5 exchanges), confirm you have everything and set isComplete
- Keep responses under 3 sentences
- Questions asked so far: ${state.questionsAsked}

When you believe you have enough information, end your message with the exact string "[COMPLETE]" (including brackets).`

  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    ...state.messages,
  ])

  const text = typeof response.content === 'string' ? response.content : ''
  const isComplete = text.includes('[COMPLETE]')
  const cleanText = text.replace('[COMPLETE]', '').trim()

  return {
    reply: cleanText,
    questionsAsked: state.questionsAsked + 1,
    isComplete,
    messages: [new AIMessage(cleanText)],
  }
}

// ─── Extractor Node ────────────────────────────────────────────

async function extractorNode(state: OnboardingStateType): Promise<Partial<OnboardingStateType>> {
  const model = getExtractorModel()

  const systemPrompt = `Extract structured data from this onboarding conversation for ${state.companyName}'s AI receptionist configuration.

Return ONLY valid JSON with these exact fields:
{
  "receptionist_services": [
    {"name": "Service Name", "description": "Brief description", "priceRange": "$X - $Y"}
  ],
  "receptionist_hours": {
    "mon": {"start": "HH:MM", "end": "HH:MM"},
    "tue": {"start": "HH:MM", "end": "HH:MM"},
    ...
  },
  "receptionist_greeting": "Hi, thanks for calling [company]. How can I help?",
  "receptionist_transfer_number": "+1XXXXXXXXXX" or null,
  "default_job_duration": 2
}

Rules:
- For services: include ALL mentioned services with realistic price ranges
- For hours: use 24h format. If they said "8 to 5 weekdays", set mon-fri 08:00-17:00
- For greeting: write a natural greeting matching their tone preference. Always include company name.
- For transfer number: include if they provided a cell/direct number
- For default_job_duration: number in hours (e.g., 1, 1.5, 2). If not mentioned, default to 2
- If information is missing, use reasonable defaults for an electrical contractor

Return ONLY the JSON object, no markdown or explanation.`

  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    ...state.messages,
  ])

  const text = typeof response.content === 'string' ? response.content : ''

  let extracted: ExtractedData
  try {
    extracted = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
  } catch {
    // Fallback with defaults
    extracted = {
      receptionist_services: [
        { name: 'General Electrical', description: 'Electrical repairs and installations', priceRange: 'Varies' },
      ],
      receptionist_hours: {
        mon: { start: '08:00', end: '17:00' },
        tue: { start: '08:00', end: '17:00' },
        wed: { start: '08:00', end: '17:00' },
        thu: { start: '08:00', end: '17:00' },
        fri: { start: '08:00', end: '17:00' },
      },
      receptionist_greeting: `Hi, thanks for calling ${state.companyName}. How can I help you today?`,
      receptionist_transfer_number: null,
      default_job_duration: 2,
    }
  }

  return {
    extractedData: extracted,
    reply: "I've got everything I need. Here's what I've set up for your AI receptionist — take a look and let me know if anything needs adjusting!",
    messages: [new AIMessage("Great, I've compiled your receptionist configuration. Please review it below.")],
  }
}

// ─── Silent extraction for live preview ────────────────────────

export async function extractDataFromConversation(
  messages: BaseMessage[],
  companyName: string
): Promise<ExtractedData | null> {
  if (messages.length < 4) return null // need at least 2 full exchanges
  try {
    const model = getExtractorModel()
    const systemPrompt = `Extract structured data from this partial onboarding conversation for ${companyName}'s AI receptionist. Only extract what has been mentioned so far — leave fields as defaults for information not yet discussed.

Return ONLY valid JSON with these exact fields:
{
  "receptionist_services": [
    {"name": "Service Name", "description": "Brief description", "priceRange": "$X - $Y"}
  ],
  "receptionist_hours": {
    "mon": {"start": "HH:MM", "end": "HH:MM"},
    ...
  },
  "receptionist_greeting": "Hi, thanks for calling [company]. How can I help?",
  "receptionist_transfer_number": "+1XXXXXXXXXX" or null,
  "default_job_duration": 2
}

Rules:
- For hours: use 24h format. If not mentioned, use empty object {}
- For services: only include services actually mentioned, with price ranges if given
- For greeting: only fill if tone/style was mentioned, otherwise use default
- For transfer number: only include if they gave a number
- Return ONLY the JSON object, no markdown or explanation.`

    const response = await model.invoke([new SystemMessage(systemPrompt), ...messages])
    const text = typeof response.content === 'string' ? response.content : ''
    return JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()) as ExtractedData
  } catch {
    return null
  }
}

// ─── Routing ───────────────────────────────────────────────────

function routeAfterInterviewer(state: OnboardingStateType): string {
  if (state.isComplete) return 'extractor'
  return END // Wait for next user message
}

// ─── Build Graph ───────────────────────────────────────────────

function buildOnboardingGraph() {
  const graph = new StateGraph(OnboardingState)
    .addNode('interviewer', interviewerNode)
    .addNode('extractor', extractorNode)
    .addEdge('__start__', 'interviewer')
    .addConditionalEdges('interviewer', routeAfterInterviewer, {
      extractor: 'extractor',
      [END]: END,
    })
    .addEdge('extractor', END)

  return graph.compile()
}

let _graph: ReturnType<typeof buildOnboardingGraph> | null = null

function getGraph() {
  if (!_graph) _graph = buildOnboardingGraph()
  return _graph
}

// ─── Public API ────────────────────────────────────────────────

export interface OnboardingInput {
  messages: BaseMessage[]
  userId: string
  companyName: string
  questionsAsked?: number
  isComplete?: boolean
}

export interface OnboardingOutput {
  reply: string
  isComplete: boolean
  extractedData: ExtractedData | null
  questionsAsked: number
}

export async function runOnboardingAgent(input: OnboardingInput): Promise<OnboardingOutput> {
  const graph = getGraph()

  const result = await graph.invoke({
    messages: input.messages,
    userId: input.userId,
    companyName: input.companyName,
    questionsAsked: input.questionsAsked ?? 0,
    isComplete: input.isComplete ?? false,
    extractedData: null,
    reply: '',
  })

  return {
    reply: result.reply,
    isComplete: result.isComplete,
    extractedData: result.extractedData,
    questionsAsked: result.questionsAsked,
  }
}

export { HumanMessage, AIMessage }
