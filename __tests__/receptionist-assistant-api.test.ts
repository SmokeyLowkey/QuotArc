/**
 * Tests for the persistent receptionist config assistant API:
 *   GET  /api/voice/assistant  — load history + config
 *   POST /api/voice/assistant  — run agent, save history
 *   DELETE /api/voice/assistant — clear history (config untouched)
 *
 * Mocks: auth, prisma, redis, require-plan, config-assistant
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Hoisted mocks (must be defined before vi.mock calls) ────────

const {
  mockPrisma,
  mockRedis,
  mockRunConfigAssistant,
  mockProfile,
} = vi.hoisted(() => {
  const mockProfile = {
    receptionist_services: [{ name: 'Panel Upgrade', description: '', priceRange: '$2,500-$4,500' }],
    receptionist_hours: { mon: { start: '09:00', end: '17:00' } },
    receptionist_greeting: 'Hello from {company_name}',
    receptionist_transfer_number: '+15551234567',
    receptionist_date_overrides: {},
    receptionist_instructions: 'Always mention the $150 consultation fee before tax.',
    receptionist_enabled: true,
    company_name: 'Acme Electric',
  }

  const mockPrisma = {
    profile: {
      findUnique: vi.fn().mockResolvedValue(mockProfile),
    },
  }

  const mockRedis = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  }

  const mockRunConfigAssistant = vi.fn().mockResolvedValue({
    reply: 'All set!',
    configUpdated: false,
    updatedMessages: [
      { _getType: () => 'human', content: "Let's get started!" },
      { _getType: () => 'ai', content: 'All set!' },
    ],
  })

  return { mockProfile, mockPrisma, mockRedis, mockRunConfigAssistant }
})

// ─── Module mocks ────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn().mockResolvedValue({ id: 'user-1' }),
  AuthError: class AuthError extends Error {},
  unauthorizedResponse: vi.fn(() => new Response('Unauthorized', { status: 401 })),
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

vi.mock('@/lib/redis', () => ({ redis: mockRedis }))

vi.mock('@/lib/require-plan', () => ({
  requirePlan: vi.fn().mockResolvedValue({ allowed: true }),
}))

vi.mock('@/lib/voice/config-assistant', () => ({
  runConfigAssistant: (...args: unknown[]) => mockRunConfigAssistant(...args),
  AIMessage: class AIMessage {
    content: string
    constructor(content: string) { this.content = content }
    _getType() { return 'ai' }
  },
}))

// ─── Import handlers after mocks ─────────────────────────────────

import { GET, POST, DELETE } from '@/app/api/voice/assistant/route'
import { requireUser } from '@/lib/auth'
import { requirePlan } from '@/lib/require-plan'

// ─── Helpers ────────────────────────────────────────────────────

function makePostRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/voice/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─── GET tests ───────────────────────────────────────────────────

describe('GET /api/voice/assistant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireUser).mockResolvedValue({ id: 'user-1' } as never)
    vi.mocked(requirePlan).mockResolvedValue({ allowed: true } as never)
    mockRedis.get.mockResolvedValue(null)
    mockPrisma.profile.findUnique.mockResolvedValue(mockProfile)
  })

  it('returns empty messages + config when no Redis state exists', async () => {
    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.messages).toEqual([])
    expect(data.config).toMatchObject({
      receptionist_services: mockProfile.receptionist_services,
      receptionist_enabled: true,
    })
  })

  it('returns receptionist_instructions in config', async () => {
    const res = await GET()
    const data = await res.json()

    expect(data.config.receptionist_instructions).toBe('Always mention the $150 consultation fee before tax.')
  })

  it('returns stored messages + current config when history exists in Redis', async () => {
    const stored = [
      { role: 'user', content: "Let's get started!" },
      { role: 'assistant', content: 'Hello! What services do you offer?' },
    ]
    mockRedis.get.mockResolvedValue(stored)

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.messages).toEqual(stored)
    expect(data.config.receptionist_greeting).toBe('Hello from {company_name}')
  })
})

// ─── POST tests ──────────────────────────────────────────────────

describe('POST /api/voice/assistant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireUser).mockResolvedValue({ id: 'user-1' } as never)
    vi.mocked(requirePlan).mockResolvedValue({ allowed: true } as never)
    mockRedis.get.mockResolvedValue(null)
    mockPrisma.profile.findUnique.mockResolvedValue(mockProfile)
    mockRunConfigAssistant.mockResolvedValue({
      reply: 'All set!',
      configUpdated: false,
      updatedMessages: [
        { _getType: () => 'human', content: 'Hello' },
        { _getType: () => 'ai', content: 'All set!' },
      ],
    })
  })

  it('runs agent, saves history to Redis, returns reply', async () => {
    const req = makePostRequest({ message: 'Hello' })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.reply).toBe('All set!')
    expect(data.configUpdated).toBe(false)
    expect(data.config).toBeNull()
    expect(mockRedis.set).toHaveBeenCalledOnce()
    expect(mockRunConfigAssistant).toHaveBeenCalledOnce()
  })

  it('returns refreshed config when configUpdated is true', async () => {
    mockRunConfigAssistant.mockResolvedValue({
      reply: 'Updated your hours.',
      configUpdated: true,
      updatedMessages: [
        { _getType: () => 'human', content: 'Change Friday to 9-3' },
        { _getType: () => 'ai', content: 'Updated your hours.' },
      ],
    })

    const req = makePostRequest({ message: 'Change Friday to 9-3' })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.configUpdated).toBe(true)
    expect(data.config).not.toBeNull()
    expect(data.config.receptionist_services).toEqual(mockProfile.receptionist_services)
  })

  it('returns 400 when message is missing', async () => {
    const req = makePostRequest({})
    const res = await POST(req)

    expect(res.status).toBe(400)
    expect(mockRunConfigAssistant).not.toHaveBeenCalled()
  })

  it('returns 400 when message is whitespace only', async () => {
    const req = makePostRequest({ message: '   ' })
    const res = await POST(req)

    expect(res.status).toBe(400)
    expect(mockRunConfigAssistant).not.toHaveBeenCalled()
  })
})

// ─── DELETE tests ─────────────────────────────────────────────────

describe('DELETE /api/voice/assistant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireUser).mockResolvedValue({ id: 'user-1' } as never)
    vi.mocked(requirePlan).mockResolvedValue({ allowed: true } as never)
  })

  it('clears Redis key and returns { reset: true }', async () => {
    const res = await DELETE()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ reset: true })
    expect(mockRedis.del).toHaveBeenCalledWith('voice:assistant:user-1')
    // profile must NOT be touched
    expect(mockPrisma.profile.findUnique).not.toHaveBeenCalled()
  })
})

// ─── Auth guard tests ─────────────────────────────────────────────

describe('Auth guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET returns 401 when unauthenticated', async () => {
    const { AuthError, unauthorizedResponse } = await import('@/lib/auth')
    vi.mocked(requireUser).mockRejectedValue(new AuthError('Not logged in'))
    vi.mocked(unauthorizedResponse).mockReturnValue(
      new Response('Unauthorized', { status: 401 }) as never
    )

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('POST returns 403 when plan does not include aiReceptionist', async () => {
    vi.mocked(requireUser).mockResolvedValue({ id: 'user-1' } as never)
    vi.mocked(requirePlan).mockResolvedValue({
      allowed: false,
      response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    } as never)

    const req = makePostRequest({ message: 'Hello' })
    const res = await POST(req)

    expect(res.status).toBe(403)
    expect(mockRunConfigAssistant).not.toHaveBeenCalled()
  })
})
