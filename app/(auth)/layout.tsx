export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-sf-surface-0 px-4">
      <div className="w-full max-w-[380px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-1">
            <img src="/icon-light-32x32.png" alt="QuotArc" width={28} height={28} className="dark:hidden" />
            <img src="/icon-dark-32x32.png" alt="QuotArc" width={28} height={28} className="hidden dark:block" />
            <h1 className="font-heading text-[24px] font-semibold tracking-tight">
              <span className="text-sf-text-primary">Quot</span>
              <span className="text-sf-accent">Arc</span>
            </h1>
          </div>
          <p className="text-[13px] text-sf-text-secondary mt-1">
            Quote to cash for electricians
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
