'use client'

import Link from 'next/link'
import { Check, Clock, MessageSquare, Phone, PhoneIncoming, Send, Sparkles, User, Zap } from 'lucide-react'
import { ProductScreenshot } from '@/components/product-screenshot'

const features: { label: string; comingSoon?: boolean; isNew?: boolean }[] = [
  { label: 'AI receptionist answers calls 24/7', isNew: true },
  { label: 'Automatic lead capture from every call', isNew: true },
  { label: 'AI-generated quotes from voice descriptions', isNew: true },
  { label: '60-second quote builder with templates' },
  { label: 'Auto follow-up sequences' },
  { label: 'One-tap invoicing from completed jobs' },
  { label: 'Online payment collection', comingSoon: true },
  { label: 'Customer database with property notes' },
  { label: 'QuickBooks Online sync', comingSoon: true },
  { label: 'Job scheduling' },
  { label: 'SMS + email notifications', comingSoon: true },
  { label: 'Quote viewed / accepted alerts' },
  { label: 'Job photo documentation', comingSoon: true },
]

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-sf-surface-0 text-sf-text-primary font-sans">
      {/* ─── Nav ─── */}
      <nav className="sticky top-0 z-50 h-[56px] border-b border-sf-border bg-sf-surface-0/95 backdrop-blur-sm">
        <div className="max-w-[680px] lg:max-w-5xl mx-auto px-4 h-full flex items-center justify-between">
          <span className="font-heading text-[18px] font-semibold tracking-tight flex items-center gap-1.5">
            <img src="/icon-light-32x32.png" alt="QuotArc" width={22} height={22} className="shrink-0 dark:hidden" />
            <img src="/icon-dark-32x32.png" alt="QuotArc" width={22} height={22} className="shrink-0 hidden dark:block" />
            <span className="text-sf-text-primary">Quot</span>
            <span className="text-sf-accent">Arc</span>
          </span>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-[13px] font-medium text-sf-text-secondary hover:text-sf-text-primary transition-colors duration-120"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="btn-press h-[36px] px-3.5 inline-flex items-center bg-sf-accent hover:bg-sf-accent-hover text-white text-[13px] font-medium rounded-[4px] transition-colors duration-120"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="max-w-[680px] lg:max-w-5xl mx-auto px-4 pt-16 pb-12 md:pt-20 md:pb-16">
        <div className="lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">
          <div>
            <h1 className="font-heading text-[26px] md:text-[32px] lg:text-[40px] font-semibold leading-[1.15] tracking-tight text-balance text-sf-text-primary">
              Stop losing jobs to missed calls{' '}
              <br className="hidden md:block" />
              and slow quotes.
            </h1>
            <p className="mt-6 text-[15px] md:text-[16px] leading-relaxed text-sf-text-secondary max-w-[520px]">
              {"62% of callers won\u2019t leave a voicemail\u00a0\u2014\u00a0they just call the next guy. And by the time you write the quote at 10\u202Fpm, the homeowner already signed with someone else. QuotArc\u2019s AI receptionist answers every call, and sends professional quotes in 60\u00a0seconds from your phone."}
            </p>
            <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sf-accent/10 border border-sf-accent/20">
              <Phone size={14} className="text-sf-accent" />
              <span className="text-[13px] font-medium text-sf-accent">NEW: AI answers your phone 24/7</span>
            </div>
            <div className="mt-5">
              <Link
                href="/signup"
                className="btn-press inline-flex items-center h-[44px] px-5 bg-sf-accent hover:bg-sf-accent-hover text-white text-[14px] font-medium rounded-[6px] transition-colors duration-120"
              >
                {"Try It Free \u2014 No Card Required"}
              </Link>
              <p className="mt-2.5 text-[13px] text-sf-text-tertiary">
                Set up in 5 minutes. Cancel anytime.
              </p>
            </div>
          </div>
          <div className="hidden lg:block">
            <ProductScreenshot />
          </div>
        </div>
        <p className="mt-12 text-[14px] italic text-sf-text-secondary text-center">
          One recovered call pays for an entire year.
        </p>
      </section>

      {/* ─── Problem: The Math ─── */}
      <section className="max-w-[680px] lg:max-w-5xl mx-auto px-4 pb-16">
        <SectionLabel>The Math You Already Know</SectionLabel>

        <div className="lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center mt-5">
          <div className="border border-sf-border rounded-[6px] bg-sf-surface-1 p-3 md:p-4 font-mono text-[13px] md:text-[14px]">
            <div className="space-y-1">
              <LedgerRow label="Calls you miss per week" value="8" />
              <LedgerRow label="Calls that were real leads" value="5" />
              <LedgerRow label="Average job value" value="$1,200" />
              <LedgerRow label="Quotes you send per month" value="40" />
              <LedgerRow label="Your current close rate" value="15%" />
            </div>

            <div className="my-3 border-t border-sf-border" />

            <div className="space-y-1">
              <LedgerRow
                label="If AI catches just 5 missed leads"
                value="+$3,600/mo"
                valueClass="text-sf-text-primary font-medium"
              />
              <LedgerRow
                label="QuotArc Pro cost"
                value={"\u2212$119/mo"}
                labelClass="text-sf-text-tertiary"
                valueClass="text-sf-text-tertiary"
              />
            </div>

            <div className="my-3 border-t border-sf-border" />

            <LedgerRow
              label="Net gain"
              value="+$3,481/mo"
              valueClass="text-sf-accent font-semibold"
              labelClass="font-medium"
            />
          </div>

          <p className="mt-5 lg:mt-0 text-[15px] lg:text-[17px] text-sf-text-secondary leading-relaxed">
            {"62% of callers won\u2019t leave a voicemail\u00a0\u2014\u00a0they just call the next electrician. Every missed call is a lost job. QuotArc\u2019s AI answers, captures the lead, and you call back when you\u2019re ready."}
          </p>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="max-w-[680px] lg:max-w-5xl mx-auto px-4 pb-16">
        <SectionLabel>How It Works</SectionLabel>

        <div className="mt-5 space-y-8 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-8">
          <Step number="01" title="Pick a job type. Line items auto-fill.">
            {"Select \u201CPanel Upgrade\u201D and QuotArc pre-loads materials, labor, and permit fees at your local rates. Edit anything. Add custom lines."}
          </Step>
          <Step number="02" title="Send it from the truck. Customer gets it instantly.">
            {"Professional quote with your company name and branding. Sent by email before you start the next job."}
          </Step>
          <Step number="03" title="QuotArc follows up. You don't have to.">
            {"If they don\u2019t respond in 3 days, an automatic follow-up goes out. Then another. You get notified the second they view or accept it."}
          </Step>
        </div>
      </section>

      {/* ─── Product Screenshot (mobile only — desktop sees it in hero) ─── */}
      <section className="bg-sf-surface-1 py-10 md:py-14 lg:hidden">
        <div className="max-w-[680px] mx-auto px-4">
          <ProductScreenshot />
        </div>
        <p className="mt-6 text-[14px] text-sf-text-secondary text-center">
          {"That\u2019s it. No 6-month onboarding. No training manuals."}
        </p>
      </section>

      {/* ─── Showcase: In-App Chat ─── */}
      <section className="max-w-[680px] lg:max-w-5xl mx-auto px-4 py-16">
        <div className="lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">
          <div>
            <SectionLabel>Customer Communication</SectionLabel>
            <h2 className="mt-3 font-heading text-[22px] md:text-[26px] lg:text-[30px] font-semibold leading-[1.2] tracking-tight text-sf-text-primary">
              Chat with customers without giving out your cell number.
            </h2>
            <p className="mt-4 text-[15px] text-sf-text-secondary leading-relaxed">
              Every quote has a built-in message thread. Customers reply from the quote link — you get notified instantly. Share photos, voice notes, files, or schedule cards right in the conversation.
            </p>
          </div>
          {/* Chat mockup */}
          <div className="mt-8 lg:mt-0">
            <div className="rounded-[6px] border border-sf-border bg-sf-surface-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
              <div className="flex items-center gap-2 px-3 py-2 bg-sf-surface-1 border-b border-sf-border">
                <MessageSquare size={13} className="text-sf-accent" />
                <span className="text-[12px] font-semibold text-sf-text-primary">Messages — Sarah Chen</span>
                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-sf-accent/10 text-sf-accent font-medium">Quote Q-042</span>
              </div>
              <div className="px-3 py-3 space-y-2.5">
                {/* Outbound */}
                <div className="flex justify-end">
                  <div className="max-w-[75%] bg-sf-accent text-white rounded-[6px] rounded-br-[2px] px-2.5 py-1.5">
                    <p className="text-[12px] leading-relaxed">Hi Sarah, here's your quote for the panel upgrade. Let me know if you have any questions!</p>
                    <p className="text-[9px] text-white/60 mt-1 text-right">2:14 PM</p>
                  </div>
                </div>
                {/* System card */}
                <div className="flex justify-center">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-sf-surface-2 text-[10px] text-sf-text-tertiary">
                    <Zap size={9} />
                    <span>Quote Q-042 sent — $4,280.00</span>
                  </div>
                </div>
                {/* Inbound */}
                <div className="flex justify-start">
                  <div className="max-w-[75%] bg-sf-surface-1 border border-sf-border rounded-[6px] rounded-bl-[2px] px-2.5 py-1.5">
                    <p className="text-[12px] text-sf-text-primary leading-relaxed">Looks good! Can you add a dedicated circuit for the EV charger in the garage?</p>
                    <p className="text-[9px] text-sf-text-tertiary mt-1">2:31 PM</p>
                  </div>
                </div>
                {/* Outbound */}
                <div className="flex justify-end">
                  <div className="max-w-[75%] bg-sf-accent text-white rounded-[6px] rounded-br-[2px] px-2.5 py-1.5">
                    <p className="text-[12px] leading-relaxed">Absolutely — I'll add a 50A circuit for that. Updated quote coming in a sec.</p>
                    <p className="text-[9px] text-white/60 mt-1 text-right">2:33 PM</p>
                  </div>
                </div>
                {/* Composer */}
                <div className="flex items-center gap-2 border border-sf-border rounded-[6px] px-2.5 py-2 bg-sf-surface-1">
                  <span className="text-[11px] text-sf-text-tertiary flex-1">Type a message...</span>
                  <Send size={13} className="text-sf-text-tertiary" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Showcase: AI Quote Generation ─── */}
      <section className="bg-sf-surface-1 py-14 md:py-16">
        <div className="max-w-[680px] lg:max-w-5xl mx-auto px-4">
          <div className="lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">
            {/* AI mockup — shown first on desktop (left side) */}
            <div className="order-2 lg:order-1 mt-8 lg:mt-0">
              <div className="rounded-[6px] border border-sf-border bg-sf-surface-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
                <div className="flex items-center gap-2 px-3 py-2 bg-sf-surface-1 border-b border-sf-border">
                  <Sparkles size={13} className="text-sf-accent" />
                  <span className="text-[12px] font-semibold text-sf-text-primary">AI Quote Enhance</span>
                  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-sf-accent/10 text-sf-accent font-medium animate-pulse">Generating...</span>
                </div>
                <div className="px-3 py-3 space-y-3">
                  {/* Input */}
                  <div className="rounded-[4px] bg-sf-surface-2 p-2.5">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-sf-text-tertiary mb-1.5">Your input</p>
                    <p className="text-[12px] text-sf-text-primary leading-relaxed">200 amp panel upgrade, customer has old Federal Pacific panel, 1,800 sq ft house</p>
                  </div>
                  {/* AI output */}
                  <div className="rounded-[4px] border border-sf-accent/20 bg-sf-accent/5 p-2.5">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-sf-accent mb-2 flex items-center gap-1">
                      <Sparkles size={9} /> AI-Generated Line Items
                    </p>
                    <div className="space-y-1.5 font-mono text-[11px]">
                      <div className="flex justify-between text-sf-text-primary">
                        <span>200A main breaker panel</span>
                        <span>$485.00</span>
                      </div>
                      <div className="flex justify-between text-sf-text-primary">
                        <span>Panel installation labor (6 hrs)</span>
                        <span>$570.00</span>
                      </div>
                      <div className="flex justify-between text-sf-text-primary">
                        <span>FPE panel removal & disposal</span>
                        <span>$175.00</span>
                      </div>
                      <div className="flex justify-between text-sf-text-primary">
                        <span>Permit & ESA inspection</span>
                        <span>$285.00</span>
                      </div>
                      <div className="flex justify-between text-sf-text-primary">
                        <span>Ground rod + bonding update</span>
                        <span>$195.00</span>
                      </div>
                      <div className="flex justify-between text-sf-text-primary">
                        <span>Copper feeders (3/0 AWG)</span>
                        <span>$320.00</span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-sf-border flex justify-between font-semibold text-[12px] text-sf-text-primary">
                        <span>Estimated total</span>
                        <span className="text-sf-accent">$2,030.00</span>
                      </div>
                    </div>
                  </div>
                  {/* Action */}
                  <div className="flex items-center gap-2">
                    <span className="flex-1 h-[28px] inline-flex items-center justify-center bg-sf-accent text-white text-[11px] font-medium rounded-[4px]">
                      Add All to Quote
                    </span>
                    <span className="h-[28px] px-2.5 inline-flex items-center justify-center border border-sf-border text-sf-text-secondary text-[11px] font-medium rounded-[4px]">
                      Regenerate
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {/* Text — shown second on desktop (right side) */}
            <div className="order-1 lg:order-2">
              <SectionLabel>AI-Powered Quotes</SectionLabel>
              <h2 className="mt-3 font-heading text-[22px] md:text-[26px] lg:text-[30px] font-semibold leading-[1.2] tracking-tight text-sf-text-primary">
                Describe the job. AI builds the quote.
              </h2>
              <p className="mt-4 text-[15px] text-sf-text-secondary leading-relaxed">
                {"Tell QuotArc what you\u2019re looking at \u2014 \u201C200 amp panel upgrade, old FPE panel\u201D \u2014 and AI generates accurate line items with local pricing. Review, tweak, and send in under 60 seconds."}
              </p>
              <div className="mt-5 space-y-2">
                <div className="flex items-center gap-2 text-[14px] text-sf-text-primary">
                  <Sparkles size={14} className="text-sf-accent shrink-0" />
                  <span>Material, labor, and permit costs pre-filled</span>
                </div>
                <div className="flex items-center gap-2 text-[14px] text-sf-text-primary">
                  <Sparkles size={14} className="text-sf-accent shrink-0" />
                  <span>Works for any electrical job type</span>
                </div>
                <div className="flex items-center gap-2 text-[14px] text-sf-text-primary">
                  <Sparkles size={14} className="text-sf-accent shrink-0" />
                  <span>Edit any line before sending</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Showcase: AI Receptionist ─── */}
      <section className="max-w-[680px] lg:max-w-5xl mx-auto px-4 py-16">
        <div className="lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <SectionLabel>AI Receptionist</SectionLabel>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-sf-accent bg-sf-accent/10 px-1.5 py-0.5 rounded">New</span>
            </div>
            <h2 className="mt-3 font-heading text-[22px] md:text-[26px] lg:text-[30px] font-semibold leading-[1.2] tracking-tight text-sf-text-primary">
              {"Never miss a call. Even when you\u2019re on a ladder."}
            </h2>
            <p className="mt-4 text-[15px] text-sf-text-secondary leading-relaxed">
              {"Your AI receptionist picks up every call, answers questions about your services and pricing, and captures the caller\u2019s name and number\u00a0\u2014\u00a0so you can call back when you\u2019re ready. No more lost leads to voicemail."}
            </p>
            <div className="mt-5 space-y-2">
              <div className="flex items-center gap-2 text-[14px] text-sf-text-primary">
                <Phone size={14} className="text-sf-accent shrink-0" />
                <span>Answers calls 24/7 with your company name</span>
              </div>
              <div className="flex items-center gap-2 text-[14px] text-sf-text-primary">
                <Phone size={14} className="text-sf-accent shrink-0" />
                <span>Quotes your services and pricing to callers</span>
              </div>
              <div className="flex items-center gap-2 text-[14px] text-sf-text-primary">
                <Phone size={14} className="text-sf-accent shrink-0" />
                <span>Captures lead info automatically</span>
              </div>
              <div className="flex items-center gap-2 text-[14px] text-sf-text-primary">
                <Phone size={14} className="text-sf-accent shrink-0" />
                <span>Transfers urgent calls to your cell</span>
              </div>
            </div>
          </div>
          {/* Phone call mockup */}
          <div className="mt-8 lg:mt-0">
            <div className="rounded-[6px] border border-sf-border bg-sf-surface-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
              {/* Header */}
              <div className="flex items-center gap-2 px-3 py-2 bg-sf-surface-1 border-b border-sf-border">
                <PhoneIncoming size={13} className="text-sf-accent" />
                <span className="text-[12px] font-semibold text-sf-text-primary">Incoming Call</span>
                <span className="ml-auto flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Live
                </span>
              </div>
              {/* Caller info bar */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-sf-border bg-sf-surface-2">
                <div className="w-6 h-6 rounded-full bg-sf-accent/10 flex items-center justify-center">
                  <User size={12} className="text-sf-accent" />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-medium text-sf-text-primary">+1 (416) 555-0199</p>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-sf-text-tertiary">
                  <Clock size={10} />
                  <span>1:24</span>
                </div>
              </div>
              {/* Conversation */}
              <div className="px-3 py-3 space-y-2.5">
                {/* AI */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] bg-sf-accent text-white rounded-[6px] rounded-br-[2px] px-2.5 py-1.5">
                    <p className="text-[12px] leading-relaxed">{"Hi, thanks for calling Volt Masters Electric! How can I help you today?"}</p>
                  </div>
                </div>
                {/* Caller */}
                <div className="flex justify-start">
                  <div className="max-w-[80%] bg-sf-surface-1 border border-sf-border rounded-[6px] rounded-bl-[2px] px-2.5 py-1.5">
                    <p className="text-[12px] text-sf-text-primary leading-relaxed">Yeah, I need a panel upgrade. How much does that run?</p>
                  </div>
                </div>
                {/* AI */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] bg-sf-accent text-white rounded-[6px] rounded-br-[2px] px-2.5 py-1.5">
                    <p className="text-[12px] leading-relaxed">{"A 200-amp panel upgrade typically runs $1,800\u2013$3,200. Can I grab your name and number so we can schedule an estimate?"}</p>
                  </div>
                </div>
                {/* Caller */}
                <div className="flex justify-start">
                  <div className="max-w-[80%] bg-sf-surface-1 border border-sf-border rounded-[6px] rounded-bl-[2px] px-2.5 py-1.5">
                    <p className="text-[12px] text-sf-text-primary leading-relaxed">Sure, Mike Chen. 416-555-0172.</p>
                  </div>
                </div>
                {/* AI */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] bg-sf-accent text-white rounded-[6px] rounded-br-[2px] px-2.5 py-1.5">
                    <p className="text-[12px] leading-relaxed">{"Got it, Mike! We\u2019ll call you back today to set up that estimate. Thanks for calling!"}</p>
                  </div>
                </div>
              </div>
              {/* Lead captured card */}
              <div className="mx-3 mb-3 rounded-[4px] border border-sf-accent/20 bg-sf-accent/5 p-2.5">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-sf-accent mb-1.5 flex items-center gap-1">
                  <Sparkles size={9} /> Lead Captured
                </p>
                <div className="space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between text-sf-text-primary">
                    <span>Name</span>
                    <span>Mike Chen</span>
                  </div>
                  <div className="flex justify-between text-sf-text-primary">
                    <span>Phone</span>
                    <span>416-555-0172</span>
                  </div>
                  <div className="flex justify-between text-sf-text-primary">
                    <span>Service</span>
                    <span>Panel Upgrade</span>
                  </div>
                  <div className="flex justify-between text-sf-text-primary">
                    <span>Est. Value</span>
                    <span className="text-sf-accent font-medium">$1,800–$3,200</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features: Everything in the Box ─── */}
      <section className="max-w-[680px] lg:max-w-5xl mx-auto px-4 py-16">
        <SectionLabel>Everything in the Box</SectionLabel>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2.5">
          {features.map((f) => (
            <div key={f.label} className="flex items-start gap-2">
              <Check size={14} strokeWidth={2} className="text-sf-accent shrink-0 mt-[3px]" />
              <span className="text-[14px] text-sf-text-primary leading-snug">
                {f.label}
                {f.isNew && (
                  <span className="ml-1.5 text-[10px] uppercase tracking-wider font-semibold text-sf-accent bg-sf-accent/10 px-1.5 py-0.5 rounded">New</span>
                )}
                {f.comingSoon && (
                  <span className="ml-1.5 text-[10px] uppercase tracking-wider font-semibold text-sf-text-tertiary bg-sf-surface-2 px-1.5 py-0.5 rounded">Soon</span>
                )}
              </span>
            </div>
          ))}
        </div>

      </section>

      {/* ─── Pricing ─── */}
      <section className="max-w-[680px] lg:max-w-5xl mx-auto px-4 pb-16">
        <SectionLabel>Pricing</SectionLabel>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-[900px] mx-auto">
          {/* Starter */}
          <div className="border border-sf-border rounded-[6px] bg-sf-surface-1 p-5 text-center">
            <p className="font-heading text-[15px] font-semibold tracking-tight text-sf-text-primary">
              Starter
            </p>
            <div className="mt-4 flex items-baseline justify-center gap-1.5">
              <span className="font-mono text-[32px] font-bold text-sf-text-primary leading-none">$59</span>
              <span className="text-[14px] text-sf-text-secondary">/ month</span>
            </div>
            <p className="mt-3 text-[13px] text-sf-text-secondary">
              Everything to run your quote-to-invoice workflow.
            </p>
            <ul className="mt-4 space-y-1.5 text-left text-[12px] text-sf-text-secondary">
              <li className="flex items-center gap-1.5"><Check size={12} className="text-sf-accent shrink-0" /> Unlimited quotes &amp; customers</li>
              <li className="flex items-center gap-1.5"><Check size={12} className="text-sf-accent shrink-0" /> Invoicing, scheduling &amp; follow-ups</li>
              <li className="flex items-center gap-1.5"><Check size={12} className="text-sf-accent shrink-0" /> AI quote generation</li>
              <li className="flex items-center gap-1.5"><Check size={12} className="text-sf-accent shrink-0" /> Google review automation</li>
            </ul>
            <Link
              href="/signup?plan=starter"
              className="btn-press mt-5 w-full inline-flex items-center justify-center h-[40px] border border-sf-accent text-sf-accent text-[13px] font-medium rounded-[4px] transition-colors duration-120 hover:bg-sf-accent hover:text-white"
            >
              Start Free Trial
            </Link>
          </div>

          {/* Pro (recommended) */}
          <div className="border-2 border-sf-accent rounded-[6px] bg-sf-surface-1 p-5 text-center relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-sf-accent text-white text-[10px] uppercase tracking-wider font-semibold px-3 py-0.5 rounded-full">
              Most Popular
            </div>
            <p className="font-heading text-[15px] font-semibold tracking-tight text-sf-text-primary">
              Pro
            </p>
            <div className="mt-4 flex items-baseline justify-center gap-1.5">
              <span className="font-mono text-[32px] font-bold text-sf-text-primary leading-none">$119</span>
              <span className="text-[14px] text-sf-text-secondary">/ month</span>
            </div>
            <p className="mt-3 text-[13px] text-sf-text-secondary">
              Everything in Starter, plus an AI that answers your phone.
            </p>
            <ul className="mt-4 space-y-1.5 text-left text-[12px] text-sf-text-secondary">
              <li className="flex items-center gap-1.5"><Check size={12} className="text-sf-accent shrink-0" /> Everything in Starter</li>
              <li className="flex items-center gap-1.5"><Check size={12} className="text-sf-accent shrink-0" /> AI receptionist — 100 min/mo included <span className="text-[9px] uppercase tracking-wider font-semibold text-sf-accent bg-sf-accent/10 px-1 py-0.5 rounded">New</span></li>
              <li className="flex items-center gap-1.5"><Check size={12} className="text-sf-accent shrink-0" /> E-signature capture</li>
              <li className="flex items-center gap-1.5"><Check size={12} className="text-sf-accent shrink-0" /> Buy more minutes any time</li>
            </ul>
            <div className="mt-4 flex items-center gap-2 px-2 py-1.5 rounded bg-sf-accent/5 border border-sf-accent/15">
              <Phone size={12} className="text-sf-accent shrink-0" />
              <span className="text-[11px] text-sf-text-secondary">100 min ≈ 40 calls. Add packs of 100 or 300 min.</span>
            </div>
            <Link
              href="/signup?plan=pro"
              className="btn-press mt-5 w-full inline-flex items-center justify-center h-[40px] bg-sf-accent hover:bg-sf-accent-hover text-white text-[13px] font-medium rounded-[4px] transition-colors duration-120"
            >
              {"Start Free Trial \u2192"}
            </Link>
          </div>

          {/* Business */}
          <div className="border border-sf-border rounded-[6px] bg-sf-surface-1 p-5 text-center">
            <p className="font-heading text-[15px] font-semibold tracking-tight text-sf-text-primary">
              Business
            </p>
            <div className="mt-4 flex items-baseline justify-center gap-1.5">
              <span className="font-mono text-[32px] font-bold text-sf-text-primary leading-none">$189</span>
              <span className="text-[14px] text-sf-text-secondary">/ month</span>
            </div>
            <p className="mt-3 text-[13px] text-sf-text-secondary">
              For busier shops. More minutes, multiple users, priority support.
            </p>
            <ul className="mt-4 space-y-1.5 text-left text-[12px] text-sf-text-secondary">
              <li className="flex items-center gap-1.5"><Check size={12} className="text-sf-accent shrink-0" /> Everything in Pro</li>
              <li className="flex items-center gap-1.5"><Check size={12} className="text-sf-accent shrink-0" /> AI receptionist — 350 min/mo included <span className="text-[9px] uppercase tracking-wider font-semibold text-sf-accent bg-sf-accent/10 px-1 py-0.5 rounded">New</span></li>
              <li className="flex items-center gap-1.5"><Check size={12} className="text-sf-accent shrink-0" /> Multi-user (up to 3 seats)</li>
              <li className="flex items-center gap-1.5"><Check size={12} className="text-sf-accent shrink-0" /> Priority support</li>
            </ul>
            <Link
              href="/signup?plan=business"
              className="btn-press mt-5 w-full inline-flex items-center justify-center h-[40px] border border-sf-accent text-sf-accent text-[13px] font-medium rounded-[4px] transition-colors duration-120 hover:bg-sf-accent hover:text-white"
            >
              Start Free Trial
            </Link>
          </div>
        </div>

        <p className="mt-6 text-[13px] text-sf-text-tertiary text-center">
          All plans include a free trial. No credit card required.
        </p>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="bg-sf-surface-2 py-14 md:py-16">
        <div className="max-w-[680px] lg:max-w-5xl mx-auto px-4 text-center">
          <h2 className="font-heading text-[22px] md:text-[24px] font-semibold tracking-tight text-sf-text-primary text-balance">
            How many quotes went cold this month?
          </h2>
          <p className="mt-4 text-[15px] text-sf-text-secondary leading-relaxed max-w-[440px] mx-auto">
            {"Try QuotArc on your next 10 quotes. If it doesn\u2019t pay for itself, cancel. You won\u2019t."}
          </p>
          <Link
            href="/signup"
            className="btn-press mt-6 inline-flex items-center h-[44px] px-5 bg-sf-accent hover:bg-sf-accent-hover text-white text-[14px] font-medium rounded-[6px] transition-colors duration-120"
          >
            Start Free Trial
          </Link>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-sf-border bg-sf-surface-1">
        <div className="max-w-[680px] lg:max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="text-[13px] text-sf-text-tertiary">
            {"\u00A9 2026 QuotArc"}
          </span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-[13px] text-sf-text-tertiary hover:text-sf-text-secondary transition-colors duration-120">Privacy</Link>
            <Link href="/terms" className="text-[13px] text-sf-text-tertiary hover:text-sf-text-secondary transition-colors duration-120">Terms</Link>
            <Link href="/contact" className="text-[13px] text-sf-text-tertiary hover:text-sf-text-secondary transition-colors duration-120">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ─── Sub-components ─── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-sf-accent">
      {children}
    </p>
  )
}

function LedgerRow({
  label,
  value,
  labelClass = '',
  valueClass = 'text-sf-text-primary',
}: {
  label: string
  value: string
  labelClass?: string
  valueClass?: string
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={`text-sf-text-secondary ${labelClass}`}>{label}</span>
      <span className={`text-right ${valueClass}`}>{value}</span>
    </div>
  )
}

function Step({
  number,
  title,
  children,
}: {
  number: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 lg:flex-col lg:gap-2">
      <span className="font-mono text-[28px] font-bold text-sf-accent leading-none mt-0.5 shrink-0">
        {number}
      </span>
      <div>
        <p className="text-[15px] font-semibold text-sf-text-primary">{title}</p>
        <p className="mt-1.5 text-[14px] text-sf-text-secondary leading-relaxed">{children}</p>
      </div>
    </div>
  )
}
