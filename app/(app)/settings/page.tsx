'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Upload, ExternalLink, Plus, X, CreditCard, Star, Phone } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useUser } from '@/hooks/use-user'
import { DEFAULT_TEMPLATES } from '@/components/quick-reply-bar'
import { PLANS, type PlanTier } from '@/lib/plans'
import type { QuickReplyTemplate, Profile } from '@/lib/types'

export default function SettingsPage() {
  const { profile, loading, updateProfile } = useUser()

  const [companyName, setCompanyName] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [defaultLaborRate, setDefaultLaborRate] = useState('')
  const [defaultTaxRate, setDefaultTaxRate] = useState('')
  const [followUpTemplate, setFollowUpTemplate] = useState('')
  const [quickReplies, setQuickReplies] = useState<QuickReplyTemplate[]>([])
  const [saving, setSaving] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  // Google Reviews
  const [googlePlaceId, setGooglePlaceId] = useState('')
  const [googleAutoSend, setGoogleAutoSend] = useState(true)
  const [googleDelayHours, setGoogleDelayHours] = useState('24')

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setCompanyName(profile.company_name || '')
      setLicenseNumber(profile.license_number || '')
      setPhone(profile.phone || '')
      setEmail(profile.email || '')
      setAddress(profile.address || '')
      setDefaultLaborRate(String(profile.default_labor_rate ?? 95))
      setDefaultTaxRate(String((profile.default_tax_rate ?? 0.05) * 100))
      setFollowUpTemplate(
        profile.follow_up_template ||
          'Hi {customer_name}, just following up on the quote I sent for {job_type}. Let me know if you have any questions.'
      )
      setQuickReplies(
        profile.quick_reply_templates?.length
          ? profile.quick_reply_templates
          : DEFAULT_TEMPLATES
      )
      // Google Reviews
      setGooglePlaceId(profile.google_place_id || '')
      setGoogleAutoSend(profile.google_review_auto_send ?? true)
      setGoogleDelayHours(String(profile.google_review_delay_hours ?? 24))
      setLogoUrl(profile.logo_url || null)
    }
  }, [profile])

  async function handleLogoUpload(file: File) {
    setLogoUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/profile/logo', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok && data.url) {
        setLogoUrl(data.url)
        toast.success('Logo uploaded')
      } else {
        toast.error(data.error || 'Upload failed')
      }
    } catch {
      toast.error('Upload failed')
    } finally {
      setLogoUploading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateProfile({
        company_name: companyName,
        license_number: licenseNumber || null,
        phone: phone || null,
        address: address || null,
        default_labor_rate: Number(defaultLaborRate) || 95,
        default_tax_rate: (Number(defaultTaxRate) || 5) / 100,
        follow_up_template: followUpTemplate || null,
        quick_reply_templates: quickReplies,
        google_place_id: googlePlaceId || null,
        google_review_auto_send: googleAutoSend,
        google_review_delay_hours: Number(googleDelayHours) || 24,
      })
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="px-4 md:px-6 py-4 md:py-6">
        <h1 className="font-heading text-[18px] font-semibold tracking-tight text-sf-text-primary mb-6">
          Settings
        </h1>
        <div className="max-w-[640px] space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-[6px] bg-sf-surface-2 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 md:px-6 py-4 md:py-6">
      <h1 className="font-heading text-[18px] font-semibold tracking-tight text-sf-text-primary mb-6">
        Settings
      </h1>

      <div className="flex flex-col gap-8 max-w-[640px]">
        {/* Company Profile */}
        <SettingsSection title="Company Profile">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SettingsField label="Company Name" value={companyName} onChange={setCompanyName} />
            <SettingsField label="License #" value={licenseNumber} onChange={setLicenseNumber} />
            <SettingsField label="Phone" value={phone} onChange={setPhone} />
            <SettingsField label="Email" value={email} onChange={setEmail} />
            <SettingsField label="Address" value={address} onChange={setAddress} full />
          </div>
          <div className="mt-3">
            <span className="text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary block mb-1.5">
              Company Logo
            </span>
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Company logo" className="h-12 mb-2 rounded-[4px] border border-sf-border object-contain bg-white px-2" />
            )}
            <label className="btn-press flex items-center gap-1.5 h-8 px-3 rounded-[4px] border border-sf-border text-[12px] font-medium text-sf-text-secondary hover:bg-sf-surface-2 transition-colors cursor-pointer w-fit">
              <Upload size={12} strokeWidth={1.5} />
              {logoUploading ? 'Uploading...' : 'Upload Logo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={logoUploading}
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleLogoUpload(file)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        </SettingsSection>

        {/* Quote Defaults */}
        <SettingsSection title="Quote Defaults">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SettingsField label="Default Labor Rate ($/hr)" value={defaultLaborRate} onChange={setDefaultLaborRate} type="number" />
            <SettingsField label="Tax Rate (%)" value={defaultTaxRate} onChange={setDefaultTaxRate} type="number" />
          </div>
          <div className="mt-3">
            <label className="text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary block mb-1.5">
              Follow-Up Message Template
            </label>
            <textarea
              rows={4}
              value={followUpTemplate}
              onChange={(e) => setFollowUpTemplate(e.target.value)}
              className="w-full px-3 py-2 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[12px] text-sf-text-primary placeholder:text-sf-text-tertiary focus:outline-none focus:ring-1 focus:ring-sf-accent resize-none font-mono leading-relaxed"
            />
            <p className="text-[11px] text-sf-text-tertiary mt-1">
              Available tokens: {'{customer_name}'}, {'{job_type}'}, {'{company_name}'}
            </p>
          </div>
        </SettingsSection>

        {/* Quick Reply Templates */}
        <SettingsSection title="Quick Reply Templates">
          <p className="text-[11px] text-sf-text-tertiary mb-3">
            Pre-written messages you can quickly send from the communication tab. Tokens: {'{customer_name}'}, {'{job_type}'}, {'{company_name}'}, {'{quote_number}'}
          </p>
          <div className="flex flex-col gap-2">
            {quickReplies.map((t, i) => (
              <div key={t.id} className="flex items-start gap-2 px-3 py-2 border border-sf-border rounded-[4px] bg-sf-surface-1">
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={t.label}
                    onChange={(e) => {
                      const updated = [...quickReplies]
                      updated[i] = { ...t, label: e.target.value }
                      setQuickReplies(updated)
                    }}
                    placeholder="Label"
                    className="w-full h-7 px-2 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[12px] font-medium text-sf-text-primary focus:outline-none focus:ring-1 focus:ring-sf-accent mb-1"
                  />
                  <textarea
                    rows={2}
                    value={t.body}
                    onChange={(e) => {
                      const updated = [...quickReplies]
                      updated[i] = { ...t, body: e.target.value }
                      setQuickReplies(updated)
                    }}
                    placeholder="Message body..."
                    className="w-full px-2 py-1 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[12px] text-sf-text-primary focus:outline-none focus:ring-1 focus:ring-sf-accent resize-none font-mono leading-relaxed"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setQuickReplies(prev => prev.filter((_, idx) => idx !== i))}
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-sf-text-tertiary hover:text-sf-danger hover:bg-sf-surface-2 transition-colors mt-0.5"
                >
                  <X size={14} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setQuickReplies(prev => [
                ...prev,
                { id: `custom-${Date.now()}`, label: '', body: '' },
              ])
            }
            className="mt-2 flex items-center gap-1 h-7 px-2.5 rounded-[4px] border border-sf-border text-[12px] font-medium text-sf-text-secondary hover:bg-sf-surface-2 transition-colors"
          >
            <Plus size={12} strokeWidth={1.5} />
            Add Template
          </button>
        </SettingsSection>

        {/* Billing */}
        <SettingsSection title="Billing">
          <BillingSection profile={profile} />
        </SettingsSection>

        {/* Google Reviews */}
        <SettingsSection title="Google Reviews">
          <GoogleReviewsSection
            placeId={googlePlaceId}
            onPlaceIdChange={setGooglePlaceId}
            autoSend={googleAutoSend}
            onAutoSendChange={setGoogleAutoSend}
            delayHours={googleDelayHours}
            onDelayHoursChange={setGoogleDelayHours}
            tier={(profile?.plan_tier as PlanTier) ?? 'free'}
          />
        </SettingsSection>

        {/* AI Receptionist */}
        <SettingsSection title="AI Receptionist">
          <Link
            href="/settings/receptionist"
            className="flex items-center justify-between px-3 py-3 border border-sf-border rounded-[4px] bg-sf-surface-1 hover:bg-sf-surface-2 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[4px] bg-sf-accent/10 flex items-center justify-center">
                <Phone size={14} className="text-sf-accent" />
              </div>
              <div>
                <div className="text-[13px] font-medium text-sf-text-primary">
                  {profile?.receptionist_enabled ? 'Receptionist Active' : 'Configure AI Receptionist'}
                </div>
                <div className="text-[11px] text-sf-text-tertiary">
                  Let AI answer calls, capture leads, and transfer to you
                </div>
              </div>
            </div>
            <ExternalLink size={14} className="text-sf-text-tertiary group-hover:text-sf-text-secondary transition-colors" />
          </Link>
        </SettingsSection>

        {/* Integrations */}
        <SettingsSection title="Integrations">
          <div className="flex flex-col gap-2">
            <IntegrationRow
              name="QuickBooks Online"
              description="Sync invoices and payments automatically"
            />
            <IntegrationRow
              name="Google Calendar"
              description="Sync jobs to your personal calendar"
            />
            <StripeConnectRow profile={profile} />
          </div>
          <p className="text-[11px] text-sf-text-tertiary mt-2">QuickBooks and Google Calendar integrations coming soon.</p>
        </SettingsSection>

        {/* Save */}
        <div className="pb-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-press h-8 px-4 rounded-[4px] bg-sf-accent hover:bg-sf-accent-hover text-white text-[13px] font-medium transition-colors duration-120 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary mb-3 pb-1.5 border-b border-sf-border">
        {title}
      </h2>
      {children}
    </section>
  )
}

function SettingsField({ label, value, onChange, type = 'text', full }: { label: string; value: string; onChange: (v: string) => void; type?: string; full?: boolean }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary block mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 px-3 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[13px] text-sf-text-primary focus:outline-none focus:ring-1 focus:ring-sf-accent"
      />
    </div>
  )
}

function BillingSection({ profile }: { profile: Profile | null }) {
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  const tier = (profile?.plan_tier as PlanTier) ?? 'free'
  const status = (profile?.plan_status as string) ?? 'free'
  const plan = PLANS[tier]
  const voiceUsed = (profile?.voice_minutes_used as number) ?? 0

  async function handleUpgrade(selectedTier: PlanTier) {
    setUpgradeLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: selectedTier }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else toast.error(data.error || 'Failed to create checkout session')
    } catch {
      toast.error('Failed to start checkout')
    } finally {
      setUpgradeLoading(false)
    }
  }

  async function handleManageBilling() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else toast.error(data.error || 'Failed to open billing portal')
    } catch {
      toast.error('Failed to open billing portal')
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Current plan */}
      <div className="flex items-center justify-between px-3 py-3 border border-sf-border rounded-[4px] bg-sf-surface-1">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[4px] bg-sf-accent/10 flex items-center justify-center">
            <CreditCard size={14} className="text-sf-accent" />
          </div>
          <div>
            <div className="text-[13px] font-medium text-sf-text-primary">
              {plan.name} {plan.price > 0 ? `— $${plan.price}/mo` : ''}
            </div>
            <div className="text-[11px] text-sf-text-tertiary">
              {status === 'active' ? 'Active subscription' : status === 'past_due' ? 'Payment past due' : status === 'canceled' ? 'Canceled' : 'Free trial'}
            </div>
          </div>
        </div>
        {status === 'active' && (
          <button
            onClick={handleManageBilling}
            disabled={portalLoading}
            className="h-7 px-3 rounded-[4px] border border-sf-border text-[12px] font-medium text-sf-text-secondary hover:bg-sf-surface-2 transition-colors disabled:opacity-50"
          >
            {portalLoading ? 'Loading...' : 'Manage Billing'}
          </button>
        )}
      </div>

      {/* Voice minutes usage */}
      {plan.voiceMinutes > 0 && status === 'active' && (
        <div className="px-3 py-2.5 border border-sf-border rounded-[4px] bg-sf-surface-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary">
              AI Receptionist Minutes
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

      {/* Upgrade options */}
      {(tier === 'free' || tier === 'starter') && (
        <div className="flex flex-col gap-2">
          {tier === 'free' && (
            <button
              onClick={() => handleUpgrade('starter')}
              disabled={upgradeLoading}
              className="btn-press h-9 px-4 rounded-[4px] border border-sf-accent text-sf-accent text-[13px] font-medium transition-colors hover:bg-sf-accent hover:text-white disabled:opacity-50"
            >
              {upgradeLoading ? 'Loading...' : 'Upgrade to Starter — $59/mo'}
            </button>
          )}
          <button
            onClick={() => handleUpgrade('pro')}
            disabled={upgradeLoading}
            className="btn-press h-9 px-4 rounded-[4px] bg-sf-accent hover:bg-sf-accent-hover text-white text-[13px] font-medium transition-colors disabled:opacity-50"
          >
            {upgradeLoading ? 'Loading...' : 'Upgrade to Pro — $129/mo'}
          </button>
        </div>
      )}
      {tier === 'pro' && (
        <button
          onClick={() => handleUpgrade('business')}
          disabled={upgradeLoading}
          className="btn-press h-9 px-4 rounded-[4px] border border-sf-accent text-sf-accent text-[13px] font-medium transition-colors hover:bg-sf-accent hover:text-white disabled:opacity-50"
        >
          {upgradeLoading ? 'Loading...' : 'Upgrade to Business — $199/mo'}
        </button>
      )}
    </div>
  )
}

function GoogleReviewsSection({
  placeId, onPlaceIdChange, autoSend, onAutoSendChange, delayHours, onDelayHoursChange, tier,
}: {
  placeId: string; onPlaceIdChange: (v: string) => void
  autoSend: boolean; onAutoSendChange: (v: boolean) => void
  delayHours: string; onDelayHoursChange: (v: string) => void
  tier: PlanTier
}) {
  const { hasFeature: hasFeat } = (() => {
    const plan = PLANS[tier]
    return { hasFeature: plan.features.googleReviews }
  })()

  if (!hasFeat) {
    return (
      <div className="px-3 py-3 border border-sf-border rounded-[4px] bg-sf-surface-1">
        <div className="flex items-center gap-2 mb-1">
          <Star size={14} className="text-sf-text-tertiary" />
          <span className="text-[13px] font-medium text-sf-text-primary">Automated Google Review Requests</span>
        </div>
        <p className="text-[11px] text-sf-text-tertiary mb-2">
          Automatically request Google reviews from customers after job completion. Available on Starter, Pro, and Business plans.
        </p>
        <span className="inline-block text-[11px] font-medium text-sf-accent">Upgrade to unlock</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-sf-text-tertiary">
        Automatically send a review request email to customers after completing a job. Requires your Google Place ID.
      </p>

      {/* Place ID */}
      <div>
        <label className="text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary block mb-1.5">
          Google Place ID
        </label>
        <input
          type="text"
          value={placeId}
          onChange={(e) => onPlaceIdChange(e.target.value)}
          placeholder="ChIJ..."
          className="w-full h-9 px-3 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[13px] text-sf-text-primary font-mono focus:outline-none focus:ring-1 focus:ring-sf-accent"
        />
        <a
          href="https://developers.google.com/maps/documentation/places/web-service/place-id"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-sf-accent hover:underline mt-1"
        >
          How to find your Place ID <ExternalLink size={10} />
        </a>
      </div>

      {/* Auto-send toggle */}
      <div className="flex items-center justify-between px-3 py-2.5 border border-sf-border rounded-[4px] bg-sf-surface-1">
        <div>
          <div className="text-[13px] font-medium text-sf-text-primary">Auto-send review requests</div>
          <div className="text-[11px] text-sf-text-tertiary">Email customers after jobs are marked complete</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoSend}
          onClick={() => onAutoSendChange(!autoSend)}
          className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${autoSend ? 'bg-sf-accent' : 'bg-sf-surface-2 border border-sf-border'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${autoSend ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>

      {/* Delay hours */}
      <div>
        <label className="text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary block mb-1.5">
          Delay after job completion (hours)
        </label>
        <input
          type="number"
          min="1"
          max="168"
          value={delayHours}
          onChange={(e) => onDelayHoursChange(e.target.value)}
          className="w-24 h-9 px-3 bg-sf-surface-2 border border-sf-border rounded-[4px] text-[13px] text-sf-text-primary focus:outline-none focus:ring-1 focus:ring-sf-accent"
        />
        <p className="text-[11px] text-sf-text-tertiary mt-1">
          Wait this many hours after a job is completed before sending the review request.
        </p>
      </div>
    </div>
  )
}

function IntegrationRow({ name, description }: { name: string; description: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 border border-sf-border rounded-[4px] bg-sf-surface-1">
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded-[4px] bg-sf-surface-2 flex items-center justify-center text-sf-text-tertiary">
          <ExternalLink size={12} strokeWidth={1.5} />
        </div>
        <div>
          <div className="text-[13px] font-medium text-sf-text-primary">{name}</div>
          <div className="text-[11px] text-sf-text-tertiary">{description}</div>
        </div>
      </div>
      <span className="text-[11px] text-sf-text-tertiary">Coming soon</span>
    </div>
  )
}

function StripeConnectRow({ profile }: { profile: Profile | null }) {
  const searchParams = useSearchParams()
  const [connectStatus, setConnectStatus] = useState<{
    connected: boolean
    charges_enabled: boolean
    complete: boolean
  } | null>(null)
  const [loading, setLoading] = useState(false)

  const refreshStatus = useCallback(async () => {
    const res = await fetch('/api/stripe/connect/status')
    if (res.ok) setConnectStatus(await res.json())
  }, [])

  // On mount: sync initial status from profile, then re-check if returning from Stripe
  useEffect(() => {
    if (profile) {
      setConnectStatus({
        connected: !!profile.stripe_account_id,
        charges_enabled: profile.stripe_onboarding_complete,
        complete: profile.stripe_onboarding_complete,
      })
    }
    if (searchParams.get('stripe_return')) {
      refreshStatus()
    }
  }, [profile, searchParams, refreshStatus])

  async function handleConnect() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/connect/onboard', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error || 'Failed to connect Stripe')
        setLoading(false)
      }
    } catch {
      toast.error('Failed to connect Stripe')
      setLoading(false)
    }
  }

  const isConnected = connectStatus?.connected && connectStatus?.complete
  const isPending = connectStatus?.connected && !connectStatus?.complete

  return (
    <div className="flex items-center justify-between px-3 py-2.5 border border-sf-border rounded-[4px] bg-sf-surface-1">
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded-[4px] bg-sf-surface-2 flex items-center justify-center text-sf-text-tertiary">
          <CreditCard size={12} strokeWidth={1.5} />
        </div>
        <div>
          <div className="text-[13px] font-medium text-sf-text-primary">Stripe Payments</div>
          <div className="text-[11px] text-sf-text-tertiary">
            {isConnected
              ? 'Connected — customers can pay invoices online'
              : isPending
                ? 'Setup incomplete — finish connecting your account'
                : 'Accept online payments on invoices'}
          </div>
        </div>
      </div>
      {isConnected ? (
        <span className="text-[11px] font-medium text-green-600">Connected</span>
      ) : (
        <button
          onClick={handleConnect}
          disabled={loading}
          className="h-7 px-3 rounded-[4px] bg-sf-accent text-white text-[12px] font-medium hover:bg-sf-accent-hover disabled:opacity-50 transition-colors"
        >
          {loading ? 'Loading…' : isPending ? 'Complete Setup' : 'Connect Stripe'}
        </button>
      )}
    </div>
  )
}
