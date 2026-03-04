'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Phone,
  Power,
  MessageSquare,
  Clock,
  Wrench,
  PhoneForwarded,
  Send,
  RotateCw,
  Loader2,
  ArrowLeft,
  CalendarOff,
  FileText,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useUser } from '@/hooks/use-user'
import { PLANS, type PlanTier } from '@/lib/plans'
import type { ReceptionistService } from '@/lib/types'

// ─── Config type ────────────────────────────────────────────────

interface ReceptionistConfig {
  receptionist_services: ReceptionistService[]
  receptionist_hours: Record<string, { start: string; end: string }>
  receptionist_greeting: string | null
  receptionist_transfer_number: string | null
  receptionist_date_overrides: Record<string, 'closed'>
  receptionist_instructions: string | null
  receptionist_enabled: boolean
}

export default function ReceptionistSettingsPage() {
  const { profile, loading, updateProfile } = useUser()
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (profile) {
      setEnabled(profile.receptionist_enabled ?? false)
    }
  }, [profile])

  const tier = (profile?.plan_tier as PlanTier) ?? 'free'
  const plan = PLANS[tier]
  const hasAccess = plan.features.aiReceptionist
  const voiceUsed = profile?.voice_minutes_used ?? 0

  async function handleToggle() {
    const next = !enabled
    setEnabled(next)
    try {
      await updateProfile({ receptionist_enabled: next })
    } catch {
      setEnabled(!next)
      toast.error('Failed to update')
    }
  }

  if (loading) {
    return (
      <div className="px-4 md:px-6 py-4 md:py-6">
        <div className="h-8 w-48 bg-sf-surface-2 animate-pulse rounded mb-6" />
        <div className="max-w-[640px] space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-sf-surface-2 animate-pulse rounded-[6px]" />)}
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="px-4 md:px-6 py-4 md:py-6">
        <BackLink />
        <div className="max-w-[640px] mt-8 text-center">
          <Phone size={40} className="mx-auto text-sf-text-tertiary mb-4" />
          <h2 className="font-heading text-[16px] font-semibold text-sf-text-primary mb-2">AI Receptionist</h2>
          <p className="text-[13px] text-sf-text-secondary mb-4">
            Let AI answer your calls, capture leads, and schedule appointments. Available on Pro and Business plans.
          </p>
          <Link
            href="/settings#billing"
            className="inline-block h-9 px-4 rounded-[4px] bg-sf-accent hover:bg-sf-accent-hover text-white text-[13px] font-medium transition-colors leading-9"
          >
            Upgrade to Pro — $129/mo
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 md:px-6 py-4 md:py-6">
      <BackLink />
      <h1 className="font-heading text-[18px] font-semibold tracking-tight text-sf-text-primary mb-6">
        AI Receptionist
      </h1>

      <div className="flex flex-col gap-6 max-w-[960px]">
        {/* Enable toggle */}
        <div className="flex items-center justify-between px-3 py-3 border border-sf-border rounded-[4px] bg-sf-surface-1">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[4px] bg-sf-accent/10 flex items-center justify-center">
              <Power size={14} className="text-sf-accent" />
            </div>
            <div>
              <div className="text-[13px] font-medium text-sf-text-primary">
                {enabled ? 'Receptionist Active' : 'Receptionist Disabled'}
              </div>
              <div className="text-[11px] text-sf-text-tertiary">
                {profile?.vapi_phone_number
                  ? profile.vapi_phone_number
                  : profile?.vapi_phone_number_id
                    ? 'Phone number provisioned'
                    : 'No phone number yet'}
              </div>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={handleToggle}
            className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${enabled ? 'bg-sf-accent' : 'bg-sf-surface-2 border border-sf-border'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Phone number */}
        {profile?.vapi_phone_number_id ? (
          <div className="flex items-center gap-3 px-3 py-3 border border-sf-border rounded-[4px] bg-sf-surface-1">
            <div className="w-8 h-8 rounded-[4px] bg-emerald-500/10 flex items-center justify-center">
              <Phone size={14} className="text-emerald-500" />
            </div>
            <div>
              <div className="text-[13px] font-medium text-sf-text-primary font-mono">
                {profile.vapi_phone_number ?? 'Number provisioned'}
              </div>
              <div className="text-[11px] text-sf-text-tertiary">
                Your AI receptionist answers this number
              </div>
            </div>
          </div>
        ) : (
          <ProvisionPhoneNumber />
        )}

        {/* Usage meter */}
        {plan.voiceMinutes > 0 && (
          <div className="px-3 py-2.5 border border-sf-border rounded-[4px] bg-sf-surface-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary">
                Minutes Used
              </span>
              <span className="text-[12px] font-mono text-sf-text-secondary">
                {voiceUsed} / {plan.voiceMinutes} min
              </span>
            </div>
            <div className="h-2 rounded-full bg-sf-surface-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-sf-accent transition-all duration-300"
                style={{ width: `${Math.min((voiceUsed / plan.voiceMinutes) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Persistent assistant chat + config panel */}
        <AssistantChat />
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────

function BackLink() {
  return (
    <Link
      href="/settings"
      className="inline-flex items-center gap-1 text-[12px] text-sf-text-secondary hover:text-sf-text-primary transition-colors mb-4"
    >
      <ArrowLeft size={12} /> Back to Settings
    </Link>
  )
}

function ProvisionPhoneNumber() {
  const [provisioning, setProvisioning] = useState(false)
  const [areaCode, setAreaCode] = useState('')

  async function handleProvision() {
    setProvisioning(true)
    try {
      const res = await fetch('/api/voice/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(areaCode.trim() && { areaCode: areaCode.trim() }),
        }),
      })
      const data = await res.json()
      if (data.phone_number_id) {
        toast.success(`Phone number provisioned: ${data.phone_number}`)
        window.location.reload()
      } else {
        toast.error(data.error || 'Failed to provision phone number')
      }
    } catch {
      toast.error('Failed to provision phone number')
    } finally {
      setProvisioning(false)
    }
  }

  return (
    <div className="px-3 py-3 border border-dashed border-sf-border rounded-[4px] bg-sf-surface-1">
      <div className="text-center mb-3">
        <Phone size={20} className="mx-auto text-sf-text-tertiary mb-2" />
        <p className="text-[13px] font-medium text-sf-text-primary mb-1">Get a phone number</p>
        <p className="text-[11px] text-sf-text-tertiary">
          We&apos;ll provision a dedicated US number that your AI receptionist answers.
        </p>
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={areaCode}
          onChange={e => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
          placeholder="Area code (optional)"
          className="w-[140px] h-8 px-2 rounded-[4px] border border-sf-border bg-sf-surface-2 text-[13px] text-sf-text-primary placeholder:text-sf-text-tertiary focus:outline-none focus:ring-1 focus:ring-sf-accent"
        />
        <button
          onClick={handleProvision}
          disabled={provisioning}
          className="btn-press h-8 px-4 rounded-[4px] bg-sf-accent hover:bg-sf-accent-hover text-white text-[13px] font-medium transition-colors disabled:opacity-50 shrink-0"
        >
          {provisioning ? 'Provisioning...' : 'Get Phone Number'}
        </button>
      </div>
    </div>
  )
}

// ─── Assistant Chat ─────────────────────────────────────────────

function AssistantChat() {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [config, setConfig] = useState<ReceptionistConfig | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Load existing conversation + config on mount
  useEffect(() => {
    fetch('/api/voice/assistant')
      .then(r => r.json())
      .then(data => {
        if (data.messages?.length > 0) setMessages(data.messages)
        if (data.config) setConfig(data.config)
      })
      .catch(() => {})
      .finally(() => setInitialized(true))
  }, [])

  // Auto-start after load completes if no messages exist
  useEffect(() => {
    if (initialized && messages.length === 0 && !sending) {
      sendMessage("Let's get started!")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized])

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    if (!text.trim() || sending) return
    setSending(true)
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])

    try {
      const res = await fetch('/api/voice/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      }
      if (data.config) setConfig(data.config)
    } catch {
      toast.error('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  async function handleClear() {
    await fetch('/api/voice/assistant', { method: 'DELETE' })
    setMessages([])
    sendMessage("Let's get started!")
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3 pb-1.5 border-b border-sf-border">
        <div className="flex items-center gap-1.5">
          <MessageSquare size={12} className="text-sf-text-tertiary" />
          <h2 className="text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary">
            Configure Your Receptionist
          </h2>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="flex items-center gap-1 text-[11px] text-sf-text-tertiary hover:text-sf-accent transition-colors"
        >
          <RotateCw size={10} />
          Clear conversation
        </button>
      </div>

      <p className="text-[11px] text-sf-text-tertiary mb-4">
        Chat to set up or update your receptionist — change hours, add services, update your greeting, and more.
      </p>

      <div className="flex gap-4">
        {/* Chat column */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div
            ref={scrollRef}
            className="h-[340px] overflow-y-auto border border-sf-border rounded-[6px] bg-sf-surface-1 p-3 flex flex-col gap-2 mb-3"
          >
            {messages.filter(m => m.content !== "Let's get started!").map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-[6px] text-[12px] leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-sf-accent text-white'
                    : 'bg-sf-surface-2 text-sf-text-primary'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-[6px] bg-sf-surface-2">
                  <Loader2 size={14} className="animate-spin text-sf-text-tertiary" />
                </div>
              </div>
            )}
          </div>

          <form onSubmit={e => { e.preventDefault(); sendMessage(input) }} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type a message..."
              disabled={sending}
              className="flex-1 h-9 px-3 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[13px] text-sf-text-primary placeholder:text-sf-text-tertiary focus:outline-none focus:ring-1 focus:ring-sf-accent disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="h-9 w-9 flex items-center justify-center rounded-[4px] bg-sf-accent hover:bg-sf-accent-hover text-white transition-colors disabled:opacity-50"
            >
              <Send size={14} />
            </button>
          </form>
        </div>

        {/* Config panel */}
        <ConfigPanel config={config} />
      </div>
    </section>
  )
}

// ─── Config Panel ───────────────────────────────────────────────

function ConfigPanel({ config }: { config: ReceptionistConfig | null }) {
  const today = new Date().toISOString().split('T')[0]
  const upcomingOverrides = Object.entries(config?.receptionist_date_overrides ?? {})
    .filter(([date]) => date >= today)
    .sort()

  const hasContent = config && (
    config.receptionist_services.length > 0 ||
    Object.keys(config.receptionist_hours).length > 0 ||
    upcomingOverrides.length > 0 ||
    config.receptionist_greeting ||
    config.receptionist_transfer_number ||
    config.receptionist_instructions
  )

  return (
    <div className="w-[280px] shrink-0">
      <div className="border border-sf-border rounded-[6px] bg-sf-surface-1 p-3 h-[390px] overflow-y-auto">
        <div className="text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary mb-3">
          Current Config
        </div>
        {hasContent ? (
          <div className="space-y-3 text-[12px]">
            {upcomingOverrides.length > 0 && (
              <div>
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-amber-500 font-semibold mb-1">
                  <CalendarOff size={9} /> Closed Days
                </div>
                <div className="space-y-0.5">
                  {upcomingOverrides.map(([date]) => (
                    <div key={date} className="flex justify-between">
                      <span className="text-sf-text-secondary font-mono">{date}</span>
                      <span className="text-amber-500 text-[10px]">one-time</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {config!.receptionist_services.length > 0 && (
              <div>
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-sf-text-tertiary font-semibold mb-1">
                  <Wrench size={9} /> Services
                </div>
                <div className="space-y-1">
                  {config!.receptionist_services.map((s, i) => (
                    <div key={i} className="flex items-start justify-between gap-2">
                      <span className="text-sf-text-primary">{s.name}</span>
                      {s.priceRange && <span className="text-sf-text-tertiary shrink-0">{s.priceRange}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {Object.keys(config!.receptionist_hours).length > 0 && (
              <div>
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-sf-text-tertiary font-semibold mb-1">
                  <Clock size={9} /> Hours
                </div>
                <div className="space-y-0.5">
                  {Object.entries(config!.receptionist_hours).map(([day, h]) => (
                    <div key={day} className="flex justify-between">
                      <span className="text-sf-text-secondary uppercase">{day}</span>
                      <span className="text-sf-text-primary font-mono text-[11px]">{h.start}–{h.end}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {config!.receptionist_transfer_number && (
              <div>
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-sf-text-tertiary font-semibold mb-1">
                  <PhoneForwarded size={9} /> Transfer
                </div>
                <div className="text-sf-text-primary font-mono">{config!.receptionist_transfer_number}</div>
              </div>
            )}
            {config!.receptionist_greeting && (
              <div>
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-sf-text-tertiary font-semibold mb-1">
                  <MessageSquare size={9} /> Greeting
                </div>
                <div className="text-sf-text-secondary text-[11px] leading-relaxed italic">
                  &ldquo;{config!.receptionist_greeting}&rdquo;
                </div>
              </div>
            )}
            {config!.receptionist_instructions && (
              <div>
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-sf-text-tertiary font-semibold mb-1">
                  <FileText size={9} /> Instructions
                </div>
                <div className="text-sf-text-secondary text-[11px] leading-relaxed">
                  {config!.receptionist_instructions}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-[12px] text-sf-text-tertiary leading-relaxed">
            Your receptionist config will appear here as we chat.
          </div>
        )}
      </div>
    </div>
  )
}
