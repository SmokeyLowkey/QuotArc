import Link from 'next/link'
import { getAllPosts } from '@/lib/blog'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blog — QuotArc',
  description: 'Guides, templates, and tips for electrical contractors and service businesses.',
}

const CATEGORY_COLORS: Record<string, string> = {
  'Templates': 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  'Software': 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  'Guide': 'bg-green-500/10 text-green-600 dark:text-green-400',
  'Business': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'Comparison': 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function BlogPage() {
  const posts = getAllPosts()

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-10">
        <h1 className="font-heading text-[32px] sm:text-[40px] font-bold text-[var(--color-foreground)] tracking-tight leading-tight">
          Resources for Contractors
        </h1>
        <p className="mt-3 text-[16px] text-[var(--color-muted-foreground)] max-w-xl">
          Templates, software guides, and business tips for electricians and service contractors.
        </p>
      </div>

      {/* Post grid */}
      {posts.length === 0 ? (
        <p className="text-[var(--color-muted-foreground)]">No posts yet.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {posts.map(post => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group block bg-[var(--color-card)] border border-[var(--color-border)] rounded-[10px] p-5 hover:border-sf-accent/40 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${CATEGORY_COLORS[post.category] ?? 'bg-sf-surface-2 text-sf-text-tertiary'}`}>
                  {post.category}
                </span>
                <span className="text-[11px] text-[var(--color-muted-foreground)]">{post.readTime}</span>
              </div>
              <h2 className="font-heading text-[17px] font-semibold text-[var(--color-foreground)] leading-snug group-hover:text-sf-accent transition-colors">
                {post.title}
              </h2>
              <p className="mt-2 text-[13px] text-[var(--color-muted-foreground)] leading-relaxed line-clamp-2">
                {post.description}
              </p>
              <p className="mt-3 text-[11px] text-[var(--color-muted-foreground)]">
                {formatDate(post.date)}
              </p>
            </Link>
          ))}
        </div>
      )}

      {/* CTA banner */}
      <div className="mt-12 rounded-[12px] bg-sf-accent/10 border border-sf-accent/20 p-6 text-center">
        <h3 className="font-heading text-[20px] font-semibold text-[var(--color-foreground)]">
          Ready to streamline your contracting business?
        </h3>
        <p className="mt-2 text-[14px] text-[var(--color-muted-foreground)]">
          QuotArc handles quotes, invoices, scheduling, and your AI phone receptionist — all in one place.
        </p>
        <Link
          href="/signup"
          className="mt-4 inline-flex items-center h-10 px-5 rounded-[8px] bg-sf-accent text-white font-medium text-[14px] hover:opacity-90 transition-opacity"
        >
          Start free →
        </Link>
      </div>
    </main>
  )
}
