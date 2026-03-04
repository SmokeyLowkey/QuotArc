'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

const themes = [
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'system', icon: Monitor, label: 'System' },
] as const

export function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const cycle = () => {
    const idx = themes.findIndex(t => t.value === theme)
    setTheme(themes[(idx + 1) % themes.length].value)
  }

  const current = themes.find(t => t.value === theme) ?? themes[0]
  const Icon = mounted ? current.icon : Moon

  return (
    <button
      type="button"
      onClick={cycle}
      className={cn(
        'flex items-center h-6 rounded-[4px] text-sf-text-tertiary hover:text-sf-text-secondary hover:bg-sf-surface-2 transition-colors duration-120',
        collapsed ? 'justify-center w-full' : 'gap-2 px-2 w-full'
      )}
      aria-label={mounted ? `${current.label} theme` : 'Toggle theme'}
      title={mounted ? `${current.label} theme` : 'Toggle theme'}
    >
      <Icon size={14} strokeWidth={1.5} className="shrink-0" />
      {!collapsed && (
        <span className="text-[11px]">{mounted ? current.label : 'Dark'}</span>
      )}
    </button>
  )
}
