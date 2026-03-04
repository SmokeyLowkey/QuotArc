import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, AuthError, unauthorizedResponse } from '@/lib/auth'
import { validateFile, uploadChatAttachment } from '@/lib/supabase/storage'

export async function POST(request: NextRequest) {
  let user
  try {
    user = await requireUser()
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse()
    throw e
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const quoteId = (formData.get('quoteId') as string | null)
    || request.nextUrl.searchParams.get('quoteId')

  if (!file || !quoteId) {
    return NextResponse.json({ error: 'file and quoteId are required' }, { status: 400 })
  }

  // Verify user owns this quote
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, user_id: user.id },
    select: { id: true },
  })

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  // Validate file type and size
  const validationError = validateFile(file.type, file.size)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const attachment = await uploadChatAttachment(quoteId, buffer, file.name, file.type)

  return NextResponse.json(attachment, { status: 201 })
}
