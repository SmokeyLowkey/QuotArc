import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateFile, uploadChatAttachment } from '@/lib/supabase/storage'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }

  const quote = await prisma.quote.findUnique({
    where: { public_token: token },
    select: { id: true, status: true },
  })

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  if (quote.status === 'expired') {
    return NextResponse.json({ error: 'This quote has expired' }, { status: 410 })
  }

  // Validate file type and size
  const validationError = validateFile(file.type, file.size)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const attachment = await uploadChatAttachment(quote.id, buffer, file.name, file.type)

  return NextResponse.json(attachment, { status: 201 })
}
