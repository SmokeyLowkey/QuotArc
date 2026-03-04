'use client'

import Link from 'next/link'
import type { ElementType } from 'react'
import {
  Plus,
  TrendingUp,
  DollarSign,
  Receipt,
  Trophy,
  Briefcase,
  ArrowRight,
  AlertCircle,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { useDashboard } from '@/hooks/use-dashboard'
import { useActivity } from '@/hooks/use-activity'
import { ActivityFeed } from '@/components/activity-feed'
import { formatCurrency } from '@/lib/format'

export default function HomePage() {
  const { data, loading } = useDashboard()
  const { events, loading: activityLoading } = useActivity(25)

  const hasChartData = data?.monthlyRevenue.some(m => m.revenue > 0)

  return (
    <div className="px-4 md:px-6 py-4 md:py-6 space-y-5">

      {/* ── Quick Actions ──────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link
          href="/quotes/new"
          className="btn-press flex items-center justify-center gap-2 flex-1 h-11 bg-sf-accent hover:bg-sf-accent-hover text-white text-[14px] font-semibold rounded-[6px] transition-colors duration-120"
        >
          <Plus size={16} strokeWidth={2.5} />
          New Quote
        </Link>
        <Link
          href="/jobs"
          className="btn-press flex items-center gap-1.5 h-11 px-4 border border-sf-border bg-sf-surface-1 hover:bg-sf-surface-2 text-sf-text-secondary text-[13px] font-medium rounded-[6px] transition-colors duration-120 shrink-0"
        >
          Jobs
          <ArrowRight size={13} strokeWidth={1.5} />
        </Link>
        <Link
          href="/invoices"
          className="btn-press flex items-center gap-1.5 h-11 px-4 border border-sf-border bg-sf-surface-1 hover:bg-sf-surface-2 text-sf-text-secondary text-[13px] font-medium rounded-[6px] transition-colors duration-120 shrink-0"
        >
          Invoices
          <ArrowRight size={13} strokeWidth={1.5} />
        </Link>
      </div>

      {/* ── KPI Cards ──────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[94px] bg-sf-surface-1 border border-sf-border rounded-[6px] animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Revenue Collected */}
          <KpiCard
            icon={DollarSign}
            label="Total Collected"
            value={formatCurrency(data.kpis.collectedAllTime)}
            sub={
              data.kpis.collectedThisMonth > 0
                ? `+${formatCurrency(data.kpis.collectedThisMonth)} this month`
                : 'None this month'
            }
            iconColor="text-sf-success"
            iconBg="bg-sf-success/10"
          />

          {/* Outstanding */}
          <KpiCard
            icon={data.kpis.overdueCount > 0 ? AlertCircle : Receipt}
            label="Outstanding"
            value={formatCurrency(data.kpis.outstanding)}
            sub={
              data.kpis.overdueCount > 0
                ? `${data.kpis.overdueCount} overdue · ${formatCurrency(data.kpis.overdueAmount)}`
                : data.kpis.outstanding > 0 ? 'All invoices current' : 'Nothing owed'
            }
            iconColor={data.kpis.overdueCount > 0 ? 'text-sf-danger' : 'text-sf-text-tertiary'}
            iconBg={data.kpis.overdueCount > 0 ? 'bg-sf-danger/10' : 'bg-sf-surface-2'}
          />

          {/* Quotes Won */}
          <KpiCard
            icon={Trophy}
            label="Quotes Won"
            value={formatCurrency(data.kpis.revenueWon)}
            sub={`${data.kpis.quotesAccepted} accepted · ${data.kpis.acceptanceRate}% rate`}
            iconColor="text-sf-accent"
            iconBg="bg-sf-accent/10"
          />

          {/* Jobs */}
          <KpiCard
            icon={Briefcase}
            label="Active Jobs"
            value={String(data.kpis.jobsScheduled + data.kpis.jobsInProgress)}
            sub={
              data.kpis.jobsInProgress > 0
                ? `${data.kpis.jobsInProgress} in progress · ${data.kpis.jobsCompletedThisMonth} done this month`
                : `${data.kpis.jobsCompletedThisMonth} completed this month`
            }
            iconColor="text-sf-info"
            iconBg="bg-sf-info/10"
          />
        </div>
      ) : null}

      {/* ── Revenue Chart ──────────────────────────────── */}
      {data && (
        <div className="bg-sf-surface-1 border border-sf-border rounded-[6px] p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[13px] font-semibold text-sf-text-primary">Monthly Revenue</h2>
              <p className="text-[11px] text-sf-text-tertiary mt-0.5">
                Paid invoices · Last 6 months
                {data.kpis.collectedAllTime > 0 && (
                  <span className="ml-1.5 text-sf-success font-mono">
                    {formatCurrency(data.kpis.collectedAllTime)} total
                  </span>
                )}
              </p>
            </div>
            <TrendingUp size={15} strokeWidth={1.5} className="text-sf-text-tertiary" />
          </div>

          {hasChartData ? (
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.monthlyRevenue}
                  barSize={32}
                  margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="rgba(160,154,147,0.12)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: '#a09a93' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#a09a93' }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    tickFormatter={(v: number) =>
                      v === 0 ? '$0' : v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                    }
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(160,154,147,0.08)' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div
                          style={{
                            background: 'var(--color-sf-surface-1)',
                            border: '1px solid var(--color-sf-border)',
                            borderRadius: 6,
                            padding: '8px 12px',
                          }}
                        >
                          <div style={{ fontSize: 11, color: '#a09a93', marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace', color: 'var(--color-sf-text-primary)' }}>
                            {formatCurrency(payload[0].value as number)}
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="revenue" fill="#e07a2f" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center">
              <p className="text-[13px] text-sf-text-tertiary">No paid invoices yet · Send your first invoice to see revenue here</p>
            </div>
          )}
        </div>
      )}

      {/* ── Quotes Summary ─────────────────────────────── */}
      {data && (
        <div className="grid grid-cols-3 gap-3">
          <MiniStat label="Quotes Sent" value={String(data.kpis.quotesSent)} />
          <MiniStat label="Acceptance Rate" value={`${data.kpis.acceptanceRate}%`} accent />
          <MiniStat label="Avg. Won Value" value={data.kpis.avgWonValue > 0 ? formatCurrency(data.kpis.avgWonValue) : '—'} />
        </div>
      )}

      {/* ── Activity Feed ──────────────────────────────── */}
      <div>
        <h2 className="text-[11px] uppercase tracking-[0.05em] font-semibold text-sf-text-secondary mb-3">
          Recent Activity
        </h2>
        {activityLoading ? (
          <div className="py-8 text-center text-sf-text-tertiary text-[13px]">Loading...</div>
        ) : (
          <ActivityFeed events={events} />
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  iconColor,
  iconBg,
}: {
  icon: ElementType
  label: string
  value: string
  sub?: string
  iconColor: string
  iconBg: string
}) {
  return (
    <div className="bg-sf-surface-1 border border-sf-border rounded-[6px] px-3 py-3">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-[5px] flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon size={14} strokeWidth={1.5} className={iconColor} />
        </div>
        <span className="text-[11px] text-sf-text-tertiary font-medium truncate">{label}</span>
      </div>
      <div className="text-[17px] font-semibold text-sf-text-primary font-mono leading-none mb-1">
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-sf-text-tertiary truncate leading-snug">{sub}</div>
      )}
    </div>
  )
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-sf-surface-1 border border-sf-border rounded-[6px] px-3 py-2.5 text-center">
      <div className="text-[11px] text-sf-text-tertiary mb-1">{label}</div>
      <div className={`text-[15px] font-semibold font-mono ${accent ? 'text-sf-accent' : 'text-sf-text-primary'}`}>
        {value}
      </div>
    </div>
  )
}
