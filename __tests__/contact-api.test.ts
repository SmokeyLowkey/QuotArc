/**
 * Tests for POST /api/contact — public contact form.
 * Validates all input fields and covers the email failure path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks ──────────────────────────────────────────────────────

const mockSendContactEmail = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/email', () => ({
  sendContactEmail: mockSendContactEmail,
}))

const { POST } = await import('@/app/api/contact/route')

// ─── Helpers ────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeInvalidJsonRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not-valid-json{{{',
  })
}

const validBody = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  subject: 'General inquiry',
  message: 'This is a test message with enough characters.',
}

// ─── Tests ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/contact', () => {
  it('sends email and returns { success: true } for valid input', async () => {
    const res = await POST(makeRequest(validBody))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ success: true })
    expect(mockSendContactEmail).toHaveBeenCalledOnce()
    expect(mockSendContactEmail).toHaveBeenCalledWith({
      name: 'Jane Doe',
      email: 'jane@example.com',
      subject: 'General inquiry',
      message: 'This is a test message with enough characters.',
    })
  })

  it('returns 400 when name field is missing', async () => {
    const { name: _n, ...bodyWithoutName } = validBody
    const res = await POST(makeRequest(bodyWithoutName))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: 'All fields are required.' })
    expect(mockSendContactEmail).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid email format', async () => {
    const res = await POST(makeRequest({ ...validBody, email: 'not-an-email' }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: 'Please enter a valid email address.' })
    expect(mockSendContactEmail).not.toHaveBeenCalled()
  })

  it('returns 400 when message is fewer than 10 characters', async () => {
    const res = await POST(makeRequest({ ...validBody, message: 'Short' }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: 'Message is too short.' })
    expect(mockSendContactEmail).not.toHaveBeenCalled()
  })

  it('returns 500 when sendContactEmail throws', async () => {
    mockSendContactEmail.mockRejectedValueOnce(new Error('Resend error'))

    const res = await POST(makeRequest(validBody))
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data).toEqual({ error: 'Failed to send message. Please try again.' })
  })

  it('returns 400 for invalid JSON body', async () => {
    const res = await POST(makeInvalidJsonRequest())
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: 'Invalid request' })
    expect(mockSendContactEmail).not.toHaveBeenCalled()
  })

  it('returns 400 when required field is whitespace-only', async () => {
    const res = await POST(makeRequest({ ...validBody, name: '   ' }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: 'All fields are required.' })
    expect(mockSendContactEmail).not.toHaveBeenCalled()
  })
})
