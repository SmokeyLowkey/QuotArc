'use client'

import { useState } from 'react'

const SUBJECTS = [
  'General question',
  'Billing or subscription',
  'Technical issue',
  'Feature request',
  'Partnership or press',
  'Other',
]

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong.')
        setStatus('error')
      } else {
        setStatus('success')
      }
    } catch {
      setErrorMsg('Network error. Please try again.')
      setStatus('error')
    }
  }

  const inputClass =
    'w-full rounded-md border border-sf-border bg-sf-surface-1 px-3 py-2 text-[14px] text-sf-text-primary placeholder:text-sf-text-tertiary focus:outline-none focus:ring-2 focus:ring-sf-accent/40 focus:border-sf-accent transition-colors duration-120'

  return (
    <div className="min-h-screen bg-sf-surface-0">
      <div className="max-w-[560px] mx-auto px-4 py-16">
        <h1 className="font-heading text-[28px] font-semibold text-sf-text-primary mb-2">Contact us</h1>
        <p className="text-[14px] text-sf-text-tertiary mb-10">
          We typically reply within one business day.
        </p>

        {status === 'success' ? (
          <div className="rounded-lg border border-sf-border bg-sf-surface-1 p-8 text-center">
            <div className="text-[32px] mb-3">&#10003;</div>
            <h2 className="font-heading text-[18px] font-semibold text-sf-text-primary mb-2">Message sent</h2>
            <p className="text-[14px] text-sf-text-secondary">
              Thanks for reaching out. We&rsquo;ll get back to you at <strong>{form.email}</strong>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-[13px] font-medium text-sf-text-secondary mb-1.5">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  placeholder="Your name"
                  value={form.name}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-[13px] font-medium text-sf-text-secondary mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="subject" className="block text-[13px] font-medium text-sf-text-secondary mb-1.5">
                Subject
              </label>
              <select
                id="subject"
                name="subject"
                required
                value={form.subject}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="" disabled>Select a topic</option>
                {SUBJECTS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="message" className="block text-[13px] font-medium text-sf-text-secondary mb-1.5">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={6}
                placeholder="How can we help?"
                value={form.message}
                onChange={handleChange}
                className={`${inputClass} resize-none`}
              />
            </div>

            {status === 'error' && (
              <p className="text-[13px] text-red-500">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full rounded-md bg-sf-accent px-4 py-2.5 text-[14px] font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity duration-120"
            >
              {status === 'loading' ? 'Sending…' : 'Send message'}
            </button>

            <p className="text-[12px] text-sf-text-tertiary text-center">
              Or email us directly at{' '}
              <a href="mailto:contact@quotarc.com" className="text-sf-accent hover:underline">
                contact@quotarc.com
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
