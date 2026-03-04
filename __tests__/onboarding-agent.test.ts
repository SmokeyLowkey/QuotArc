/**
 * Tests for lib/voice/onboarding-agent
 * Verifies: INTERVIEW_TOPICS length, extractDataFromConversation guard (< 4 messages),
 * successful JSON parse, invalid JSON → null, and LLM error → null.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HumanMessage, AIMessage } from '@langchain/core/messages'

// ─── Mocks ──────────────────────────────────────────────────────

const mockInvoke = vi.fn()

vi.mock('@langchain/openai', () => ({
  // Must use a regular function (not arrow) because ChatOpenAI is called with `new`
  ChatOpenAI: vi.fn().mockImplementation(function () {
    return { invoke: mockInvoke }
  }),
}))

// Dynamic import AFTER vi.mock so mocks are hoisted
const { extractDataFromConversation, INTERVIEW_TOPICS } = await import('@/lib/voice/onboarding-agent')

// ─── Helpers ────────────────────────────────────────────────────

function makeMessages(count: number) {
  return Array.from({ length: count }, (_, i) =>
    i % 2 === 0 ? new HumanMessage(`user message ${i}`) : new AIMessage(`ai reply ${i}`)
  )
}

const validExtractedData = {
  receptionist_services: [
    { name: 'Panel Upgrade', description: 'Electrical panel upgrades', priceRange: '$2,000–$4,000' },
  ],
  receptionist_hours: {
    mon: { start: '08:00', end: '17:00' },
    fri: { start: '08:00', end: '17:00' },
  },
  receptionist_greeting: 'Hi, thanks for calling ABC Electric. How can I help?',
  receptionist_transfer_number: '+16045551234',
  default_job_duration: 2,
}

// ─── Tests ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('INTERVIEW_TOPICS', () => {
  it('has exactly 4 topics', () => {
    expect(INTERVIEW_TOPICS).toHaveLength(4)
  })
})

describe('extractDataFromConversation', () => {
  it('returns null immediately when fewer than 4 messages — no LLM call', async () => {
    const result = await extractDataFromConversation(makeMessages(3), 'ABC Electric')

    expect(result).toBeNull()
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('returns null for 0 messages — no LLM call', async () => {
    const result = await extractDataFromConversation([], 'ABC Electric')

    expect(result).toBeNull()
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('returns parsed ExtractedData when LLM returns valid JSON with 4+ messages', async () => {
    mockInvoke.mockResolvedValue({ content: JSON.stringify(validExtractedData) })

    const result = await extractDataFromConversation(makeMessages(4), 'ABC Electric')

    expect(result).not.toBeNull()
    expect(result?.receptionist_services).toHaveLength(1)
    expect(result?.receptionist_services[0].name).toBe('Panel Upgrade')
    expect(result?.receptionist_transfer_number).toBe('+16045551234')
    expect(result?.default_job_duration).toBe(2)
    expect(mockInvoke).toHaveBeenCalledOnce()
  })

  it('strips markdown code fences from LLM response before parsing', async () => {
    mockInvoke.mockResolvedValue({
      content: '```json\n' + JSON.stringify(validExtractedData) + '\n```',
    })

    const result = await extractDataFromConversation(makeMessages(4), 'ABC Electric')

    expect(result).not.toBeNull()
    expect(result?.receptionist_greeting).toBe('Hi, thanks for calling ABC Electric. How can I help?')
  })

  it('returns null when LLM returns invalid JSON', async () => {
    mockInvoke.mockResolvedValue({ content: 'not valid json at all' })

    const result = await extractDataFromConversation(makeMessages(4), 'ABC Electric')

    expect(result).toBeNull()
  })

  it('returns null when LLM invoke throws', async () => {
    mockInvoke.mockRejectedValue(new Error('OpenRouter rate limit exceeded'))

    const result = await extractDataFromConversation(makeMessages(4), 'ABC Electric')

    expect(result).toBeNull()
  })
})
