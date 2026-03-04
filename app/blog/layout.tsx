import Link from 'next/link'

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      {/* Minimal nav */}
      <nav className="border-b border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-heading text-[16px] font-bold text-[var(--color-foreground)] tracking-tight">
            Quot<span className="text-sf-accent">Arc</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/blog" className="text-[13px] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors">
              Blog
            </Link>
            <Link
              href="/login"
              className="text-[13px] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="h-8 px-3.5 rounded-[6px] bg-sf-accent text-white text-[13px] font-medium flex items-center hover:opacity-90 transition-opacity"
            >
              Try free
            </Link>
          </div>
        </div>
      </nav>

      {children}

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] mt-16">
        <div className="max-w-4xl mx-auto px-4 py-8 flex items-center justify-between">
          <span className="text-[12px] text-[var(--color-muted-foreground)]">
            © {new Date().getFullYear()} QuotArc. All rights reserved.
          </span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-[12px] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">Privacy</Link>
            <Link href="/terms" className="text-[12px] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
