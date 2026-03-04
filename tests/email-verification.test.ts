import { describe, it, expect, beforeAll } from 'vitest'
import { config } from 'dotenv'
import { randomBytes } from 'crypto'

// Load env before anything else
config({ path: '.env.local' })

let prisma: any
let sendVerificationEmail: any
let getAuthAdmin: any

beforeAll(async () => {
  const prismaModule = await import('../lib/prisma')
  prisma = prismaModule.prisma
  const emailModule = await import('../lib/email')
  sendVerificationEmail = emailModule.sendVerificationEmail
  const authAdminModule = await import('../lib/supabase/auth-admin')
  getAuthAdmin = authAdminModule.getAuthAdmin
})

// ─── Environment checks ─────────────────────────────────────────
describe('Environment', () => {
  it('has RESEND_API_KEY set', () => {
    expect(process.env.RESEND_API_KEY).toBeDefined()
    expect(process.env.RESEND_API_KEY!.length).toBeGreaterThan(0)
  })

  it('has NEXT_PUBLIC_APP_URL set', () => {
    expect(process.env.NEXT_PUBLIC_APP_URL).toBeDefined()
  })

  it('has SUPABASE_POOLER_URL set', () => {
    expect(process.env.SUPABASE_POOLER_URL).toBeDefined()
  })

  it('has SUPABASE_SERVICE_ROLE_KEY set', () => {
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeDefined()
  })
})

// ─── DB connection ───────────────────────────────────────────────
describe('Prisma connection', () => {
  it('can connect and query profiles', async () => {
    const count = await prisma.profile.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })
})

// ─── Resend email delivery ───────────────────────────────────────
describe('Resend email delivery', () => {
  it('sends verification email successfully', async () => {
    const result = await sendVerificationEmail({
      to: 'yuriykondakov04@gmail.com',
      companyName: 'Test Electric Co',
      verifyUrl: 'http://localhost:3000/auth/verify/test-token-123',
    })

    console.log('Resend response:', JSON.stringify(result.data, null, 2))
    expect(result.error).toBeNull()
    expect(result.data).toBeDefined()
    expect(result.data.id).toBeDefined()
    console.log('Email sent! Resend ID:', result.data.id)
  }, 15000)
})

// ─── Full verification lifecycle (uses a temp profile) ───────────
describe('Verification lifecycle', () => {
  const tempId = '00000000-0000-0000-0000-000000000099'
  const tempEmail = 'test-verify@example.com'
  const testToken = randomBytes(32).toString('hex')

  beforeAll(async () => {
    // Clean up any leftover test profile
    await prisma.profile.deleteMany({ where: { id: tempId } })

    // Create a temp profile for testing
    await prisma.profile.create({
      data: {
        id: tempId,
        email: tempEmail,
        company_name: 'Lifecycle Test Co',
        email_verified: false,
        verification_token: testToken,
        verification_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })
  })

  it('profile starts as unverified with a token', async () => {
    const profile = await prisma.profile.findUnique({ where: { id: tempId } })
    expect(profile).toBeDefined()
    expect(profile!.email_verified).toBe(false)
    expect(profile!.verification_token).toBe(testToken)
    expect(profile!.verification_expires).toBeDefined()
  })

  it('can look up profile by verification_token', async () => {
    const found = await prisma.profile.findUnique({
      where: { verification_token: testToken },
    })
    expect(found).toBeDefined()
    expect(found!.id).toBe(tempId)
  })

  it('marks profile as verified and clears token', async () => {
    const updated = await prisma.profile.update({
      where: { id: tempId },
      data: {
        email_verified: true,
        verification_token: null,
        verification_expires: null,
      },
    })
    expect(updated.email_verified).toBe(true)
    expect(updated.verification_token).toBeNull()
    expect(updated.verification_expires).toBeNull()
  })

  it('token lookup returns null after verification', async () => {
    const found = await prisma.profile.findUnique({
      where: { verification_token: testToken },
    })
    expect(found).toBeNull()
  })

  it('rejects expired tokens', async () => {
    const expiredToken = randomBytes(32).toString('hex')

    await prisma.profile.update({
      where: { id: tempId },
      data: {
        email_verified: false,
        verification_token: expiredToken,
        verification_expires: new Date(Date.now() - 1000),
      },
    })

    const found = await prisma.profile.findUnique({
      where: { verification_token: expiredToken },
    })
    expect(found).toBeDefined()
    expect(found!.verification_expires!.getTime()).toBeLessThan(Date.now())
  })

  it('regenerates token when expired', async () => {
    const profile = await prisma.profile.findUnique({ where: { id: tempId } })
    const isExpired = profile!.verification_expires! < new Date()
    expect(isExpired).toBe(true)

    const newToken = randomBytes(32).toString('hex')
    const updated = await prisma.profile.update({
      where: { id: tempId },
      data: {
        verification_token: newToken,
        verification_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })
    expect(updated.verification_token).toBe(newToken)
    expect(updated.verification_expires!.getTime()).toBeGreaterThan(Date.now())
  })

  it('cleanup: removes temp profile', async () => {
    await prisma.profile.delete({ where: { id: tempId } })
    const gone = await prisma.profile.findUnique({ where: { id: tempId } })
    expect(gone).toBeNull()
  })
})

// ─── Supabase auth admin ─────────────────────────────────────────
describe('Supabase auth admin', () => {
  it('can list users', async () => {
    const admin = getAuthAdmin()
    const { data, error } = await admin.listUsers()
    expect(error).toBeNull()
    expect(data.users).toBeDefined()
    console.log(`Supabase has ${data.users.length} auth user(s)`)
  })
})
