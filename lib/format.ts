export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

export function timeAgo(dateStr: string): string {
  if (!dateStr) return ''
  const now = new Date()
  const then = new Date(dateStr)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateStr)
}

export function daysUntil(dateStr: string): string {
  if (!dateStr) return ''
  const now = new Date()
  const then = new Date(dateStr)
  const diffDays = Math.ceil((then.getTime() - now.getTime()) / 86400000)
  if (diffDays < 0) return `${Math.abs(diffDays)} days ago`
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'tomorrow'
  return `in ${diffDays} days`
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10)
}
