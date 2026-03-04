import { CheckCircle2, XCircle } from 'lucide-react'
import { VerifySuccess } from './verify-success'

export default async function VerifyTokenPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  let success = false
  let message = ''

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/verify-email`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        cache: 'no-store',
      }
    )
    const data = await res.json()

    if (res.ok) {
      success = true
      message = data.message || 'Your email has been verified!'
    } else {
      message = data.error || 'Verification failed'
    }
  } catch {
    message = 'Something went wrong. Please try again.'
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-sf-surface-0 px-4">
      <div className="w-full max-w-[380px] text-center">
        {/* Logo */}
        <div className="mb-8">
          <h1 className="font-heading text-[24px] font-semibold tracking-tight">
            <span className="text-sf-text-primary">Quot</span>
            <span className="text-sf-accent">Arc</span>
          </h1>
        </div>

        {success ? (
          <VerifySuccess message={message} />
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <XCircle size={24} strokeWidth={1.5} className="text-red-500" />
            </div>
            <h2 className="text-[18px] font-semibold text-sf-text-primary mb-2">
              Verification failed
            </h2>
            <p className="text-[13px] text-sf-text-secondary mb-6">
              {message}
            </p>
            <a
              href="/verify-email"
              className="btn-press inline-flex items-center justify-center h-10 w-full bg-sf-surface-2 border border-sf-border hover:bg-sf-surface-3 text-sf-text-primary text-[14px] font-medium rounded-[4px] transition-colors duration-120"
            >
              Request a new verification link
            </a>
          </>
        )}
      </div>
    </div>
  )
}
