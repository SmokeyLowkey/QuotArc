'use client'

import type { QuickReplyTemplate } from '@/lib/types'

interface QuickReplyBarProps {
  templates: QuickReplyTemplate[]
  onSelect: (body: string) => void
}

export function QuickReplyBar({ templates, onSelect }: QuickReplyBarProps) {
  if (!templates.length) return null

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {templates.map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect(t.body)}
          className="shrink-0 px-2.5 h-7 rounded-full border border-sf-border bg-sf-surface-1 text-[11px] font-medium text-sf-text-secondary hover:bg-sf-surface-2 hover:text-sf-text-primary transition-colors"
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/** Default templates seeded when user has none */
export const DEFAULT_TEMPLATES: QuickReplyTemplate[] = [
  { id: 'omw', label: 'On my way!', body: 'Hey {customer_name}, I\'m on my way now.' },
  { id: 'arrived', label: 'Arrived', body: 'Hi {customer_name}, I\'ve arrived at the job site.' },
  { id: 'complete', label: 'Job complete', body: 'Good news — the work is done! Everything tested and working.' },
  { id: 'materials', label: 'Materials ready', body: 'Materials for your {job_type} have arrived. Ready to schedule.' },
  { id: 'schedule', label: 'Schedule?', body: 'Hi {customer_name}, when works best to start the {job_type}?' },
  { id: 'thanks', label: 'Thank you!', body: 'Thanks for choosing {company_name}! Let me know if you need anything.' },
]
