'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={(resolvedTheme === 'dark' ? 'dark' : 'light') as ToasterProps['theme']}
      position="bottom-right"
      duration={3000}
      className="toaster group"
      toastOptions={{
        style: {
          background: 'var(--surface-1)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          fontSize: '13px',
          fontFamily: 'var(--font-sans)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
