import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  const { id } = await params
  const body = await request.json()

  const job = await prisma.job.findFirst({
    where: { id, user_id: user.id },
  })

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const updated = await prisma.job.update({
    where: { id },
    data: {
      ...(body.status !== undefined && { status: body.status }),
      ...(body.scheduled_date !== undefined && { scheduled_date: new Date(body.scheduled_date) }),
      ...(body.start_time !== undefined && { start_time: body.start_time }),
      ...(body.estimated_hours !== undefined && { estimated_hours: body.estimated_hours }),
      ...(body.actual_hours !== undefined && { actual_hours: body.actual_hours }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.address !== undefined && { address: body.address }),
      updated_at: new Date(),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  const { id } = await params

  const job = await prisma.job.findFirst({
    where: { id, user_id: user.id },
  })

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  await prisma.job.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
