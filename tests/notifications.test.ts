import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { config } from 'dotenv'

// Load env before anything else
config({ path: '.env.local' })

let prisma: any

// ─── Test constants ─────────────────────────────────────────────
const TEST_USER_ID = '00000000-0000-0000-0000-000000000077'

beforeAll(async () => {
  const prismaModule = await import('../lib/prisma')
  prisma = prismaModule.prisma

  // Clean up any leftover test data
  await prisma.notification.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.profile.deleteMany({ where: { id: TEST_USER_ID } })

  // Create test profile
  await prisma.profile.create({
    data: {
      id: TEST_USER_ID,
      email: 'test-notif@quotarc.test',
      company_name: 'Notif Test Electric',
    },
  })
})

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.profile.deleteMany({ where: { id: TEST_USER_ID } })
})

// ─── Notification creation ──────────────────────────────────────
describe('Notification CRUD', () => {
  let notifId: string

  it('creates a quote_viewed notification', async () => {
    const notif = await prisma.notification.create({
      data: {
        user_id: TEST_USER_ID,
        type: 'quote_viewed',
        title: 'Quote viewed',
        body: 'John Smith viewed Q-001',
        link_url: '/quotes/some-id',
        metadata: { customer_name: 'John Smith', quote_number: 'Q-001' },
      },
    })

    expect(notif).toBeDefined()
    expect(notif.id).toBeDefined()
    expect(notif.type).toBe('quote_viewed')
    expect(notif.is_read).toBe(false)
    expect(notif.read_at).toBeNull()
    notifId = notif.id
  })

  it('creates multiple notification types', async () => {
    await prisma.notification.createMany({
      data: [
        {
          user_id: TEST_USER_ID,
          type: 'quote_accepted',
          title: 'Quote accepted',
          body: 'Jane Doe accepted Q-002',
          link_url: '/quotes/another-id',
        },
        {
          user_id: TEST_USER_ID,
          type: 'customer_replied',
          title: 'New reply',
          body: 'Bob replied on Q-003',
          link_url: '/quotes/third-id',
        },
        {
          user_id: TEST_USER_ID,
          type: 'invoice_paid',
          title: 'Invoice paid',
          body: 'INV-001 was paid',
          link_url: '/invoices/inv-id',
        },
      ],
    })

    const count = await prisma.notification.count({ where: { user_id: TEST_USER_ID } })
    expect(count).toBe(4)
  })
})

// ─── Querying ───────────────────────────────────────────────────
describe('Notification queries', () => {
  it('fetches notifications ordered by created_at desc', async () => {
    const notifs = await prisma.notification.findMany({
      where: { user_id: TEST_USER_ID },
      orderBy: { created_at: 'desc' },
    })

    expect(notifs).toHaveLength(4)
    // Most recent first
    for (let i = 1; i < notifs.length; i++) {
      expect(new Date(notifs[i - 1].created_at).getTime())
        .toBeGreaterThanOrEqual(new Date(notifs[i].created_at).getTime())
    }
  })

  it('counts unread notifications', async () => {
    const unreadCount = await prisma.notification.count({
      where: { user_id: TEST_USER_ID, is_read: false },
    })

    expect(unreadCount).toBe(4) // all unread initially
  })

  it('filters by type', async () => {
    const quoteNotifs = await prisma.notification.findMany({
      where: { user_id: TEST_USER_ID, type: 'quote_viewed' },
    })

    expect(quoteNotifs).toHaveLength(1)
    expect(quoteNotifs[0].title).toBe('Quote viewed')
  })
})

// ─── Mark as read ───────────────────────────────────────────────
describe('Mark notifications as read', () => {
  it('marks a single notification as read', async () => {
    const first = await prisma.notification.findFirst({
      where: { user_id: TEST_USER_ID, type: 'quote_viewed' },
    })

    const updated = await prisma.notification.update({
      where: { id: first.id },
      data: { is_read: true, read_at: new Date() },
    })

    expect(updated.is_read).toBe(true)
    expect(updated.read_at).toBeDefined()
  })

  it('unread count decreases after marking read', async () => {
    const unreadCount = await prisma.notification.count({
      where: { user_id: TEST_USER_ID, is_read: false },
    })

    expect(unreadCount).toBe(3) // 4 - 1 = 3
  })

  it('marks all notifications as read', async () => {
    await prisma.notification.updateMany({
      where: { user_id: TEST_USER_ID, is_read: false },
      data: { is_read: true, read_at: new Date() },
    })

    const unreadCount = await prisma.notification.count({
      where: { user_id: TEST_USER_ID, is_read: false },
    })

    expect(unreadCount).toBe(0)
  })
})

// ─── Cascade delete ─────────────────────────────────────────────
describe('Notification cascade', () => {
  it('notifications are deleted when profile is deleted', async () => {
    // Verify notifications exist
    const before = await prisma.notification.count({ where: { user_id: TEST_USER_ID } })
    expect(before).toBe(4)

    // Delete profile (should cascade)
    await prisma.profile.delete({ where: { id: TEST_USER_ID } })

    const after = await prisma.notification.count({ where: { user_id: TEST_USER_ID } })
    expect(after).toBe(0)
  })

  it('cleanup: recreate profile for afterAll', async () => {
    // afterAll will try to clean up, so recreate a profile to avoid errors
    await prisma.profile.create({
      data: {
        id: TEST_USER_ID,
        email: 'test-notif@quotarc.test',
        company_name: 'Notif Test Electric',
      },
    })
  })
})
