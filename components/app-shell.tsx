'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  FileText,
  Receipt,
  Users,
  Settings,
  Briefcase,
  PhoneIncoming,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/use-user'
import { PLANS, type PlanTier } from '@/lib/plans'
import { NotificationBell } from '@/components/notification-bell'
import { ThemeToggle } from '@/components/theme-toggle'

const navItems = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/quotes', label: 'Quotes', icon: FileText },
  { href: '/invoices', label: 'Invoices', icon: Receipt },
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/leads', label: 'Leads', icon: PhoneIncoming },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const { profile, initials, signOut, loading } = useUser()

  const displayName = profile?.company_name || 'My Company'

  return (
    <div className="flex h-dvh overflow-hidden bg-sf-surface-0">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-sf-border bg-sf-surface-0 transition-[width] duration-200 ease-out',
          collapsed ? 'w-12' : 'w-[220px]'
        )}
      >
        {/* Logo + Bell */}
        <div className={cn(
          'flex items-center h-12 border-b border-sf-border shrink-0',
          collapsed ? 'justify-center px-0' : 'justify-between px-3'
        )}>
          {!collapsed ? (
            <Link href="/home" className="flex items-center gap-1.5 font-heading text-[16px] font-semibold tracking-tight">
              <Image src="/icon-light-32x32.png" alt="QuotArc" width={22} height={22} className="shrink-0 dark:hidden" />
              <Image src="/icon-dark-32x32.png" alt="QuotArc" width={22} height={22} className="shrink-0 hidden dark:block" />
              <span className="text-sf-text-primary">Quot</span>
              <span className="text-sf-accent">Arc</span>
            </Link>
          ) : (
            <Link href="/home" className="flex items-center justify-center">
              <Image src="/icon-light-32x32.png" alt="QuotArc" width={22} height={22} className="dark:hidden" />
              <Image src="/icon-dark-32x32.png" alt="QuotArc" width={22} height={22} className="hidden dark:block" />
            </Link>
          )}
          {!collapsed && (
            <div className="hidden md:block">
              <NotificationBell />
            </div>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-2 px-1.5 flex flex-col gap-0.5">
          {navItems.map(item => {
            const isActive = item.href === '/home'
              ? pathname === '/home'
              : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 h-8 rounded-[4px] transition-colors duration-120 text-[13px] font-medium',
                  collapsed ? 'justify-center px-0' : 'px-2.5',
                  isActive
                    ? 'bg-sf-surface-2 text-sf-text-primary border-l-[3px] border-sf-accent'
                    : 'text-sf-text-secondary hover:bg-sf-surface-2 hover:text-sf-text-primary border-l-[3px] border-transparent'
                )}
              >
                <item.icon size={16} strokeWidth={1.5} className="shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Bottom: User + Sign Out + Collapse Toggle */}
        <div className="border-t border-sf-border px-2 py-2 flex flex-col gap-2">
          {!collapsed && (
            <div className="flex items-center gap-2 px-1">
              <div className="w-7 h-7 rounded-full bg-sf-surface-2 flex items-center justify-center text-[11px] font-semibold text-sf-text-secondary shrink-0">
                {loading ? '...' : initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] text-sf-text-primary font-medium truncate">
                  {loading ? 'Loading...' : displayName}
                </div>
                <div className="text-[11px] text-sf-text-tertiary">
                  {(() => {
                    const tier = (profile?.plan_tier as PlanTier) ?? 'free'
                    const plan = PLANS[tier]
                    return plan.price > 0 ? `${plan.name} · $${plan.price}/mo` : plan.name
                  })()}
                </div>
              </div>
              <button
                onClick={signOut}
                className="shrink-0 text-sf-text-tertiary hover:text-sf-text-secondary transition-colors"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={14} strokeWidth={1.5} />
              </button>
            </div>
          )}
          {collapsed && (
            <div className="flex justify-center">
              <div className="w-7 h-7 rounded-full bg-sf-surface-2 flex items-center justify-center text-[11px] font-semibold text-sf-text-secondary">
                {loading ? '...' : initials}
              </div>
            </div>
          )}
          <ThemeToggle collapsed={collapsed} />
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center h-6 rounded-[4px] text-sf-text-tertiary hover:text-sf-text-secondary hover:bg-sf-surface-2 transition-colors duration-120"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={14} strokeWidth={1.5} /> : <ChevronLeft size={14} strokeWidth={1.5} />}
          </button>
        </div>
      </aside>

      {/* Mobile notification bell */}
      <div className="md:hidden fixed top-2 right-2 z-40 w-8 h-8 flex items-center justify-center rounded-full bg-sf-surface-1 border border-sf-border shadow-sm">
        <NotificationBell />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-11 pb-14 md:pt-0 md:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-sf-surface-0 border-t border-sf-border flex items-center justify-around z-50">
        {navItems.map(item => {
          const isActive = item.href === '/home'
            ? pathname === '/home'
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center h-full w-full transition-colors',
                isActive ? 'text-sf-accent' : 'text-sf-text-tertiary'
              )}
            >
              <item.icon size={20} strokeWidth={1.5} />
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
