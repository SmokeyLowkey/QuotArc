/**
 * Warmup endpoint — hit this after dev server starts to pre-compile
 * the voice routes so the first real call doesn't suffer cold-start lag.
 *
 * Also used as a health check by Vapi/monitoring.
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() })
}

export async function POST() {
  return NextResponse.json({ ok: true, ts: Date.now() })
}
