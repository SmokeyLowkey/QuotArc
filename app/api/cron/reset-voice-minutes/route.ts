import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * Voice minutes reset cron job.
 * Runs daily at 4 AM. Resets voice_minutes_used for users whose billing
 * period has rolled over (checks voice_minutes_reset_at).
 *
 * Trigger: Vercel cron (daily) or external scheduler hitting GET /api/cron/reset-voice-minutes
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (skip in dev)
  if (CRON_SECRET) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const now = new Date()

  // Find users with voice minutes used > 0 and reset_at in the past (or null)
  const usersToReset = await prisma.profile.findMany({
    where: {
      voice_minutes_used: { gt: 0 },
      plan_tier: { in: ['pro', 'business'] },
      plan_status: 'active',
      OR: [
        { voice_minutes_reset_at: null },
        { voice_minutes_reset_at: { lte: now } },
      ],
    },
    select: { id: true, stripe_subscription_id: true },
  })

  if (usersToReset.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  let reset = 0

  for (const user of usersToReset) {
    // Calculate next reset date (30 days from now as a simple billing period)
    const nextReset = new Date(now)
    nextReset.setDate(nextReset.getDate() + 30)

    await prisma.profile.update({
      where: { id: user.id },
      data: {
        voice_minutes_used: 0,
        voice_minutes_reset_at: nextReset,
      },
    })

    reset++
  }

  return NextResponse.json({ processed: usersToReset.length, reset })
}
