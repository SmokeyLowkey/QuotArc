import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendVerificationEmail } from '@/lib/email'
import { getAuthAdmin } from '@/lib/supabase/auth-admin'
import { randomBytes } from 'crypto'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const email = body.email?.toLowerCase().trim()

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  // Find profile by email
  let profile = await prisma.profile.findFirst({
    where: { email },
    select: {
      id: true,
      email: true,
      company_name: true,
      email_verified: true,
      verification_token: true,
      verification_expires: true,
    },
  })

  // Profile doesn't exist yet — create it from Supabase auth user
  if (!profile) {
    try {
      const admin = getAuthAdmin()
      const { data } = await admin.listUsers()
      const authUser = data.users.find(u => u.email === email)

      if (!authUser) {
        // Don't reveal whether the email exists
        return NextResponse.json({ success: true })
      }

      profile = await prisma.profile.create({
        data: {
          id: authUser.id,
          email,
          company_name: authUser.user_metadata?.company_name || 'My Company',
          email_verified: false,
          verification_token: randomBytes(32).toString('hex'),
          verification_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        select: {
          id: true,
          email: true,
          company_name: true,
          email_verified: true,
          verification_token: true,
          verification_expires: true,
        },
      })
    } catch (err) {
      console.error('Failed to create profile for verification:', err)
      return NextResponse.json({ success: true })
    }
  }

  if (profile.email_verified) {
    return NextResponse.json({ success: true })
  }

  // Ensure Supabase metadata is in sync (email_verified = false)
  try {
    const admin = getAuthAdmin()
    await admin.updateUserById(profile.id, {
      user_metadata: { email_verified: false },
    })
  } catch {
    // Non-critical
  }

  // Regenerate token if expired or missing
  let token = profile.verification_token
  if (!token || (profile.verification_expires && profile.verification_expires < new Date())) {
    token = randomBytes(32).toString('hex')
    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        verification_token: token,
        verification_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })
  }

  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify/${token}`

  try {
    await sendVerificationEmail({
      to: profile.email,
      companyName: profile.company_name,
      verifyUrl,
    })
  } catch (err) {
    console.error('Failed to send verification email via Resend:', err)
    return NextResponse.json(
      { error: 'Failed to send verification email' },
      { status: 502 }
    )
  }

  return NextResponse.json({ success: true })
}
