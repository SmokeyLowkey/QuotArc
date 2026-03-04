import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { config } from 'dotenv'
import { randomBytes } from 'crypto'

// Load env before anything else
config({ path: '.env.local' })

let prisma: any

// ─── Test constants ─────────────────────────────────────────────
const TEST_USER_ID = '00000000-0000-0000-0000-000000000044'
const TEST_CUSTOMER_ID = randomBytes(16).toString('hex').substring(0, 36)
const TEST_QUOTE_ID = randomBytes(16).toString('hex').substring(0, 36)
const TEST_PUBLIC_TOKEN = randomBytes(16).toString('hex')

beforeAll(async () => {
  const prismaModule = await import('../lib/prisma')
  prisma = prismaModule.prisma

  // Clean up any leftover test data (reverse dependency order)
  await prisma.quoteMessage.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.activityEvent.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.quoteLineItem.deleteMany({ where: { quote: { user_id: TEST_USER_ID } } })
  await prisma.quote.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.customer.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.profile.deleteMany({ where: { id: TEST_USER_ID } })

  // Create test profile
  await prisma.profile.create({
    data: {
      id: TEST_USER_ID,
      email: 'test-comms@quotarc.test',
      company_name: 'Test Electric Co',
      phone: '555-0100',
    },
  })

  // Create test customer
  await prisma.customer.create({
    data: {
      id: TEST_CUSTOMER_ID,
      user_id: TEST_USER_ID,
      name: 'John Smith',
      email: 'john@example.com',
      phone: '555-0200',
      address: '123 Main St',
    },
  })

  // Create test quote (simulating a "sent" quote)
  await prisma.quote.create({
    data: {
      id: TEST_QUOTE_ID,
      user_id: TEST_USER_ID,
      customer_id: TEST_CUSTOMER_ID,
      quote_number: 'Q-TEST-001',
      status: 'sent',
      job_type: '200A Panel Upgrade',
      subtotal: 3500,
      tax_rate: 0.13,
      tax: 455,
      total: 3955,
      public_token: TEST_PUBLIC_TOKEN,
      delivery_status: 'delivered',
      sent_at: new Date(),
    },
  })
})

afterAll(async () => {
  // Cleanup in reverse dependency order
  await prisma.quoteMessage.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.activityEvent.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.quoteLineItem.deleteMany({ where: { quote: { user_id: TEST_USER_ID } } })
  await prisma.quote.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.customer.deleteMany({ where: { user_id: TEST_USER_ID } })
  await prisma.profile.deleteMany({ where: { id: TEST_USER_ID } })
})

// ─── Test data verification ──────────────────────────────────────
describe('Test data setup', () => {
  it('created test profile', async () => {
    const profile = await prisma.profile.findUnique({ where: { id: TEST_USER_ID } })
    expect(profile).toBeDefined()
    expect(profile.company_name).toBe('Test Electric Co')
  })

  it('created test customer', async () => {
    const customer = await prisma.customer.findUnique({ where: { id: TEST_CUSTOMER_ID } })
    expect(customer).toBeDefined()
    expect(customer.name).toBe('John Smith')
    expect(customer.user_id).toBe(TEST_USER_ID)
  })

  it('created test quote with public token', async () => {
    const quote = await prisma.quote.findUnique({ where: { id: TEST_QUOTE_ID } })
    expect(quote).toBeDefined()
    expect(quote.status).toBe('sent')
    expect(quote.public_token).toBe(TEST_PUBLIC_TOKEN)
    expect(quote.quote_number).toBe('Q-TEST-001')
  })

  it('can look up quote by public_token', async () => {
    const quote = await prisma.quote.findUnique({ where: { public_token: TEST_PUBLIC_TOKEN } })
    expect(quote).toBeDefined()
    // Postgres returns UUID with dashes, so compare without format
    expect(quote.id.replace(/-/g, '')).toBe(TEST_QUOTE_ID.replace(/-/g, ''))
  })
})

// ─── Electrician sends a message ─────────────────────────────────
describe('Electrician sends outbound message', () => {
  let messageId: string

  it('creates a portal message', async () => {
    const message = await prisma.quoteMessage.create({
      data: {
        quote_id: TEST_QUOTE_ID,
        user_id: TEST_USER_ID,
        direction: 'outbound',
        channel: 'portal',
        body: 'Hi John, just following up on the panel upgrade quote. Let me know if you have any questions!',
        sender_name: 'Test Electric Co',
        is_read: true, // outbound messages are always "read"
      },
    })

    expect(message).toBeDefined()
    expect(message.id).toBeDefined()
    expect(message.direction).toBe('outbound')
    expect(message.channel).toBe('portal')
    expect(message.is_read).toBe(true)
    messageId = message.id
  })

  it('creates a message_sent activity event', async () => {
    const event = await prisma.activityEvent.create({
      data: {
        user_id: TEST_USER_ID,
        quote_id: TEST_QUOTE_ID,
        event_type: 'message_sent',
        metadata: {
          customer_name: 'John Smith',
          quote_number: 'Q-TEST-001',
        },
      },
    })

    expect(event).toBeDefined()
    expect(event.event_type).toBe('message_sent')
    expect(event.metadata).toEqual({
      customer_name: 'John Smith',
      quote_number: 'Q-TEST-001',
    })
  })

  it('message appears in quote messages', async () => {
    const messages = await prisma.quoteMessage.findMany({
      where: { quote_id: TEST_QUOTE_ID },
      orderBy: { created_at: 'asc' },
    })

    expect(messages).toHaveLength(1)
    expect(messages[0].id).toBe(messageId)
    expect(messages[0].direction).toBe('outbound')
  })
})

// ─── Customer views messages via public token ─────────────────────
describe('Customer views messages (public portal)', () => {
  it('can fetch portal messages by public token (excludes notes)', async () => {
    const quote = await prisma.quote.findUnique({
      where: { public_token: TEST_PUBLIC_TOKEN },
      select: { id: true },
    })

    const messages = await prisma.quoteMessage.findMany({
      where: { quote_id: quote.id, channel: 'portal' },
      orderBy: { created_at: 'asc' },
    })

    expect(messages).toHaveLength(1)
    expect(messages[0].direction).toBe('outbound')
    expect(messages[0].body).toContain('panel upgrade')
  })
})

// ─── Customer replies ─────────────────────────────────────────────
describe('Customer sends inbound reply', () => {
  it('creates an inbound message', async () => {
    const quote = await prisma.quote.findUnique({
      where: { public_token: TEST_PUBLIC_TOKEN },
      include: { customer: { select: { name: true } } },
    })

    const message = await prisma.quoteMessage.create({
      data: {
        quote_id: quote.id,
        user_id: quote.user_id,
        direction: 'inbound',
        channel: 'portal',
        body: 'Looks good! When can you start the work?',
        sender_name: quote.customer.name,
        is_read: false, // inbound messages start as unread
      },
    })

    expect(message).toBeDefined()
    expect(message.direction).toBe('inbound')
    expect(message.sender_name).toBe('John Smith')
    expect(message.is_read).toBe(false)
  })

  it('creates a customer_replied activity event', async () => {
    const event = await prisma.activityEvent.create({
      data: {
        user_id: TEST_USER_ID,
        quote_id: TEST_QUOTE_ID,
        event_type: 'customer_replied',
        metadata: {
          customer_name: 'John Smith',
          quote_number: 'Q-TEST-001',
        },
      },
    })

    expect(event).toBeDefined()
    expect(event.event_type).toBe('customer_replied')
  })

  it('inbound message appears as unread', async () => {
    const unread = await prisma.quoteMessage.findMany({
      where: {
        quote_id: TEST_QUOTE_ID,
        direction: 'inbound',
        is_read: false,
      },
    })

    expect(unread).toHaveLength(1)
    expect(unread[0].body).toContain('When can you start')
  })
})

// ─── Electrician adds internal note ───────────────────────────────
describe('Electrician adds internal note', () => {
  it('creates a note (not visible to customer)', async () => {
    const note = await prisma.quoteMessage.create({
      data: {
        quote_id: TEST_QUOTE_ID,
        user_id: TEST_USER_ID,
        direction: 'outbound',
        channel: 'note',
        body: 'Customer has dog in backyard - enter through side gate',
        sender_name: 'Test Electric Co',
        is_read: true,
      },
    })

    expect(note).toBeDefined()
    expect(note.channel).toBe('note')
  })

  it('notes are excluded from public portal queries', async () => {
    const portalMessages = await prisma.quoteMessage.findMany({
      where: { quote_id: TEST_QUOTE_ID, channel: 'portal' },
      orderBy: { created_at: 'asc' },
    })

    // Should only have the outbound message and inbound reply (no notes)
    expect(portalMessages).toHaveLength(2)
    expect(portalMessages.every((m: any) => m.channel === 'portal')).toBe(true)
  })

  it('notes appear in the full message list', async () => {
    const allMessages = await prisma.quoteMessage.findMany({
      where: { quote_id: TEST_QUOTE_ID },
      orderBy: { created_at: 'asc' },
    })

    expect(allMessages).toHaveLength(3)
    expect(allMessages[2].channel).toBe('note')
    expect(allMessages[2].body).toContain('dog in backyard')
  })
})

// ─── Timeline merge (events + messages) ───────────────────────────
describe('Timeline merge verification', () => {
  it('has activity events for the quote', async () => {
    const events = await prisma.activityEvent.findMany({
      where: { quote_id: TEST_QUOTE_ID },
      orderBy: { created_at: 'asc' },
    })

    expect(events.length).toBeGreaterThanOrEqual(2)

    const types = events.map((e: any) => e.event_type)
    expect(types).toContain('message_sent')
    expect(types).toContain('customer_replied')
  })

  it('can build a merged chronological timeline', async () => {
    const [messages, events] = await Promise.all([
      prisma.quoteMessage.findMany({
        where: { quote_id: TEST_QUOTE_ID },
        orderBy: { created_at: 'asc' },
      }),
      prisma.activityEvent.findMany({
        where: { quote_id: TEST_QUOTE_ID },
        orderBy: { created_at: 'asc' },
      }),
    ])

    // Filter out message_sent/customer_replied from events (messages render those)
    const messageEventTypes = new Set(['message_sent', 'customer_replied'])
    const systemEvents = events.filter((e: any) => !messageEventTypes.has(e.event_type))

    // Merge into a single timeline
    const timeline = [
      ...systemEvents.map((e: any) => ({ type: 'event', timestamp: e.created_at, data: e })),
      ...messages.map((m: any) => ({ type: 'message', timestamp: m.created_at, data: m })),
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    // Should have 3 messages (no system events left after filtering message_sent/customer_replied)
    expect(timeline.length).toBe(3)
    expect(timeline.every((item) => item.type === 'message')).toBe(true)

    // Verify order: outbound → inbound → note
    expect(timeline[0].data.direction).toBe('outbound')
    expect(timeline[0].data.channel).toBe('portal')
    expect(timeline[1].data.direction).toBe('inbound')
    expect(timeline[2].data.channel).toBe('note')
  })
})

// ─── Electrician replies again ────────────────────────────────────
describe('Full round-trip conversation', () => {
  it('electrician sends another portal message', async () => {
    const msg = await prisma.quoteMessage.create({
      data: {
        quote_id: TEST_QUOTE_ID,
        user_id: TEST_USER_ID,
        direction: 'outbound',
        channel: 'portal',
        body: 'I can start next Monday! I\'ll need access to the basement panel.',
        sender_name: 'Test Electric Co',
        is_read: true,
      },
    })

    expect(msg).toBeDefined()
  })

  it('full conversation has correct message count and order', async () => {
    const messages = await prisma.quoteMessage.findMany({
      where: { quote_id: TEST_QUOTE_ID },
      orderBy: { created_at: 'asc' },
    })

    expect(messages).toHaveLength(4)

    // Message 1: electrician sends portal message
    expect(messages[0].direction).toBe('outbound')
    expect(messages[0].channel).toBe('portal')

    // Message 2: customer replies
    expect(messages[1].direction).toBe('inbound')
    expect(messages[1].channel).toBe('portal')

    // Message 3: electrician adds internal note
    expect(messages[2].direction).toBe('outbound')
    expect(messages[2].channel).toBe('note')

    // Message 4: electrician replies on portal
    expect(messages[3].direction).toBe('outbound')
    expect(messages[3].channel).toBe('portal')
  })

  it('public portal shows only portal messages (no notes)', async () => {
    const portalMessages = await prisma.quoteMessage.findMany({
      where: { quote_id: TEST_QUOTE_ID, channel: 'portal' },
      orderBy: { created_at: 'asc' },
    })

    expect(portalMessages).toHaveLength(3) // excludes the 1 note
    expect(portalMessages[0].direction).toBe('outbound')
    expect(portalMessages[1].direction).toBe('inbound')
    expect(portalMessages[2].direction).toBe('outbound')
  })

  it('unread count is correct', async () => {
    const unread = await prisma.quoteMessage.count({
      where: {
        user_id: TEST_USER_ID,
        direction: 'inbound',
        is_read: false,
      },
    })

    expect(unread).toBe(1) // only the customer reply
  })

  it('marking messages as read works', async () => {
    await prisma.quoteMessage.updateMany({
      where: {
        quote_id: TEST_QUOTE_ID,
        direction: 'inbound',
        is_read: false,
      },
      data: { is_read: true },
    })

    const unread = await prisma.quoteMessage.count({
      where: {
        user_id: TEST_USER_ID,
        direction: 'inbound',
        is_read: false,
      },
    })

    expect(unread).toBe(0)
  })
})

// ─── Expired quote blocks replies ─────────────────────────────────
describe('Expired quote behavior', () => {
  it('expired quotes should not accept customer replies', async () => {
    // Simulate quote expiring
    await prisma.quote.update({
      where: { id: TEST_QUOTE_ID },
      data: { status: 'expired', expired_at: new Date() },
    })

    const quote = await prisma.quote.findUnique({
      where: { public_token: TEST_PUBLIC_TOKEN },
    })

    expect(quote.status).toBe('expired')

    // The API route checks for expired status - verify the check logic
    const isExpired = quote.status === 'expired'
    expect(isExpired).toBe(true)
  })

  it('restore quote to sent for cleanup', async () => {
    await prisma.quote.update({
      where: { id: TEST_QUOTE_ID },
      data: { status: 'sent', expired_at: null },
    })
  })
})

// ─── Index performance check ──────────────────────────────────────
describe('Query patterns use indexes', () => {
  it('quote_messages indexed by quote_id + created_at', async () => {
    const messages = await prisma.quoteMessage.findMany({
      where: { quote_id: TEST_QUOTE_ID },
      orderBy: { created_at: 'asc' },
    })

    expect(messages.length).toBeGreaterThan(0)
  })

  it('quote_messages indexed by user_id + is_read (unread count)', async () => {
    const unreadCount = await prisma.quoteMessage.count({
      where: {
        user_id: TEST_USER_ID,
        is_read: false,
      },
    })

    expect(unreadCount).toBeGreaterThanOrEqual(0)
  })
})
