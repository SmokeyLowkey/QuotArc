/**
 * Tests for POST /api/auth/send-reset
 * Verifies the Resend-based password reset flow:
 * - Calls Supabase admin.generateLink for recovery
 * - Sends branded email via sendPasswordResetEmail
 * - Never reveals whether an email exists (always returns success)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks ──────────────────────────────────────────────────────

const mockGenerateLink = vi.fn()

vi.mock('@/lib/supabase/auth-admin', () => ({
  getAuthAdmin: vi.fn(() => ({ generateLink: mockGenerateLink })),
}))

const mockSendPasswordResetEmail = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/email', () => ({
  sendPasswordResetEmail: mockSendPasswordResetEmail,
}))

const { POST } = await import('@/app/api/auth/send-reset/route')

// ─── Helpers ────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/send-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─── Tests ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/auth/send-reset', () => {
  it('sends reset email when generateLink returns an action_link', async () => {
    mockGenerateLink.mockResolvedValue({
      data: { properties: { action_link: 'https://auth.supabase.co/recover?token=abc123' } },
      error: null,
    })

    const res = await POST(makeRequest({ email: 'user@example.com' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ success: true })
    expect(mockSendPasswordResetEmail).toHaveBeenCalledOnce()
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith({
      to: 'user@example.com',
      resetUrl: 'https://auth.supabase.co/recover?token=abc123',
    })
  })

  it('returns success without sending email when generateLink returns no action_link', async () => {
    mockGenerateLink.mockResolvedValue({
      data: { properties: {} },
      error: null,
    })

    const res = await POST(makeRequest({ email: 'unknown@example.com' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ success: true })
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('returns success even when generateLink throws (no email leak)', async () => {
    mockGenerateLink.mockRejectedValue(new Error('User not found'))

    const res = await POST(makeRequest({ email: 'notfound@example.com' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ success: true })
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('normalises email to lowercase before processing', async () => {
    mockGenerateLink.mockResolvedValue({
      data: { properties: { action_link: 'https://auth.supabase.co/recover?token=xyz' } },
      error: null,
    })

    await POST(makeRequest({ email: 'USER@EXAMPLE.COM' }))

    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@example.com' })
    )
  })

  it('returns 400 when email field is missing', async () => {
    const res = await POST(makeRequest({}))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: 'Email is required' })
    expect(mockGenerateLink).not.toHaveBeenCalled()
  })
})
