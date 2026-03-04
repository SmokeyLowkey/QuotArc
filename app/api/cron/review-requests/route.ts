import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hasFeature, type PlanTier } from '@/lib/plans'
import { sendReviewRequestEmail } from '@/lib/email'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * Google Review request cron job.
 * Finds completed jobs where:
 *   - electrician has google_place_id set
 *   - google_review_auto_send is enabled
 *   - job completed > delay_hours ago
 *   - no existing ReviewRequest for this customer+job (idempotent)
 *   - user's plan includes googleReviews feature
 *
 * Trigger: Vercel cron (every 2 hours) or external scheduler hitting GET /api/cron/review-requests
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

  // Find completed jobs eligible for review requests
  const eligibleJobs = await prisma.job.findMany({
    where: {
      status: 'completed',
      user: {
        google_place_id: { not: null },
        google_review_auto_send: true,
      },
    },
    include: {
      customer: true,
      user: {
        select: {
          id: true,
          company_name: true,
          google_place_id: true,
          google_review_delay_hours: true,
          plan_tier: true,
          plan_status: true,
        },
      },
    },
  })

  if (eligibleJobs.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const job of eligibleJobs) {
    // Gate on plan tier
    const tier = job.user.plan_tier as PlanTier
    if (!hasFeature(tier, 'googleReviews')) {
      skipped++
      continue
    }

    // Free-tier users still need active status if they're on a paid plan
    if (tier !== 'free' && job.user.plan_status !== 'active') {
      skipped++
      continue
    }

    // Check delay: job must have been updated (completed) > delay_hours ago
    const delayMs = (job.user.google_review_delay_hours ?? 24) * 3600000
    const jobCompletedAt = job.updated_at
    if (now.getTime() - jobCompletedAt.getTime() < delayMs) {
      skipped++
      continue
    }

    // Customer must have an email
    if (!job.customer?.email) {
      skipped++
      continue
    }

    // Check idempotency — no existing ReviewRequest for this customer+job
    const existing = await prisma.reviewRequest.findUnique({
      where: {
        user_id_customer_id_job_id: {
          user_id: job.user_id,
          customer_id: job.customer_id,
          job_id: job.id,
        },
      },
    })

    if (existing) {
      skipped++
      continue
    }

    try {
      const reviewUrl = `https://search.google.com/local/writereview?placeid=${encodeURIComponent(job.user.google_place_id!)}`

      await sendReviewRequestEmail({
        to: job.customer.email,
        customerName: job.customer.name,
        companyName: job.user.company_name,
        jobType: job.job_type,
        reviewUrl,
      })

      // Create ReviewRequest + ActivityEvent in a transaction
      await prisma.$transaction([
        prisma.reviewRequest.create({
          data: {
            user_id: job.user_id,
            customer_id: job.customer_id,
            job_id: job.id,
          },
        }),
        prisma.activityEvent.create({
          data: {
            user_id: job.user_id,
            event_type: 'review_requested',
            metadata: {
              customer_name: job.customer.name,
              customer_email: job.customer.email,
              job_type: job.job_type,
              job_id: job.id,
            },
          },
        }),
      ])

      sent++
    } catch (err) {
      console.error(`[review-requests] Failed for job ${job.id}:`, err)
      failed++
    }
  }

  return NextResponse.json({ processed: eligibleJobs.length, sent, skipped, failed })
}
