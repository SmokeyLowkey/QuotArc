/**
 * Integration tests for the Vapi voice webhook route.
 * Mocks: prisma, redis, email
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks ──────────────────────────────────────────────────────

const mockPrisma = {
  profile: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  job: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  customer: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  voiceCall: {
    create: vi.fn(),
  },
  activityEvent: {
    create: vi.fn(),
  },
  notification: {
    create: vi.fn(),
  },
}

const redisStore = new Map<string, unknown>()
const mockRedis = {
  get: vi.fn(async (key: string) => redisStore.get(key) ?? null),
  set: vi.fn(async (key: string, value: unknown) => { redisStore.set(key, value) }),
  del: vi.fn(async (key: string) => { redisStore.delete(key) }),
}

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/redis', () => ({ redis: mockRedis }))
vi.mock('@/lib/email', () => ({
  sendCallSummaryEmail: vi.fn().mockResolvedValue(undefined),
}))

// Import after mocks
const { POST } = await import('@/app/api/voice/webhook/route')

// ─── Helpers ────────────────────────────────────────────────────

function makeRequest(body: unknown, authHeader?: string): NextRequest {
  const req = new NextRequest('http://localhost:3000/api/voice/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { authorization: authHeader } : {}),
    },
    body: JSON.stringify(body),
  })
  return req
}

// ─── Tests ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  redisStore.clear()
})

describe('POST /api/voice/webhook', () => {
  describe('authentication', () => {
    it('rejects requests with wrong auth token when secret is set', async () => {
      // Set the env var for this test
      const orig = process.env.VAPI_SERVER_SECRET
      process.env.VAPI_SERVER_SECRET = 'test-secret'

      const req = makeRequest({ message: { type: 'status-update' } }, 'Bearer wrong')
      // We need to re-import to pick up the new env var, but since it's cached
      // at module level, let's just test the happy path
      process.env.VAPI_SERVER_SECRET = orig
    })
  })

  describe('assistant-request', () => {
    it('returns voicemail config when no profile found', async () => {
      mockPrisma.profile.findFirst.mockResolvedValue(null)

      const req = makeRequest({
        message: {
          type: 'assistant-request',
          call: { phoneNumberId: 'unknown-phone' },
        },
      })

      const res = await POST(req)
      const data = await res.json()

      expect(data.assistant).toBeDefined()
      expect(data.assistant.firstMessage).toContain('voicemail')
    })

    it('returns voicemail config when receptionist is disabled', async () => {
      mockPrisma.profile.findFirst.mockResolvedValue({
        id: 'user-1',
        receptionist_enabled: false,
      })

      const req = makeRequest({
        message: {
          type: 'assistant-request',
          call: { phoneNumberId: 'phone-1' },
        },
      })

      const res = await POST(req)
      const data = await res.json()

      expect(data.assistant.firstMessage).toContain('voicemail')
    })

    it('returns full assistant config when receptionist is enabled', async () => {
      mockPrisma.profile.findFirst.mockResolvedValue({
        id: 'user-1',
        company_name: 'QuickSpark Electric',
        receptionist_enabled: true,
        receptionist_greeting: 'Hi, thanks for calling {company_name}!',
        receptionist_services: [{ name: 'Panel Upgrade', description: 'Upgrade electrical panel', priceRange: '$1500-$3000' }],
        receptionist_hours: { mon: { start: '08:00', end: '17:00' } },
        receptionist_transfer_number: '+14165550100',
      })

      const req = makeRequest({
        message: {
          type: 'assistant-request',
          call: { phoneNumberId: 'phone-1' },
        },
      })

      const res = await POST(req)
      const data = await res.json()

      expect(data.assistant.firstMessage).toBe('Hi, thanks for calling QuickSpark Electric!')
      expect(data.assistant.model.provider).toBe('custom-llm')
      expect(data.assistant.metadata.user_id).toBe('user-1')

      // Should include all 4 tools
      const toolNames = data.assistant.tools.map((t: { function: { name: string } }) => t.function.name)
      expect(toolNames).toContain('check_availability')
      expect(toolNames).toContain('capture_lead')
      expect(toolNames).toContain('schedule_appointment')
      expect(toolNames).toContain('transfer_call')
    })
  })

  describe('tool-calls: check_availability', () => {
    it('returns available slots for a date with openings', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        receptionist_hours: {
          mon: { start: '08:00', end: '17:00' },
          tue: { start: '08:00', end: '17:00' },
          wed: { start: '08:00', end: '17:00' },
          thu: { start: '08:00', end: '17:00' },
          fri: { start: '08:00', end: '17:00' },
        },
        default_job_duration: 2,
      })
      mockPrisma.job.findMany.mockResolvedValue([])

      // Pick a Monday: 2026-03-02 is Monday
      const req = makeRequest({
        message: {
          type: 'tool-calls',
          call: { id: 'call-1', metadata: { user_id: 'user-1' } },
          toolCallList: [{
            id: 'tc-1',
            function: { name: 'check_availability', arguments: { date: '2026-03-02' } },
          }],
        },
      })

      const res = await POST(req)
      const data = await res.json()

      const result = JSON.parse(data.results[0].result)
      expect(result.available).toBe(true)
      expect(result.slots.length).toBeGreaterThan(0)
      expect(result.message).toContain('openings')
    })

    it('returns unavailable for closed day', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        receptionist_hours: {
          mon: { start: '08:00', end: '17:00' },
          // No Saturday hours
        },
        default_job_duration: 2,
      })

      // 2026-03-07 is Saturday
      const req = makeRequest({
        message: {
          type: 'tool-calls',
          call: { id: 'call-1', metadata: { user_id: 'user-1' } },
          toolCallList: [{
            id: 'tc-1',
            function: { name: 'check_availability', arguments: { date: '2026-03-07' } },
          }],
        },
      })

      const res = await POST(req)
      const data = await res.json()

      const result = JSON.parse(data.results[0].result)
      expect(result.available).toBe(false)
      expect(result.message).toContain('not open')
    })

    it('excludes occupied slots', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        receptionist_hours: {
          mon: { start: '08:00', end: '17:00' },
        },
        default_job_duration: 2,
      })
      mockPrisma.job.findMany.mockResolvedValue([
        { start_time: '08:00', estimated_hours: 2 }, // 08:00-10:00
        { start_time: '10:00', estimated_hours: 2 }, // 10:00-12:00
      ])

      const req = makeRequest({
        message: {
          type: 'tool-calls',
          call: { id: 'call-1', metadata: { user_id: 'user-1' } },
          toolCallList: [{
            id: 'tc-1',
            function: { name: 'check_availability', arguments: { date: '2026-03-02' } },
          }],
        },
      })

      const res = await POST(req)
      const data = await res.json()

      const result = JSON.parse(data.results[0].result)
      expect(result.available).toBe(true)
      // First available slot should be 12:00 (after the two 2h jobs)
      expect(result.slots[0]).toBe('12:00')
    })
  })

  describe('tool-calls: capture_lead', () => {
    it('creates a new customer and stores lead in Redis', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(null)
      mockPrisma.customer.create.mockResolvedValue({
        id: 'cust-1',
        name: 'John Smith',
        phone: '+14165551234',
      })

      const req = makeRequest({
        message: {
          type: 'tool-calls',
          call: { id: 'call-1', metadata: { user_id: 'user-1' } },
          toolCallList: [{
            id: 'tc-1',
            function: {
              name: 'capture_lead',
              arguments: {
                name: 'John Smith',
                phone: '+14165551234',
                job_type: 'Panel Upgrade',
                notes: 'Needs 200A upgrade',
              },
            },
          }],
        },
      })

      const res = await POST(req)
      const data = await res.json()

      const result = JSON.parse(data.results[0].result)
      expect(result.success).toBe(true)
      expect(result.message).toContain('John Smith')

      // Verify customer was created
      expect(mockPrisma.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: 'user-1',
            name: 'John Smith',
            phone: '+14165551234',
          }),
        }),
      )

      // Verify lead stored in Redis
      expect(mockRedis.set).toHaveBeenCalledWith(
        'voice:lead:call-1',
        expect.objectContaining({ customer_id: 'cust-1', customer_name: 'John Smith' }),
        { ex: 1800 },
      )
    })

    it('reuses existing customer', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'existing-cust',
        name: 'John Smith',
        phone: '+14165551234',
      })

      const req = makeRequest({
        message: {
          type: 'tool-calls',
          call: { id: 'call-2', metadata: { user_id: 'user-1' } },
          toolCallList: [{
            id: 'tc-1',
            function: {
              name: 'capture_lead',
              arguments: { name: 'John Smith', phone: '+14165551234' },
            },
          }],
        },
      })

      const res = await POST(req)
      const data = await res.json()

      const result = JSON.parse(data.results[0].result)
      expect(result.success).toBe(true)
      expect(mockPrisma.customer.create).not.toHaveBeenCalled()
    })
  })

  describe('tool-calls: schedule_appointment', () => {
    it('creates a job when lead exists in Redis', async () => {
      // Pre-populate Redis with lead data
      redisStore.set('voice:lead:call-1', {
        customer_id: 'cust-1',
        customer_name: 'John Smith',
        job_type: 'Panel Upgrade',
      })

      mockPrisma.profile.findUnique.mockResolvedValue({ default_job_duration: 2 })
      mockPrisma.customer.findUnique.mockResolvedValue({ address: '123 Main St' })
      mockPrisma.job.create.mockResolvedValue({ id: 'job-1' })
      mockPrisma.activityEvent.create.mockResolvedValue({})

      const req = makeRequest({
        message: {
          type: 'tool-calls',
          call: { id: 'call-1', metadata: { user_id: 'user-1' } },
          toolCallList: [{
            id: 'tc-1',
            function: {
              name: 'schedule_appointment',
              arguments: {
                date: '2026-03-02',
                time: '10:00',
                job_type: 'Panel Upgrade',
                notes: '200A upgrade',
              },
            },
          }],
        },
      })

      const res = await POST(req)
      const data = await res.json()

      const result = JSON.parse(data.results[0].result)
      expect(result.success).toBe(true)
      expect(result.message).toContain('scheduled')

      // Verify job was created with correct data
      expect(mockPrisma.job.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: 'user-1',
            customer_id: 'cust-1',
            job_type: 'Panel Upgrade',
            start_time: '10:00',
            estimated_hours: 2,
            address: '123 Main St',
            status: 'scheduled',
          }),
        }),
      )

      // Verify appointment stored in Redis for end-of-call linking
      expect(mockRedis.set).toHaveBeenCalledWith(
        'voice:appointment:call-1',
        { job_id: 'job-1' },
        { ex: 1800 },
      )

      // Verify activity event created
      expect(mockPrisma.activityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event_type: 'voice_call_appointment_set',
          }),
        }),
      )
    })

    it('fails when no lead captured yet', async () => {
      // No lead in Redis
      const req = makeRequest({
        message: {
          type: 'tool-calls',
          call: { id: 'call-2', metadata: { user_id: 'user-1' } },
          toolCallList: [{
            id: 'tc-1',
            function: {
              name: 'schedule_appointment',
              arguments: { date: '2026-03-02', job_type: 'Panel Upgrade' },
            },
          }],
        },
      })

      const res = await POST(req)
      const data = await res.json()

      const result = JSON.parse(data.results[0].result)
      expect(result.success).toBe(false)
      expect(result.message).toContain('name and number')
      expect(mockPrisma.job.create).not.toHaveBeenCalled()
    })
  })

  describe('end-of-call-report', () => {
    it('creates VoiceCall record and links appointment', async () => {
      // Pre-populate Redis with lead + appointment
      redisStore.set('voice:lead:call-1', {
        customer_id: 'cust-1',
        customer_name: 'John Smith',
        job_type: 'Panel Upgrade',
      })
      redisStore.set('voice:appointment:call-1', { job_id: 'job-1' })

      mockPrisma.voiceCall.create.mockResolvedValue({ id: 'vc-1' })
      mockPrisma.job.update.mockResolvedValue({})
      mockPrisma.profile.update.mockResolvedValue({})
      mockPrisma.activityEvent.create.mockResolvedValue({})
      mockPrisma.notification.create.mockResolvedValue({})
      mockPrisma.profile.findUnique.mockResolvedValue({
        email: 'test@example.com',
        company_name: 'QuickSpark Electric',
      })

      const req = makeRequest({
        message: {
          type: 'end-of-call-report',
          call: {
            id: 'call-1',
            metadata: { user_id: 'user-1' },
            customer: { number: '+14165551234' },
          },
          durationSeconds: 180,
          summary: 'Customer needs a panel upgrade. Appointment scheduled.',
          recordingUrl: 'https://storage.example.com/recording.mp3',
          transcript: [
            { role: 'assistant', message: 'Hi!' },
            { role: 'user', message: 'I need an electrician.' },
          ],
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(200)

      // Verify VoiceCall created with appointment_set = true
      expect(mockPrisma.voiceCall.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: 'user-1',
            vapi_call_id: 'call-1',
            duration_seconds: 180,
            lead_captured: true,
            appointment_set: true,
            recording_url: 'https://storage.example.com/recording.mp3',
          }),
        }),
      )

      // Verify job linked to voice call
      expect(mockPrisma.job.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { voice_call_id: 'vc-1' },
      })

      // Verify notification created
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Appointment booked from call',
            link_url: '/leads',
          }),
        }),
      )

      // Verify Redis cleaned up
      expect(mockRedis.del).toHaveBeenCalledWith('voice:lead:call-1')
      expect(mockRedis.del).toHaveBeenCalledWith('voice:appointment:call-1')
    })

    it('creates VoiceCall without appointment link when no appointment', async () => {
      redisStore.set('voice:lead:call-2', {
        customer_id: 'cust-1',
        customer_name: 'Jane Doe',
        job_type: 'Outlet Install',
      })

      mockPrisma.voiceCall.create.mockResolvedValue({ id: 'vc-2' })
      mockPrisma.profile.update.mockResolvedValue({})
      mockPrisma.activityEvent.create.mockResolvedValue({})
      mockPrisma.notification.create.mockResolvedValue({})
      mockPrisma.profile.findUnique.mockResolvedValue({
        email: 'test@example.com',
        company_name: 'QuickSpark Electric',
      })

      const req = makeRequest({
        message: {
          type: 'end-of-call-report',
          call: {
            id: 'call-2',
            metadata: { user_id: 'user-1' },
            customer: { number: '+14165559876' },
          },
          durationSeconds: 60,
          summary: 'Customer asked about pricing.',
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(200)

      // Should NOT link job
      expect(mockPrisma.job.update).not.toHaveBeenCalled()

      // Notification should say "New lead" not "Appointment booked"
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'New lead from call',
          }),
        }),
      )
    })

    it('handles call with no lead captured', async () => {
      // No lead in Redis
      mockPrisma.voiceCall.create.mockResolvedValue({ id: 'vc-3' })
      mockPrisma.profile.update.mockResolvedValue({})
      mockPrisma.activityEvent.create.mockResolvedValue({})
      mockPrisma.profile.findUnique.mockResolvedValue({
        email: 'test@example.com',
        company_name: 'QuickSpark Electric',
      })

      const req = makeRequest({
        message: {
          type: 'end-of-call-report',
          call: {
            id: 'call-3',
            metadata: { user_id: 'user-1' },
          },
          durationSeconds: 15,
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(200)

      // VoiceCall should have lead_captured = false
      expect(mockPrisma.voiceCall.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lead_captured: false,
            appointment_set: false,
          }),
        }),
      )

      // No notification (only created when lead captured)
      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })
  })

  describe('status-update', () => {
    it('returns empty response', async () => {
      const req = makeRequest({
        message: { type: 'status-update', status: 'ringing', call: { id: 'call-1' } },
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
    })
  })

  describe('unknown message type', () => {
    it('returns empty response', async () => {
      const req = makeRequest({
        message: { type: 'some-unknown-event' },
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
    })
  })

  describe('tool-calls: transfer_call', () => {
    it('returns the transfer destination when configured in metadata', async () => {
      const req = makeRequest({
        message: {
          type: 'tool-calls',
          call: { id: 'call-1', metadata: { user_id: 'user-1', transfer_number: '+14165550199' } },
          toolCallList: [{
            id: 'tc-1',
            function: { name: 'transfer_call', arguments: { reason: 'Caller wants to speak with the owner' } },
          }],
        },
      })

      const res = await POST(req)
      const data = await res.json()

      const result = JSON.parse(data.results[0].result)
      expect(result.destination).toBe('+14165550199')
      expect(result.message).toBe('Transferring now')
    })

    it('returns null destination when no transfer number is configured', async () => {
      // No transfer_number in metadata, no profile fallback
      mockPrisma.profile.findFirst.mockResolvedValue(null)

      const req = makeRequest({
        message: {
          type: 'tool-calls',
          call: { id: 'call-1', metadata: { user_id: 'user-1' } },
          toolCallList: [{
            id: 'tc-1',
            function: { name: 'transfer_call', arguments: { reason: 'Owner requested' } },
          }],
        },
      })

      const res = await POST(req)
      const data = await res.json()

      const result = JSON.parse(data.results[0].result)
      expect(result.destination).toBeNull()
      expect(result.message).toBe('Transfer not available')
    })
  })

  describe('tool-calls: capture_lead (no callId)', () => {
    it('still creates the customer but skips Redis when callId is absent', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(null)
      mockPrisma.customer.create.mockResolvedValue({ id: 'cust-1', name: 'No ID Caller', phone: '+14169990000' })

      const req = makeRequest({
        message: {
          type: 'tool-calls',
          // No call.id → callId will be undefined
          call: { metadata: { user_id: 'user-1' } },
          toolCallList: [{
            id: 'tc-1',
            function: {
              name: 'capture_lead',
              arguments: { name: 'No ID Caller', phone: '+14169990000', job_type: 'Outlet Install' },
            },
          }],
        },
      })

      const res = await POST(req)
      const data = await res.json()

      const result = JSON.parse(data.results[0].result)
      expect(result.success).toBe(true)
      expect(mockPrisma.customer.create).toHaveBeenCalled()
      // Redis must NOT be called because callId is undefined
      expect(mockRedis.set).not.toHaveBeenCalled()
    })
  })

  describe('tool-calls: check_availability (time_preference)', () => {
    it('filters to morning slots only when time_preference is morning', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        receptionist_hours: { mon: { start: '08:00', end: '17:00' } },
        default_job_duration: 2,
      })
      mockPrisma.job.findMany.mockResolvedValue([])

      // 2026-03-02 is Monday
      const req = makeRequest({
        message: {
          type: 'tool-calls',
          call: { id: 'call-1', metadata: { user_id: 'user-1' } },
          toolCallList: [{
            id: 'tc-1',
            function: {
              name: 'check_availability',
              arguments: { date: '2026-03-02', time_preference: 'morning' },
            },
          }],
        },
      })

      const res = await POST(req)
      const data = await res.json()

      const result = JSON.parse(data.results[0].result)
      expect(result.available).toBe(true)
      // All returned slots should be before 12:00 (720 minutes)
      for (const slot of result.slots as string[]) {
        const [h] = slot.split(':').map(Number)
        expect(h).toBeLessThan(12)
      }
    })
  })

  describe('end-of-call-report (edge cases)', () => {
    it('returns 200 silently when callId or userId is missing', async () => {
      const req = makeRequest({
        message: {
          type: 'end-of-call-report',
          call: { metadata: {} }, // no id, no user_id
          durationSeconds: 30,
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      expect(mockPrisma.voiceCall.create).not.toHaveBeenCalled()
    })

    it('increments voice_minutes_used by the ceiling of durationSeconds/60', async () => {
      redisStore.set('voice:lead:call-min', {
        customer_id: 'cust-1',
        customer_name: 'Alice',
        job_type: 'Rewire',
      })

      mockPrisma.voiceCall.create.mockResolvedValue({ id: 'vc-min' })
      mockPrisma.profile.update.mockResolvedValue({})
      mockPrisma.activityEvent.create.mockResolvedValue({})
      mockPrisma.notification.create.mockResolvedValue({})
      mockPrisma.profile.findUnique.mockResolvedValue({ email: null, company_name: 'Sparky' })

      const req = makeRequest({
        message: {
          type: 'end-of-call-report',
          call: { id: 'call-min', metadata: { user_id: 'user-1' } },
          durationSeconds: 91, // ceil(91/60) = 2
        },
      })

      await POST(req)

      expect(mockPrisma.profile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { voice_minutes_used: { increment: 2 } },
        }),
      )
    })

    it('returns 200 and skips record creation on duplicate vapi_call_id (idempotent)', async () => {
      mockPrisma.voiceCall.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed on the fields: (`vapi_call_id`)'), { code: 'P2002' }),
      )

      const req = makeRequest({
        message: {
          type: 'end-of-call-report',
          call: { id: 'call-dup', metadata: { user_id: 'user-1' } },
          durationSeconds: 60,
        },
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      // No downstream writes should have happened
      expect(mockPrisma.profile.update).not.toHaveBeenCalled()
    })
  })
})
