import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'
import { parsePaginationParams, buildPaginationMeta } from '@/lib/pagination'

export async function GET(request: NextRequest) {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  const { searchParams } = new URL(request.url)
  const { page, limit, skip } = parsePaginationParams(searchParams)
  const search = searchParams.get('search')?.trim() || undefined

  const where = {
    user_id: user.id,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { address: { contains: search, mode: 'insensitive' as const } },
            { city: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.customer.count({ where }),
  ])

  return NextResponse.json({
    customers,
    pagination: buildPaginationMeta(total, page, limit),
  })
}

export async function POST(request: NextRequest) {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  const body = await request.json()

  const customer = await prisma.customer.create({
    data: {
      user_id: user.id,
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      address: body.address || null,
      city: body.city || null,
      province: body.province || null,
      property_notes: body.property_notes || null,
      panel_size: body.panel_size || null,
      service_amps: body.service_amps || null,
    },
  })

  return NextResponse.json(customer)
}
