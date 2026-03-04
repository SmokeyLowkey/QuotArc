import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { prisma } from '@/lib/prisma'

const secret = new TextEncoder().encode(process.env.N8N_WEBHOOK_SECRET!)

// Callback endpoint for n8n AI workflows to report results back
export async function POST(request: NextRequest) {
  // Verify HS512 JWT from n8n
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing auth header' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')

  try {
    await jwtVerify(token, secret, { algorithms: ['HS512'] })
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const body = await request.json()

  // Insert activity event
  if (body.event_type && body.user_id) {
    await prisma.activityEvent.create({
      data: {
        user_id: body.user_id,
        quote_id: body.quote_id || null,
        invoice_id: body.invoice_id || null,
        event_type: body.event_type,
        metadata: body.metadata || {},
      },
    })
  }

  return NextResponse.json({ success: true })
}
