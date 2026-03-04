import { cn } from '@/lib/utils'

export interface MetricItem {
  label: string
  value: string
  variant?: 'default' | 'danger' | 'success' | 'accent'
}

interface MetricStripProps {
  items: MetricItem[]
  className?: string
}

export function MetricStrip({ items, className }: MetricStripProps) {
  return (
    <>
      {/* Desktop: horizontal inline row */}
      <div className={cn(
        'hidden md:flex items-center gap-4 md:gap-6 py-2 border-b border-sf-border overflow-x-auto text-nowrap mb-4',
        className,
      )}>
        {items.map((item, i) => (
          <span key={item.label} className="contents">
            <MetricCell item={item} />
            {i < items.length - 1 && <span className="text-sf-border">|</span>}
          </span>
        ))}
      </div>

      {/* Mobile: 2-column card grid */}
      <div className={cn('md:hidden grid grid-cols-2 gap-2 mb-4', className)}>
        {items.map(item => (
          <div key={item.label} className="bg-sf-surface-1 border border-sf-border rounded-[6px] px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary mb-0.5">
              {item.label}
            </div>
            <div className={cn(
              'font-mono text-[15px] font-semibold',
              item.variant === 'danger' && 'text-sf-danger',
              item.variant === 'success' && 'text-sf-success',
              item.variant === 'accent' && 'text-sf-accent',
              (!item.variant || item.variant === 'default') && 'text-sf-text-primary',
            )}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function MetricCell({ item }: { item: MetricItem }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary">
        {item.label}:
      </span>
      <span className={cn(
        'font-mono text-[14px] font-medium',
        item.variant === 'danger' && 'text-sf-danger',
        item.variant === 'success' && 'text-sf-success',
        item.variant === 'accent' && 'text-sf-accent',
        (!item.variant || item.variant === 'default') && 'text-sf-text-primary',
      )}>
        {item.value}
      </span>
    </div>
  )
}
