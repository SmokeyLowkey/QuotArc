/**
 * Tests for POST /api/profile/logo
 * Verifies logo upload: auth check, file validation delegation to uploadLogo,
 * DB update of logo_url, and error propagation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks ──────────────────────────────────────────────────────

const mockUser = { id: 'user-uuid-123', email: 'test@example.com' }

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn().mockResolvedValue(mockUser),
  AuthError: class extends Error {
    constructor() { super('Unauthorized'); this.name = 'AuthError' }
  },
  unauthorizedResponse: vi.fn(() => new Response(
    JSON.stringify({ error: 'Unauthorized' }), { status: 401 }
  )),
}))

const mockUploadLogo = vi.fn()

vi.mock('@/lib/supabase/storage', () => ({
  uploadLogo: mockUploadLogo,
}))

const mockPrisma = {
  profile: {
    update: vi.fn(),
  },
}

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

const { POST } = await import('@/app/api/profile/logo/route')

// ─── Helpers ────────────────────────────────────────────────────

function makeUploadRequest(file?: File): NextRequest {
  const formData = new FormData()
  if (file) formData.append('file', file)
  return new NextRequest('http://localhost:3000/api/profile/logo', {
    method: 'POST',
    body: formData,
  })
}

function makePngFile(name = 'logo.png', sizeBytes = 1024): File {
  const bytes = new Uint8Array(sizeBytes)
  return new File([bytes], name, { type: 'image/png' })
}

// ─── Tests ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/profile/logo', () => {
  it('uploads logo and returns public URL', async () => {
    mockUploadLogo.mockResolvedValue({ url: 'https://storage.supabase.co/logos/user-uuid-123/logo.png?t=123' })
    mockPrisma.profile.update.mockResolvedValue({})

    const res = await POST(makeUploadRequest(makePngFile()))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.url).toMatch(/logos\/user-uuid-123/)
    expect(mockUploadLogo).toHaveBeenCalledOnce()
    expect(mockPrisma.profile.update).toHaveBeenCalledWith({
      where: { id: 'user-uuid-123' },
      data: { logo_url: expect.stringContaining('logos/user-uuid-123') },
    })
  })

  it('returns 400 when no file is provided', async () => {
    const res = await POST(makeUploadRequest()) // no file appended
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: 'No file provided' })
    expect(mockUploadLogo).not.toHaveBeenCalled()
  })

  it('returns 401 when user is not authenticated', async () => {
    const { requireUser } = await import('@/lib/auth')
    const { AuthError } = await import('@/lib/auth')
    ;(requireUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new AuthError())

    const res = await POST(makeUploadRequest(makePngFile()))

    expect(res.status).toBe(401)
    expect(mockUploadLogo).not.toHaveBeenCalled()
  })

  it('returns 400 with error message when uploadLogo throws invalid type error', async () => {
    mockUploadLogo.mockRejectedValue(new Error('Logo must be a JPEG, PNG, or WebP image.'))

    const res = await POST(makeUploadRequest(makePngFile()))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: 'Logo must be a JPEG, PNG, or WebP image.' })
    expect(mockPrisma.profile.update).not.toHaveBeenCalled()
  })

  it('returns 400 with error message when uploadLogo throws size error', async () => {
    mockUploadLogo.mockRejectedValue(new Error('Logo must be under 5MB.'))

    const res = await POST(makeUploadRequest(makePngFile()))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: 'Logo must be under 5MB.' })
  })
})
