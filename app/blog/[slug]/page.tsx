import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAllPosts, getPost } from '@/lib/blog'
import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return getAllPosts().map(p => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return {}
  return {
    title: `${post.title} — QuotArc Blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
    },
  }
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

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      {/* Back link */}
      <Link
        href="/blog"
        className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors mb-8"
      >
        <ArrowLeft size={13} />
        All posts
      </Link>

      {/* Post header */}
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${CATEGORY_COLORS[post.category] ?? 'bg-sf-surface-2 text-sf-text-tertiary'}`}>
            {post.category}
          </span>
          <span className="text-[11px] text-[var(--color-muted-foreground)]">{post.readTime}</span>
        </div>
        <h1 className="font-heading text-[28px] sm:text-[34px] font-bold text-[var(--color-foreground)] leading-tight tracking-tight">
          {post.title}
        </h1>
        <p className="mt-3 text-[16px] text-[var(--color-muted-foreground)] leading-relaxed">
          {post.description}
        </p>
        <p className="mt-3 text-[12px] text-[var(--color-muted-foreground)]">
          {formatDate(post.date)}
        </p>
      </header>

      {/* MDX Content */}
      <article className="prose-blog">
        <MDXRemote
          source={post.content}
          options={{
            mdxOptions: {
              remarkPlugins: [remarkGfm],
            },
          }}
        />
      </article>

      {/* CTA */}
      <div className="mt-12 rounded-[12px] bg-sf-accent/10 border border-sf-accent/20 p-6">
        <h3 className="font-heading text-[20px] font-semibold text-[var(--color-foreground)]">
          Try QuotArc free — no credit card required
        </h3>
        <p className="mt-2 text-[14px] text-[var(--color-muted-foreground)]">
          Quotes, invoices, scheduling, and an AI receptionist that answers calls 24/7. Built for electrical and service contractors.
        </p>
        <Link
          href="/signup"
          className="mt-4 inline-flex items-center h-10 px-5 rounded-[8px] bg-sf-accent text-white font-medium text-[14px] hover:opacity-90 transition-opacity"
        >
          Get started free →
        </Link>
      </div>
    </main>
  )
}
