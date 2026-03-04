import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'

export async function PATCH(request: NextRequest) {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  const { ids } = await request.json() as { ids?: string[] }
  const now = new Date()

  if (ids && ids.length > 0) {
    await prisma.notification.updateMany({
      where: { id: { in: ids }, user_id: user.id },
      data: { is_read: true, read_at: now },
    })
  } else {
    await prisma.notification.updateMany({
      where: { user_id: user.id, is_read: false },
      data: { is_read: true, read_at: now },
    })
  }

  return NextResponse.json({ success: true })
}
