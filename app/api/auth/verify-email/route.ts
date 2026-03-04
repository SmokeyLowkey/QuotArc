import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthAdmin } from '@/lib/supabase/auth-admin'

export async function POST(request: NextRequest) {
  const { token } = await request.json()

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  // Find profile by verification token
  const profile = await prisma.profile.findUnique({
    where: { verification_token: token },
    select: {
      id: true,
      email_verified: true,
      verification_expires: true,
    },
  })

  if (!profile) {
    return NextResponse.json({ error: 'Invalid verification link' }, { status: 400 })
  }

  if (profile.email_verified) {
    return NextResponse.json({ message: 'Email already verified' })
  }

  // Check expiry
  if (profile.verification_expires && profile.verification_expires < new Date()) {
    return NextResponse.json({ error: 'Verification link has expired' }, { status: 400 })
  }

  // Mark as verified + clear token
  await prisma.profile.update({
    where: { id: profile.id },
    data: {
      email_verified: true,
      verification_token: null,
      verification_expires: null,
    },
  })

  // Update Supabase user metadata so middleware recognises the user as verified
  const admin = getAuthAdmin()
  const { error: metaError } = await admin.updateUserById(profile.id, {
    user_metadata: { email_verified: true },
  })
  if (metaError) {
    console.error('Failed to update Supabase user metadata:', metaError.message)
    // Retry once
    const { error: retryError } = await admin.updateUserById(profile.id, {
      user_metadata: { email_verified: true },
    })
    if (retryError) {
      console.error('Retry also failed:', retryError.message)
    }
  }

  return NextResponse.json({ success: true })
}
