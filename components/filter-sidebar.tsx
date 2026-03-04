'use client'

import { useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'

export interface FilterOption {
  id: string
  label: string
}

interface FilterSidebarProps {
  filters: FilterOption[]
  activeFilter: string
  onFilterChange: (id: string) => void
  counts?: Record<string, number>
  className?: string
}

export function FilterSidebar({
  filters,
  activeFilter,
  onFilterChange,
  counts,
  className,
}: FilterSidebarProps) {
  return (
    <>
      {/* Desktop — persistent aside */}
      <aside className={cn('hidden lg:flex flex-col gap-0.5 w-44 shrink-0', className)}>
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => onFilterChange(f.id)}
            className={cn(
              'w-full flex items-center justify-between px-2.5 py-2 rounded-[4px] text-[13px] font-medium transition-colors duration-120 text-left',
              activeFilter === f.id
                ? 'bg-sf-accent/10 text-sf-accent'
                : 'text-sf-text-secondary hover:bg-sf-surface-2 hover:text-sf-text-primary',
            )}
          >
            <span>{f.label}</span>
            {counts?.[f.id] !== undefined && (
              <span className={cn(
                'text-[11px] font-mono tabular-nums',
                activeFilter === f.id ? 'text-sf-accent/70' : 'text-sf-text-tertiary',
              )}>
                {counts[f.id]}
              </span>
            )}
          </button>
        ))}
      </aside>

      {/* Mobile — drawer trigger button */}
      <MobileFilterDrawer
        filters={filters}
        activeFilter={activeFilter}
        onFilterChange={onFilterChange}
        counts={counts}
      />
    </>
  )
}

function MobileFilterDrawer({
  filters,
  activeFilter,
  onFilterChange,
  counts,
}: Omit<FilterSidebarProps, 'className'>) {
  const [open, setOpen] = useState(false)
  const activeLabel = filters.find(f => f.id === activeFilter)?.label ?? 'All'

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="bottom">
      <DrawerTrigger asChild>
        <button className="lg:hidden inline-flex items-center gap-1.5 h-8 px-3 border border-sf-border rounded-[4px] text-[13px] font-medium text-sf-text-secondary hover:bg-sf-surface-2 transition-colors">
          <SlidersHorizontal size={13} strokeWidth={1.5} />
          {activeLabel}
          {counts?.[activeFilter] !== undefined && (
            <span className="text-sf-text-tertiary text-[12px]">({counts[activeFilter]})</span>
          )}
        </button>
      </DrawerTrigger>
      <DrawerContent className="bg-sf-surface-0 border-t border-sf-border">
        <DrawerHeader className="flex-row items-center justify-between py-3 px-4 border-b border-sf-border">
          <DrawerTitle className="text-[14px] font-semibold text-sf-text-primary">Filter</DrawerTitle>
          <DrawerClose asChild>
            <button className="text-sf-text-tertiary hover:text-sf-text-secondary">
              <X size={16} strokeWidth={1.5} />
            </button>
          </DrawerClose>
        </DrawerHeader>
        <div className="px-4 py-3 flex flex-col gap-0.5 pb-8">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => { onFilterChange(f.id); setOpen(false) }}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2.5 rounded-[4px] text-[14px] font-medium transition-colors text-left',
                activeFilter === f.id
                  ? 'bg-sf-accent/10 text-sf-accent'
                  : 'text-sf-text-secondary hover:bg-sf-surface-2',
              )}
            >
              <span>{f.label}</span>
              {counts?.[f.id] !== undefined && (
                <span className={cn(
                  'text-[12px] font-mono',
                  activeFilter === f.id ? 'text-sf-accent/70' : 'text-sf-text-tertiary',
                )}>
                  {counts[f.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
