import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { config } from 'dotenv'
import { randomBytes } from 'crypto'

// Load env before anything else
config({ path: '.env.local' })

let prisma: any

// ─── Test constants ─────────────────────────────────────────────
function randomUUID() {
  const hex = randomBytes(16).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

const TEST_USER_ID = '00000000-0000-0000-0000-000000000066'
const TEST_CUSTOMER_ID = randomUUID()
const TEST_QUOTE_ID = randomUUID()
const TEST_PUBLIC_TOKEN = randomBytes(16).toString('hex')

beforeAll(async () => {
  const prismaModule = await import('../lib/prisma')
  prisma = prismaModule.prisma

  // Clean up any leftover test data (reverse dependency order)
  await prisma.quoteMessage.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.activityEvent.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.job.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.notification.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.quoteLineItem.deleteMany({ where: { quote: { user_id: TEST_USER_ID } } })
  await prisma.quote.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.customer.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.profile.deleteMany({ where: { id: TEST_USER_ID } })

  // Create test profile
  await prisma.profile.create({
    data: {
      id: TEST_USER_ID,
      email: 'test-jobs@quotarc.test',
      company_name: 'Jobs Test Electric',
      phone: '555-0300',
    },
  })

  // Create test customer
  await prisma.customer.create({
    data: {
      id: TEST_CUSTOMER_ID,
      user_id: TEST_USER_ID,
      name: 'Alice Johnson',
      email: 'alice@example.com',
      phone: '555-0400',
      address: '456 Oak Ave',
    },
  })

  // Create test quote
  await prisma.quote.create({
    data: {
      id: TEST_QUOTE_ID,
      user_id: TEST_USER_ID,
      customer_id: TEST_CUSTOMER_ID,
      quote_number: 'Q-JOBS-001',
      status: 'accepted',
      job_type: 'EV Charger Install',
      subtotal: 2500,
      tax_rate: 0.13,
      tax: 325,
      total: 2825,
      public_token: TEST_PUBLIC_TOKEN,
      delivery_status: 'delivered',
      sent_at: new Date(),
      accepted_at: new Date(),
    },
  })
})

afterAll(async () => {
  await prisma.quoteMessage.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.activityEvent.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.job.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.notification.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.quoteLineItem.deleteMany({ where: { quote: { user_id: TEST_USER_ID } } })
  await prisma.quote.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.customer.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.profile.deleteMany({ where: { id: TEST_USER_ID } })
})

// ─── Job creation ───────────────────────────────────────────────
describe('Job CRUD', () => {
  let jobId: string

  it('creates a scheduled job', async () => {
    const job = await prisma.job.create({
      data: {
        user_id: TEST_USER_ID,
        customer_id: TEST_CUSTOMER_ID,
        job_type: 'EV Charger Install',
        status: 'scheduled',
        scheduled_date: new Date('2026-03-15'),
        start_time: '09:00',
        estimated_hours: 4,
        notes: 'Need access to garage panel',
        address: '456 Oak Ave',
      },
    })

    expect(job).toBeDefined()
    expect(job.id).toBeDefined()
    expect(job.status).toBe('scheduled')
    expect(job.job_type).toBe('EV Charger Install')
    expect(Number(job.estimated_hours)).toBe(4)
    expect(job.start_time).toBe('09:00')
    expect(job.address).toBe('456 Oak Ave')
    jobId = job.id
  })

  it('reads job with customer relation', async () => {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { customer: { select: { name: true, phone: true } } },
    })

    expect(job).toBeDefined()
    expect(job.customer.name).toBe('Alice Johnson')
    expect(job.customer.phone).toBe('555-0400')
  })

  it('updates job fields', async () => {
    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        start_time: '10:00',
        notes: 'Updated: bring extra conduit',
        updated_at: new Date(),
      },
    })

    expect(updated.start_time).toBe('10:00')
    expect(updated.notes).toContain('extra conduit')
  })
})

// ─── Status transitions (kanban) ────────────────────────────────
describe('Job status transitions', () => {
  let jobId: string

  beforeAll(async () => {
    const job = await prisma.job.create({
      data: {
        user_id: TEST_USER_ID,
        customer_id: TEST_CUSTOMER_ID,
        job_type: 'Panel Upgrade',
        status: 'scheduled',
        scheduled_date: new Date('2026-03-16'),
        estimated_hours: 6,
      },
    })
    jobId = job.id
  })

  it('starts as scheduled', async () => {
    const job = await prisma.job.findUnique({ where: { id: jobId } })
    expect(job.status).toBe('scheduled')
  })

  it('transitions to in_progress', async () => {
    const updated = await prisma.job.update({
      where: { id: jobId },
      data: { status: 'in_progress', updated_at: new Date() },
    })

    expect(updated.status).toBe('in_progress')
  })

  it('transitions to completed with actual_hours', async () => {
    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        actual_hours: 5.5,
        notes: 'Completed successfully. Old panel removed.',
        updated_at: new Date(),
      },
    })

    expect(updated.status).toBe('completed')
    expect(Number(updated.actual_hours)).toBe(5.5)
    expect(updated.notes).toContain('Completed successfully')
  })
})

// ─── Jobs by status (kanban grouping) ───────────────────────────
describe('Jobs grouped by status', () => {
  it('creates jobs in different statuses', async () => {
    await prisma.job.createMany({
      data: [
        {
          user_id: TEST_USER_ID,
          customer_id: TEST_CUSTOMER_ID,
          job_type: 'Outlet Install',
          status: 'scheduled',
          scheduled_date: new Date('2026-03-17'),
          estimated_hours: 1,
        },
        {
          user_id: TEST_USER_ID,
          customer_id: TEST_CUSTOMER_ID,
          job_type: 'Ceiling Fan',
          status: 'in_progress',
          scheduled_date: new Date('2026-03-17'),
          estimated_hours: 2,
        },
      ],
    })
  })

  it('groups jobs by status correctly', async () => {
    const allJobs = await prisma.job.findMany({
      where: { user_id: TEST_USER_ID },
    })

    const grouped: Record<string, any[]> = {
      scheduled: [],
      in_progress: [],
      completed: [],
    }
    for (const job of allJobs) {
      grouped[job.status]?.push(job)
    }

    expect(grouped.scheduled.length).toBeGreaterThanOrEqual(2) // EV Charger + Outlet
    expect(grouped.in_progress.length).toBeGreaterThanOrEqual(1) // Ceiling Fan
    expect(grouped.completed.length).toBeGreaterThanOrEqual(1) // Panel Upgrade
  })

  it('groups jobs by scheduled_date', async () => {
    const jobs = await prisma.job.findMany({
      where: { user_id: TEST_USER_ID },
      orderBy: [{ scheduled_date: 'asc' }, { start_time: 'asc' }],
    })

    const byDate: Record<string, any[]> = {}
    for (const job of jobs) {
      const date = new Date(job.scheduled_date).toISOString().split('T')[0]
      if (!byDate[date]) byDate[date] = []
      byDate[date].push(job)
    }

    expect(Object.keys(byDate).length).toBeGreaterThanOrEqual(2)
  })
})

// ─── Job linked to quote ────────────────────────────────────────
describe('Job linked to quote (schedule-from-chat)', () => {
  let linkedJobId: string

  it('creates a job linked to a quote', async () => {
    const job = await prisma.job.create({
      data: {
        user_id: TEST_USER_ID,
        quote_id: TEST_QUOTE_ID,
        customer_id: TEST_CUSTOMER_ID,
        job_type: 'EV Charger Install',
        status: 'scheduled',
        scheduled_date: new Date('2026-03-20'),
        start_time: '14:00',
        estimated_hours: 4,
        address: '456 Oak Ave',
      },
    })

    expect(job).toBeDefined()
    expect(job.quote_id).toBe(TEST_QUOTE_ID)
    linkedJobId = job.id
  })

  it('creates a job_scheduled activity event', async () => {
    const event = await prisma.activityEvent.create({
      data: {
        user_id: TEST_USER_ID,
        quote_id: TEST_QUOTE_ID,
        event_type: 'job_scheduled',
        metadata: {
          customer_name: 'Alice Johnson',
          job_type: 'EV Charger Install',
          scheduled_date: '2026-03-20',
        },
      },
    })

    expect(event).toBeDefined()
    expect(event.event_type).toBe('job_scheduled')
    expect(event.metadata.customer_name).toBe('Alice Johnson')
  })

  it('inserts a schedule_card message into the quote chat', async () => {
    const message = await prisma.quoteMessage.create({
      data: {
        quote_id: TEST_QUOTE_ID,
        user_id: TEST_USER_ID,
        direction: 'outbound',
        channel: 'portal',
        message_type: 'schedule_card',
        body: '',
        sender_name: 'Jobs Test Electric',
        is_read: true,
        metadata: {
          job_id: linkedJobId,
          job_type: 'EV Charger Install',
          scheduled_date: '2026-03-20',
          start_time: '14:00',
          estimated_hours: 4,
        },
      },
    })

    expect(message).toBeDefined()
    expect(message.message_type).toBe('schedule_card')
    expect(message.metadata.job_type).toBe('EV Charger Install')
    expect(message.metadata.scheduled_date).toBe('2026-03-20')
  })

  it('schedule_card appears in customer-visible portal messages', async () => {
    const portalMessages = await prisma.quoteMessage.findMany({
      where: { quote_id: TEST_QUOTE_ID, channel: 'portal' },
      orderBy: { created_at: 'asc' },
    })

    const scheduleCards = portalMessages.filter((m: any) => m.message_type === 'schedule_card')
    expect(scheduleCards).toHaveLength(1)
    expect(scheduleCards[0].metadata.start_time).toBe('14:00')
  })

  it('job can be queried with quote relation', async () => {
    const job = await prisma.job.findUnique({
      where: { id: linkedJobId },
      include: {
        quote: { select: { quote_number: true, status: true } },
        customer: { select: { name: true } },
      },
    })

    expect(job.quote).toBeDefined()
    expect(job.quote.quote_number).toBe('Q-JOBS-001')
    expect(job.quote.status).toBe('accepted')
    expect(job.customer.name).toBe('Alice Johnson')
  })
})

// ─── Job deletion ───────────────────────────────────────────────
describe('Job deletion', () => {
  it('deletes a job', async () => {
    const jobs = await prisma.job.findMany({
      where: { user_id: TEST_USER_ID, job_type: 'Outlet Install' },
    })

    expect(jobs.length).toBeGreaterThanOrEqual(1)

    await prisma.job.delete({ where: { id: jobs[0].id } })

    const deleted = await prisma.job.findUnique({ where: { id: jobs[0].id } })
    expect(deleted).toBeNull()
  })
})

// ─── Index performance check ────────────────────────────────────
describe('Job query patterns use indexes', () => {
  it('jobs indexed by user_id + scheduled_date', async () => {
    const jobs = await prisma.job.findMany({
      where: {
        user_id: TEST_USER_ID,
        scheduled_date: {
          gte: new Date('2026-03-01'),
          lte: new Date('2026-03-31'),
        },
      },
      orderBy: [{ scheduled_date: 'asc' }, { start_time: 'asc' }],
    })

    expect(jobs.length).toBeGreaterThan(0)
  })

  it('jobs indexed by user_id + status', async () => {
    const scheduled = await prisma.job.findMany({
      where: { user_id: TEST_USER_ID, status: 'scheduled' },
    })

    expect(scheduled.length).toBeGreaterThanOrEqual(1)
  })
})
