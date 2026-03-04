import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'

export async function GET(request: NextRequest) {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const skip = (page - 1) * limit

  try {
    const [notifications, unreadCount, total] = await Promise.all([
      prisma.notification.findMany({
        where: { user_id: user.id },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({
        where: { user_id: user.id, is_read: false },
      }),
      prisma.notification.count({ where: { user_id: user.id } }),
    ])

    const totalPages = Math.ceil(total / limit)
    return NextResponse.json({
      notifications,
      unreadCount,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    })
  } catch (err) {
    console.error('[notifications] Fetch error for user', user.id, err)
    return NextResponse.json({ notifications: [], unreadCount: 0, pagination: { page: 1, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } })
  }
}
